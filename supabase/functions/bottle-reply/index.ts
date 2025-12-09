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

async function getAICompletion(messages: any[], apiConfig: any) {
  let apiUrl = 'https://ai.gateway.lovable.dev/v1/chat/completions';
  let apiKey = Deno.env.get('LOVABLE_API_KEY') || '';
  let model = 'google/gemini-2.5-flash';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  console.log('getAICompletion called with apiConfig:', JSON.stringify(apiConfig));

  // 使用用户自定义API - 优先级最高
  if (apiConfig?.apiKey && apiConfig?.provider) {
    console.log('Using user custom API, provider:', apiConfig.provider);
    switch (apiConfig.provider) {
      case 'deepseek':
        apiUrl = 'https://api.deepseek.com/v1/chat/completions';
        apiKey = apiConfig.apiKey;
        model = 'deepseek-chat';
        break;
      case 'openai':
        apiUrl = 'https://api.openai.com/v1/chat/completions';
        apiKey = apiConfig.apiKey;
        model = 'gpt-4o-mini';
        break;
      case 'custom':
        // 智能补全API路径
        let customUrl = apiConfig.baseUrl || 'https://api.deepseek.com/v1';
        if (!customUrl.includes('/chat/completions')) {
          customUrl = customUrl.replace(/\/$/, '') + '/chat/completions';
        }
        apiUrl = customUrl;
        apiKey = apiConfig.apiKey;
        model = apiConfig.model || 'deepseek-chat';
        break;
    }
  } else {
    console.log('No user API config, using Lovable AI');
  }

  headers['Authorization'] = `Bearer ${apiKey}`;

  console.log('Calling AI API:', apiUrl, 'Model:', model);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, messages, max_tokens: 500 }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI API Error:', response.status, errorText);
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '...';
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

    const reply = await getAICompletion(messages, apiConfig);
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
