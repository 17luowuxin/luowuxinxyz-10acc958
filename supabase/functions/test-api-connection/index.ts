import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authErrorResponse, requireUser } from "../_shared/require-user.ts";

import { buildChatCompletionsUrl, describeAiError, htmlResponseMessage, looksLikeHtml } from "../_shared/ai-endpoint.ts";

const buildApiUrl = buildChatCompletionsUrl;

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
        return new Response(JSON.stringify({ success: false, error: `连接超时：12秒内服务商没有回应，请检查API地址或换个更快的模型（实际请求：${testUrl}）` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: false, error: `连不上这个地址，请检查API地址有没有写错（实际请求：${testUrl}）` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const responseText = await response.text();
    console.log('Response status:', response.status);
    const reply = (body: Record<string, unknown>) => new Response(JSON.stringify({ ...body, testedUrl: testUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    if (looksLikeHtml(responseText, response.headers.get('content-type') || '')) {
      return reply({ success: false, error: htmlResponseMessage(testUrl) });
    }
    if (!response.ok) {
      return reply({ success: false, error: describeAiError(response.status, responseText, testUrl) });
    }

    let json: any;
    try {
      json = JSON.parse(responseText);
    } catch {
      return reply({ success: false, error: `返回的内容不是AI回复，请检查API地址是否正确（实际请求：${testUrl}）。返回开头：${responseText.trim().slice(0, 80)}` });
    }
    if (json?.error) {
      return reply({ success: false, error: describeAiError(400, responseText, testUrl) });
    }
    const hasReply = Array.isArray(json?.choices) && json.choices.length > 0
      || Array.isArray(json?.content) || typeof json?.content === 'string';
    if (!hasReply) {
      return reply({ success: false, error: `服务商有响应，但没有返回AI回复，可能是地址或模型不对（实际请求：${testUrl}）` });
    }
    return reply({ success: true, message: '连接成功，API响应正常' });
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
