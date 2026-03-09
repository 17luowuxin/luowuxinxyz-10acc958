import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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

interface AIConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  provider?: string;
  useDefaultApi?: boolean;
  defaultModel?: string;
}

interface SpaceImageConfig {
  enabled: boolean;
  apiKey: string;
  apiUrl: string;
  model: string;
  stylePrompt: string;
  size: string;
}

interface UnsplashConfig {
  enabled: boolean;
  accessKey: string;
  category: string;
}

// 从 Cloud 和 External 两个数据库获取 api_keys，合并结果（外部优先）
async function fetchApiSettings(userId: string) {
  if (!userId) return null;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const cloudClient = createClient(supabaseUrl, supabaseKey);

  const { data: cloudSettings } = await cloudClient
    .from('api_keys')
    .select('provider, api_key')
    .eq('user_id', userId);

  const extUrl = Deno.env.get('EXTERNAL_SUPABASE_URL');
  const extKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY');
  let externalSettings: any[] | null = null;
  if (extUrl && extKey) {
    try {
      const extClient = createClient(extUrl, extKey);
      const { data } = await extClient
        .from('api_keys')
        .select('provider, api_key')
        .eq('user_id', userId);
      externalSettings = data;
    } catch (e) {
      console.warn('Failed to read external api_keys:', e);
    }
  }

  const merged = new Map<string, string>();
  if (cloudSettings) {
    for (const s of cloudSettings) merged.set(s.provider, s.api_key);
  }
  if (externalSettings) {
    for (const s of externalSettings) merged.set(s.provider, s.api_key);
  }

  if (merged.size === 0) return null;
  return merged;
}

async function checkDefaultApiSetting(userId: string): Promise<{ useDefault: boolean; defaultModel: string }> {
  if (!userId) return { useDefault: false, defaultModel: 'deepseek-chat' };
  
  const settings = await fetchApiSettings(userId);
  let useDefault = false;
  let defaultModel = 'deepseek-chat';
  
  if (settings) {
    if (settings.get('use_default_api') === 'true') useDefault = true;
    const dm = settings.get('default_model');
    if (dm) defaultModel = dm;
  }
  return { useDefault, defaultModel };
}

async function getSpaceImageConfig(userId: string): Promise<SpaceImageConfig | null> {
  if (!userId) return null;
  const settings = await fetchApiSettings(userId);
  if (!settings) return null;
  
  const enabled = settings.get('space_image_enabled') === 'true';
  const apiKey = settings.get('space_image_api_key') || '';
  const apiUrl = settings.get('space_image_api_url') || '';
  const model = settings.get('space_image_model') || '';
  const stylePrompt = settings.get('space_image_style_prompt') || '';
  const size = settings.get('space_image_size') || '1024x1024';
  
  if (!enabled || !apiKey || !apiUrl) return null;
  return { enabled, apiKey, apiUrl, model, stylePrompt, size };
}

// 获取角色专属垫图设置
async function getCharacterRefImage(userId: string, characterId: string): Promise<{ refImageUrl: string } | null> {
  if (!userId || !characterId) return null;
  const settings = await fetchApiSettings(userId);
  if (!settings) return null;
  
  const refUrl = settings.get(`nai_ref_image_${characterId}`) || '';
  
  if (!refUrl) return null;
  return { refImageUrl: refUrl };
}

async function getUnsplashConfig(userId: string): Promise<UnsplashConfig | null> {
  if (!userId) return null;
  const settings = await fetchApiSettings(userId);
  if (!settings) return null;
  
  const enabled = settings.get('unsplash_enabled') === 'true';
  const accessKey = settings.get('unsplash_access_key') || '';
  const category = settings.get('unsplash_category') || 'auto';
  
  if (!enabled || !accessKey) return null;
  return { enabled, accessKey, category };
}

