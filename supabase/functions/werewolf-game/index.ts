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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 200,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

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
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error("请求超时，请重试");
    }
    throw error;
  }
}

interface Character {
  id: string;
  name: string;
  persona: string;
  role: string;
  isAlive: boolean;
}

interface GameState {
  phase: 'night' | 'day' | 'vote';
  round: number;
  characters: Character[];
  lastAction?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, character, gameState, targetName, apiConfig, userId } = await req.json();

    const useDefaultApi = userId ? await checkDefaultApiSetting(userId) : false;

    const config: AIConfig = {
      apiKey: apiConfig?.apiKey,
      baseUrl: apiConfig?.baseUrl,
      model: apiConfig?.model,
      provider: apiConfig?.provider,
      useDefaultApi: useDefaultApi,
    };

    let prompt = '';
    const aliveCharacters = gameState.characters.filter((c: Character) => c.isAlive);
    const aliveNames = aliveCharacters.map((c: Character) => c.name).join('、');

    if (action === 'night_action') {
      if (character.role === '狼人') {
        prompt = `你是${character.name}，性格是${character.persona}。你是一个狼人。
现在是第${gameState.round}个夜晚，还活着的玩家有：${aliveNames}。
请选择今晚要杀死的目标（不能选择自己或其他狼人），并说明你的理由。
用一句话回复，格式：我选择杀死[玩家名]，因为[理由]。`;
      } else if (character.role === '预言家') {
        prompt = `你是${character.name}，性格是${character.persona}。你是预言家。
现在是第${gameState.round}个夜晚，还活着的玩家有：${aliveNames}。
请选择今晚要查验的玩家，并说明你的理由。
用一句话回复，格式：我选择查验[玩家名]，因为[理由]。`;
      } else if (character.role === '女巫') {
        prompt = `你是${character.name}，性格是${character.persona}。你是女巫，有解药和毒药各一瓶。
现在是第${gameState.round}个夜晚，今晚${targetName || '没有人'}被狼人杀害。还活着的玩家有：${aliveNames}。
请决定是否使用药水。
用一句话回复你的决定和理由。`;
      } else if (character.role === '守卫') {
        prompt = `你是${character.name}，性格是${character.persona}。你是守卫。
现在是第${gameState.round}个夜晚，还活着的玩家有：${aliveNames}。
请选择今晚要守护的玩家（不能连续两晚守护同一人）。
用一句话回复，格式：我选择守护[玩家名]，因为[理由]。`;
      }
    } else if (action === 'day_speech') {
      const roleHint = character.role === '狼人' 
        ? '你需要隐藏自己的身份，引导大家怀疑其他人。' 
        : `你是${character.role}，需要帮助好人阵营找出狼人。`;
      
      prompt = `你是${character.name}，性格是${character.persona}。${roleHint}
现在是第${gameState.round}天的讨论环节。${gameState.lastAction || ''}
还活着的玩家有：${aliveNames}。
请发表你的看法，分析谁可能是狼人，字数控制在50字以内。`;
    } else if (action === 'vote') {
      const roleHint = character.role === '狼人' 
        ? '你需要投票给好人，避免暴露自己。' 
        : '你需要投票给你怀疑是狼人的玩家。';
      
      prompt = `你是${character.name}，性格是${character.persona}。${roleHint}
现在是投票环节，需要投票处决一名玩家。
还活着的玩家有：${aliveNames}。
用一句话回复，格式：我投票给[玩家名]，因为[理由]。`;
    } else if (action === 'last_words') {
      prompt = `你是${character.name}，性格是${character.persona}。你的身份是${character.role}。
你被投票出局了，请发表你的遗言，可以选择是否揭示身份。
字数控制在30字以内。`;
    }

    console.log('Werewolf game prompt:', prompt);

    const reply = await getAICompletion(
      [
        { role: 'system', content: '你正在玩狼人杀游戏，请完全代入角色，根据你的身份和性格来回复。回复要简短有力。' },
        { role: 'user', content: prompt }
      ],
      config
    );

    console.log('Werewolf game reply:', reply);

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Werewolf game error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});