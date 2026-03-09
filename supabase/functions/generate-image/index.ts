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

// 角色特征保持指令 - 确保垫图P图时角色外貌一致
const CHARACTER_CONSISTENCY_PROMPT = `CRITICAL: You must maintain the character's facial features, hairstyle, eye color, body proportions, and overall appearance exactly consistent with the reference image. Preserve the character's identity while adapting to the new scene. Do NOT change the character's face or key visual traits.`;

async function editImage(prompt: string, _config: ImageConfig, referenceImageBase64: string, _size?: string): Promise<{ url?: string; b64?: string }> {
  // Ensure the reference image has proper data URI format
  let imageUrl = referenceImageBase64;
  if (!imageUrl.startsWith('data:')) {
    imageUrl = `data:image/png;base64,${imageUrl}`;
  }

  // Build enhanced prompt with character consistency instructions
  const scenePrompt = prompt || '生成一张自然的日常场景图片';
  const editPrompt = `${CHARACTER_CONSISTENCY_PROMPT}\n\nScene instruction: ${scenePrompt}\n\nBased on the reference image, generate a new image of this exact same character in the described scene. Keep the character's appearance identical.`;
  
  console.log('img2img edit, scene:', scenePrompt.slice(0, 80));

  // Strategy 1: User's own API - try /images/edits (FormData) first
  console.log('Using user API for img2img');
  try {
    let editApiUrl = _config.apiUrl.replace(/\/+$/, '');
    // Try /images/edits endpoint with FormData
    const editsUrl = editApiUrl.replace(/\/images\/generations\/?$/, '') + '/images/edits';
    
    // Convert base64 to Blob for FormData
    const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '');
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'image/png' });

    const formData = new FormData();
    formData.append('image', blob, 'reference.png');
    formData.append('prompt', scenePrompt);
    if (_config.model) formData.append('model', _config.model);
    formData.append('n', '1');
    if (_size) formData.append('size', _size);

    console.log('Trying /images/edits (FormData):', editsUrl);
    const editController = new AbortController();
    const editTimeout = setTimeout(() => editController.abort(), 30000);
    const editResp = await fetch(editsUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${_config.apiKey}` },
      body: formData,
      signal: editController.signal,
    });
    clearTimeout(editTimeout);

    if (editResp.ok) {
      const data = await editResp.json();
      if (data.data?.[0]?.url) return { url: data.data[0].url };
      if (data.data?.[0]?.b64_json) return { b64: data.data[0].b64_json };
    } else {
      console.log('/images/edits failed:', editResp.status, '- trying JSON fallback');
    }
  } catch (e) {
    console.log('/images/edits error, trying JSON fallback:', e);
  }

  // Strategy 2: /images/generations with image field in JSON body (即梦/通义兼容)
  try {
    let apiUrl = _config.apiUrl.replace(/\/+$/, '');
    if (!apiUrl.includes('/images/generations')) {
      apiUrl = `${apiUrl}/images/generations`;
    }

    const jsonBody: Record<string, unknown> = {
      model: _config.model || 'dall-e-3',
      size: _size || '1024x1024',
      prompt: scenePrompt,
      n: 1,
      image: imageUrl,
      reference_image: imageUrl,
    };

    console.log('Trying /images/generations with image field:', apiUrl);
    const genController = new AbortController();
    const genTimeout = setTimeout(() => genController.abort(), 60000);
    const genResp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${_config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(jsonBody),
      signal: genController.signal,
    });
    clearTimeout(genTimeout);

    if (genResp.ok) {
      const data = await genResp.json();
      if (data.data?.[0]?.url) return { url: data.data[0].url };
      if (data.data?.[0]?.b64_json) return { b64: data.data[0].b64_json };
      if (data.url) return { url: data.url };
      if (data.image) return { url: data.image.startsWith('data:') ? data.image : `data:image/png;base64,${data.image}` };
      if (data.images?.[0]?.url) return { url: data.images[0].url };
    } else {
      console.log('JSON img2img also failed:', genResp.status);
    }
  } catch (e) {
    console.log('JSON img2img error:', e);
  }

  // Final fallback: pure text2img without reference image
  console.log('All img2img methods failed, falling back to text2img');
  return await generateImage(scenePrompt, _config, _size);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { prompt, userId, testMode, apiKey, apiUrl, model, size, stylePrompt, referenceImageBase64, action, characterId } = body;
    
    // Only use explicitly provided reference image (don't auto-load from DB)
    // Auto img2img disabled: 即梦等国产API不支持img2img，且会导致超时
    let effectiveRefBase64 = referenceImageBase64 || null;
    
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
