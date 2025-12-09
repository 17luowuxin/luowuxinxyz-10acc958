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
    const { messages, characters, userMessage, userApiKey, provider, customBaseUrl, customModel, userProfile } = await req.json();
    
    let apiKey: string | undefined;
    let apiUrl: string;
    let model: string;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    
    // Priority: user's custom API key > Lovable AI
    if (userApiKey && provider) {
      if (provider === 'deepseek') {
        apiKey = userApiKey;
        apiUrl = "https://api.deepseek.com/v1/chat/completions";
        model = "deepseek-chat";
        headers["Authorization"] = `Bearer ${apiKey}`;
      } else if (provider === 'openai') {
        apiKey = userApiKey;
        apiUrl = "https://api.openai.com/v1/chat/completions";
        model = "gpt-4o-mini";
        headers["Authorization"] = `Bearer ${apiKey}`;
      } else if (provider === 'anthropic') {
        apiKey = userApiKey;
        apiUrl = "https://api.anthropic.com/v1/messages";
        model = "claude-3-haiku-20240307";
        headers["x-api-key"] = userApiKey;
        headers["anthropic-version"] = "2023-06-01";
      } else if (provider === 'custom' && customBaseUrl) {
        apiKey = userApiKey;
        let finalUrl = customBaseUrl.trim();
        if (!finalUrl.endsWith('/chat/completions')) {
          if (!finalUrl.endsWith('/')) finalUrl += '/';
          if (!finalUrl.includes('/v1/')) finalUrl += 'v1/';
          if (!finalUrl.endsWith('/')) finalUrl += 'chat/completions';
          else finalUrl += 'chat/completions';
        }
        apiUrl = finalUrl;
        model = customModel || "deepseek-chat";
        headers["Authorization"] = `Bearer ${apiKey}`;
      } else {
        apiKey = Deno.env.get("LOVABLE_API_KEY");
        apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
        model = "google/gemini-2.5-flash";
        headers["Authorization"] = `Bearer ${apiKey}`;
      }
    } else {
      apiKey = Deno.env.get("LOVABLE_API_KEY");
      apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
      model = "google/gemini-2.5-flash";
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API密钥未配置" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Using provider:", userApiKey ? provider : "lovable-ai");
    console.log("API URL:", apiUrl);

    // 用户信息
    const userName = userProfile?.nickname || '用户';
    const userPersona = userProfile?.persona || '';

    // 随机选择1-2个角色来回复
    const numResponders = Math.min(characters.length, Math.random() > 0.5 ? 2 : 1);
    const shuffled = [...characters].sort(() => Math.random() - 0.5);
    const responders = shuffled.slice(0, numResponders);

    const responses: { characterId: string; characterName: string; content: string }[] = [];

    for (const character of responders) {
      const systemPrompt = `你是群聊中的一个角色，名叫"${character.name}"。
${character.persona ? `你的人设是: ${character.persona}` : ''}

群聊中还有其他角色：${characters.filter((c: any) => c.id !== character.id).map((c: any) => c.name).join('、')}
用户"${userName}"也在群里。${userPersona ? `关于用户: ${userPersona}` : ''}

请用符合你角色性格的方式回复用户的消息。回复要简洁自然，像朋友聊天一样。
注意：你只需要扮演${character.name}这一个角色，不要扮演其他角色。`;

      const requestBody = provider === 'anthropic' && userApiKey ? {
        model,
        max_tokens: 1024,
        messages: [
          ...messages.slice(-10),
          { role: "user", content: `${userName}说: ${userMessage}` }
        ],
        system: systemPrompt,
      } : {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.slice(-10),
          { role: "user", content: `${userName}说: ${userMessage}` }
        ],
      };

      const response = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI API error:", response.status, errorText);
        continue;
      }

      const data = await response.json();
      let content = '';
      
      if (provider === 'anthropic' && userApiKey) {
        content = data.content?.[0]?.text || '';
      } else {
        content = data.choices?.[0]?.message?.content || '';
      }
      
      if (content) {
        responses.push({
          characterId: character.id,
          characterName: character.name,
          content
        });
      }

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