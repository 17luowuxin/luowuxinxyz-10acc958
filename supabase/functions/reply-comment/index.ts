import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authErrorResponse, requireUser } from "../_shared/require-user.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface AIConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  provider?: string;
  useDefaultApi?: boolean;
  defaultModel?: string;
}

// 从 Cloud 和 External 两个数据库获取 api_keys，合并结果（外部优先）
async function fetchApiSettings(userId: string) {
  if (!userId) return null;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const cloudClient = createClient(supabaseUrl, supabaseKey);

  const { data: cloudSettings } = await cloudClient
    .from('api_keys')
    .select('provider, api_key')
    .eq('user_id', userId);

  const extUrl = Deno.env.get('EXTERNAL_SUPABASE_URL');
  const extKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY');
  let externalSettings: any[] | null = null;
  if (extUrl && extKey) {
    try {
      const extClient = createClient(extUrl, extKey);
      const { data } = await extClient
        .from('api_keys')
        .select('provider, api_key')
        .eq('user_id', userId);
      externalSettings = data;
    } catch (e) {
      console.warn('Failed to read external api_keys:', e);
    }
  }

  const merged = new Map<string, string>();
  if (cloudSettings) {
    for (const s of cloudSettings) merged.set(s.provider, s.api_key);
  }
  if (externalSettings) {
    for (const s of externalSettings) merged.set(s.provider, s.api_key);
  }

  if (merged.size === 0) return null;
  return merged;
}

async function checkDefaultApiSetting(userId: string): Promise<{ useDefault: boolean; defaultModel: string }> {
  if (!userId) return { useDefault: false, defaultModel: 'deepseek-chat' };
  
  const settings = await fetchApiSettings(userId);
  let useDefault = false;
  let defaultModel = 'deepseek-chat';
  
  if (settings) {
    const defaultApiVal = settings.get('use_default_api');
    if (defaultApiVal === 'true') {
      useDefault = true;
    }
    const defaultModelVal = settings.get('default_model');
    if (defaultModelVal) {
      defaultModel = defaultModelVal;
    }
  }
  return { useDefault, defaultModel };
}