// 根据分类获取搜索修饰词
function getCategoryModifier(category: string): string {
  const categoryMap: Record<string, string> = {
    nature: 'nature landscape scenery',
    city: 'city urban architecture street',
    people: 'people portrait lifestyle',
    food: 'food cuisine delicious',
    animals: 'animals pets wildlife',
    art: 'art design illustration abstract',
    travel: 'travel destination vacation',
    minimal: 'minimal simple clean aesthetic',
  };
  return categoryMap[category] || '';
}

// 使用 Unsplash 搜索图片
async function searchUnsplashImage(keywords: string[], config: UnsplashConfig): Promise<string | null> {
  try {
    const categoryModifier = getCategoryModifier(config.category);
    
    for (const keyword of keywords) {
      const searchQuery = config.category !== 'auto' && categoryModifier 
        ? `${keyword} ${categoryModifier}` 
        : keyword;
      
      console.log('Searching Unsplash with query:', searchQuery, 'category:', config.category);
      
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=10&orientation=squarish`,
        {
          headers: {
            'Authorization': `Client-ID ${config.accessKey}`,
          },
        }
      );
      
      if (!response.ok) {
        console.error('Unsplash API error:', response.status);
        continue;
      }
      
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const randomIndex = Math.floor(Math.random() * Math.min(data.results.length, 5));
        const photo = data.results[randomIndex];
        console.log('Found Unsplash image for keyword:', keyword, 'category:', config.category);
        return photo.urls?.regular || photo.urls?.small || null;
      }
    }
    
    console.log('No Unsplash images found for any keywords');
    return null;
  } catch (error) {
    console.error('Unsplash search error:', error);
    return null;
  }
}

// 角色特征保持指令（仅用于垫图/编辑场景时强化“保持脸”）
const CHARACTER_CONSISTENCY_PROMPT = `CRITICAL: You must maintain the character's facial features, hairstyle, eye color, body proportions, and overall appearance exactly consistent with the reference image. Preserve the character's identity while adapting to the new scene. Do NOT change the character's face or key visual traits.`;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  const b64 = uint8ToBase64(bytes);
  return `data:${mime};base64,${b64}`;
}

function dataUrlToBytes(dataUrlOrBase64: string): { bytes: Uint8Array; mime: string; dataUrl: string } {
  let dataUrl = dataUrlOrBase64;
  if (!dataUrl.startsWith('data:')) dataUrl = `data:image/png;base64,${dataUrl}`;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
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

function buildImagesEndpoint(baseUrl: string, kind: 'generations' | 'edits'): string {
  let url = baseUrl.replace(/\/+$/, '');

  // If user provided the full images endpoint, normalize to requested kind.
  url = url.replace(/\/images\/(generations|edits)\b/, `/images/${kind}`);

  if (url.includes(`/images/${kind}`)) return url;
  return `${url}/images/${kind}`;
}

async function parseImageUrlFromResponse(response: Response): Promise<string | null> {
  const data = await response.json();

  if (data.data?.[0]?.url) return data.data[0].url;
  if (data.data?.[0]?.b64_json) return `data:image/png;base64,${data.data[0].b64_json}`;
  if (data.url) return data.url;
  if (data.image) return data.image.startsWith('data:') ? data.image : `data:image/png;base64,${data.image}`;
  if (data.images?.[0]?.url) return data.images[0].url;
  if (data.images?.[0]?.b64_json) return `data:image/png;base64,${data.images[0].b64_json}`;
  if (data.output?.url) return data.output.url;

  console.log('No image URL found in response:', JSON.stringify(data).slice(0, 500));
  return null;
}

async function tryImg2ImgMultipart(
  prompt: string,
  config: SpaceImageConfig,
  refDataUrl: string,
  timeoutMs: number,
): Promise<string | null> {
  const apiUrl = buildImagesEndpoint(config.apiUrl, 'edits');
  const { bytes, mime } = dataUrlToBytes(refDataUrl);

  const fd = new FormData();
  fd.append('model', config.model || 'dall-e-3');
  fd.append('prompt', prompt);
  fd.append('n', '1');
  fd.append('size', config.size || '1024x1024');
  fd.append('image', new Blob([bytes], { type: mime }), 'reference.png');

  console.log('img2img via /images/edits multipart:', apiUrl, 'timeoutMs:', timeoutMs);
  try {
    const response = await fetchWithTimeout(
      apiUrl,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: fd,
      },
      timeoutMs,
    );

    if (!response.ok) {
      const t = await response.text().catch(() => '');
      console.error('img2img(/edits) failed:', response.status, t.slice(0, 200));
      return null;
    }

    return await parseImageUrlFromResponse(response);
  } catch (e) {
    console.error('img2img(/edits) multipart threw error:', e instanceof Error ? e.message : e);
    return null;
  }
}

async function tryImg2ImgJson(
  prompt: string,
  config: SpaceImageConfig,
  refDataUrl: string,
  timeoutMs: number,
): Promise<string | null> {
  const apiUrl = buildImagesEndpoint(config.apiUrl, 'generations');

  console.log('img2img via /images/generations JSON:', apiUrl, 'timeoutMs:', timeoutMs);
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
          size: config.size || '1024x1024',
          prompt,
          n: 1,
          image: refDataUrl,
          reference_image: refDataUrl,
        }),
      },
      timeoutMs,
    );

    if (!response.ok) {
      const t = await response.text().catch(() => '');
      console.error('img2img(JSON) failed:', response.status, t.slice(0, 200));
      return null;
    }

    return await parseImageUrlFromResponse(response);
  } catch (e) {
    console.error('img2img(JSON) threw error:', e instanceof Error ? e.message : e);
    return null;
  }
}

