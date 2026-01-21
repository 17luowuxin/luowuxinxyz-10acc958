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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Block message scheduler triggered");

    // 获取所有活跃的拉黑记录，且距离上次消息超过30分钟
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { data: activeBlocks, error } = await supabase
      .from('character_blocks')
      .select('user_id, character_id, message_count, last_message_at')
      .eq('is_active', true)
      .or(`last_message_at.is.null,last_message_at.lt.${thirtyMinutesAgo}`);

    if (error) {
      console.error("Error fetching blocks:", error);
      throw error;
    }

    console.log(`Found ${activeBlocks?.length || 0} blocks to process`);

    const results: { userId: string; characterId: string; success: boolean }[] = [];

    for (const block of activeBlocks || []) {
      try {
        // 获取用户的API配置
        const { data: apiConfig } = await supabase
          .from('api_keys')
          .select('api_key, provider')
          .eq('user_id', block.user_id)
          .maybeSingle();

        // 调用 block-message 函数生成并发送消息
        const response = await fetch(`${supabaseUrl}/functions/v1/block-message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            action: 'generate_block_message',
            userId: block.user_id,
            characterId: block.character_id,
            apiKey: apiConfig?.api_key,
          }),
        });

        const result = await response.json();
        
        results.push({
          userId: block.user_id,
          characterId: block.character_id,
          success: result.success || false,
        });

        console.log(`Processed block for user ${block.user_id}, character ${block.character_id}:`, result.success);
      } catch (err) {
        console.error(`Error processing block for user ${block.user_id}:`, err);
        results.push({
          userId: block.user_id,
          characterId: block.character_id,
          success: false,
        });
      }
    }

    return new Response(JSON.stringify({ 
      processed: results.length,
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Scheduler error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});