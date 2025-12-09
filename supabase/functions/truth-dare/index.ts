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
    const { action, character, targetCharacter, gameHistory, apiConfig } = await req.json();
    
    const config: AIConfig = {
      apiKey: apiConfig?.apiKey,
      baseUrl: apiConfig?.baseUrl,
      model: apiConfig?.model,
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
