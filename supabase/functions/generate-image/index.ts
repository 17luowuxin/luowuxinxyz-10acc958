import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ImageConfig {
  apiKey: string;
  apiUrl: string;
  model: string;
  enabled: boolean;
}

async function getImageConfig(userId: string): Promise<ImageConfig | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data: apiSettings } = await supabase
    .from('api_keys')
    .select('provider, api_key')
    .eq('user_id', userId);
  
  if (!apiSettings) return null;
  
  const enabled = apiSettings.find(s => s.provider === 'space_image_enabled')?.api_key === 'true';
  const apiKey = apiSettings.find(s => s.provider === 'space_image_api_key')?.api_key || '';
  const apiUrl = apiSettings.find(s => s.provider === 'space_image_api_url')?.api_key || '';
  const model = apiSettings.find(s => s.provider === 'space_image_model')?.api_key || '';
  
  if (!apiKey || !apiUrl) return null;
  
  return { enabled, apiKey, apiUrl, model };
}

async function generateImage(prompt: string, config: ImageConfig): Promise<string | null> {
  let apiUrl = config.apiUrl.replace(/\/+$/, '');
  if (!apiUrl.includes('/images/generations')) {
    apiUrl = `${apiUrl}/images/generations`;
  }
  
  console.log('Generating image with URL:', apiUrl, 'model:', config.model || 'default');
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model || 'dall-e-3',
      size: '1024x1024',
      prompt: prompt,
      n: 1,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Image generation failed:', response.status, errorText);
    throw new Error(`图片生成失败: ${response.status} - ${errorText.slice(0, 100)}`);
  }
  
  const data = await response.json();
  
  // 支持多种返回格式
  if (data.data?.[0]?.url) {
    return data.data[0].url;
  } else if (data.data?.[0]?.b64_json) {
    return `data:image/png;base64,${data.data[0].b64_json}`;
  } else if (data.url) {
    return data.url;
  } else if (data.images?.[0]?.url) {
    return data.images[0].url;
  } else if (data.images?.[0]?.b64_json) {
    return `data:image/png;base64,${data.images[0].b64_json}`;
  } else if (data.image) {
    return data.image.startsWith('data:') ? data.image : `data:image/png;base64,${data.image}`;
  }
  
  console.error('Unknown response format:', JSON.stringify(data).slice(0, 500));
  throw new Error('API返回格式无法识别');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, userId, testMode, apiKey, apiUrl, model } = await req.json();
    
    if (!prompt) {
      return new Response(JSON.stringify({ error: '请提供绘图提示词' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let config: ImageConfig;
    
    // 测试模式：直接使用传入的配置
    if (testMode && apiKey && apiUrl) {
      config = {
        apiKey,
        apiUrl,
        model: model || '',
        enabled: true,
      };
    } else if (userId) {
      // 正常模式：从数据库获取配置
      const userConfig = await getImageConfig(userId);
      if (!userConfig) {
        return new Response(JSON.stringify({ error: '未配置图片生成API，请在设置中配置' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      config = userConfig;
    } else {
      return new Response(JSON.stringify({ error: '缺少用户ID或测试配置' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Generating image for prompt:', prompt.slice(0, 100));
    
    const imageUrl = await generateImage(prompt, config);
    
    if (!imageUrl) {
      return new Response(JSON.stringify({ error: '图片生成失败' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      imageUrl,
      prompt 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Generate image error:', error);
    const errorMessage = error instanceof Error ? error.message : '图片生成失败';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
