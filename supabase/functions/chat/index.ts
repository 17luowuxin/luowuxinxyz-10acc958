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
    
    // 获取预设、世界书和记忆摘要
    let presetsContent = '';
    let worldBooksContent = '';
    let memoryContent = '';
    
    if (userId && characterId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // 获取该角色的预设（角色专属 + 无角色关联的通用预设）
      const { data: presets } = await supabase
        .from('presets')
        .select('name, content')
        .eq('user_id', userId)
        .or(`character_id.eq.${characterId},character_id.is.null`);
      
      if (presets && presets.length > 0) {
        presetsContent = '\n【预设指令】\n' + presets.map(p => `【${p.name}】\n${p.content}`).join('\n\n');
        console.log('Presets loaded:', presets.length);
      }
      
      // 获取世界书（全局 + 角色专属）
      const { data: globalWorldBooks } = await supabase
        .from('world_books')
        .select('name, content')
        .eq('user_id', userId)
        .eq('is_global', true);
      
      const { data: charWorldBooks } = await supabase
        .from('world_books')
        .select('name, content')
        .eq('user_id', userId)
        .eq('character_id', characterId);
      
      const allWorldBooks = [...(globalWorldBooks || []), ...(charWorldBooks || [])];
      if (allWorldBooks.length > 0) {
        worldBooksContent = '\n【世界设定】\n' + allWorldBooks.map(w => `【${w.name}】\n${w.content}`).join('\n\n');
        console.log('World books loaded:', allWorldBooks.length);
      }
      
      // 获取角色记忆摘要
      const { data: memory } = await supabase
        .from('character_memories')
        .select('summary')
        .eq('character_id', characterId)
        .eq('user_id', userId)
        .maybeSingle();
      
      if (memory?.summary) {
        memoryContent = `\n【关于用户的记忆】\n${memory.summary}`;
        console.log('Memory loaded for character:', characterId);
      }
    }
    
    let apiKey: string | undefined;
    let apiUrl: string;
    let model: string;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    
    // Check user's API settings from database
    let useDefaultApi = false;
    let hasCustomApiConfig = false;
    let savedCustomKey = '';
    let savedBaseUrl = '';
    let savedModel = '';
    
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
        const customKeySetting = apiSettings.find(s => s.provider === 'custom');
        const baseUrlSetting = apiSettings.find(s => s.provider === 'custom_base_url');
        const modelSetting = apiSettings.find(s => s.provider === 'custom_model');
        
        if (defaultApiSetting && defaultApiSetting.api_key === 'true') {
          useDefaultApi = true;
        }
        if (customKeySetting) {
          savedCustomKey = customKeySetting.api_key;
          hasCustomApiConfig = true;
        }
        if (baseUrlSetting) {
          savedBaseUrl = baseUrlSetting.api_key;
        }
        if (modelSetting) {
          savedModel = modelSetting.api_key;
        }
      }
    }
    
    // 优先级：用户自定义API > 默认API（仅当用户明确选择时）
    // 如果用户配置了自定义API，必须使用用户的，不自动fallback
    
    if (hasCustomApiConfig && !useDefaultApi) {
      // 用户配置了自定义API且没有选择使用默认API，使用用户的配置
      const finalApiKey = userApiKey || savedCustomKey;
      const finalBaseUrl = baseUrl || savedBaseUrl;
      const finalModel = customModel || savedModel || 'deepseek-chat';
      
      if (!finalApiKey) {
        console.error("User has custom API config but no API key");
        return new Response(JSON.stringify({ error: "请先在设置中配置API密钥" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      apiKey = finalApiKey;
      let finalUrl = finalBaseUrl.trim().replace(/\/+$/, '');
      
      // 智能处理URL格式
      if (finalUrl.endsWith('/chat/completions')) {
        apiUrl = finalUrl;
      } else if (finalUrl.endsWith('/v1')) {
        apiUrl = `${finalUrl}/chat/completions`;
      } else if (finalUrl.includes('/v1/')) {
        apiUrl = finalUrl.replace(/\/v1\/.*$/, '/v1/chat/completions');
      } else {
        apiUrl = `${finalUrl}/v1/chat/completions`;
      }
      
      model = finalModel;
      headers["Authorization"] = `Bearer ${apiKey}`;
      console.log("Using user's custom API:", apiUrl);
      console.log("Model:", model);
      
    } else if (useDefaultApi) {
      // 用户明确选择使用默认API
      apiKey = Deno.env.get("DEFAULT_DEEPSEEK_API_KEY");
      if (apiKey) {
        apiUrl = "https://api.deepseek.com/v1/chat/completions";
        model = "deepseek-chat";
        headers["Authorization"] = `Bearer ${apiKey}`;
        console.log("Using default DeepSeek API (user selected)");
      } else {
        // 默认API不可用时提示用户
        return new Response(JSON.stringify({ error: "默认API暂不可用，请配置自定义API" }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (userApiKey && provider) {
      // 前端传来的临时配置
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
        
        if (finalUrl.endsWith('/chat/completions')) {
          apiUrl = finalUrl;
        } else if (finalUrl.endsWith('/v1')) {
          apiUrl = `${finalUrl}/chat/completions`;
        } else if (finalUrl.includes('/v1/')) {
          apiUrl = finalUrl.replace(/\/v1\/.*$/, '/v1/chat/completions');
        } else {
          apiUrl = `${finalUrl}/v1/chat/completions`;
        }
        
        model = customModel || "deepseek-chat";
        headers["Authorization"] = `Bearer ${apiKey}`;
        console.log("Using custom API from request:", apiUrl);
      } else {
        return new Response(JSON.stringify({ error: "请先在设置中配置API" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // 没有任何配置，提示用户去设置
      return new Response(JSON.stringify({ error: "请先在设置中配置API密钥" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
${memoryContent}

【关于你的聊天对象】
你正在和"${userName}"聊天。${userPersonaInfo ? `关于${userName}: ${userPersonaInfo}` : ''}
记住要用"${userName}"称呼对方，不要随便给对方取别的名字或昵称。

请严格按照上述角色人设来回复用户，保持角色的性格特点、说话方式和语气。
回复要简洁自然，像真实朋友聊天一样，同时体现角色的独特个性。
如果角色人设中有特定的口头禅或说话习惯，请在对话中自然地使用。
如果你记住了关于用户的一些信息，请自然地运用这些记忆，但不要刻意提及"我记得..."。`;

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
