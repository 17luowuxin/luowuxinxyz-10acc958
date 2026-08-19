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

    const { accessKey } = await req.json();

    if (!accessKey) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: '请填写 Access Key' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Testing Unsplash connection...');

    const response = await fetch('https://api.unsplash.com/search/photos?query=cat&per_page=1', {
      headers: {
        'Authorization': `Client-ID ${accessKey}`,
      },
    });

    console.log('Unsplash response status:', response.status);

    if (response.ok) {
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Unsplash 连接成功！' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'API响应正常' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      console.error('Unsplash API error:', response.status);
      
      let errorMessage = `API错误: ${response.status}`;
      if (response.status === 401) {
        errorMessage = 'Access Key 无效或已过期';
      } else if (response.status === 403) {
        errorMessage = 'API 访问被拒绝，请检查权限';
      } else if (response.status === 429) {
        errorMessage = 'API 请求次数超限，请稍后再试';
      }
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch {
    console.error('Unsplash connection test failed');
    return new Response(JSON.stringify({ 
      success: false, 
      error: '连接测试失败'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
