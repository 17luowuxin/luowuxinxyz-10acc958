import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
        // Append /chat/completions if not already present
        let finalUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
        if (!finalUrl.endsWith('/chat/completions')) {
          finalUrl = `${finalUrl}/chat/completions`;
        }
        testUrl = finalUrl;
        testHeaders = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        };
        testBody = JSON.stringify({
          model: model || 'gpt-3.5-turbo',
          max_tokens: 5,
          messages: [{ role: 'user', content: 'Hi' }],
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

    console.log('Testing URL:', testUrl);
    
    const response = await fetch(testUrl, {
      method: 'POST',
      headers: testHeaders,
      body: testBody,
    });

    const responseText = await response.text();
    console.log('Response status:', response.status);
    console.log('Response body:', responseText.substring(0, 500));

    if (response.ok) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: '连接成功' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      let errorMessage = '连接失败';
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.error?.message || errorData.message || '连接失败';
      } catch {
        errorMessage = responseText.substring(0, 200) || '连接失败';
      }
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error: unknown) {
    console.error('Test connection error:', error);
    const errorMessage = error instanceof Error ? error.message : '连接测试失败';
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
