import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Convert base64url to Uint8Array
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - base64Url.length % 4) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Generate VAPID authorization header
async function generateVapidAuthHeader(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  subject: string
): Promise<{ authorization: string; cryptoKey: string }> {
  const audience = new URL(endpoint).origin;
  
  // Create JWT header
  const header = { typ: 'JWT', alg: 'ES256' };
  
  // Create JWT payload
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60, // 12 hours
    sub: subject
  };
  
  // Encode header and payload
  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedToken = `${headerB64}.${payloadB64}`;
  
  // Import private key
  const privateKeyBytes = base64UrlToUint8Array(vapidPrivateKey);
  
  // Create the key in JWK format
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: vapidPublicKey.slice(0, 43),
    y: vapidPublicKey.slice(43),
    d: btoa(String.fromCharCode(...privateKeyBytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  };
  
  try {
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );
    
    // Sign the token
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      encoder.encode(unsignedToken)
    );
    
    // Convert signature to base64url
    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    const jwt = `${unsignedToken}.${signatureB64}`;
    
    return {
      authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
      cryptoKey: `p256ecdsa=${vapidPublicKey}`
    };
  } catch (error) {
    console.error('Error generating VAPID header:', error);
    throw error;
  }
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
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (subError) {
      console.error('[send-push] Error fetching subscriptions:', subError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch subscriptions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[send-push] No subscriptions found for user:', userId);
      return new Response(
        JSON.stringify({ message: 'No subscriptions found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[send-push] Found ${subscriptions.length} subscription(s)`);

    const results = [];
    
    for (const sub of subscriptions) {
      try {
        // Create push payload
        const payload = JSON.stringify({
          title: title || `${characterName || '角色'}发来消息`,
          body: body || '你收到了一条新消息',
          url: url || (characterId ? `/chat/${characterId}` : '/'),
          characterId,
          tag: `chat-${characterId || 'default'}`
        });

        // Build request headers
        const pushHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          'TTL': '86400',
        };

        // Add VAPID authentication if available
        if (vapidPublicKey && vapidPrivateKey) {
          try {
            const vapidHeaders = await generateVapidAuthHeader(
              sub.endpoint,
              vapidPublicKey,
              vapidPrivateKey,
              'mailto:noreply@lovable.dev'
            );
            pushHeaders['Authorization'] = vapidHeaders.authorization;
            pushHeaders['Crypto-Key'] = vapidHeaders.cryptoKey;
          } catch (vapidError) {
            console.error('[send-push] VAPID header generation failed:', vapidError);
            // Continue without VAPID - may fail on some push services
          }
        }

        console.log(`[send-push] Sending to endpoint: ${sub.endpoint.slice(0, 60)}...`);

        const response = await fetch(sub.endpoint, {
          method: 'POST',
          headers: pushHeaders,
          body: payload
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
