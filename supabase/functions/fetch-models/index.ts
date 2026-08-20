import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authErrorResponse, requireUser } from "../_shared/require-user.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await requireUser(req);
    if (!auth.ok) return authErrorResponse(auth, corsHeaders);

    const { apiKey, baseUrl } = await req.json();

    if (!apiKey || !baseUrl) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: '请提供API密钥和Base URL' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 构建models端点URL
    let modelsUrl = baseUrl.replace(/\/+$/, ''); // 移除末尾斜杠
    
    // 如果URL以/chat/completions结尾，替换为/models
    if (modelsUrl.endsWith('/chat/completions')) {
      modelsUrl = modelsUrl.replace('/chat/completions', '/models');
    } else if (modelsUrl.endsWith('/v1')) {
      modelsUrl = `${modelsUrl}/models`;
    } else if (!modelsUrl.endsWith('/models')) {
      // 尝试添加/models
      modelsUrl = `${modelsUrl}/models`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    let response: Response;
    try {
      response = await fetch(modelsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return new Response(JSON.stringify({ success: false, error: '获取模型超时，请检查API地址或网络' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    const responseText = await response.text();

    if (!response.ok) {
      // 尝试其他常见的models端点格式
      const alternativeUrls = [
        baseUrl.replace(/\/+$/, '') + '/models',
        baseUrl.replace(/\/+$/, '').replace('/v1', '') + '/v1/models',
        baseUrl.replace(/\/+$/, '').replace('/chat/completions', '') + '/models',
      ];

      for (const altUrl of alternativeUrls) {
        if (altUrl === modelsUrl) continue;
        
        try {
          const altController = new AbortController();
          const altTimeoutId = setTimeout(() => altController.abort(), 5000);
          const altResponse = await fetch(altUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            signal: altController.signal,
          });
          clearTimeout(altTimeoutId);

          if (altResponse.ok) {
            const altText = await altResponse.text();
            const altData = JSON.parse(altText);
            const models = extractModels(altData);
            if (models.length > 0) {
              return new Response(JSON.stringify({ 
                success: true, 
                models 
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
          }
        } catch {
          console.log('Alternative model URL failed');
        }
      }

      return new Response(JSON.stringify({ 
        success: false, 
        error: `无法获取模型列表: HTTP ${response.status}` 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const data = JSON.parse(responseText);
      const models = extractModels(data);
      
      if (models.length === 0) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: '未找到可用模型' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        models 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: '解析模型列表失败' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch {
    console.error('Fetch models failed');
    return new Response(JSON.stringify({ 
      success: false, 
      error: '获取模型列表失败'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function extractModels(data: any): string[] {
  const models: string[] = [];
  
  // OpenAI格式: { data: [{ id: "model-name" }] }
  if (data.data && Array.isArray(data.data)) {
    for (const model of data.data) {
      if (model.id) {
        models.push(model.id);
      }
    }
  }
  
  // 其他格式: { models: ["model1", "model2"] }
  if (data.models && Array.isArray(data.models)) {
    for (const model of data.models) {
      if (typeof model === 'string') {
        models.push(model);
      } else if (model.id) {
        models.push(model.id);
      } else if (model.name) {
        models.push(model.name);
      }
    }
  }
  
  // 直接数组格式: ["model1", "model2"]
  if (Array.isArray(data)) {
    for (const model of data) {
      if (typeof model === 'string') {
        models.push(model);
      } else if (model.id) {
        models.push(model.id);
      } else if (model.name) {
        models.push(model.name);
      }
    }
  }

  // 排序，优先显示常用模型
  return models.sort((a, b) => {
    const priorityKeywords = ['chat', 'gpt', 'claude', 'deepseek', 'qwen', 'glm'];
    const aHasPriority = priorityKeywords.some(k => a.toLowerCase().includes(k));
    const bHasPriority = priorityKeywords.some(k => b.toLowerCase().includes(k));
    if (aHasPriority && !bHasPriority) return -1;
    if (!aHasPriority && bHasPriority) return 1;
    return a.localeCompare(b);
  });
}
