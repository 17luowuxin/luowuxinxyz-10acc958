import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  provider?: string;
  useDefaultApi?: boolean;
}

async function checkDefaultApiSetting(userId: string): Promise<boolean> {
  if (!userId) return false;
  
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
      return true;
    }
  }
  return false;
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

  if (config.useDefaultApi) {
    const defaultKey = Deno.env.get("DEFAULT_TENSDAQ_API_KEY");
    if (defaultKey) {
      apiUrl = 'https://tensdaq-api.x-aio.com/chat/completions';
      headers['Authorization'] = `Bearer ${defaultKey}`;
      model = 'deepseek-chat';
      console.log('Using default Tensdaq API');
    } else {
      throw new Error("默认API未配置");
    }
  } else if (config.apiKey && (config.provider === 'custom' && config.baseUrl)) {
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
  } else {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }
    apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
    headers['Authorization'] = `Bearer ${LOVABLE_API_KEY}`;
    model = "google/gemini-2.5-flash";
    console.log('Using Lovable AI Gateway');
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 200,
      stream: false,
    }),
  });

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
  
  let content = '';
  if (data.choices?.[0]?.message?.content) {
    content = data.choices[0].message.content;
  } else if (data.choices?.[0]?.text) {
    content = data.choices[0].text;
  } else if (data.content) {
    content = data.content;
  } else if (data.result) {
    content = data.result;
  } else if (data.output) {
    content = data.output;
  } else if (data.response) {
    content = data.response;
  } else if (typeof data === 'string') {
    content = data;
  }
  
  return content || "...";
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { character, userComment, apiConfig, userId } = await req.json();
    
    const useDefaultApi = userId ? await checkDefaultApiSetting(userId) : false;
    
    const config: AIConfig = {
      apiKey: apiConfig?.apiKey,
      baseUrl: apiConfig?.baseUrl,
      model: apiConfig?.model,
      provider: apiConfig?.provider,
      useDefaultApi: useDefaultApi,
    };

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