import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// NovelAI可用的模型列表 - 官方最新模型列表
const NOVELAI_MODELS = [
  // NEW - V4.5 最新模型
  { id: 'nai-diffusion-4-5-curated', name: 'NAI Diffusion V4.5 Curated', description: '最新模型，精选数据集训练，推荐流媒体使用' },
  { id: 'nai-diffusion-4-5-full', name: 'NAI Diffusion V4.5 Full', description: '最新最强模型' },
  // V4 模型
  { id: 'nai-diffusion-4-curated-preview', name: 'NAI Diffusion V4 Curated', description: '精选模型，不再推荐使用' },
  { id: 'nai-diffusion-4-full', name: 'NAI Diffusion V4 Full', description: 'V4完整模型' },
  // Legacy 旧版模型
  { id: 'nai-diffusion-3', name: 'NAI Diffusion Anime V3', description: '旧版动漫模型，不再推荐' },
  { id: 'nai-diffusion-furry-3', name: 'NAI Diffusion Furry V3', description: 'Furry风格V3' },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { apiKey } = await req.json();

    if (!apiKey) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: '请提供API密钥' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 验证API密钥是否有效
    const response = await fetch('https://api.novelai.net/user/subscription', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'API密钥无效或已过期' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const subscriptionData = await response.json();
    console.log('NovelAI subscription:', subscriptionData.tier);

    return new Response(JSON.stringify({ 
      success: true, 
      models: NOVELAI_MODELS,
      subscription: subscriptionData.tier
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('NovelAI models error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : '未知错误' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
