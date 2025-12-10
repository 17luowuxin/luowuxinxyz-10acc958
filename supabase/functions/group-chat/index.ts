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
    const { messages, characters, userMessage, userApiKey, provider, baseUrl, model: customModel, userProfile, mentionedCharacterIds } = await req.json();
    
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
      } else if (provider === 'custom' && baseUrl) {
        apiKey = userApiKey;
        // 简化URL拼接逻辑
        let finalUrl = baseUrl.trim().replace(/\/+$/, '');
        if (!finalUrl.endsWith('/chat/completions')) {
          finalUrl = `${finalUrl}/chat/completions`;
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
    console.log("Mentioned characters:", mentionedCharacterIds);

    // 用户信息
    const userName = userProfile?.nickname || '用户';
    const userPersona = userProfile?.persona || '';

    // 确定回复的角色 - 每个角色独立回复，不会一个角色扮演多人
    let responders: any[] = [];
    
    // 如果有@的角色，只让被@的角色回复
    if (mentionedCharacterIds && mentionedCharacterIds.length > 0) {
      responders = characters.filter((c: any) => mentionedCharacterIds.includes(c.id));
      console.log("Using mentioned characters:", responders.map((r: any) => r.name));
    } else {
      // 没有@的话，随机选择1个角色来回复（避免多角色混乱）
      const shuffled = [...characters].sort(() => Math.random() - 0.5);
      responders = shuffled.slice(0, 1);
    }

    const responses: { characterId: string; characterName: string; content: string }[] = [];

    // 每个角色单独调用API，确保每个回复都是独立的
    for (const character of responders) {
      const otherCharacters = characters.filter((c: any) => c.id !== character.id).map((c: any) => c.name).join('、');
      
      const systemPrompt = `你正在模拟微信群聊中的角色"${character.name}"。
${character.persona ? `你的人设是: ${character.persona}` : ''}

群聊成员: ${userName}(用户)${otherCharacters ? `、${otherCharacters}` : ''}

【核心规则 - 必须严格遵守】
1. 你只能扮演"${character.name}"这一个角色，绝对不能扮演其他角色或模拟其他人的回复
2. 直接用第一人称回复，不要在回复开头加任何角色名、编号或前缀
3. 只回复一段话，不要分多段或模拟对话
4. 回复要简短自然，像真实微信群聊，一般1-3句话
5. 可以用括号表达动作或情绪，如(笑)(无语)
6. 保持"${character.name}"的性格特点

【禁止行为】
- 禁止写出其他角色的回复
- 禁止使用"角色名:"的格式
- 禁止模拟多人对话
- 禁止添加编号如"1." "2."

${userPersona ? `关于用户${userName}: ${userPersona}` : ''}

正确示例: "哈哈今天心情不错呀~" 或 "(笑) 你怎么突然问这个"
错误示例: "小明: 你好 小红: 我也好" 或 "1. 内容"`;

      const requestBody = provider === 'anthropic' && userApiKey ? {
        model,
        max_tokens: 150,
        messages: [
          ...messages.slice(-10),
          { role: "user", content: `${userName}: ${userMessage}` }
        ],
        system: systemPrompt,
      } : {
        model,
        max_tokens: 150,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.slice(-10),
          { role: "user", content: `${userName}: ${userMessage}` }
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
      
      // 清理回复内容，移除可能的角色名前缀和编号
      if (content) {
        // 移除开头的角色名:、数字编号等
        content = content.replace(/^[^:：]*[:：]\s*/g, '');
        content = content.replace(/^\d+[\.\s、]*/, '');
        content = content.trim();
        
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
