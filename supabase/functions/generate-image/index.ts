import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authErrorResponse, requireUser } from "../_shared/require-user.ts";

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
  
  const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL');
  const externalKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY');
  
  let allSettings: any[] = [];
  
  const { data: cloudData } = await supabase
    .from('api_keys')
    .select('provider, api_key')
    .eq('user_id', userId);
  if (cloudData) allSettings = [...cloudData];
  
  if (externalUrl && externalKey) {
    const extClient = createClient(externalUrl, externalKey);
    const { data: extData } = await extClient
      .from('api_keys')
      .select('provider, api_key')
      .eq('user_id', userId);
    if (extData) {
      const extMap = new Map(extData.map(s => [s.provider, s.api_key]));
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
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('图片生成超时，请稍后再试或换一个更快的模型');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function buildImagesEndpoint(baseUrl: string): string {
  let url = baseUrl.replace(/\/+$/, '');
  url = url.replace(/\/images\/(generations|edits)\b/, '/images/generations');
  if (url.includes('/images/generations')) return url;
  return `${url}/images/generations`;
}

function buildEditsEndpoint(baseUrl: string): string {
  return buildImagesEndpoint(baseUrl).replace(/\/images\/generations$/, '/images/edits');
}

async function referenceImageToBlob(reference: string): Promise<Blob | null> {
  try {
    if (reference.startsWith('data:')) {
      const [meta, b64] = reference.split(',');
      const mime = meta.match(/data:([^;]+)/)?.[1] || 'image/png';
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      return new Blob([bytes], { type: mime });
    }
    if (/^https?:\/\//.test(reference)) {
      const res = await fetchWithTimeout(reference, {}, 20_000);
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      return new Blob([buf], { type: res.headers.get('content-type') || 'image/png' });
    }
  } catch (err) {
    console.error('reference image load failed:', err);
  }
  return null;
}

// 垫图（参考图）→ 图生图
async function editImage(
  prompt: string,
  config: ImageConfig,
  referenceImage: string,
  size?: string,
): Promise<{ url?: string; b64?: string }> {
  const blob = await referenceImageToBlob(referenceImage);
  if (!blob) throw new Error('参考图读取失败');

  const form = new FormData();
  form.append('model', config.model || 'gpt-image-1');
  form.append('prompt', prompt);
  form.append('image', blob, 'reference.png');
  if (size) form.append('size', size);
  form.append('n', '1');

  const apiUrl = buildEditsEndpoint(config.apiUrl);
  console.log('img2img URL:', apiUrl, 'model:', config.model || 'default');

  const response = await fetchWithTimeout(
    apiUrl,
    { method: 'POST', headers: { Authorization: `Bearer ${config.apiKey}` }, body: form },
    110_000,
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`垫图生成失败: ${response.status} - ${errorText.slice(0, 120)}`);
  }

  return await parseImageApiResponse(response);
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

// 纯文生图
async function generateImage(prompt: string, config: ImageConfig, size?: string): Promise<{ url?: string; b64?: string }> {
  const apiUrl = buildImagesEndpoint(config.apiUrl);
  console.log('Text2img URL:', apiUrl, 'model:', config.model || 'default', 'size:', size || '1024x1024');

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
    50_000,
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Image generation failed:', response.status, errorText);
    throw new Error(`图片生成失败: ${response.status} - ${errorText.slice(0, 120)}`);
  }

  return await parseImageApiResponse(response);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { prompt, userId, testMode, apiKey, apiUrl, model, size, stylePrompt } = body;
    const auth = await requireUser(req, userId);
    if (!auth.ok) return authErrorResponse(auth, corsHeaders);
    
    if (!prompt) {
      return new Response(JSON.stringify({ success: false, error: '请提供绘图提示词' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let config: ImageConfig;
    
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
        return new Response(JSON.stringify({ success: false, error: '未配置图片生成API，请在设置中配置' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      config = userConfig;
    } else {
      return new Response(JSON.stringify({ success: false, error: '缺少用户ID或测试配置' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build final prompt with style prefix
    let finalPrompt = prompt;
    const mergedStylePrompt = stylePrompt || config.stylePrompt || '';
    if (mergedStylePrompt) {
      finalPrompt = `${mergedStylePrompt}, ${finalPrompt}`;
    }

  console.log(`[text2img] request size: ${size || 'default'}`);
    
    const finalSize = size || config.imageSize || '1024x1024';
    const result = await generateImage(finalPrompt, config, finalSize);
    
    const imageUrl = result.url || (result.b64 ? `data:image/png;base64,${result.b64}` : null);
    
    if (!imageUrl) {
      return new Response(JSON.stringify({ success: false, error: '图片生成失败' }), {
        status: 200,
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
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
