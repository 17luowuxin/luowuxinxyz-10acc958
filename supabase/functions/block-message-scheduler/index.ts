import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ApiSettingRow = { provider: string; api_key: string; created_at?: string };

const pickLatest = (rows: ApiSettingRow[], provider: string) =>
  rows
    .filter((r) => r.provider === provider)
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
    .at(-1)?.api_key;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Block message scheduler triggered");

    // 1分钟仍未加回好友，则继续发一条（仅在线模式会在 block-message 内生效）
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();

    const { data: activeBlocks, error } = await supabase
      .from('character_blocks')
      .select('user_id, character_id, message_count, last_message_at')
      .eq('is_active', true)
      .or(`last_message_at.is.null,last_message_at.lt.${oneMinuteAgo}`);

    if (error) {
      console.error("Error fetching blocks:", error);
      throw error;
    }

    console.log(`Found ${activeBlocks?.length || 0} blocks to process`);

    const results: { userId: string; characterId: string; success: boolean; detail?: string }[] = [];

    for (const block of activeBlocks || []) {
      try {
        const { data: apiSettings } = await supabase
          .from('api_keys')
          .select('provider, api_key, created_at')
          .eq('user_id', block.user_id);

        const rows = (apiSettings || []) as ApiSettingRow[];
        const apiKey = pickLatest(rows, 'custom');
        const apiUrl = pickLatest(rows, 'custom_base_url');
        const model = pickLatest(rows, 'custom_model');

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
            apiKey,
            apiUrl,
            model,
            batchCount: 1,
          }),
        });

        const result = await response.json().catch(() => ({}));
        const success = Boolean(result?.success);

        results.push({
          userId: block.user_id,
          characterId: block.character_id,
          success,
          detail: result?.reason || result?.message || result?.error,
        });

        console.log(`Processed block for user ${block.user_id}, character ${block.character_id}:`, success, result?.reason || '');
      } catch (err) {
        console.error(`Error processing block for user ${block.user_id}:`, err);
        results.push({
          userId: block.user_id,
          characterId: block.character_id,
          success: false,
          detail: String(err),
        });
      }
    }

    return new Response(JSON.stringify({
      processed: results.length,
      results,
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
