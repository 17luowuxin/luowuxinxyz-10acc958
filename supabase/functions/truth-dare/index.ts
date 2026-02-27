import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

async function checkDefaultApiSetting(userId: string): Promise<{ useDefault: boolean; defaultModel: string }> {
  if (!userId) return { useDefault: false, defaultModel: 'deepseek-chat' };
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data: apiSettings } = await supabase
    .from('api_keys')
    .select('provider, api_key')
    .eq('user_id', userId);
  
  let useDefault = false;
  let defaultModel = 'deepseek-chat';
  
  if (apiSettings) {
    const defaultApiSetting = apiSettings.find(s => s.provider === 'use_default_api');
    if (defaultApiSetting && defaultApiSetting.api_key === 'true') {
      useDefault = true;
    }
    const defaultModelSetting = apiSettings.find(s => s.provider === 'default_model');
    if (defaultModelSetting) {
      defaultModel = defaultModelSetting.api_key;
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


  const MAX_TOKENS_PER_CALL = 1500;
  const MAX_CONTINUATIONS = 3;
  const CONTINUE_PROMPT = '继续，直接接着上一句续写，不要重复前文。';

  const extractContent = (data: any): string => {
    if (data?.choices?.[0]?.message?.content) return data.choices[0].message.content;
    if (data?.choices?.[0]?.delta?.content) return data.choices[0].delta.content;
    if (data?.choices?.[0]?.text) return data.choices[0].text;
    if (data?.content) return data.content;
    if (data?.result) return data.result;
    if (data?.output?.text) return data.output.text;
    if (data?.output?.content) return data.output.content;
    if (data?.output) return typeof data.output === 'string' ? data.output : JSON.stringify(data.output);
    if (data?.response) return typeof data.response === 'string' ? data.response : JSON.stringify(data.response);
    if (data?.text) return data.text;
    if (data?.answer) return data.answer;
    if (data?.message?.content) return data.message.content;
    if (typeof data === 'string') return data;
    return '';
  };

  const appendWithoutOverlap = (prev: string, next: string) => {
    if (!prev) return next;
    if (!next) return prev;

    const maxOverlap = Math.min(200, prev.length, next.length);
    for (let i = maxOverlap; i > 0; i--) {
      if (next.startsWith(prev.slice(-i))) {
        return prev + next.slice(i);
      }
    }
    return prev + next;
  };

  const requestOnce = async (requestMessages: Array<{ role: string; content: string }>) => {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: requestMessages,
        max_tokens: MAX_TOKENS_PER_CALL,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      if (response.status === 429) throw new Error("请求太频繁，请稍后再试");
      if (response.status === 402) throw new Error("AI额度不足，请充值");
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const finishReason = data?.choices?.[0]?.finish_reason as string | undefined;
    const content = extractContent(data);

    console.log("Finish reason:", finishReason);
    console.log("Extracted content:", content?.slice(0, 200) || 'EMPTY');

    return { content: (content || '').trim(), finishReason };
  };

  let accumulated = '';
  let currentMessages = [...messages];

  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    const { content, finishReason } = await requestOnce(currentMessages);

    accumulated = appendWithoutOverlap(accumulated, content);

    if (!accumulated || accumulated.trim() === '') {
      return '(AI暂时无法回复，请稍后再试)';
    }

    if (finishReason !== 'length') break;

    if (i < MAX_CONTINUATIONS) {
      currentMessages = [
        ...messages,
        { role: "assistant", content: accumulated },
        { role: "user", content: CONTINUE_PROMPT },
      ];
    }
  }

  // 清理内容 - 移除前后空白和多余换行
  return accumulated.trim().replace(/^\n+|\n+$/g, '');

}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, character, targetCharacter, gameHistory, apiConfig, userId } = await req.json();
    
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

    let systemPrompt = `你是${character.name}，性格特点：${character.persona || '活泼开朗'}。
你正在和朋友们玩真心话大冒险游戏。请根据你的性格特点来提问或回答。
回答要自然有趣，符合你的人设；允许分行/分点，但不要无意义铺垫。`;

    let userPrompt = '';
    
    switch (action) {
      case 'ask_truth':
        userPrompt = `轮到你向${targetCharacter.name}提问真心话了。请提出1个有趣但不过分的问题。
要求：一句话为主，尽量在40字内。直接输出问题。`;
        break;
        
      case 'ask_dare':
        userPrompt = `轮到你向${targetCharacter.name}提出大冒险了。请提出一个有趣且可执行的挑战。
要求：不超过200字；可以用2-4条分点描述步骤；不要太过分。直接输出挑战内容。`;
        break;
        
      case 'answer_truth':
        userPrompt = `${targetCharacter.name}问你真心话："${gameHistory}"
请根据你的人设诚实回答。要求：1-3句话，尽量在120字内。`;
        break;
        
      case 'do_dare':
        userPrompt = `${targetCharacter.name}给你的大冒险是："${gameHistory}"
请描述你如何完成挑战，以及你的反应。
要求：1-4句话或分点，尽量在180字内，直接描述完成过程。`;
        break;
        
      case 'react':
        userPrompt = `游戏中发生了这件事：${gameHistory}
作为旁观者，请给出一句简短反应（尽量20字内）。`;
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
