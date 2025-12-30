import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  provider?: string;
  useDefaultApi?: boolean;
  defaultModel?: string;
}

async function checkDefaultApiSetting(userId: string): Promise<{ useDefault: boolean; defaultModel: string }> {
  if (!userId) return { useDefault: false, defaultModel: 'deepseek-chat' };
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data: apiSettings } = await supabase
    .from('api_keys')
    .select('provider, api_key')
    .eq('user_id', userId);
  
  let useDefault = false;
  let defaultModel = 'deepseek-chat';
  
  if (apiSettings) {
    const defaultApiSetting = apiSettings.find(s => s.provider === 'use_default_api');
    if (defaultApiSetting && defaultApiSetting.api_key === 'true') {
      useDefault = true;
    }
    const defaultModelSetting = apiSettings.find(s => s.provider === 'default_model');
    if (defaultModelSetting) {
      defaultModel = defaultModelSetting.api_key;
    }
  }
  return { useDefault, defaultModel };
}

async function getAICompletion(
  messages: Array<{ role: string; content: string }>,
  config: AIConfig
): Promise<string> {
  let apiUrl: string;
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  let model: string;

  // 【关键修复】优先检查用户传递的自定义API配置
  if (config.apiKey && config.provider === 'custom' && config.baseUrl) {
    let baseUrl = config.baseUrl.replace(/\/+$/, '');
    if (!baseUrl.endsWith('/chat/completions')) {
      baseUrl = `${baseUrl}/chat/completions`;
    }
    apiUrl = baseUrl;
    headers['Authorization'] = `Bearer ${config.apiKey}`;
    model = config.model || 'deepseek-chat';
    console.log('Using custom API:', apiUrl, 'model:', model);
  } else if (config.apiKey && config.provider === 'deepseek') {
    apiUrl = 'https://api.deepseek.com/v1/chat/completions';
    headers['Authorization'] = `Bearer ${config.apiKey}`;
    model = 'deepseek-chat';
    console.log('Using DeepSeek API');
  } else if (config.apiKey && config.provider === 'openai') {
    apiUrl = 'https://api.openai.com/v1/chat/completions';
    headers['Authorization'] = `Bearer ${config.apiKey}`;
    model = 'gpt-4o-mini';
    console.log('Using OpenAI API');
  } else if (config.useDefaultApi) {
    // 只有在用户没有配置自定义API时才检查默认API设置
    const defaultKey = Deno.env.get("DEFAULT_DEEPSEEK_API_KEY");
    if (defaultKey) {
      apiUrl = 'https://api.deepseek.com/v1/chat/completions';
      headers['Authorization'] = `Bearer ${defaultKey}`;
      model = 'deepseek-chat';
      console.log('Using default DeepSeek API');
    } else {
      throw new Error("默认API暂不可用，请配置自定义API");
    }
  } else {
    // 没有任何配置，提示用户
    throw new Error("请先在设置中配置API密钥");
  }

  // 尝试流式和非流式
  let response = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 1500,
      stream: false,
    }),
  });
  
  // 如果返回400错误，可能是模型不支持某些参数，重试
  if (response.status === 400) {
    console.log("First request failed with 400, retrying with minimal params...");
    response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
      }),
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI API error:", response.status, errorText);
    if (response.status === 429) {
      throw new Error("请求太频繁，请稍后再试");
    } else if (response.status === 402) {
      throw new Error("AI额度不足，请充值");
    }
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  
  // 检测是否被截断
  const finishReason = data.choices?.[0]?.finish_reason;
  console.log("Finish reason:", finishReason);
  if (finishReason === 'length') {
    console.warn("Response was truncated due to max_tokens limit");
  }
  
  console.log("AI API raw response:", JSON.stringify(data).slice(0, 800));
  
  let content = '';
  // 尝试多种格式提取内容
  if (data.choices?.[0]?.message?.content) {
    content = data.choices[0].message.content;
  } else if (data.choices?.[0]?.delta?.content) {
    content = data.choices[0].delta.content;
  } else if (data.choices?.[0]?.text) {
    content = data.choices[0].text;
  } else if (data.content) {
    content = data.content;
  } else if (data.result) {
    content = data.result;
  } else if (data.output?.text) {
    content = data.output.text;
  } else if (data.output?.content) {
    content = data.output.content;
  } else if (data.output) {
    content = typeof data.output === 'string' ? data.output : JSON.stringify(data.output);
  } else if (data.response) {
    content = typeof data.response === 'string' ? data.response : JSON.stringify(data.response);
  } else if (data.text) {
    content = data.text;
  } else if (data.answer) {
    content = data.answer;
  } else if (data.message?.content) {
    content = data.message.content;
  } else if (typeof data === 'string') {
    content = data;
  }
  
  console.log("Extracted content:", content?.slice(0, 200) || 'EMPTY');
  
  if (!content || content.trim() === '') {
    console.error("Empty content from API. Full response:", JSON.stringify(data));
    // 返回一个默认的有趣内容而不是错误提示
    const fallbackContents = [
      '今天也是元气满满的一天呢~ ✨',
      '刚刚看到了很美的风景，想分享给你们！🌸',
      '有点困困的，但还是想来看看大家~',
      '最近在想一些有趣的事情呢 🤔',
      '希望大家今天都开开心心的！💕'
    ];
    return fallbackContents[Math.floor(Math.random() * fallbackContents.length)];
  }
  
  // 清理内容 - 移除前后空白和多余换行
  return content.trim().replace(/^\n+|\n+$/g, '');
}

