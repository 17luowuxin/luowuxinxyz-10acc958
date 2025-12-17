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
}

async function getNovelAIConfig(userId: string): Promise<NovelAIConfig | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: apiSettings } = await supabase
    .from("api_keys")
    .select("provider, api_key")
    .eq("user_id", userId);

  if (!apiSettings) return null;

  const novelaiKey = apiSettings.find((s) => s.provider === "novelai");
  const novelaiModel = apiSettings.find((s) => s.provider === "novelai_model");
  const novelaiSteps = apiSettings.find((s) => s.provider === "novelai_steps");
  const novelaiScale = apiSettings.find((s) => s.provider === "novelai_scale");
  const novelaiSampler = apiSettings.find((s) => s.provider === "novelai_sampler");
  const novelaiWidth = apiSettings.find((s) => s.provider === "novelai_width");
  const novelaiHeight = apiSettings.find((s) => s.provider === "novelai_height");
  const novelaiNegative = apiSettings.find((s) => s.provider === "novelai_negative_prompt");

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
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, userId, characterName, negativePrompt } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "用户未登录" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config = await getNovelAIConfig(userId);

    if (!config) {
      return new Response(JSON.stringify({ error: "请先在设置中配置NovelAI API密钥" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const modelId = config.model || "nai-diffusion-4-full";
    const isV4 = modelId.includes("diffusion-4");
    
    // User configurable parameters with defaults
    const userSteps = config.steps || 28;
    const userScale = config.scale || (isV4 ? 6.0 : 7.0);
    const userSampler = config.sampler || "k_euler_ancestral";
    const userWidth = config.width || (isV4 ? 832 : 640);
    const userHeight = config.height || (isV4 ? 1216 : 640);
    
    console.log("Generating image with NovelAI:", {
      model: modelId,
      isV4,
      steps: userSteps,
      scale: userScale,
      sampler: userSampler,
      width: userWidth,
      height: userHeight,
      promptLength: prompt?.length,
    });

    // V4 models need different parameters
    const defaultNegative = negativePrompt || config.negativePrompt ||
      "lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry";

    // V4 specific parameters (based on NovelAI V4 API requirements)
    const v4Params = {
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
      reference_strength: 0.6,
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

    // V3 parameters
    const v3Params = {
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

    const novelaiPayload = {
      input: isV4 ? "" : prompt,
      model: modelId,
      action: "generate",
      parameters: isV4 ? v4Params : v3Params,
    };
    
    console.log("NovelAI payload:", JSON.stringify(novelaiPayload, null, 2));

    let response: Response;
    try {
      response = await fetch("https://image.novelai.net/ai/generate-image", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/zip",
        },
        body: JSON.stringify(novelaiPayload),
      });
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
    const ab = new ArrayBuffer(pngData.byteLength);
    new Uint8Array(ab).set(pngData);
    const base64 = base64Encode(ab);
    const imageUrl = `data:image/png;base64,${base64}`;

    console.log("Image generated successfully", {
      pngName,
      size: pngData.length,
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
