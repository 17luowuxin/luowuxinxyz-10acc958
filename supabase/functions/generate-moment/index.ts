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
    const { character, type, userPost, userApiKey, provider, customBaseUrl, customModel, userProfile } = await req.json();
    
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
      throw new Error("API key not configured");
    }

    // 获取用户信息
    const userName = userProfile?.nickname || '用户';
    const userPersona = userProfile?.persona || '';

    let prompt = "";
    
    if (type === "moment") {
      prompt = `你是一个名叫"${character.name}"的虚拟角色。
${character.persona ? `你的人设是: ${character.persona}` : ''}

请以这个角色的身份发布一条朋友圈动态。内容可以是：
- 分享今天的心情
- 分享一个小故事或想法
- 对生活的感悟
- 可爱有趣的日常

要求：
- 符合角色性格
- 简短自然，1-3句话
- 可以使用emoji
- 不要加引号`;
    } else if (type === "reply") {
      prompt = `你是一个名叫"${character.name}"的虚拟角色。
${character.persona ? `你的人设是: ${character.persona}` : ''}

你的好友"${userName}"发了一条说说："${userPost}"
${userPersona ? `\n关于${userName}的信息: ${userPersona}` : ''}

请以这个角色的身份回复${userName}的说说，就像朋友评论一样。要求：
- 符合你的角色性格
- 要称呼对方的名字"${userName}"
- 简短亲切，像朋友聊天
- 可以使用emoji
- 1-2句话即可`;
    }

    console.log(`Using provider: ${userApiKey ? provider : 'lovable-ai'}`);
    console.log(`API URL: ${apiUrl}`);
    console.log(`User: ${userName}`);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      
      if (response.status === 402) {
        throw new Error("配额已用完，请检查API设置或充值");
      }
      if (response.status === 429) {
        throw new Error("请求过于频繁，请稍后再试");
      }
      throw new Error(`AI service error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Generate moment error:", error);
    const errorMessage = error instanceof Error ? error.message : "未知错误";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
