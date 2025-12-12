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

  if (config.useDefaultApi) {
    const defaultKey = Deno.env.get("DEFAULT_DEEPSEEK_API_KEY");
    if (defaultKey) {
      apiUrl = 'https://api.deepseek.com/v1/chat/completions';
      headers['Authorization'] = `Bearer ${defaultKey}`;
      model = 'deepseek-chat';
      console.log('Using default DeepSeek API');
    } else {
      // Fallback to Lovable AI
      const lovableKey = Deno.env.get("LOVABLE_API_KEY");
      if (!lovableKey) throw new Error("API未配置");
      apiUrl = 'https://ai.gateway.lovable.dev/v1/chat/completions';
      headers['Authorization'] = `Bearer ${lovableKey}`;
      model = 'google/gemini-2.5-flash';
      console.log('Using Lovable AI as fallback');
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, character, scriptRole, script, gameState, question, apiConfig, userId } = await req.json();

    const apiSetting = userId ? await checkDefaultApiSetting(userId) : { useDefault: false, defaultModel: 'deepseek-chat' };

    const config: AIConfig = {
      apiKey: apiConfig?.apiKey,
      baseUrl: apiConfig?.baseUrl,
      model: apiConfig?.model,
      provider: apiConfig?.provider,
      useDefaultApi: apiSetting.useDefault,
      defaultModel: apiSetting.defaultModel,
    };

    let systemPrompt = `你正在玩剧本杀游戏。你需要完全代入角色，根据剧本背景和你的角色设定来回复。
剧本名称：${script.title}
剧本背景：${script.background}
你扮演的角色：${scriptRole.name}
角色背景：${scriptRole.background}
你的秘密：${scriptRole.secret}
${scriptRole.isMurderer ? '【重要】你是凶手，需要隐藏自己的身份，转移其他人的注意力。' : '【重要】你不是凶手，需要通过讨论找出真正的凶手。'}

你原本的性格是：${character.persona || '普通人'}
请结合你的性格和角色设定来回复。`;

    let userPrompt = '';

    if (action === 'introduce') {
      userPrompt = `现在是自我介绍环节，请以第一人称介绍你的角色（不要透露你的秘密和是否是凶手）。控制在50字以内。`;
    } else if (action === 'discuss') {
      const otherSpeeches = gameState.recentSpeeches?.join('\n') || '';
      userPrompt = `现在是讨论环节。${otherSpeeches ? `其他人刚才说：\n${otherSpeeches}\n` : ''}
请发表你的看法，可以质疑他人或分享线索（但不要直接暴露自己的秘密）。控制在60字以内。`;
    } else if (action === 'answer') {
      userPrompt = `有人问你："${question}"\n请根据你的角色设定回答这个问题（可以选择性隐瞒或撒谎，但要合理）。控制在40字以内。`;
    } else if (action === 'vote') {
      const allRoles = gameState.roles?.map((r: any) => r.name).join('、') || '';
      userPrompt = `现在是投票环节，需要投票选出你认为的凶手。候选人：${allRoles}
请投票并说明理由。格式：我投票给[角色名]，因为[理由]。控制在40字以内。`;
    } else if (action === 'reveal') {
      userPrompt = `游戏结束，请揭示你的真实身份和秘密。控制在50字以内。`;
    }

    console.log('Script murder prompt:', userPrompt);

    const reply = await getAICompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      config
    );

    console.log('Script murder reply:', reply);

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Script murder error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});