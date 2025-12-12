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
  } else if (config.apiKey && config.provider === 'custom' && config.baseUrl) {
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
    const { action, character, targetCharacter, gameHistory, apiConfig, userId } = await req.json();
    
    const useDefaultApi = userId ? await checkDefaultApiSetting(userId) : false;
    
    const config: AIConfig = {
      apiKey: apiConfig?.apiKey,
      baseUrl: apiConfig?.baseUrl,
      model: apiConfig?.model,
      provider: apiConfig?.provider,
      useDefaultApi: useDefaultApi,
    };

    let systemPrompt = `你是${character.name}，性格特点：${character.persona || '活泼开朗'}。
你正在和朋友们玩真心话大冒险游戏。请根据你的性格特点来提问或回答。
回答要简短有趣，符合你的人设。不要太长，控制在50字以内。`;

    let userPrompt = '';
    
    switch (action) {
      case 'ask_truth':
        userPrompt = `轮到你向${targetCharacter.name}提问真心话了。请提出一个有趣但不过分的真心话问题。
问题要符合朋友之间的互动，可以调皮但要尊重对方。只输出问题，不要其他内容。`;
        break;
        
      case 'ask_dare':
        userPrompt = `轮到你向${targetCharacter.name}提出大冒险了。请提出一个有趣但可以完成的大冒险挑战。
挑战要好玩但不要太过分，适合朋友之间玩。只输出挑战内容，不要其他内容。`;
        break;
        
      case 'answer_truth':
        userPrompt = `${targetCharacter.name}问你真心话："${gameHistory}"
请根据你的性格诚实地回答这个问题。回答要自然有趣。只输出回答，不要其他内容。`;
        break;
        
      case 'do_dare':
        userPrompt = `${targetCharacter.name}给你的大冒险是："${gameHistory}"
请描述你如何完成这个挑战，以及你的反应。描述要生动有趣。只输出描述，不要其他内容。`;
        break;
        
      case 'react':
        userPrompt = `游戏中发生了这件事：${gameHistory}
作为旁观者，请给出一句简短的反应或评论。可以是调侃、鼓励或搞笑的话。只输出一句话。`;
        break;
        
      default:
        userPrompt = '请说一句开场白，准备开始真心话大冒险游戏。';
    }

    const reply = await getAICompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      config
    );

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in truth-dare function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});