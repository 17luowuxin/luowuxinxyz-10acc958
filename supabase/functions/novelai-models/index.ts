import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// NovelAI可用的模型列表
const NOVELAI_MODELS = [
  { id: 'nai-diffusion-4-curated-preview', name: 'NAI Diffusion V4 (Curated)', description: '最新模型，高质量输出' },
  { id: 'nai-diffusion-3', name: 'NAI Diffusion V3 (Anime Full)', description: '动漫风格，完整版' },
  { id: 'nai-diffusion-2', name: 'NAI Diffusion V2', description: '上一代模型' },
  { id: 'safe-diffusion', name: 'Safe Diffusion', description: '安全版本' },
  { id: 'nai-diffusion-furry', name: 'NAI Diffusion Furry', description: 'Furry风格' },
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