// 生成图片（垫图优先走用户配置的 OpenAI 兼容接口；若超时/失败，使用 Lovable AI 兜底并上传到公共存储）
function sizeToAspectHint(size?: string): string {
  const s = (size || '').trim();
  if (!s) return '';
  if (s === '1024x1024') return 'square (1:1)';
  if (s === '768x1024') return 'portrait (3:4)';
  if (s === '1024x768') return 'landscape (4:3)';

  const m = s.match(/^(\d{2,4})x(\d{2,4})$/);
  if (!m) return '';
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return '';
  const ratio = (w / h).toFixed(2);
  return `aspect ratio ~${ratio} (${w}x${h})`;
}

async function generateImageViaLovable(prompt: string, size: string, timeoutMs: number): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) return null;

  const aspectHint = sizeToAspectHint(size);
  const instruction = [
    'Generate ONE high-quality image. No text overlay, no watermark.',
    aspectHint ? `Prefer ${aspectHint}.` : '',
    `Prompt: ${prompt}`,
  ].filter(Boolean).join('\n');

  try {
    const resp = await fetchWithTimeout(
      'https://ai.gateway.lovable.dev/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-image',
          messages: [{ role: 'user', content: instruction }],
          modalities: ['image', 'text'],
        }),
      },
      timeoutMs,
    );

    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      console.error('Lovable image API error:', resp.status, t.slice(0, 400));
      return null;
    }

    const data = await resp.json();
    const imageUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url as string | undefined;
    if (!imageUrl) {
      console.error('Lovable image API returned no image:', JSON.stringify(data).slice(0, 500));
      return null;
    }

    return imageUrl;
  } catch (e) {
    console.error('Lovable image generation threw error:', e instanceof Error ? e.message : e);
    return null;
  }
}

