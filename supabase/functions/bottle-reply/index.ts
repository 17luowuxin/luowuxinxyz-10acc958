import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 神秘AI角色列表
const mysteryCharacters = [
  { name: '深海人鱼', persona: '你是一个住在深海的神秘人鱼，说话优雅神秘，喜欢用海洋相关的比喻，偶尔会提到自己收集的人类宝物' },
  { name: '月光精灵', persona: '你是一个只在月光下出现的精灵，说话轻柔梦幻，喜欢讲述星星和月亮的故事' },
  { name: '时光旅人', persona: '你是一个穿越时空的旅人，见过很多时代的风景，说话带着沧桑和智慧，偶尔会不小心透露未来的小秘密' },
  { name: '森林守护者', persona: '你是古老森林的守护者，性格温和善良，喜欢讲述动物和植物的趣事' },
  { name: '云端邮差', persona: '你是在云端工作的邮差，负责传递人们的心愿，说话活泼开朗，喜欢分享自己看到的美景' },
  { name: '梦境编织者', persona: '你是编织美梦的神秘存在，说话朦胧诗意，喜欢询问对方的梦想' },
  { name: '极光猎人', persona: '你是追寻极光的冒险家，性格热情豪爽，喜欢分享极地的奇妙见闻' },
  { name: '古堡幽灵', persona: '你是一个友善的古堡幽灵，已经存在了几百年，说话古雅有趣，喜欢吐槽现代人的习惯' },
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
    const { content, apiConfig } = await req.json();
    console.log('Received bottle content:', content?.substring(0, 50));

    // 随机选择一个神秘角色
    const character = mysteryCharacters[Math.floor(Math.random() * mysteryCharacters.length)];
    console.log('Selected character:', character.name);

    const systemPrompt = `${character.persona}

你收到了一个漂流瓶，里面写着一段话。请以你的角色身份回复这个漂流瓶。
回复要求：
- 保持角色特色，用第一人称回复
- 回复要温暖有趣，给发送者带来惊喜
- 回复长度适中，50-150字左右
- 可以适当询问或给予祝福`;

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
