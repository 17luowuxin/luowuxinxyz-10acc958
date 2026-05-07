import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BATCH_SIZE = 200;

const RELATED_TABLES = [
  { name: 'chat_messages', scopedByUser: true },
  { name: 'character_memories', scopedByUser: true },
  { name: 'character_extracted_memories', scopedByUser: true },
  { name: 'character_summaries', scopedByUser: true },
  { name: 'character_sprites', scopedByUser: true },
  { name: 'world_books', scopedByUser: true },
  { name: 'chat_read_status', scopedByUser: true },
  { name: 'character_blocks', scopedByUser: true },
  { name: 'pending_messages', scopedByUser: true },
  { name: 'presets', scopedByUser: true },
  { name: 'moments', scopedByUser: true },
  { name: 'diaries', scopedByUser: true },
  { name: 'dream_transactions', scopedByUser: true },
  { name: 'gift_history', scopedByUser: true },
  { name: 'guestbook', scopedByUser: true },
  { name: 'vn_saves', scopedByUser: true },
  { name: 'group_members', scopedByUser: false },
  { name: 'group_messages', scopedByUser: false },
] as const;

function isValidUUID(value: string) {
  return UUID_REGEX.test(value);
}

function getClients(authSource: string | null, authHeader: string) {
  const cloudUrl = Deno.env.get('SUPABASE_URL')!;
  const cloudServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const cloudAdmin = createClient(cloudUrl, cloudServiceKey);

  const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL');
  const externalServiceKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY');
  const externalAdmin = externalUrl && externalServiceKey
    ? createClient(externalUrl, externalServiceKey)
    : null;

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const verifyClient = authSource === 'external' && externalAdmin ? externalAdmin : cloudAdmin;
  const dataClient = authSource === 'external' && externalAdmin ? externalAdmin : cloudAdmin;

  return { verifyClient, dataClient, token };
}

async function deleteByCharacterInBatches(
  adminClient: ReturnType<typeof createClient>,
  table: string,
  userId: string,
  characterId: string,
  scopedByUser: boolean,
) {
  let deleted = 0;

  while (true) {
    let query = adminClient
      .from(table)
      .select('id')
      .eq('character_id', characterId)
      .limit(BATCH_SIZE);

    if (scopedByUser) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`${table}: ${error.message}`);
    }

    const ids = (data || []).map((row: { id: string }) => row.id).filter(Boolean);
    if (ids.length === 0) break;

    const { error: deleteError } = await adminClient
      .from(table)
      .delete()
      .in('id', ids);

    if (deleteError) {
      throw new Error(`${table}: ${deleteError.message}`);
    }

    deleted += ids.length;

    if (ids.length < BATCH_SIZE) break;
  }

  return deleted;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { characterId, authSource } = await req.json();

    if (!characterId || typeof characterId !== 'string' || !isValidUUID(characterId)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid characterId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { verifyClient, dataClient, token } = getClients(authSource ?? null, authHeader);
    const { data: userData, error: userError } = await verifyClient.auth.getUser(token);

    if (userError || !userData.user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = userData.user.id;

    const { data: existingCharacter, error: existingError } = await dataClient
      .from('characters')
      .select('id')
      .eq('id', characterId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }

    if (!existingCharacter) {
      return new Response(JSON.stringify({ success: false, error: '未找到该角色或没有权限' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const deletedCounts: Record<string, number> = {};

    for (const table of RELATED_TABLES) {
      deletedCounts[table.name] = await deleteByCharacterInBatches(dataClient, table.name, userId, characterId, table.scopedByUser);
    }

    const { error: deleteCharacterError } = await dataClient
      .from('characters')
      .delete()
      .eq('id', characterId)
      .eq('user_id', userId);

    if (deleteCharacterError) {
      throw new Error(`characters: ${deleteCharacterError.message}`);
    }

    return new Response(JSON.stringify({ success: true, deletedCounts }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[delete-character] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});