// 用视觉能力识别图片内容（优先使用用户自定义/OpenAI配置；不行再用 Lovable AI 网关）
async function getImageDescription(imageUrl: string, config: AIConfig): Promise<string> {
  const visionPrompt = '用一句话(15字以内)描述这张图片的主要内容，只说核心内容。';

  const tryParseContent = async (resp: Response) => {
    const data = await resp.json();
    return (data?.choices?.[0]?.message?.content as string | undefined)?.trim() || '';
  };

  // 1) 优先走用户配置（你填的“可识别图片”的模型就能真正派上用场）
  try {
    const canUseUserVision =
      !!config.apiKey &&
      (config.provider === 'custom' || config.provider === 'openai') &&
      (config.provider !== 'custom' || !!config.baseUrl);

    if (canUseUserVision) {
      let apiUrl = '';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      };

      let model = config.model || (config.provider === 'openai' ? 'gpt-4o-mini' : 'deepseek-chat');

      if (config.provider === 'custom') {
        let baseUrl = (config.baseUrl || '').replace(/\/+$/, '');
        if (!baseUrl.endsWith('/chat/completions')) baseUrl = `${baseUrl}/chat/completions`;
        apiUrl = baseUrl;
      } else {
        apiUrl = 'https://api.openai.com/v1/chat/completions';
      }

      console.log('Vision via user provider:', config.provider, 'model:', model);

      let response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: visionPrompt },
                { type: 'image_url', image_url: { url: imageUrl } },
              ],
            },
          ],
          max_tokens: 80,
          stream: false,
        }),
      });

      if (response.status === 400) {
        console.log('Vision user provider 400, retry minimal params...');
        response = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: visionPrompt },
                  { type: 'image_url', image_url: { url: imageUrl } },
                ],
              },
            ],
          }),
        });
      }

      if (response.ok) {
        const content = await tryParseContent(response);
        if (content) return content;
      } else {
        const t = await response.text();
        console.error('User vision API error:', response.status, t.slice(0, 400));
      }
    }
  } catch (err) {
    console.error('User vision error:', err);
  }

  // 2) 兜底：Lovable AI 网关（如果额度不足会返回 402）
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.log('No LOVABLE_API_KEY, skip image recognition');
    return '';
  }

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: visionPrompt },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
        max_tokens: 80,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error('Lovable vision API error:', response.status, t.slice(0, 400));
      return '';
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
  } catch (err) {
    console.error('Lovable image recognition error:', err);
    return '';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { character, type, userPost, userImages, userApiKey, provider, baseUrl, model: customModel, userProfile, userId } = await req.json();
    
    // 检查是否使用默认API
    const apiSetting = userId ? await checkDefaultApiSetting(userId) : { useDefault: false, defaultModel: 'deepseek-chat' };
    
    const config: AIConfig = {
      apiKey: userApiKey,
      baseUrl: baseUrl,
      model: customModel,
      provider: provider,
      useDefaultApi: apiSetting.useDefault,
      defaultModel: apiSetting.defaultModel,
    };

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
      const shortName = userName.length > 2 ? userName.slice(0, 2) : userName;
      
      // 如果有图片，识别图片内容
      let imageDescriptions = '';
      if (userImages && userImages.length > 0) {
        console.log("Recognizing user images:", userImages.length);
        const descriptions = [];
        for (const imgUrl of userImages.slice(0, 3)) { // 最多识别3张
          const desc = await getImageDescription(imgUrl, config);
          if (desc) descriptions.push(desc);
        }
        if (descriptions.length > 0) {
          imageDescriptions = `\n好友还发了${userImages.length}张图片，内容是: ${descriptions.join('、')}`;
        }
      }
      
      prompt = `你是一个名叫"${character.name}"的虚拟角色。
${character.persona ? `你的人设是: ${character.persona}` : ''}

你的好友发了一条说说："${userPost || '分享了图片'}"${imageDescriptions}
${userPersona ? `关于这位好友: ${userPersona}` : ''}

请以你的角色身份回复这条说说。要求：
- 符合你的角色性格和说话方式
- 回复要针对说说的具体内容${imageDescriptions ? '，可以评论图片内容' : ''}
- 不要每次都叫对方名字，偶尔叫"${shortName}"或用亲昵称呼如"亲"、"宝"等
- 简短自然，像朋友评论
- 可以使用emoji
- 1-2句话`;
    }

    // 日志：显示实际使用的API
    const usingCustom = userApiKey && (provider === 'custom' || provider === 'deepseek' || provider === 'openai');
    console.log("API Config received:", { hasApiKey: !!userApiKey, provider, hasBaseUrl: !!baseUrl });
    console.log(`Using provider: ${usingCustom ? provider : (apiSetting.useDefault ? 'default-api' : 'lovable-ai')}`);
    console.log(`User: ${userName}, hasImages: ${!!userImages}`);

    const content = await getAICompletion(
      [{ role: "user", content: prompt }],
      config
    );

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