async function uploadImageDataUrlToPublicBucket(dataUrl: string, userId: string, prefix: string): Promise<string | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const { bytes, mime } = dataUrlToBytes(dataUrl);
    const ext = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : 'png';
    const path = `${prefix}/${userId || 'anonymous'}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const { error } = await sb.storage
      .from('chat-images')
      .upload(path, new Blob([bytes], { type: mime }), {
        contentType: mime,
        upsert: true,
        cacheControl: '3600',
      });

    if (error) {
      console.error('Image upload error:', error);
      return null;
    }

    const { data } = sb.storage.from('chat-images').getPublicUrl(path);
    return data?.publicUrl || null;
  } catch (e) {
    console.error('uploadImageDataUrlToPublicBucket error:', e instanceof Error ? e.message : e);
    return null;
  }
}

async function generateImage(
  prompt: string,
  config: SpaceImageConfig,
  userId: string,
  refImageUrl?: string,
): Promise<string | null> {
  // Hard cap to avoid Edge Function wall-time aborts
  const deadline = Date.now() + 58_000;
  const msLeft = () => Math.max(2_000, deadline - Date.now());

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

  try {
    // 添加画风提示词前缀
    let finalPrompt = prompt;
    if (config.stylePrompt) finalPrompt = `${config.stylePrompt}, ${finalPrompt}`;

    console.log('Generating image with prompt:', finalPrompt.slice(0, 100), 'size:', config.size || '1024x1024');

    // 垫图：优先 /images/edits（multipart），其次 JSON 兼容
    if (refImageUrl) {
      try {
        console.log('Loading reference image for img2img...');

        const refTimeout = Math.min(8_000, msLeft() - 4_000);
        if (refTimeout > 2_000) {
          const imgResp = await fetchWithTimeout(refImageUrl, { method: 'GET' }, refTimeout);
          if (imgResp.ok) {
            const mime = imgResp.headers.get('content-type') || 'image/png';
            const buf = new Uint8Array(await imgResp.arrayBuffer());
            const refDataUrl = bytesToDataUrl(buf, mime);

            const editPrompt = `${CHARACTER_CONSISTENCY_PROMPT}\n${finalPrompt}`;

            // 给垫图接口充足时间（最多45s）
            const editsTimeout = Math.min(45_000, msLeft() - 4_000);
            if (editsTimeout > 4_000) {
              const edits = await tryImg2ImgMultipart(editPrompt, config, refDataUrl, editsTimeout);
              if (edits) return edits;
            }

            const jsonTimeout = Math.min(20_000, msLeft() - 4_000);
            if (jsonTimeout > 4_000) {
              const jsonEdits = await tryImg2ImgJson(editPrompt, config, refDataUrl, jsonTimeout);
              if (jsonEdits) return jsonEdits;
            }

            console.log('img2img failed, will try text2img fallback');
          }
        }
      } catch (e) {
        console.error('Failed to load/use ref image:', e instanceof Error ? e.message : e);
      }
    }

    // 文生图：优先用户配置的即梦等接口，给足时间（最多50s）
    const apiUrl = buildImagesEndpoint(config.apiUrl, 'generations');
    const textTimeout = Math.min(50_000, msLeft() - 4_000);

    if (textTimeout > 6_000) {
      console.log('Trying external text2img...', apiUrl, 'timeoutMs:', textTimeout);
      try {
        const response = await fetchWithTimeout(
          apiUrl,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: config.model || 'dall-e-3',
              size: config.size || '1024x1024',
              prompt: finalPrompt,
              n: 1,
            }),
          },
          textTimeout,
        );

        if (response.ok) {
          const out = await parseImageUrlFromResponse(response);
          if (out) return out;
        } else {
          const errText = await response.text().catch(() => '');
          console.error('External text2img error:', response.status, errText.slice(0, 300));
        }
      } catch (e) {
        console.error('External text2img threw error:', e instanceof Error ? e.message : e);
      }
    } else {
      console.log('Skip external text2img due to low budget:', textTimeout);
    }

    console.error('Image generation failed: all external API attempts exhausted');
    return null;
  } catch (error) {
    console.error('Image generation error:', error);
    return null;
  }
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
    throw new Error("请先在设置中配置API密钥");
  }

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
  
  const finishReason = data.choices?.[0]?.finish_reason;
  console.log("Finish reason:", finishReason);
  if (finishReason === 'length') {
    console.warn("Response was truncated due to max_tokens limit");
  }
  
  console.log("AI API raw response:", JSON.stringify(data).slice(0, 800));
  
  let content = '';
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
    const fallbackContents = [
      '今天也是元气满满的一天呢~ ✨',
      '刚刚看到了很美的风景，想分享给你们！🌸',
      '有点困困的，但还是想来看看大家~',
      '最近在想一些有趣的事情呢 🤔',
      '希望大家今天都开开心心的！💕'
    ];
    return fallbackContents[Math.floor(Math.random() * fallbackContents.length)];
  }
  
  return content.trim().replace(/^\n+|\n+$/g, '');
}

async function getImageDescription(imageUrl: string, config: AIConfig): Promise<string> {
  const visionPrompt = '用一句话(15字以内)描述这张图片的主要内容，只说核心内容。';

  const tryParseContent = async (resp: Response) => {
    const data = await resp.json();
    return (data?.choices?.[0]?.message?.content as string | undefined)?.trim() || '';
  };

  const toDataUrl = async (url: string): Promise<string | null> => {
    try {
      const r = await fetch(url);
      if (!r.ok) return null;
      const ct = r.headers.get('content-type') || 'image/jpeg';
      const buf = new Uint8Array(await r.arrayBuffer());
      if (buf.byteLength > 2_500_000) return null;
      return `data:${ct};base64,${encodeBase64(buf.buffer)}`;
    } catch {
      return null;
    }
  };

  const callVision = async (apiUrl: string, headers: Record<string, string>, model: string, img: string, imageUrlShape: 'object' | 'string') => {
    const imagePart =
      imageUrlShape === 'string'
        ? { type: 'image_url', image_url: img }
        : { type: 'image_url', image_url: { url: img } };

    let response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: visionPrompt }, imagePart],
          },
        ],
        max_tokens: 80,
        stream: false,
      }),
    });

    if (response.status === 400) {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: visionPrompt }, imagePart],
            },
          ],
        }),
      });
    }

    if (!response.ok) {
      const t = await response.text();
      console.error('Vision API error:', response.status, t.slice(0, 600));
      return '';
    }

    const content = await tryParseContent(response);
    return content;
  };

  try {
    const canUseUserVision =
      !!config.apiKey &&
      (config.provider === 'custom' || config.provider === 'openai') &&
      (config.provider !== 'custom' || !!config.baseUrl);

    if (canUseUserVision) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      };

      const model = config.model || (config.provider === 'openai' ? 'gpt-4o-mini' : 'deepseek-chat');
      const apiUrl =
        config.provider === 'custom'
          ? (() => {
              let baseUrl = (config.baseUrl || '').replace(/\/+$/, '');
              if (!baseUrl.endsWith('/chat/completions')) baseUrl = `${baseUrl}/chat/completions`;
              return baseUrl;
            })()
          : 'https://api.openai.com/v1/chat/completions';

      console.log('Vision via user provider:', config.provider, 'model:', model);

      let content = await callVision(apiUrl, headers, model, imageUrl, 'object');
      if (!content) content = await callVision(apiUrl, headers, model, imageUrl, 'string');

      if (!content) {
        const dataUrl = await toDataUrl(imageUrl);
        if (dataUrl) {
          content = await callVision(apiUrl, headers, model, dataUrl, 'object');
          if (!content) content = await callVision(apiUrl, headers, model, dataUrl, 'string');
        }
      }

      if (content) return content;
    }
  } catch (err) {
    console.error('User vision error:', err);
  }

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
    const { character, type, momentId, userPost, userImages, userApiKey, provider, baseUrl, model: customModel, userProfile, userId } = await req.json();
    
    // 构建数据库客户端 - 优先使用外部数据库（外部用户的数据在那里）
    const cloudUrl = Deno.env.get('SUPABASE_URL')!;
    const cloudKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const cloudDb = createClient(cloudUrl, cloudKey);
    
    const extUrl = Deno.env.get('EXTERNAL_SUPABASE_URL');
    const extKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY');
    const extDb = (extUrl && extKey) ? createClient(extUrl, extKey) : null;
    // 外部用户的 moments/comments 存在外部数据库
    const supabase = extDb || cloudDb;

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
      
      let imageDescriptions = '';
      if (userImages && userImages.length > 0) {
        console.log("Recognizing user images:", userImages.length);
        const descriptions = [];
        for (const imgUrl of userImages.slice(0, 3)) {
          const desc = await getImageDescription(imgUrl, config);
          if (desc) descriptions.push(desc);
        }
        if (descriptions.length > 0) {
          imageDescriptions = `\n好友还发了${userImages.length}张图片，内容是: ${descriptions.join('、')}`;
        }
      }
      
      let conversationContext = '';
      if (momentId) {
        const { data: comments } = await supabase
          .from('comments')
          .select('content, is_character_reply, created_at')
          .eq('moment_id', momentId)
          .order('created_at', { ascending: true })
          .limit(20);
        
        if (comments && comments.length > 0) {
          const history = comments.map(c => {
            const charMatch = c.content.match(/^\[([^\]]+)\]\s*/);
            if (c.is_character_reply && charMatch) {
              const charName = charMatch[1];
              const text = c.content.replace(/^\[([^\]]+)\]\s*/, '');
              return `${charName}: ${text}`;
            } else {
              return `${userName}: ${c.content}`;
            }
          });
          conversationContext = `\n\n【之前的评论对话】\n${history.join('\n')}`;
          console.log(`Loaded ${comments.length} comments as context`);
        }
      }
      
      prompt = `你是一个名叫"${character.name}"的虚拟角色。
