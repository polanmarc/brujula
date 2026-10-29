// Per-user Google OAuth (read-only Gmail). Tokens live encrypted in google_accounts,
// which only the service role can read.
import { decrypt, encrypt, signState, verifyState } from "./crypto.server";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GMAIL_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/gmail.readonly"];

function oauthConfig() {
  const clientId = process.env["GOOGLE_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_CLIENT_SECRET"];
  const appUrl = process.env["APP_URL"]?.replace(/\/+$/, "");
  if (!clientId || !clientSecret || !appUrl) return null;
  return { clientId, clientSecret, redirectUri: `${appUrl}/api/google/callback`, appUrl };
}

export const googleConfigured = () => !!oauthConfig() && !!process.env["TOKEN_ENCRYPTION_KEY"];

export function buildAuthUrl(userId: string): string {
  const cfg = oauthConfig();
  if (!cfg) throw new Error("Google OAuth no está configurado en el servidor");
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: signState(userId),
  });
  return `${AUTH_URL}?${params}`;
}

type TokenResponse = { access_token: string; expires_in: number; refresh_token?: string; id_token?: string };

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  if (!res.ok) throw new Error(`Google token [${res.status}]: ${await res.text()}`);
  return res.json();
}

function emailFromIdToken(idToken?: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(idToken!.split(".")[1]!, "base64url").toString("utf8"));
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

/** Handles GET /api/google/callback: verifies state, stores encrypted tokens, redirects to Ajustes. */
export async function handleGoogleCallback(request: Request): Promise<Response> {
  const cfg = oauthConfig();
  const url = new URL(request.url);
  const back = (status: string) =>
    Response.redirect(`${cfg?.appUrl ?? url.origin}/ajustes?google=${status}`, 302);
  if (!cfg) return back("not_configured");
  if (url.searchParams.get("error")) return back("denied");
  const userId = verifyState(url.searchParams.get("state") ?? "");
  const code = url.searchParams.get("code");
  if (!userId || !code) return back("invalid");

  try {
    const tok = await tokenRequest({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      grant_type: "authorization_code",
    });
    if (!tok.refresh_token) return back("no_refresh");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("google_accounts").upsert({
      user_id: userId,
      email: emailFromIdToken(tok.id_token),
      refresh_token_enc: encrypt(tok.refresh_token),
      access_token_enc: encrypt(tok.access_token),
      expires_at: new Date(Date.now() + (tok.expires_in - 60) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return back("ok");
  } catch (e) {
    console.error("[Google OAuth]", e);
    return back("error");
  }
}

/** Valid access token for a user, refreshing it when expired. null = not connected. */
export async function getUserAccessToken(userId: string): Promise<{ token: string; email: string | null } | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: acc } = await supabaseAdmin.from("google_accounts").select("*").eq("user_id", userId).maybeSingle();
  if (!acc) return null;
  if (acc.access_token_enc && acc.expires_at && new Date(acc.expires_at).getTime() > Date.now()) {
    return { token: decrypt(acc.access_token_enc), email: acc.email };
  }
  const cfg = oauthConfig();
  if (!cfg) return null;
  try {
    const tok = await tokenRequest({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: decrypt(acc.refresh_token_enc),
      grant_type: "refresh_token",
    });
    await supabaseAdmin
      .from("google_accounts")
      .update({
        access_token_enc: encrypt(tok.access_token),
        expires_at: new Date(Date.now() + (tok.expires_in - 60) * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    return { token: tok.access_token, email: acc.email };
  } catch (e) {
    // revoked or expired refresh token: drop the link so the UI offers to reconnect
    if (String(e).includes("invalid_grant")) await supabaseAdmin.from("google_accounts").delete().eq("user_id", userId);
    throw e;
  }
}

export async function disconnectGoogle(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: acc } = await supabaseAdmin.from("google_accounts").select("refresh_token_enc").eq("user_id", userId).maybeSingle();
  if (acc) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(decrypt(acc.refresh_token_enc))}`, { method: "POST" });
    } catch {
      // revocation is best effort
    }
  }
  await supabaseAdmin.from("google_accounts").delete().eq("user_id", userId);
}
