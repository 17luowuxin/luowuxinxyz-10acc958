import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

async function getAICompletion(
  messages: Array<{ role: string; content: string }>,
  config: AIConfig
): Promise<string> {
  const useCustomApi = config.apiKey && config.baseUrl;
  
  let apiUrl: string;
  let headers: Record<string, string>;
  let model: string;

  if (useCustomApi) {
    let baseUrl = config.baseUrl!.replace(/\/$/, '');
    if (!baseUrl.endsWith('/chat/completions')) {
      baseUrl = `${baseUrl}/chat/completions`;
    }
    apiUrl = baseUrl;
    headers = {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    };
    model = config.model || 'deepseek-chat';
    console.log('Using custom API:', apiUrl, 'model:', model);
  } else {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }
    apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
    headers = {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    };
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
      temperature: 0.9,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI API error:", response.status, errorText);
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "...";
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, character, scriptRole, script, gameState, question, apiConfig } = await req.json();

    const config: AIConfig = {
      apiKey: apiConfig?.apiKey,
      baseUrl: apiConfig?.baseUrl,
      model: apiConfig?.model,
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
