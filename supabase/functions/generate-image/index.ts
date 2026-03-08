import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Safe base64 encoding that doesn't overflow the stack
function uint8ToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
  }
  return btoa(parts.join(''));
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ImageConfig {
  apiKey: string;
  apiUrl: string;
  model: string;
  enabled: boolean;
  imageSize?: string;
  stylePrompt?: string;
}

async function getImageConfig(userId: string): Promise<ImageConfig | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Try external DB first, then cloud
  const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL');
  const externalKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY');
  
  let allSettings: any[] = [];
  
  // Cloud DB
  const { data: cloudData } = await supabase
    .from('api_keys')
    .select('provider, api_key')
    .eq('user_id', userId);
  if (cloudData) allSettings = [...cloudData];
  
  // External DB (overrides cloud)
  if (externalUrl && externalKey) {
    const extClient = createClient(externalUrl, externalKey);
    const { data: extData } = await extClient
      .from('api_keys')
      .select('provider, api_key')
      .eq('user_id', userId);
    if (extData) {
      const extMap = new Map(extData.map(s => [s.provider, s.api_key]));
      // Merge: external overrides cloud
      const merged = new Map(allSettings.map(s => [s.provider, s.api_key]));
      extMap.forEach((v, k) => merged.set(k, v));
      allSettings = Array.from(merged.entries()).map(([provider, api_key]) => ({ provider, api_key }));
    }
  }
  
  if (!allSettings.length) return null;
  
  const get = (p: string) => allSettings.find(s => s.provider === p)?.api_key || '';
  
  const enabled = get('space_image_enabled') === 'true';
  const apiKey = get('space_image_api_key');
  const apiUrl = get('space_image_api_url');
  const model = get('space_image_model');
  const imageSize = get('space_image_size');
  const stylePrompt = get('space_image_style_prompt');
  
  if (!apiKey || !apiUrl) return null;
  
  return { enabled, apiKey, apiUrl, model, imageSize, stylePrompt };
}

async function generateImage(prompt: string, config: ImageConfig, size?: string): Promise<{ url?: string; b64?: string }> {
  let apiUrl = config.apiUrl.replace(/\/+$/, '');
  if (!apiUrl.includes('/images/generations')) {
    apiUrl = `${apiUrl}/images/generations`;
  }
  
  console.log('Generating image with URL:', apiUrl, 'model:', config.model || 'default', 'size:', size || '1024x1024');
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model || 'dall-e-3',
      size: size || '1024x1024',
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
  
  // Support multiple response formats
  if (data.data?.[0]?.url) {
    return { url: data.data[0].url };
  } else if (data.data?.[0]?.b64_json) {
    return { b64: data.data[0].b64_json };
  } else if (data.url) {
    return { url: data.url };
  } else if (data.images?.[0]?.url) {
    return { url: data.images[0].url };
  } else if (data.images?.[0]?.b64_json) {
    return { b64: data.images[0].b64_json };
  } else if (data.image) {
    return { url: data.image.startsWith('data:') ? data.image : `data:image/png;base64,${data.image}` };
  }
  
  console.error('Unknown response format:', JSON.stringify(data).slice(0, 500));
  throw new Error('API返回格式无法识别');
}

