import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 匿名神秘角色池 - 漂流瓶回复都是匿名的
const anonymousPersonas = [
  { persona: '你是一个温柔的倾听者，说话温暖治愈，像一位知心朋友' },
  { persona: '你是一个活泼开朗的人，说话俏皮可爱，总能带来快乐' },
  { persona: '你是一个睿智的旅人，见过很多风景，说话富有哲理' },
  { persona: '你是一个浪漫主义者，喜欢诗意地表达，感性细腻' },
  { persona: '你是一个乐观的小太阳，总是能看到事情积极的一面' },
];

interface AIConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  provider?: string;
}

async function getAICompletion(messages: any[], config: AIConfig) {
  let apiUrl: string;
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  let model: string;

  console.log('getAICompletion called with config:', JSON.stringify(config));

  // 使用用户自定义API
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
  } else {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }
    apiUrl = 'https://ai.gateway.lovable.dev/v1/chat/completions';
    headers['Authorization'] = `Bearer ${LOVABLE_API_KEY}`;
    model = 'google/gemini-2.5-flash';
    console.log('Using Lovable AI Gateway');
  }

  console.log('Calling AI API:', apiUrl, 'Model:', model);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, messages, max_tokens: 500, stream: false }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI API Error:', response.status, errorText);
    if (response.status === 429) {
      throw new Error("请求太频繁，请稍后再试");
    } else if (response.status === 402) {
      throw new Error("AI额度不足，请充值");
    }
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  
  // 兼容多种响应格式
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
    const { content, apiConfig, userId } = await req.json();
    console.log('Received bottle from user:', userId, 'content:', content?.substring(0, 50));

    // 创建Supabase客户端
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 获取用户资料，让AI知道用户是谁
    let userName = '朋友';
    let userPersona = '';
    
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('nickname, persona')
      .eq('user_id', userId)
      .maybeSingle();

    if (userProfile) {
      userName = userProfile.nickname || '朋友';
      userPersona = userProfile.persona || '';
      console.log('Found user profile:', userName);
    }

    // 随机选择一个匿名人设
    const randomIndex = Math.floor(Math.random() * anonymousPersonas.length);
    const selectedPersona = anonymousPersonas[randomIndex];
    console.log('Using anonymous persona index:', randomIndex);

    const systemPrompt = `${selectedPersona.persona}

你收到了一个来自"${userName}"的漂流瓶，里面写着一段话。
${userPersona ? `关于${userName}的一些信息: ${userPersona}` : ''}

请以匿名身份回复这个漂流瓶。
回复要求：
- 用第一人称回复，像一个友善的陌生人
- 回复要温暖有趣，像朋友聊天一样自然
- 可以称呼对方"${userName}"
- 回复长度适中，50-150字左右
- 可以适当询问、安慰或给予祝福
- 不要透露自己的身份，保持神秘感`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `漂流瓶内容：${content}` }
    ];

    const config: AIConfig = {
      apiKey: apiConfig?.apiKey,
      baseUrl: apiConfig?.baseUrl,
      model: apiConfig?.model,
      provider: apiConfig?.provider,
    };

    const reply = await getAICompletion(messages, config);
    console.log('Generated anonymous reply');

    // 漂流瓶回复是匿名的，character返回"神秘人"
    return new Response(JSON.stringify({ 
      reply,
      character: '神秘人'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in bottle-reply:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});