${character.persona ? `你的人设是: ${character.persona}` : ''}

你的好友发了一条说说："${userPost || '分享了图片'}"${imageDescriptions}
${userPersona ? `关于这位好友: ${userPersona}` : ''}
${conversationContext}

【最新一条评论】${userName}: ${userPost}

请以你的角色身份回复这条最新评论。要求：
- 符合你的角色性格和说话方式
- 回复要针对最新评论的具体内容${imageDescriptions ? '，可以评论图片内容' : ''}
- 如果有之前的对话，请接着上文自然回复，不要重复之前说过的话
- 不要每次都叫对方名字，偶尔叫"${shortName}"或用亲昵称呼如"亲"、"宝"等
- 简短自然，像朋友评论
- 可以使用emoji
- 1-2句话`;
    } else if (type === "guestbook-reply") {
      const shortName = userName.length > 2 ? userName.slice(0, 2) : userName;
      
      prompt = `你是一个名叫"${character.name}"的虚拟角色。
${character.persona ? `你的人设是: ${character.persona}` : ''}

你的好友在留言板给你留言："${userPost}"
${userPersona ? `关于这位好友: ${userPersona}` : ''}

请以你的角色身份回复这条留言。要求：
- 符合你的角色性格和说话方式
- 亲切自然，像好朋友聊天
- 偶尔叫"${shortName}"或用亲昵称呼
- 可以使用emoji
- 1-2句话`;
    }

    const usingCustom = userApiKey && (provider === 'custom' || provider === 'deepseek' || provider === 'openai');
    console.log("API Config received:", { hasApiKey: !!userApiKey, provider, hasBaseUrl: !!baseUrl });
    console.log(`Using provider: ${usingCustom ? provider : (apiSetting.useDefault ? 'default-api' : 'lovable-ai')}`);
    console.log(`User: ${userName}, hasImages: ${!!userImages}`);

    const content = await getAICompletion(
      [{ role: "user", content: prompt }],
      config
    );

    let imageUrl: string | undefined;
    if (type === "moment") {
      const spaceImageConfig = await getSpaceImageConfig(userId);
      if (spaceImageConfig) {
        console.log("Space image generation enabled, generating image...");
        
        // 从角色人设中提取性别和外观特征（只使用明确性别词，避免误判）
        const persona = character?.persona || '';
        const maleHits = (persona.match(/男生|男性|男孩|男孩纸|boy|male|先生|王子|哥哥|弟弟|少年|青年|性别男|男角色/gi) || []).length;
        const femaleHits = (persona.match(/女生|女性|女孩|girl|female|小姐|公主|姐姐|妹妹|少女|性别女|女角色/gi) || []).length;

        let genderDesc = '一个人';
        let genderGuard = '';

        if (maleHits > femaleHits) {
          genderDesc = '一个男生';
          genderGuard = '男性角色，男性五官与体态，不要女性特征';
        } else if (femaleHits > maleHits) {
          genderDesc = '一个女生';
          genderGuard = '女性角色，女性五官与体态，不要男性特征';
        }

        console.log('Gender detection:', { maleHits, femaleHits, genderDesc });

        // 提取外观关键词（中文优先）
        const appearanceParts: string[] = [];
        const hairMatch = persona.match(/(?:头发|发色|发型)[：:]\s*([^，。\n]+)/);
        if (hairMatch) appearanceParts.push(hairMatch[1]);
        const eyeMatch = persona.match(/(?:眼睛|眼色|瞳色)[：:]\s*([^，。\n]+)/);
        if (eyeMatch) appearanceParts.push(eyeMatch[1]);
        // 外貌描述
        const appearanceMatch = persona.match(/(?:外貌|外观|样貌|长相|形象|特征)[：:]\s*([^。\n]+)/);
        if (appearanceMatch) appearanceParts.push(appearanceMatch[1]);

        const appearanceStr = appearanceParts.length > 0 ? '，' + appearanceParts.join('，') : '';
        // 用中文自然语言构建提示词，stylePrompt 已由 generateImage 函数自动拼接
        const imagePrompt = [`${genderDesc}${appearanceStr}`, genderGuard, content].filter(Boolean).join('，');
        console.log("Image prompt:", imagePrompt.slice(0, 150));
        
        const charRef = character?.id ? await getCharacterRefImage(userId, character.id) : null;
        if (charRef) {
          console.log("Using character reference image for space moment img2img");
        }
        const generatedImageUrl = await generateImage(imagePrompt, spaceImageConfig, userId, charRef?.refImageUrl);
        
        if (generatedImageUrl) {
          console.log("Image generated successfully");
          imageUrl = generatedImageUrl;
        } else {
          console.log("Image generation failed or returned null");
        }
      }
      
      if (!imageUrl) {
        const unsplashConfig = await getUnsplashConfig(userId);
        if (unsplashConfig) {
          console.log("Unsplash enabled, extracting keywords from content...");
          
          const keywordPrompt = `请从以下动态内容中提取2-4个适合搜索图片的英文关键词，用逗号分隔。
要求：
- 关键词要具体、可视化，适合搜索摄影图片
- 优先提取场景、物体、情感相关的词
- 只输出关键词，不要其他内容

动态内容：${content}`;
          
          try {
            const keywordsResponse = await getAICompletion(
              [{ role: "user", content: keywordPrompt }],
              config
            );
            
            const keywords = keywordsResponse
              .split(/[,，、\s]+/)
              .map(k => k.trim())
              .filter(k => k.length > 0 && k.length < 30);
            
            console.log("Extracted keywords:", keywords);
            
            if (keywords.length > 0) {
              const unsplashImageUrl = await searchUnsplashImage(keywords, unsplashConfig);
              if (unsplashImageUrl) {
                console.log("Unsplash image found successfully");
                imageUrl = unsplashImageUrl;
              }
            }
          } catch (keywordError) {
            console.error("Keyword extraction error:", keywordError);
          }
        }
      }
    }

    return new Response(JSON.stringify({ content, imageUrl }), {
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
