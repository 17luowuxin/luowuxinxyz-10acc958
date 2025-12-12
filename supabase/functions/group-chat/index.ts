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
  config: AIConfig,
  maxTokens: number = 150
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
      const lovableKey = Deno.env.get("LOVABLE_API_KEY");
      if (!lovableKey) throw new Error("API未配置");
      apiUrl = 'https://ai.gateway.lovable.dev/v1/chat/completions';
      headers['Authorization'] = `Bearer ${lovableKey}`;
      model = 'google/gemini-2.5-flash';
      console.log('Using Lovable AI as fallback');
    }
  } else {
    // 没有任何配置时使用 Lovable AI
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
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  const response = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
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
  
  return content || '...';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, characters, userMessage, userApiKey, provider, baseUrl, model: customModel, userProfile, mentionedCharacterIds, userId } = await req.json();
    
    const apiSetting = userId ? await checkDefaultApiSetting(userId) : { useDefault: false, defaultModel: 'deepseek-chat' };
    
    // 构建配置对象
    const config: AIConfig = {
      apiKey: userApiKey,
      baseUrl: baseUrl,
      model: customModel,
      provider: provider,
      useDefaultApi: apiSetting.useDefault,
      defaultModel: apiSetting.defaultModel,
    };

    // 日志：显示实际使用的API
    const usingCustom = userApiKey && (provider === 'custom' || provider === 'deepseek' || provider === 'openai');
    console.log("API Config received:", { hasApiKey: !!userApiKey, provider, hasBaseUrl: !!baseUrl, model: customModel });
    console.log("Using provider:", usingCustom ? provider : (apiSetting.useDefault ? 'default-api' : "lovable-ai"));
    console.log("Mentioned characters:", mentionedCharacterIds);

    const userName = userProfile?.nickname || '用户';
    const userPersona = userProfile?.persona || '';

    let responders: any[] = [];
    
    if (mentionedCharacterIds && mentionedCharacterIds.length > 0) {
      responders = characters.filter((c: any) => mentionedCharacterIds.includes(c.id));
      console.log("Using mentioned characters:", responders.map((r: any) => r.name));
    } else {
      const shuffled = [...characters].sort(() => Math.random() - 0.5);
      responders = shuffled.slice(0, 1);
    }

    const responses: { characterId: string; characterName: string; content: string }[] = [];

    for (const character of responders) {
      const otherCharacters = characters.filter((c: any) => c.id !== character.id).map((c: any) => c.name).join('、');
      
      const systemPrompt = `你正在模拟微信群聊中的角色"${character.name}"。
${character.persona ? `你的人设是: ${character.persona}` : ''}

群聊成员: ${userName}(用户)${otherCharacters ? `、${otherCharacters}` : ''}

【核心规则 - 必须严格遵守】
1. 你只能扮演"${character.name}"这一个角色，绝对不能扮演其他角色或模拟其他人的回复
2. 直接用第一人称回复，不要在回复开头加任何角色名、编号或前缀
3. 只回复一段话，不要分多段或模拟对话
4. 回复要简短自然，像真实微信群聊，一般1-3句话
5. 可以用括号表达动作或情绪，如(笑)(无语)
6. 保持"${character.name}"的性格特点

【禁止行为】
- 禁止写出其他角色的回复
- 禁止使用"角色名:"的格式
- 禁止模拟多人对话
- 禁止添加编号如"1." "2."

${userPersona ? `关于用户${userName}: ${userPersona}` : ''}

正确示例: "哈哈今天心情不错呀~" 或 "(笑) 你怎么突然问这个"
错误示例: "小明: 你好 小红: 我也好" 或 "1. 内容"`;

      try {
        let content = await getAICompletion(
          [
            { role: "system", content: systemPrompt },
            ...messages.slice(-10),
            { role: "user", content: `${userName}: ${userMessage}` }
          ],
          config
        );
        
        if (content) {
          content = content.replace(/^[^:：]*[:：]\s*/g, '');
          content = content.replace(/^\d+[\.\s、]*/, '');
          content = content.trim();
          
          responses.push({
            characterId: character.id,
            characterName: character.name,
            content
          });
        }
      } catch (error) {
        console.error(`Error getting response for ${character.name}:`, error);
      }

      if (responders.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return new Response(JSON.stringify({ responses }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Group chat function error:", error);
    const errorMessage = error instanceof Error ? error.message : "未知错误";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
