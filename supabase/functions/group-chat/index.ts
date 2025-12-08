import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, characters, userMessage } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // 随机选择1-2个角色来回复
    const numResponders = Math.min(characters.length, Math.random() > 0.5 ? 2 : 1);
    const shuffled = [...characters].sort(() => Math.random() - 0.5);
    const responders = shuffled.slice(0, numResponders);

    const responses: { characterId: string; characterName: string; content: string }[] = [];

    for (const character of responders) {
      const systemPrompt = `你是群聊中的一个角色，名叫"${character.name}"。
${character.persona ? `你的人设是: ${character.persona}` : ''}

群聊中还有其他角色：${characters.filter((c: any) => c.id !== character.id).map((c: any) => c.name).join('、')}

请用符合你角色性格的方式回复用户的消息。回复要简洁自然，像朋友聊天一样。
注意：你只需要扮演${character.name}这一个角色，不要扮演其他角色。`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages.slice(-10), // 最近10条消息作为上下文
            { role: "user", content: `用户说: ${userMessage}` }
          ],
        }),
      });

      if (!response.ok) {
        console.error("AI API error:", response.status);
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      
      if (content) {
        responses.push({
          characterId: character.id,
          characterName: character.name,
          content
        });
      }

      // 添加小延迟，避免回复太快
      await new Promise(resolve => setTimeout(resolve, 500));
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
