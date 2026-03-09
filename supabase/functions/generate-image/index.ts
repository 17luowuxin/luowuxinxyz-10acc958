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

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function dataUrlToBytes(dataUrlOrBase64: string): { bytes: Uint8Array; mime: string; dataUrl: string } {
  let dataUrl = dataUrlOrBase64;
  if (!dataUrl.startsWith('data:')) {
    dataUrl = `data:image/png;base64,${dataUrl}`;
  }

  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    // Fallback: treat as base64
    const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, mime: 'image/png', dataUrl: `data:image/png;base64,${b64}` };
  }

  const mime = match[1] || 'image/png';
  const b64 = match[2];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, mime, dataUrl };
}

async function parseImageApiResponse(response: Response): Promise<{ url?: string; b64?: string }> {
  const data = await response.json();

  if (data.data?.[0]?.url) return { url: data.data[0].url };
  if (data.data?.[0]?.b64_json) return { b64: data.data[0].b64_json };
  if (data.url) return { url: data.url };
  if (data.images?.[0]?.url) return { url: data.images[0].url };
  if (data.images?.[0]?.b64_json) return { b64: data.images[0].b64_json };
  if (data.image) {
    return { url: data.image.startsWith('data:') ? data.image : `data:image/png;base64,${data.image}` };
  }

  console.error('Unknown response format:', JSON.stringify(data).slice(0, 500));
  throw new Error('API返回格式无法识别');
}

function buildImagesEndpoint(baseUrl: string, kind: 'generations' | 'edits'): string {
  let url = baseUrl.replace(/\/+$/, '');

  // If user provided the full images endpoint, normalize to requested kind.
  url = url.replace(/\/images\/(generations|edits)\b/, `/images/${kind}`);

  // If it already points to /images/{kind}, keep it.
  if (url.includes(`/images/${kind}`)) return url;

  // Otherwise append.
  return `${url}/images/${kind}`;
}

async function generateImage(prompt: string, config: ImageConfig, size?: string): Promise<{ url?: string; b64?: string }> {
  const apiUrl = buildImagesEndpoint(config.apiUrl, 'generations');
  console.log('Generating image with URL:', apiUrl, 'model:', config.model || 'default', 'size:', size || '1024x1024');

  const response = await fetchWithTimeout(
    apiUrl,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model || 'dall-e-3',
        size: size || '1024x1024',
        prompt,
        n: 1,
      }),
    },
    45_000,
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Image generation failed:', response.status, errorText);
    throw new Error(`图片生成失败: ${response.status} - ${errorText.slice(0, 120)}`);
  }

  return await parseImageApiResponse(response);
}

// 角色特征保持指令 - 垫图/P图时强化“保持脸”
const CHARACTER_CONSISTENCY_PROMPT = `CRITICAL: You must maintain the character's facial features, hairstyle, eye color, body proportions, and overall appearance exactly consistent with the reference image. Preserve the character's identity while adapting to the new scene. Do NOT change the character's face or key visual traits.`;

async function editImageMultipart(prompt: string, config: ImageConfig, referenceDataUrl: string, size?: string) {
  const apiUrl = buildImagesEndpoint(config.apiUrl, 'edits');
  const { bytes, mime } = dataUrlToBytes(referenceDataUrl);

  const fd = new FormData();
  fd.append('model', config.model || 'dall-e-3');
  fd.append('prompt', prompt);
  fd.append('n', '1');
  fd.append('size', size || '1024x1024');
  fd.append('image', new Blob([bytes], { type: mime }), 'reference.png');

  console.log('img2img via /images/edits multipart:', apiUrl);
  try {
    const response = await fetchWithTimeout(
      apiUrl,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          // NOTE: do NOT set Content-Type for multipart
        },
        body: fd,
      },
      25_000,
    );

    if (!response.ok) {
      const t = await response.text().catch(() => '');
      throw new Error(`img2img(/edits)失败: ${response.status} ${t.slice(0, 200)}`);
    }

    return await parseImageApiResponse(response);
  } catch (e) {
    console.error('img2img(/edits) multipart error:', e instanceof Error ? e.message : e);
    throw e;
  }
}

async function editImageJson(prompt: string, config: ImageConfig, referenceDataUrl: string, size?: string) {
  const apiUrl = buildImagesEndpoint(config.apiUrl, 'generations');
  console.log('img2img via /images/generations JSON:', apiUrl);

  try {
    const response = await fetchWithTimeout(
      apiUrl,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model || 'dall-e-3',
          size: size || '1024x1024',
          prompt,
          n: 1,
          image: referenceDataUrl,
          reference_image: referenceDataUrl,
        }),
      },
      25_000,
    );

    if (!response.ok) {
      const t = await response.text().catch(() => '');
      throw new Error(`img2img(JSON)失败: ${response.status} ${t.slice(0, 200)}`);
    }

    return await parseImageApiResponse(response);
  } catch (e) {
    console.error('img2img(JSON) error:', e instanceof Error ? e.message : e);
    throw e;
  }
}

async function editImage(prompt: string, config: ImageConfig, referenceImageBase64: string, size?: string): Promise<{ url?: string; b64?: string }> {
  const ref = dataUrlToBytes(referenceImageBase64).dataUrl;
  const editPrompt = `${CHARACTER_CONSISTENCY_PROMPT}\n${prompt || '保持角色形象，生成一张自然的日常场景图片'}`;

  try {
    return await editImageMultipart(editPrompt, config, ref, size);
  } catch (e) {
    console.log('img2img multipart failed, try JSON fallback:', e instanceof Error ? e.message : e);
  }

  try {
    return await editImageJson(editPrompt, config, ref, size);
  } catch (e) {
    console.log('img2img JSON failed, falling back to text2img');
  }

  return await generateImage(prompt || '生成一张自然的日常场景图片', config, size);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { prompt, userId, testMode, apiKey, apiUrl, model, size, stylePrompt, referenceImageBase64, action, characterId } = body;
    
    // Auto-load per-character reference image if characterId provided
    let effectiveRefBase64 = referenceImageBase64 || null;
    if (!effectiveRefBase64 && characterId && userId && !testMode) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const sb = createClient(supabaseUrl, supabaseKey);
        const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL');
        const externalKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY');
        
        let refUrl = '';
        
        const { data: cloudRef } = await sb.from('api_keys').select('provider, api_key')
          .eq('user_id', userId).in('provider', [`nai_ref_image_${characterId}`]);
        if (cloudRef) {
          const img = cloudRef.find((r: any) => r.provider === `nai_ref_image_${characterId}`);
          if (img) refUrl = img.api_key;
        }
        
        if (externalUrl && externalKey) {
          const ext = createClient(externalUrl, externalKey);
          const { data: extRef } = await ext.from('api_keys').select('provider, api_key')
            .eq('user_id', userId).in('provider', [`nai_ref_image_${characterId}`]);
          if (extRef) {
            const img = extRef.find((r: any) => r.provider === `nai_ref_image_${characterId}`);
            if (img) refUrl = img.api_key;
          }
        }
        
        if (refUrl) {
          console.log('Auto-loaded character reference image for', characterId);
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);
            const imgResp = await fetch(refUrl, { signal: controller.signal });
            clearTimeout(timeout);
            if (imgResp.ok) {
              const buf = await imgResp.arrayBuffer();
              const b64 = uint8ToBase64(new Uint8Array(buf));
              effectiveRefBase64 = `data:image/png;base64,${b64}`;
              console.log('Loaded character ref image, size:', buf.byteLength);
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
