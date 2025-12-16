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

  if (!novelaiKey) return null;

  return {
    apiKey: novelaiKey.api_key,
    model: novelaiModel?.api_key || "nai-diffusion-3",
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

    console.log("Generating image with NovelAI:", {
      model: config.model,
      promptLength: prompt?.length,
    });

    const novelaiPayload = {
      input: prompt,
      model: config.model || "nai-diffusion-3",
      action: "generate",
      parameters: {
        width: 512,
        height: 768,
        scale: 7,
        sampler: "k_euler_ancestral",
        steps: 28,
        n_samples: 1,
        ucPreset: 0,
        qualityToggle: true,
        negative_prompt:
          negativePrompt ||
          "lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry",
      },
    };

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
