import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildPushPayload,
  type PushMessage,
  type PushSubscription,
  type VapidKeys,
} from "https://esm.sh/@block65/webcrypto-web-push@1.0.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function extractBearerToken(req: Request): string {
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader) return '';
  if (authHeader.toLowerCase().startsWith('bearer ')) return authHeader.slice(7);
  return authHeader;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, title, body, url, characterId, characterName } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[send-push] Sending notification to user ${userId} for character ${characterName || characterId}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || '';
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || '';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Security: if called by a normal user session, only allow sending to themselves.
    // (Internal server-to-server calls may use the service role key.)
    const bearer = extractBearerToken(req);
    let effectiveUserId = userId as string;
    if (bearer && bearer !== supabaseServiceKey) {
      const { data: authData, error: authError } = await supabase.auth.getUser(bearer);
      if (authError || !authData?.user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      effectiveUserId = authData.user.id;
    }

    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', effectiveUserId);

    if (subError) {
      console.error('[send-push] Error fetching subscriptions:', subError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch subscriptions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[send-push] No subscriptions found for user:', effectiveUserId);
      return new Response(
        JSON.stringify({ message: 'No subscriptions found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[send-push] Found ${subscriptions.length} subscription(s)`);

    const results = [];
    
    const vapid: VapidKeys | null = (vapidPublicKey && vapidPrivateKey)
      ? {
        subject: 'mailto:noreply@lovable.dev',
        publicKey: vapidPublicKey,
        privateKey: vapidPrivateKey,
      }
      : null;

    if (!vapid) {
      console.error('[send-push] Missing VAPID keys (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)');
    }

    for (const sub of subscriptions) {
      try {
        // Create push payload (this will be encrypted by the web push protocol)
        const payload = JSON.stringify({
          title: title || `${characterName || '角色'}发来消息`,
          body: body || '你收到了一条新消息',
          url: url || (characterId ? `/chat/${characterId}` : '/'),
          characterId,
          tag: `chat-${characterId || 'default'}`
        });

        const subscription: PushSubscription = {
          endpoint: sub.endpoint,
          expirationTime: null,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        const message: PushMessage = {
          data: payload,
          options: {
            ttl: 60 * 60 * 24, // 1 day
          },
        };

        if (!vapid) {
          results.push({ endpoint: sub.endpoint.slice(0, 50), success: false, error: 'Missing VAPID keys' });
          continue;
        }

        const requestInit = await buildPushPayload(message, subscription, vapid);

        console.log(`[send-push] Sending to endpoint: ${sub.endpoint.slice(0, 60)}...`);
        // Deno's type defs can be strict about Uint8Array vs BodyInit; wrap in Blob for compatibility.
        const response = await fetch(subscription.endpoint, {
          ...requestInit,
          // Wrap encrypted bytes into a Blob to satisfy Deno's fetch BodyInit typing.
          body: requestInit.body
            ? new Blob([requestInit.body as unknown as BlobPart])
            : undefined,
        });

        console.log(`[send-push] Response status: ${response.status}`);

        if (response.status === 201 || response.status === 200) {
          results.push({ endpoint: sub.endpoint.slice(0, 50), success: true });
        } else if (response.status === 410 || response.status === 404) {
          // Subscription expired, remove it
          console.log(`[send-push] Subscription expired, removing...`);
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id);
          results.push({ endpoint: sub.endpoint.slice(0, 50), success: false, reason: 'expired' });
        } else {
          const errorText = await response.text().catch(() => '');
          console.error(`[send-push] Push failed with status ${response.status}:`, errorText);
          results.push({ endpoint: sub.endpoint.slice(0, 50), success: false, status: response.status, error: errorText.slice(0, 100) });
        }
      } catch (pushError) {
        console.error('[send-push] Push error for subscription:', sub.id, pushError);
        results.push({ endpoint: sub.endpoint.slice(0, 50), success: false, error: String(pushError) });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[send-push] Completed: ${successCount}/${results.length} successful`);

    return new Response(
      JSON.stringify({ sent: successCount, total: results.length, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[send-push] Error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
