import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unzipSync } from "https://esm.sh/fflate@0.8.2?deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NovelAIConfig {
  apiKey: string;
  model?: string;
  steps?: number;
  scale?: number;
  sampler?: string;
  width?: number;
  height?: number;
  negativePrompt?: string;
  nsfwMode?: boolean;
  referenceImage?: string;
  referenceStrength?: number;
  vibeTransfer?: boolean;
  vibeImage?: string;
  vibeStrength?: number;
}

async function getNovelAIConfig(userId: string): Promise<NovelAIConfig | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: apiSettings } = await supabase
    .from("api_keys")
    .select("provider, api_key, created_at")
    .eq("user_id", userId);

  if (!apiSettings) return null;

  type Row = { provider: string; api_key: string; created_at: string };
  const rows = apiSettings as Row[];

  const pickLatest = (provider: string) =>
    rows
      .filter((r) => r.provider === provider)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .at(-1);

  const novelaiKey = pickLatest("novelai");
  const novelaiModel = pickLatest("novelai_model");
  const novelaiSteps = pickLatest("novelai_steps");
  const novelaiScale = pickLatest("novelai_scale");
  const novelaiSampler = pickLatest("novelai_sampler");
  const novelaiWidth = pickLatest("novelai_width");
  const novelaiHeight = pickLatest("novelai_height");
  const novelaiNegative = pickLatest("novelai_negative_prompt");
  const novelaiNsfw = pickLatest("novelai_nsfw");
  const novelaiRefImage = pickLatest("novelai_reference_image");
  const novelaiRefStrength = pickLatest("novelai_reference_strength");
  const novelaiVibeTransfer = pickLatest("novelai_vibe_transfer");
  const novelaiVibeImage = pickLatest("novelai_vibe_image");
  const novelaiVibeStrength = pickLatest("novelai_vibe_strength");

  if (!novelaiKey) return null;

  return {
    apiKey: novelaiKey.api_key,
    model: novelaiModel?.api_key || "nai-diffusion-4-full",
    steps: novelaiSteps ? parseInt(novelaiSteps.api_key) : 28,
    scale: novelaiScale ? parseFloat(novelaiScale.api_key) : 6.0,
    sampler: novelaiSampler?.api_key || "k_euler_ancestral",
    width: novelaiWidth ? parseInt(novelaiWidth.api_key) : 832,
    height: novelaiHeight ? parseInt(novelaiHeight.api_key) : 1216,
    negativePrompt: novelaiNegative?.api_key,
    nsfwMode: novelaiNsfw?.api_key === "true",
    referenceImage: novelaiRefImage?.api_key,
    referenceStrength: novelaiRefStrength ? parseFloat(novelaiRefStrength.api_key) : 0.6,
    vibeTransfer: novelaiVibeTransfer?.api_key === "true",
    vibeImage: novelaiVibeImage?.api_key,
    vibeStrength: novelaiVibeStrength ? parseFloat(novelaiVibeStrength.api_key) : 0.6,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, userId, characterName, negativePrompt, referenceImage, referenceStrength } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "用户未登录" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // 覆盖config中的referenceImage和referenceStrength（来自请求体）
    const requestRefImage = referenceImage || null;
    const requestRefStrength = referenceStrength || 0.6;

    const config = await getNovelAIConfig(userId);

    if (!config) {
      return new Response(JSON.stringify({ error: "请先在设置中配置NovelAI API密钥" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const modelId = config.model || "nai-diffusion-4-5-full";
    // V4 和 V4.5 都使用 v4_prompt 格式
    const isV4OrNewer = modelId.includes("diffusion-4") || modelId.includes("diffusion-4-5");
    
    // User configurable parameters with defaults
    const userSteps = config.steps || 28;
    const userScale = config.scale || (isV4OrNewer ? 6.0 : 7.0);
    const userSampler = config.sampler || "k_euler_ancestral";
    const userWidth = config.width || (isV4OrNewer ? 832 : 640);
    const userHeight = config.height || (isV4OrNewer ? 1216 : 640);

    // 参考图/风格迁移图片过大会导致 NovelAI 400 “Error decoding request body”
    // 这里设置一个保守阈值，超过则自动跳过参考图参数并尝试继续生成。
    const MAX_REFERENCE_BASE64_LEN = 5_000_000; // ~3.5MB binary (rough)
    
    console.log("Generating image with NovelAI:", {
      model: modelId,
      isV4OrNewer,
      steps: userSteps,
      scale: userScale,
      sampler: userSampler,
      width: userWidth,
      height: userHeight,
      promptLength: prompt?.length,
      hasReferenceImage: !!requestRefImage,
      vibeTransfer: config.vibeTransfer,
    });

    // V4 models need different parameters
    // 根据NSFW模式决定负面提示词
    const nsfwMode = config.nsfwMode || false;
    const baseNegative = "lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, transparent background, transparent, alpha channel";
    const sfwNegative = nsfwMode ? baseNegative : baseNegative + ", nsfw, nude, naked, explicit, sexual";
    const defaultNegative = negativePrompt || config.negativePrompt || sfwNegative;

    // Helper function to fetch image as base64
    const fetchImageAsBase64 = async (imageUrl: string): Promise<string | null> => {
      try {
        // Skip empty or invalid URLs
        if (!imageUrl || imageUrl.trim() === '') {
          return null;
        }
        
        // If already base64, extract the data part
        if (imageUrl.startsWith('data:')) {
          const base64Part = imageUrl.split(',')[1];
          // Validate base64 is not empty and has reasonable length
          if (!base64Part || base64Part.length < 100) {
            console.log("Invalid base64 image data, too short");
            return null;
          }
          return base64Part;
        }
        
        const response = await fetch(imageUrl);
        if (!response.ok) {
          console.log("Failed to fetch image:", response.status);
          return null;
        }
        
        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength < 100) {
          console.log("Image data too small, likely invalid");
          return null;
        }
        
        const base64 = base64Encode(arrayBuffer);
        return base64;
      } catch (e) {
        console.error("Failed to fetch image:", e);
        return null;
      }
    };

    // Determine action type
    let actionType = "generate";
    let referenceImageBase64: string | null = null;
    let vibeImageBase64: string | null = null;
    
    // 只使用请求体中的垫图，不使用config中的（避免之前保存的无效图片导致问题）
    // 测试绘图时显式传入垫图，普通生成时不使用
    const effectiveRefImage = requestRefImage || null;
    const effectiveRefStrength = requestRefStrength || 0.6;

    // Check for img2img reference image - only if explicitly provided in request
    if (effectiveRefImage) {
      referenceImageBase64 = await fetchImageAsBase64(effectiveRefImage);
      if (referenceImageBase64) {
        actionType = "img2img";
        console.log("Using img2img mode with reference image, strength:", effectiveRefStrength);
      } else {
        console.log("Reference image provided but failed to load, falling back to generate mode");
      }
    }

    // Check for vibe transfer - 只在图片有效时才生效
    // 由于历史数据可能存在残留配置，必须严格校验
    if (config.vibeTransfer && config.vibeImage && config.vibeImage.trim() !== '') {
      vibeImageBase64 = await fetchImageAsBase64(config.vibeImage);
      if (vibeImageBase64 && vibeImageBase64.length > 100) {
        console.log("Vibe transfer enabled with valid reference image");
      } else {
        console.log("Vibe transfer config exists but image invalid, ignoring");
        vibeImageBase64 = null;
      }
    }

    // V4 specific parameters (based on NovelAI V4 API requirements)
    const v4Params: Record<string, any> = {
      width: userWidth,
      height: userHeight,
      n_samples: 1,
      seed: Math.floor(Math.random() * 4294967295),
      sampler: userSampler,
      steps: userSteps,
      scale: userScale,
      cfg_rescale: 0,
      sm: false,
      sm_dyn: false,
      skip_cfg_below_sigma: 0,
      noise_schedule: "karras",
      legacy: false,
      legacy_v3_extend: false,
      negative_prompt: defaultNegative,
      reference_strength: effectiveRefStrength,
      add_original_image: false,
      uncond_scale: 1,
      qualityToggle: true,
      use_coords: false,
      v4_prompt: {
        caption: {
          base_caption: prompt,
          char_captions: []
        },
        use_coords: false,
        use_order: false
      },
      v4_negative_prompt: {
        caption: {
          base_caption: defaultNegative,
          char_captions: []
        }
      }
    };

    // Add img2img parameters
    if (actionType === "img2img" && referenceImageBase64) {
      v4Params.image = referenceImageBase64;
      v4Params.strength = effectiveRefStrength;
    }

    // Add vibe transfer parameters (V4/V4.5 only)
    // 只有在 vibeImageBase64 确实有效（长度足够）时才添加，防止无效数据导致 400 错误
    if (
      vibeImageBase64 &&
      vibeImageBase64.length > 100 &&
      vibeImageBase64.length <= MAX_REFERENCE_BASE64_LEN &&
      isV4OrNewer
    ) {
      v4Params.reference_image_multiple = [{
        image: vibeImageBase64,
        strength: config.vibeStrength || 0.6,
        information_extracted: 1.0,
      }];
      console.log("Added vibe transfer to payload, image length:", vibeImageBase64.length);
    } else if (vibeImageBase64 && vibeImageBase64.length > MAX_REFERENCE_BASE64_LEN) {
      console.log(
        "Vibe image too large, skipping reference_image_multiple. length:",
        vibeImageBase64.length,
      );
    } else if (config.vibeTransfer) {
      // 配置了 vibeTransfer 但图片无效，记录日志便于排查
      console.log("Vibe transfer enabled but no valid image, skipping reference_image_multiple");
    }

    // V3 parameters
    const v3Params: Record<string, any> = {
      width: userWidth,
      height: userHeight,
      n_samples: 1,
      seed: Math.floor(Math.random() * 4294967295),
      sampler: userSampler,
      steps: userSteps,
      scale: userScale,
      ucPreset: 0,
      qualityToggle: true,
      negative_prompt: defaultNegative,
    };

    // Add img2img parameters for V3
    if (actionType === "img2img" && referenceImageBase64) {
      v3Params.image = referenceImageBase64;
      v3Params.strength = config.referenceStrength || 0.6;
    }

    const novelaiPayload = {
      input: isV4OrNewer ? "" : prompt,
      model: modelId,
      action: actionType,
      parameters: isV4OrNewer ? v4Params : v3Params,
    };

    // 避免把超长 base64 打到日志里（会导致日志爆炸/影响性能）
    const summarizePayloadForLog = (payload: any) => {
      const p = payload?.parameters || {};
      const refMulti = Array.isArray(p.reference_image_multiple) ? p.reference_image_multiple : null;
      return {
        ...payload,
        parameters: {
          ...p,
          image: p.image ? `[base64:${String(p.image).length}]` : undefined,
          reference_image_multiple: refMulti
            ? refMulti.map((x: any) => ({
                ...x,
                image: x?.image ? `[base64:${String(x.image).length}]` : undefined,
              }))
            : undefined,
        },
      };
    };

    console.log("NovelAI payload (summary):", JSON.stringify(summarizePayloadForLog(novelaiPayload), null, 2));

    const sendNovelAIRequest = async (payload: any) => {
      return await fetch("https://image.novelai.net/ai/generate-image", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/zip",
        },
        body: JSON.stringify(payload),
      });
    };

    let response: Response;
    try {
      response = await sendNovelAIRequest(novelaiPayload);
    } catch (fetchError) {
      console.error("NovelAI fetch error:", fetchError);
      return new Response(
        JSON.stringify({
          error: "无法连接NovelAI服务器（网络/代理问题），请稍后再试",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const contentType = response.headers.get("content-type") || "";
    console.log("NovelAI response:", {
      status: response.status,
      contentType,
    });

    // 400: Error decoding request body
    // 常见原因：带了过大的参考图 / 风格迁移图（尤其是残留配置）。
    // 这里做一次自动降级重试：
    // - 若带了 reference_image_multiple（风格迁移）→ 去掉后重试
    // - 若是 img2img（带 image）→ 降级为 generate 后重试
    if (!response.ok) {
      const firstErrorText = await response.text();
      const isDecodeBodyError =
        response.status === 400 &&
        (firstErrorText.includes("Error decoding request body") || firstErrorText.includes("decoding request body"));

      const hasVibe = isV4OrNewer && !!(v4Params as any).reference_image_multiple;
      const hasImg2Img = actionType === "img2img" && !!(v4Params as any).image;

      if (isDecodeBodyError && (hasVibe || hasImg2Img)) {
        console.log("NovelAI 400 decode body detected, trying fallback...", {
          hasVibe,
          hasImg2Img,
        });

        // 1) 去掉 vibe 参数再试
        if (hasVibe) {
          const v4ParamsNoVibe = { ...(v4Params as any) };
          delete v4ParamsNoVibe.reference_image_multiple;
          const payloadNoVibe = {
            ...novelaiPayload,
            parameters: v4ParamsNoVibe,
          };
          console.log("Retrying without vibe transfer...");
          response = await sendNovelAIRequest(payloadNoVibe);
        }

        // 2) 如果还是失败且是 img2img，再降级为纯文生图
        if (!response.ok && hasImg2Img) {
          const v4ParamsGen = { ...(v4Params as any) };
          delete v4ParamsGen.image;
          delete v4ParamsGen.strength;
          const payloadGen = {
            input: isV4OrNewer ? "" : prompt,
            model: modelId,
            action: "generate",
            parameters: v4ParamsGen,
          };
          console.log("Retrying as generate (dropping img2img image)...");
          response = await sendNovelAIRequest(payloadGen);
        }

        // 如果降级后依然失败，继续走下面的报错分支（读取新的 response.text）
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error("NovelAI API error:", response.status, errorText);

        if (response.status === 401) {
          return new Response(JSON.stringify({ error: "NovelAI API密钥无效" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "NovelAI订阅已过期或额度不足" }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "NovelAI请求过于频繁，请稍后再试" }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // 针对 400 decode body 给更清晰的提示
        if (response.status === 400 && errorText.includes("Error decoding request body")) {
          return new Response(
            JSON.stringify({
              error: "请求体解析失败：可能存在残留的风格迁移/垫图配置或参考图过大。请在设置里清除 NovelAI 数据后重试。",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        return new Response(
          JSON.stringify({
            error: `NovelAI生成失败: ${response.status} - ${errorText.substring(0, 200)}`,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // NovelAI通常返回zip（里面是png文件），需要解压
    // 之前用“在zip里直接找PNG头”会失败：因为zip一般会压缩png内容，原始PNG头不会直接出现在zip字节流里。
    const zipBytes = new Uint8Array(await response.arrayBuffer());

    let files: Record<string, Uint8Array>;
    try {
      files = unzipSync(zipBytes);
    } catch (unzipErr) {
      console.error("Failed to unzip NovelAI response", {
        unzipErr,
        contentType,
        bytes: zipBytes.length,
      });

      // 有时服务会返回JSON（例如错误信息）但状态码仍为200，便于排查我们把前200字节尝试当文本
      const maybeText = new TextDecoder().decode(zipBytes.slice(0, 200));
      return new Response(
        JSON.stringify({
          error: `NovelAI返回数据无法解压（可能是返回了非zip内容）: ${maybeText}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const fileNames = Object.keys(files);
    const pngName = fileNames.find((n) => n.toLowerCase().endsWith(".png"));

    if (!pngName) {
      console.error("No PNG found in NovelAI zip", { fileNames });
      return new Response(
        JSON.stringify({
          error: `图片生成失败：zip中未找到PNG文件（包含: ${fileNames.join(", ")})`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const pngData = files[pngName];
    
    // 上传到 Supabase Storage 而不是返回 base64，加快传输速度
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const fileName = `novelai/${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
    
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('chat-images')
      .upload(fileName, pngData, {
        contentType: 'image/png',
        cacheControl: '31536000',
      });
    
    let imageUrl: string;
    
    if (uploadError) {
      // 如果上传失败，回退到 base64
      console.error("Failed to upload to storage, falling back to base64:", uploadError);
      const ab = new ArrayBuffer(pngData.byteLength);
      new Uint8Array(ab).set(pngData);
      const base64 = base64Encode(ab);
      imageUrl = `data:image/png;base64,${base64}`;
    } else {
      // 获取公开URL
      const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(fileName);
      imageUrl = urlData.publicUrl;
    }

    console.log("Image generated successfully", {
      pngName,
      size: pngData.length,
      uploadedToStorage: !uploadError,
    });

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl,
        characterName,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("NovelAI generate error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "未知错误",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
