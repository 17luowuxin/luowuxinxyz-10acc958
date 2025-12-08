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
    const { messages, persona, characterName, userApiKey, provider } = await req.json();
    
    // Use user's custom API key or default Lovable AI
    let apiKey = Deno.env.get("LOVABLE_API_KEY");
    let apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
    let model = "google/gemini-2.5-flash";
    
    // If user provides their own API key
    if (userApiKey && provider) {
      if (provider === 'deepseek') {
        apiKey = userApiKey;
        apiUrl = "https://api.deepseek.com/v1/chat/completions";
        model = "deepseek-chat";
      } else if (provider === 'openai') {
        apiKey = userApiKey;
        apiUrl = "https://api.openai.com/v1/chat/completions";
        model = "gpt-4o-mini";
      }
    }

    if (!apiKey) {
      throw new Error("API key not configured");
    }

    const systemPrompt = `你是一个名叫"${characterName}"的虚拟角色。
${persona ? `角色设定: ${persona}` : ''}
请用符合角色性格的方式回复用户，保持可爱、温暖、有趣的对话风格。
回复要简洁自然，像真实朋友聊天一样。`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "请求过于频繁，请稍后再试" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "配额已用完，请充值" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI服务暂时不可用" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error: unknown) {
    console.error("Chat function error:", error);
    const errorMessage = error instanceof Error ? error.message : "未知错误";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
