import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, persona, characterName, characterId, userApiKey, provider, baseUrl, model: customModel, userProfile, userId } = await req.json();
    
    // 获取预设和世界书
    let presetsContent = '';
    let worldBooksContent = '';
    
    if (userId && characterId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // 获取该角色的预设
      const { data: presets } = await supabase
        .from('presets')
        .select('name, content')
        .eq('user_id', userId)
        .or(`character_id.eq.${characterId},character_id.is.null`);
      
      if (presets && presets.length > 0) {
        presetsContent = '\n【可用预设】\n' + presets.map(p => `- ${p.name}: ${p.content}`).join('\n');
      }
      
      // 获取全局世界书
      const { data: worldBooks } = await supabase
        .from('world_books')
        .select('name, content')
        .eq('user_id', userId)
        .eq('is_global', true);
      
      if (worldBooks && worldBooks.length > 0) {
        worldBooksContent = '\n【世界设定】\n' + worldBooks.map(w => `${w.name}: ${w.content}`).join('\n');
      }
    }
    
    let apiKey: string | undefined;
    let apiUrl: string;
    let model: string;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    
    // Check if using default API
    let useDefaultApi = false;
    let defaultModel = 'deepseek-chat';
    if (userId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { data: apiSettings } = await supabase
        .from('api_keys')
        .select('provider, api_key')
        .eq('user_id', userId);
      
      if (apiSettings) {
        const defaultApiSetting = apiSettings.find(s => s.provider === 'use_default_api');
        if (defaultApiSetting && defaultApiSetting.api_key === 'true') {
          useDefaultApi = true;
        }
        const defaultModelSetting = apiSettings.find(s => s.provider === 'default_model');
        if (defaultModelSetting) {
          defaultModel = defaultModelSetting.api_key;
        }
      }
    }
    
    // Priority: default API > user's custom API key > Lovable AI
    if (useDefaultApi) {
      // Use the default Tensdaq API key stored in secrets
      apiKey = Deno.env.get("DEFAULT_TENSDAQ_API_KEY");
      apiUrl = "https://tensdaq-api.x-aio.com/chat/completions";
      model = defaultModel;
      headers["Authorization"] = `Bearer ${apiKey}`;
      console.log("Using default Tensdaq API with model:", model);
    } else if (userApiKey && provider) {
      if (provider === 'deepseek') {
        apiKey = userApiKey;
        apiUrl = "https://api.deepseek.com/v1/chat/completions";
        model = "deepseek-chat";
        headers["Authorization"] = `Bearer ${apiKey}`;
      } else if (provider === 'openai') {
        apiKey = userApiKey;
        apiUrl = "https://api.openai.com/v1/chat/completions";
        model = "gpt-4o-mini";
        headers["Authorization"] = `Bearer ${apiKey}`;
      } else if (provider === 'anthropic') {
        apiKey = userApiKey;
        apiUrl = "https://api.anthropic.com/v1/messages";
        model = "claude-3-haiku-20240307";
        headers["x-api-key"] = userApiKey;
        headers["anthropic-version"] = "2023-06-01";
      } else if (provider === 'custom' && baseUrl) {
        apiKey = userApiKey;
        let finalUrl = baseUrl.trim().replace(/\/+$/, '');
        if (!finalUrl.endsWith('/chat/completions')) {
          finalUrl = `${finalUrl}/chat/completions`;
        }
        apiUrl = finalUrl;
        model = customModel || "deepseek-chat";
        headers["Authorization"] = `Bearer ${apiKey}`;
      } else {
        apiKey = Deno.env.get("LOVABLE_API_KEY");
        apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
        model = "google/gemini-2.5-flash";
        headers["Authorization"] = `Bearer ${apiKey}`;
      }
    } else {
      apiKey = Deno.env.get("LOVABLE_API_KEY");
      apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
      model = "google/gemini-2.5-flash";
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    if (!apiKey) {
      console.error("No API key available");
      return new Response(JSON.stringify({ error: "API密钥未配置" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Using provider:", userApiKey ? provider : "lovable-ai");
    console.log("API URL:", apiUrl);

    const userName = userProfile?.nickname || '用户';
    const userPersonaInfo = userProfile?.persona || '';

    const systemPrompt = `你是一个名叫"${characterName || '小助手'}"的虚拟角色。
${persona ? `\n你的角色人设和性格特点如下:\n${persona}\n` : ''}
${worldBooksContent}
${presetsContent}

【关于你的聊天对象】
你正在和"${userName}"聊天。${userPersonaInfo ? `关于${userName}: ${userPersonaInfo}` : ''}
记住要用"${userName}"称呼对方，不要随便给对方取别的名字或昵称。

请严格按照上述角色人设来回复用户，保持角色的性格特点、说话方式和语气。
回复要简洁自然，像真实朋友聊天一样，同时体现角色的独特个性。
如果角色人设中有特定的口头禅或说话习惯，请在对话中自然地使用。`;

    let requestBody: Record<string, unknown>;
    const isAnthropic = provider === 'anthropic' && userApiKey;
    
    if (isAnthropic) {
      requestBody = {
        model,
        max_tokens: 1024,
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role === 'system' ? 'user' : m.role,
          content: m.content,
        })),
        system: systemPrompt,
      };
    } else {
      requestBody = {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      };
    }

    console.log("Sending request to AI...");
    console.log("Request model:", model);
    console.log("API URL:", apiUrl);

    // 添加超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时

    let response: Response;
    try {
      response = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error("Fetch error:", fetchError);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return new Response(JSON.stringify({ error: "请求超时，请重试" }), {
          status: 504,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw fetchError;
    }
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "请求过于频繁，请稍后再试" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "配额已用完，请充值" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 401) {
        return new Response(JSON.stringify({ error: "API密钥无效，请检查配置" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI服务错误: " + errorText.slice(0, 200) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contentType = response.headers.get('content-type') || '';
    console.log("Response content-type:", contentType);
    console.log("Response status:", response.status);

    // 检查是否是流式响应
    if (contentType.includes('text/event-stream')) {
      console.log("AI response received, streaming SSE...");
      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // 非SSE响应 - 读取并解析
    const responseText = await response.text();
    console.log("Response text (first 500 chars):", responseText.slice(0, 500));

    // 尝试解析为JSON
    let content = '';
    try {
      const jsonResponse = JSON.parse(responseText);
      
      // 尝试多种格式提取内容
      if (jsonResponse.choices?.[0]?.message?.content) {
        content = jsonResponse.choices[0].message.content;
      } else if (jsonResponse.choices?.[0]?.delta?.content) {
        content = jsonResponse.choices[0].delta.content;
      } else if (jsonResponse.choices?.[0]?.text) {
        content = jsonResponse.choices[0].text;
      } else if (jsonResponse.content?.[0]?.text) {
        // Claude格式
        content = jsonResponse.content[0].text;
      } else if (jsonResponse.content) {
        content = typeof jsonResponse.content === 'string' ? jsonResponse.content : JSON.stringify(jsonResponse.content);
      } else if (jsonResponse.result) {
        content = typeof jsonResponse.result === 'string' ? jsonResponse.result : JSON.stringify(jsonResponse.result);
      } else if (jsonResponse.output?.text) {
        content = jsonResponse.output.text;
      } else if (jsonResponse.output) {
        content = typeof jsonResponse.output === 'string' ? jsonResponse.output : JSON.stringify(jsonResponse.output);
      } else if (jsonResponse.response) {
        content = typeof jsonResponse.response === 'string' ? jsonResponse.response : JSON.stringify(jsonResponse.response);
      } else if (jsonResponse.data?.choices?.[0]?.message?.content) {
        content = jsonResponse.data.choices[0].message.content;
      } else if (jsonResponse.message) {
        content = typeof jsonResponse.message === 'string' ? jsonResponse.message : JSON.stringify(jsonResponse.message);
      } else if (typeof jsonResponse === 'string') {
        content = jsonResponse;
      }

      if (!content && jsonResponse.error) {
        console.error("API returned error:", jsonResponse.error);
        const errorMsg = typeof jsonResponse.error === 'string' ? jsonResponse.error : (jsonResponse.error.message || JSON.stringify(jsonResponse.error));
        return new Response(JSON.stringify({ error: `API错误: ${errorMsg}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (parseError) {
      console.log("Response is not JSON, treating as plain text");
      // 如果不是JSON，可能是纯文本或其他格式
      content = responseText;
    }

    if (!content) {
      console.error("Could not extract content from response:", responseText.slice(0, 500));
      return new Response(JSON.stringify({ error: "无法解析AI响应，请检查API配置是否正确" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Extracted content (first 100 chars):", content.slice(0, 100));

    // 包装成SSE格式返回给前端
    const sseData = `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\ndata: [DONE]\n\n`;
    return new Response(sseData, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error: unknown) {
    console.error("Chat function error:", error);
    const errorMessage = error instanceof Error ? error.message : "未知错误";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
