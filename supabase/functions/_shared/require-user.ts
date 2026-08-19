import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type AuthSource = "lovable-cloud" | "external";

type AuthSuccess = {
  ok: true;
  userId: string;
  source: AuthSource;
};

type AuthFailure = {
  ok: false;
  status: 401 | 403;
  message: string;
};

export type AuthResult = AuthSuccess | AuthFailure;

function bearerToken(req: Request): string {
  const value = req.headers.get("Authorization")?.trim() ?? "";
  return value.replace(/^Bearer\s+/i, "").trim();
}

export function requireServiceRole(req: Request): boolean {
  const token = bearerToken(req);
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return Boolean(serviceRoleKey && token === serviceRoleKey);
}

/**
 * Edge Functions are hosted in Lovable Cloud, while users may be authenticated
 * by either the Cloud or external Supabase project. Verify the bearer token
 * against the matching Auth service before any service-role data access.
 */
export async function requireUser(
  req: Request,
  claimedUserId?: unknown,
  preferredSource?: unknown,
): Promise<AuthResult> {
  const token = bearerToken(req);
  if (!token) return { ok: false, status: 401, message: "Unauthorized" };

  const cloudUrl = Deno.env.get("SUPABASE_URL");
  const cloudKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const externalKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");

  const candidates: Array<{ source: AuthSource; url: string; key: string }> = [];
  const cloud = cloudUrl && cloudKey
    ? { source: "lovable-cloud" as const, url: cloudUrl, key: cloudKey }
    : null;
  const external = externalUrl && externalKey
    ? { source: "external" as const, url: externalUrl, key: externalKey }
    : null;

  if (preferredSource === "external") {
    if (external) candidates.push(external);
    if (cloud) candidates.push(cloud);
  } else {
    if (cloud) candidates.push(cloud);
    if (external) candidates.push(external);
  }

  // Trusted server-to-server calls may use the Cloud service-role key.
  if (cloudKey && token === cloudKey && typeof claimedUserId === "string" && claimedUserId) {
    return {
      ok: true,
      userId: claimedUserId,
      source: preferredSource === "external" ? "external" : "lovable-cloud",
    };
  }

  for (const candidate of candidates) {
    const client = createClient(candidate.url, candidate.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) continue;

    if (typeof claimedUserId === "string" && claimedUserId && claimedUserId !== data.user.id) {
      return { ok: false, status: 403, message: "User mismatch" };
    }

    return { ok: true, userId: data.user.id, source: candidate.source };
  }

  return { ok: false, status: 401, message: "Unauthorized" };
}

export function authErrorResponse(
  result: AuthFailure,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify({ error: result.message }), {
    status: result.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
