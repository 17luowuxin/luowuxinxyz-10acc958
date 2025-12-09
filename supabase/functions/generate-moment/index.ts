import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { character, type, userPost, userId } = await req.json();
    
    // 初始化 Supabase 客户端获取用户API配置
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 获取用户的API配置
    let apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
    let apiKey = Deno.env.get("LOVABLE_API_KEY");
    let model = "google/gemini-2.5-flash";

    // 从请求头获取用户token
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      
      if (user) {
        const { data: apiConfig } = await supabase
          .from('api_keys')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        if (apiConfig) {
          if (apiConfig.provider === 'deepseek') {
            apiUrl = 'https://api.deepseek.com/v1/chat/completions';
            apiKey = apiConfig.api_key;
            model = 'deepseek-chat';
          } else if (apiConfig.provider === 'openai') {
            apiUrl = 'https://api.openai.com/v1/chat/completions';
            apiKey = apiConfig.api_key;
            model = 'gpt-4o-mini';
          } else if (apiConfig.provider === 'custom' && apiConfig.api_key) {
            // 自定义API
            let customUrl = apiConfig.api_key.split('|')[1] || apiConfig.api_key;
            if (!customUrl.includes('/chat/completions')) {
              customUrl = customUrl.replace(/\/$/, '') + '/v1/chat/completions';
            }
            apiUrl = customUrl;
            apiKey = apiConfig.api_key.split('|')[0];
            model = 'deepseek-chat';
          }
        }
      }
    }

    if (!apiKey) {
      throw new Error("API key not configured");
    }

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

用户发了一条说说："${userPost}"

请以这个角色的身份回复这条说说，就像朋友评论一样。要求：
- 符合角色性格
- 简短亲切，像朋友聊天
- 可以使用emoji
- 1-2句话即可`;
    }

    console.log(`Calling API: ${apiUrl} with model: ${model}`);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
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