async function editImage(prompt: string, _config: ImageConfig, referenceImageBase64: string, _size?: string): Promise<{ url?: string; b64?: string }> {
  // Use Lovable AI (Gemini flash-image) for native image editing - like Jimeng P图
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.error('LOVABLE_API_KEY not configured, cannot do img2img');
    throw new Error('图片编辑功能需要内置AI支持');
  }

  // Ensure the reference image has proper data URI format
  let imageUrl = referenceImageBase64;
  if (!imageUrl.startsWith('data:')) {
    imageUrl = `data:image/png;base64,${imageUrl}`;
  }

  const editPrompt = prompt || '基于这张图片，保持角色外貌和风格不变，生成一张自然的新图片';
  console.log('Using Lovable AI for img2img edit, prompt:', editPrompt.slice(0, 100));

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-image',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: editPrompt },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      modalities: ['image', 'text'],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Lovable AI img2img failed:', response.status, errText.slice(0, 200));
    // Fallback to text2img with user's own API
    console.log('Falling back to text2img');
    return await generateImage(prompt, _config, _size);
  }

  const data = await response.json();
  const editedImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (editedImageUrl) {
    return { url: editedImageUrl };
  }

  console.log('Lovable AI returned no image, falling back to text2img');
  return await generateImage(prompt, _config, _size);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { prompt, userId, testMode, apiKey, apiUrl, model, size, stylePrompt, referenceImageBase64, action, characterId } = body;
    
    // Auto-load per-character reference image if characterId provided and no explicit referenceImageBase64
    let effectiveRefBase64 = referenceImageBase64 || null;
    if (!effectiveRefBase64 && characterId && userId && !testMode) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const sb = createClient(supabaseUrl, supabaseKey);
        const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL');
        const externalKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY');
        
        let refUrl = '';
        let refStrength = 0.6;
        
        // Check cloud first
        const { data: cloudRef } = await sb.from('api_keys').select('provider, api_key')
          .eq('user_id', userId).in('provider', [`nai_ref_image_${characterId}`, `nai_ref_strength_${characterId}`]);
        if (cloudRef) {
          const img = cloudRef.find((r: any) => r.provider === `nai_ref_image_${characterId}`);
          const str = cloudRef.find((r: any) => r.provider === `nai_ref_strength_${characterId}`);
          if (img) refUrl = img.api_key;
          if (str) refStrength = parseFloat(str.api_key) || 0.6;
        }
        
        // Check external (override)
        if (externalUrl && externalKey) {
          const ext = createClient(externalUrl, externalKey);
          const { data: extRef } = await ext.from('api_keys').select('provider, api_key')
            .eq('user_id', userId).in('provider', [`nai_ref_image_${characterId}`, `nai_ref_strength_${characterId}`]);
          if (extRef) {
            const img = extRef.find((r: any) => r.provider === `nai_ref_image_${characterId}`);
            const str = extRef.find((r: any) => r.provider === `nai_ref_strength_${characterId}`);
            if (img) refUrl = img.api_key;
            if (str) refStrength = parseFloat(str.api_key) || 0.6;
          }
        }
        
        if (refUrl) {
          console.log('Auto-loaded character reference image for', characterId, 'strength:', refStrength);
          // Fetch the image as base64
          try {
            const imgResp = await fetch(refUrl);
            if (imgResp.ok) {
              const buf = await imgResp.arrayBuffer();
              const b64 = uint8ToBase64(new Uint8Array(buf));
              effectiveRefBase64 = `data:image/png;base64,${b64}`;
              console.log('Successfully loaded character ref image, size:', buf.byteLength);
            }
          } catch (e) {
            console.error('Failed to fetch character reference image:', e);
          }
        }
      } catch (e) {
        console.error('Error loading character reference image:', e);
      }
    }
    
    // Determine effective action
    const effectiveAction = action || (effectiveRefBase64 ? 'edit-image' : 'generate-image');
    
    if (!prompt && effectiveAction !== 'edit-image') {
      return new Response(JSON.stringify({ error: '请提供绘图提示词' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let config: ImageConfig;
    
    // Test mode: use provided config directly
    if (testMode && apiKey && apiUrl) {
      config = {
        apiKey,
        apiUrl,
        model: model || '',
        enabled: true,
      };
    } else if (userId) {
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

    // Build final prompt with style prefix
    let finalPrompt = prompt || '';
    const mergedStylePrompt = stylePrompt || config.stylePrompt || '';
    if (mergedStylePrompt) {
      finalPrompt = `${mergedStylePrompt}, ${finalPrompt}`;
    }

    console.log(`[${effectiveAction}] prompt: ${finalPrompt.slice(0, 100)}, size: ${size || 'default'}`);
    
    let result: { url?: string; b64?: string };
    
    const finalSize = size || config.imageSize || '1024x1024';

    if (effectiveAction === 'edit-image' && effectiveRefBase64) {
      result = await editImage(finalPrompt, config, effectiveRefBase64, finalSize);
    } else {
      const genResult = await generateImage(finalPrompt, config, finalSize);
      result = genResult;
    }
    
    const imageUrl = result.url || (result.b64 ? `data:image/png;base64,${result.b64}` : null);
    
    if (!imageUrl) {
      return new Response(JSON.stringify({ error: '图片生成失败' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      imageUrl,
      b64: result.b64 || null,
      prompt: finalPrompt,
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