async function getAICompletion(
  messages: Array<{ role: string; content: string }>,
  config: AIConfig
): Promise<string> {
  let apiUrl: string;
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  let model: string;

  // 【关键修复】优先检查用户传递的自定义API配置
  if (config.apiKey && config.provider === 'custom' && config.baseUrl) {
    let baseUrl = config.baseUrl.replace(/\/+$/, '');
    if (!baseUrl.endsWith('/chat/completions')) {
      baseUrl = `${baseUrl}/chat/completions`;
    }
    apiUrl = baseUrl;
    headers['Authorization'] = `Bearer ${config.apiKey}`;
    model = config.model || 'deepseek-chat';
    console.log('Using custom API:', apiUrl, 'model:', model);
  } else if (config.apiKey && config.provider === 'deepseek') {
    apiUrl = 'https://api.deepseek.com/v1/chat/completions';
    headers['Authorization'] = `Bearer ${config.apiKey}`;
    model = 'deepseek-chat';
    console.log('Using DeepSeek API');
  } else if (config.apiKey && config.provider === 'openai') {
    apiUrl = 'https://api.openai.com/v1/chat/completions';
    headers['Authorization'] = `Bearer ${config.apiKey}`;
    model = 'gpt-4o-mini';
    console.log('Using OpenAI API');
  } else if (config.useDefaultApi) {
    // 只有在用户没有配置自定义API时才检查默认API设置
    const defaultKey = Deno.env.get("DEFAULT_DEEPSEEK_API_KEY");
    if (defaultKey) {
      apiUrl = 'https://api.deepseek.com/v1/chat/completions';
      headers['Authorization'] = `Bearer ${defaultKey}`;
      model = 'deepseek-chat';
      console.log('Using default DeepSeek API');
    } else {
      throw new Error("默认API暂不可用，请配置自定义API");
    }
  } else {
    // 没有任何配置，提示用户
    throw new Error("请先在设置中配置API密钥");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  const response = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 2048,
      stream: false,
    }),
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI API error:", response.status, errorText);
    if (response.status === 429) {
      throw new Error("请求太频繁，请稍后再试");
    } else if (response.status === 402) {
      throw new Error("AI额度不足，请充值");
    }
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  
  // 检测是否被截断
  let finishReason = data.choices?.[0]?.finish_reason;
  console.log("Finish reason:", finishReason);
  
  
  let content = '';
  // 尝试多种格式提取内容
  if (data.choices?.[0]?.message?.content) {
    content = data.choices[0].message.content;
  } else if (data.choices?.[0]?.delta?.content) {
    content = data.choices[0].delta.content;
  } else if (data.choices?.[0]?.text) {
    content = data.choices[0].text;
  } else if (data.content) {
    content = data.content;
  } else if (data.result) {
    content = data.result;
  } else if (data.output?.text) {
    content = data.output.text;
  } else if (data.output?.content) {
    content = data.output.content;
  } else if (data.output) {
    content = typeof data.output === 'string' ? data.output : JSON.stringify(data.output);
  } else if (data.response) {
    content = typeof data.response === 'string' ? data.response : JSON.stringify(data.response);
  } else if (data.text) {
    content = data.text;
  } else if (data.answer) {
    content = data.answer;
  } else if (data.message?.content) {
    content = data.message.content;
  } else if (typeof data === 'string') {
    content = data;
  }
  
  
  // 自动续写：如果 finish_reason 是 length，说明被截断了
  let fullContent = content;
  let continueCount = 0;
  const maxContinue = 3;
  
  while (finishReason === 'length' && continueCount < maxContinue && fullContent.length > 0) {
    continueCount++;
    console.log(`Content truncated (finish_reason=length), auto-continuing... attempt ${continueCount}`);
    
    const continueMessages = [
      ...messages,
      { role: "assistant", content: fullContent },
      { role: "user", content: "请接着上文继续写完，不要重复已经说过的内容，直接从断句处继续。" }
    ];
    
    try {
      const continueResponse = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: continueMessages,
          max_tokens: 2048,
          stream: false,
        }),
      });
      
      if (continueResponse.ok) {
        const continueData = await continueResponse.json();
        const newContent = continueData.choices?.[0]?.message?.content || '';
        finishReason = continueData.choices?.[0]?.finish_reason || null;
        
        if (newContent) {
          fullContent += newContent;
          console.log(`Continuation ${continueCount} added ${newContent.length} chars, new finish_reason: ${finishReason}`);
        } else {
          break;
        }
      } else {
        console.error("Continue request failed:", continueResponse.status);
        break;
      }
    } catch (continueError) {
      console.error("Continue request error:", continueError);
      break;
    }
  }
  
  if (!fullContent || fullContent.trim() === '') {
    console.error("Empty content from AI API");
    return '(AI暂时无法回复，请稍后再试)';
  }
  
  console.log(`Final content length: ${fullContent.length} chars, continued ${continueCount} times`);
  
  // 清理内容 - 移除前后空白和多余换行
  return fullContent.trim().replace(/^\n+|\n+$/g, '');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { character, userComment, apiConfig, userId } = await req.json();
    const auth = await requireUser(req, userId);
    if (!auth.ok) return authErrorResponse(auth, corsHeaders);
    
    const apiSetting = userId ? await checkDefaultApiSetting(userId) : { useDefault: false, defaultModel: 'deepseek-chat' };
    
    const config: AIConfig = {
      apiKey: apiConfig?.apiKey,
      baseUrl: apiConfig?.baseUrl,
      model: apiConfig?.model,
      provider: apiConfig?.provider,
      useDefaultApi: apiSetting.useDefault,
      defaultModel: apiSetting.defaultModel,
    };

    // 日志：显示实际使用的API
    const usingCustom = apiConfig?.apiKey && (apiConfig?.provider === 'custom' || apiConfig?.provider === 'deepseek' || apiConfig?.provider === 'openai');
    console.log("API Config received:", { hasApiKey: !!apiConfig?.apiKey, provider: apiConfig?.provider, hasBaseUrl: !!apiConfig?.baseUrl });
    console.log("Using provider:", usingCustom ? apiConfig.provider : (apiSetting.useDefault ? 'default-api' : "lovable-ai"));

    const prompt = `你是一个名叫"${character.name}"的虚拟角色。
${character.persona ? `你的人设是: ${character.persona}` : ''}

用户评论了你的动态："${userComment}"

请以这个角色的身份回复这条评论。要求：
- 符合角色性格
- 简短亲切，像朋友聊天
- 可以使用emoji
- 不要加引号，直接回复内容`;

    const content = await getAICompletion(
      [{ role: "user", content: prompt }],
      config
    );

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Reply comment error:", error);
    const errorMessage = error instanceof Error ? error.message : "未知错误";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
