import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NovelAIConfig {
  apiKey: string;
  model?: string;
}

async function getNovelAIConfig(userId: string): Promise<NovelAIConfig | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data: apiSettings } = await supabase
    .from('api_keys')
    .select('provider, api_key')
    .eq('user_id', userId);
  
  if (!apiSettings) return null;
  
  const novelaiKey = apiSettings.find(s => s.provider === 'novelai');
  const novelaiModel = apiSettings.find(s => s.provider === 'novelai_model');
  
  if (!novelaiKey) return null;
  
  return {
    apiKey: novelaiKey.api_key,
    model: novelaiModel?.api_key || 'nai-diffusion-3',
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, userId, characterName, negativePrompt } = await req.json();
    
    if (!userId) {
      return new Response(JSON.stringify({ error: '用户未登录' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const config = await getNovelAIConfig(userId);
    
    if (!config) {
      return new Response(JSON.stringify({ error: '请先在设置中配置NovelAI API密钥' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Generating image with NovelAI:', { model: config.model, promptLength: prompt?.length });

    // 构建NovelAI请求
    const novelaiPayload = {
      input: prompt,
      model: config.model || 'nai-diffusion-3',
      action: 'generate',
      parameters: {
        width: 512,
        height: 768,
        scale: 7,
        sampler: 'k_euler_ancestral',
        steps: 28,
        n_samples: 1,
        ucPreset: 0,
        qualityToggle: true,
        negative_prompt: negativePrompt || 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry',
      },
    };

    let response;
    try {
      response = await fetch('https://image.novelai.net/ai/generate-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/zip',
        },
        body: JSON.stringify(novelaiPayload),
      });
    } catch (fetchError) {
      console.error('NovelAI fetch error (可能需要VPN):', fetchError);
      return new Response(JSON.stringify({ 
        error: '无法连接NovelAI服务器，可能需要VPN/代理访问海外服务' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('NovelAI response status:', response.status, 'content-type:', response.headers.get('content-type'));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('NovelAI API error:', response.status, errorText);
      
      if (response.status === 401) {
        return new Response(JSON.stringify({ error: 'NovelAI API密钥无效' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'NovelAI订阅已过期或额度不足' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'NovelAI请求过于频繁，请稍后再试' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ error: `NovelAI生成失败: ${response.status} - ${errorText.substring(0, 200)}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // NovelAI返回的是zip文件，需要解压获取图片
    const zipData = await response.arrayBuffer();
    
    // 简单解析zip获取图片数据（NovelAI的zip很简单，只有一个png文件）
    const uint8Array = new Uint8Array(zipData);
    
    // 找到PNG文件头 (89 50 4E 47)
    let pngStart = -1;
    for (let i = 0; i < uint8Array.length - 4; i++) {
      if (uint8Array[i] === 0x89 && uint8Array[i+1] === 0x50 && 
          uint8Array[i+2] === 0x4E && uint8Array[i+3] === 0x47) {
        pngStart = i;
        break;
      }
    }
    
    if (pngStart === -1) {
      console.error('No PNG found in response');
      return new Response(JSON.stringify({ error: '图片生成失败，未找到有效图片' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // 提取PNG数据到末尾
    const pngData = uint8Array.slice(pngStart);
    
    // 转换为base64
    const base64 = btoa(String.fromCharCode(...pngData));
    const imageUrl = `data:image/png;base64,${base64}`;
    
    console.log('Image generated successfully, size:', pngData.length);

    return new Response(JSON.stringify({ 
      success: true, 
      imageUrl,
      characterName 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('NovelAI generate error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : '未知错误' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
