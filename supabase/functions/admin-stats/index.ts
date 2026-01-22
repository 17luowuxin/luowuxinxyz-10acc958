import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 创建用户客户端验证身份
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // 验证用户
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 检查是否是管理员
    const { data: roleData } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Not an admin' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 使用service role key来绕过RLS
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { action } = await req.json();

    if (action === 'get_stats') {
      const today = new Date().toISOString().split('T')[0];
      
      const [usersRes, charsRes, msgsRes, todayRes] = await Promise.all([
        adminClient.from('profiles').select('*', { count: 'exact', head: true }),
        adminClient.from('characters').select('*', { count: 'exact', head: true }),
        adminClient.from('chat_messages').select('*', { count: 'exact', head: true }),
        adminClient.from('profiles').select('*', { count: 'exact', head: true })
          .gte('created_at', today),
      ]);

      return new Response(JSON.stringify({
        totalUsers: usersRes.count || 0,
        totalCharacters: charsRes.count || 0,
        totalMessages: msgsRes.count || 0,
        todayUsers: todayRes.count || 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_trend') {
      const dateMap: Record<string, { users: number; messages: number }> = {};
      
      // 初始化30天的日期
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dateMap[dateStr] = { users: 0, messages: 0 };
      }

      // 逐天获取精确的消息数量
      const promises = Object.keys(dateMap).map(async (dateStr) => {
        const startOfDay = `${dateStr}T00:00:00.000Z`;
        const endOfDay = `${dateStr}T23:59:59.999Z`;
        
        const [usersRes, msgsRes] = await Promise.all([
          adminClient.from('profiles')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startOfDay)
            .lte('created_at', endOfDay),
          adminClient.from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startOfDay)
            .lte('created_at', endOfDay),
        ]);
        
        return {
          date: dateStr,
          users: usersRes.count || 0,
          messages: msgsRes.count || 0,
        };
      });

      const results = await Promise.all(promises);
      
      results.forEach(result => {
        if (dateMap[result.date]) {
          dateMap[result.date].users = result.users;
          dateMap[result.date].messages = result.messages;
        }
      });

      const trend = Object.entries(dateMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, data]) => ({
          date: date.slice(5),
          users: data.users,
          messages: data.messages,
        }));

      return new Response(JSON.stringify({ trend }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Admin stats error:', err);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
