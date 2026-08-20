import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authErrorResponse, requireUser } from "../_shared/require-user.ts";

// 智能构建API URL
function buildApiUrl(baseUrl: string): string {
  let finalUrl = baseUrl.trim().replace(/\/+$/, '');
  
  if (finalUrl.endsWith('/chat/completions')) {
    return finalUrl;
  } else if (finalUrl.endsWith('/v1')) {
    return `${finalUrl}/chat/completions`;
  } else if (finalUrl.includes('/v1/')) {
    return finalUrl.replace(/\/v1\/.*$/, '/v1/chat/completions');
  } else {
    // 尝试添加/v1/chat/completions
    return `${finalUrl}/v1/chat/completions`;
  }
}

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

    const { provider, apiKey, baseUrl, model } = await req.json();

    console.log('Testing connection for provider:', provider);

    let testUrl: string;
    let testHeaders: Record<string, string>;
    let testBody: string;

    switch (provider) {
      case 'deepseek':
        testUrl = 'https://api.deepseek.com/v1/chat/completions';
        testHeaders = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        };
        testBody = JSON.stringify({
          model: 'deepseek-chat',
          max_tokens: 5,
          messages: [{ role: 'user', content: 'Hi' }],
        });
        break;

      case 'openai':
        testUrl = 'https://api.openai.com/v1/chat/completions';
        testHeaders = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        };
        testBody = JSON.stringify({
          model: 'gpt-3.5-turbo',
          max_tokens: 5,
          messages: [{ role: 'user', content: 'Hi' }],
        });
        break;

      case 'anthropic':
        testUrl = 'https://api.anthropic.com/v1/messages';
        testHeaders = {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        };
        testBody = JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 5,
          messages: [{ role: 'user', content: 'Hi' }],
        });
        break;

      case 'custom':
        if (!baseUrl) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: '请填写API Base URL' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        // 使用智能URL构建函数
        testUrl = buildApiUrl(baseUrl);
        testHeaders = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        };
        testBody = JSON.stringify({
          model: model || 'gpt-3.5-turbo',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Say hi' }],
          stream: false,
        });
        break;

      default:
        return new Response(JSON.stringify({ 
          success: false, 
          error: '不支持的API提供商' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    let response: Response;
    try {
      response = await fetch(testUrl, {
        method: 'POST',
        headers: testHeaders,
        body: testBody,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return new Response(JSON.stringify({ success: false, error: '连接超时，请检查API地址或网络' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    const responseText = await response.text();
    console.log('Response status:', response.status);

    // 检查是否有有效响应
    if (response.ok) {
      // 尝试解析响应验证格式
      try {
        const json = JSON.parse(responseText);
        // 检查是否有choices或其他有效内容
        if (json.choices || json.content || json.result || json.output || json.response) {
          return new Response(JSON.stringify({ 
            success: true, 
            message: '连接成功，API响应正常' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        // 如果有error字段
        if (json.error) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: json.error.message || json.error || '未知错误' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        // 其他情况也认为成功
        return new Response(JSON.stringify({ 
          success: true, 
          message: '连接成功' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch {
        // 非JSON响应但状态码OK
        return new Response(JSON.stringify({ 
          success: true, 
          message: '连接成功' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      let errorMessage = '连接失败';
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.error?.message || errorData.message || errorData.error || `HTTP ${response.status}`;
      } catch {
        errorMessage = responseText.substring(0, 200) || `HTTP ${response.status}`;
      }
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch {
    console.error('API connection test failed');
    return new Response(JSON.stringify({ 
      success: false, 
      error: '连接测试失败'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
