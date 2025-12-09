import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 备用神秘角色（当用户没有创建角色时使用）
const fallbackCharacters = [
  { name: '神秘旅人', persona: '你是一个四处漂泊的神秘旅人，见过很多风景，说话温和有智慧' },
  { name: '海边精灵', persona: '你是住在海边的小精灵，说话可爱活泼，喜欢讲述海洋的故事' },
];

async function getAICompletion(messages: any[], apiConfig: any) {
  let apiUrl = 'https://ai.gateway.lovable.dev/v1/chat/completions';
  let apiKey = Deno.env.get('LOVABLE_API_KEY') || '';
  let model = 'google/gemini-2.5-flash';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // 使用用户自定义API
  if (apiConfig?.apiKey && apiConfig?.provider) {
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
        apiUrl = apiConfig.customBaseUrl || apiUrl;
        apiKey = apiConfig.apiKey;
        model = apiConfig.customModel || model;
        break;
    }
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

    // 获取用户创建的角色
    let character: { name: string; persona: string };
    
    const { data: userCharacters, error } = await supabase
      .from('characters')
      .select('name, persona')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching characters:', error);
    }

    if (userCharacters && userCharacters.length > 0) {
      // 随机选择用户的一个角色
      const randomIndex = Math.floor(Math.random() * userCharacters.length);
      const selected = userCharacters[randomIndex];
      character = {
        name: selected.name,
        persona: selected.persona || `你是${selected.name}，一个友善可爱的朋友`
      };
      console.log('Selected user character:', character.name);
    } else {
      // 没有角色时使用备用角色
      const randomIndex = Math.floor(Math.random() * fallbackCharacters.length);
      character = fallbackCharacters[randomIndex];
      console.log('Using fallback character:', character.name);
    }

    const systemPrompt = `${character.persona}

你收到了一个来自好友的漂流瓶，里面写着一段话。请以你的角色身份回复这个漂流瓶。
回复要求：
- 保持你的角色特色，用第一人称回复
- 回复要温暖有趣，像朋友聊天一样自然
- 回复长度适中，50-150字左右
- 可以适当询问、安慰或给予祝福`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `漂流瓶内容：${content}` }
    ];

    const reply = await getAICompletion(messages, apiConfig);
    console.log('Generated reply from:', character.name);

    return new Response(JSON.stringify({ 
      reply,
      character: character.name
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
