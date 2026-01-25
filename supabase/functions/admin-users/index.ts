import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify user and admin role
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: roleData, error: roleError } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: 'Not an admin' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client for admin operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { action, inactiveMonths } = await req.json();

    if (action === 'get_users') {
      // Get all users from auth.users with profiles data
      const { data: authUsers, error: authError } = await adminClient.auth.admin.listUsers({
        perPage: 1000
      });

      if (authError) {
        console.error('Error fetching auth users:', authError);
        return new Response(
          JSON.stringify({ error: authError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get profiles
      const { data: profiles } = await adminClient
        .from('profiles')
        .select('user_id, nickname, avatar_url');

      // Get last activity (last message time) for each user
      const { data: lastMessages } = await adminClient
        .from('chat_messages')
        .select('user_id, created_at')
        .order('created_at', { ascending: false });

      // Build user activity map
      const lastActivityMap: Record<string, string> = {};
      (lastMessages || []).forEach(msg => {
        if (!lastActivityMap[msg.user_id]) {
          lastActivityMap[msg.user_id] = msg.created_at;
        }
      });

      // Merge data
      const users = authUsers.users.map(authUser => {
        const profile = profiles?.find(p => p.user_id === authUser.id);
        return {
          id: authUser.id,
          email: authUser.email,
          created_at: authUser.created_at,
          last_sign_in_at: authUser.last_sign_in_at,
          last_activity_at: lastActivityMap[authUser.id] || null,
          nickname: profile?.nickname || null,
          avatar_url: profile?.avatar_url || null,
        };
      });

      return new Response(
        JSON.stringify({ users }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get_inactive_users') {
      const months = inactiveMonths || 6;
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - months);

      // Get all users
      const { data: authUsers } = await adminClient.auth.admin.listUsers({
        perPage: 1000
      });

      // Get last activity for each user
      const { data: lastMessages } = await adminClient
        .from('chat_messages')
        .select('user_id, created_at')
        .order('created_at', { ascending: false });

      const lastActivityMap: Record<string, string> = {};
      (lastMessages || []).forEach(msg => {
        if (!lastActivityMap[msg.user_id]) {
          lastActivityMap[msg.user_id] = msg.created_at;
        }
      });

      // Filter inactive users
      const inactiveUsers = authUsers?.users.filter(user => {
        const lastActivity = lastActivityMap[user.id] || user.last_sign_in_at || user.created_at;
        return new Date(lastActivity) < cutoffDate;
      }) || [];

      return new Response(
        JSON.stringify({ 
          users: inactiveUsers.map(u => ({
            id: u.id,
            email: u.email,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at,
            last_activity_at: lastActivityMap[u.id] || null
          })),
          cutoffDate: cutoffDate.toISOString(),
          months
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'cleanup_user_data') {
      const { userId } = await req.json();
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'userId required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Delete user data from all tables (but keep auth user so they can re-register)
      const tables = [
        'chat_messages', 'characters', 'character_memories', 'character_sprites',
        'group_messages', 'group_members', 'group_chats',
        'moments', 'comments', 'bottles', 'diaries',
        'photos', 'albums', 'music', 'customization', 'profiles',
        'presets', 'world_books', 'dream_transactions', 'gift_history',
        'gift_favorites', 'user_stickers', 'push_subscriptions', 'vn_saves',
        'space_logs', 'guestbook', 'character_blocks', 'chat_read_status',
        'pending_messages', 'api_keys', 'gift_custom_images'
      ];

      const results: Record<string, boolean> = {};
      for (const table of tables) {
        const { error } = await adminClient.from(table).delete().eq('user_id', userId);
        results[table] = !error;
      }

      return new Response(
        JSON.stringify({ success: true, results }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'batch_cleanup') {
      const { userIds } = await req.json();
      if (!userIds || !Array.isArray(userIds)) {
        return new Response(
          JSON.stringify({ error: 'userIds array required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tables = [
        'chat_messages', 'characters', 'character_memories', 'character_sprites',
        'group_messages', 'group_members', 'group_chats',
        'moments', 'comments', 'bottles', 'diaries',
        'photos', 'albums', 'music', 'customization', 'profiles',
        'presets', 'world_books', 'dream_transactions', 'gift_history',
        'gift_favorites', 'user_stickers', 'push_subscriptions', 'vn_saves',
        'space_logs', 'guestbook', 'character_blocks', 'chat_read_status',
        'pending_messages', 'api_keys', 'gift_custom_images'
      ];

      let cleanedCount = 0;
      for (const userId of userIds) {
        for (const table of tables) {
          await adminClient.from(table).delete().eq('user_id', userId);
        }
        cleanedCount++;
      }

      return new Response(
        JSON.stringify({ success: true, cleanedCount }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
