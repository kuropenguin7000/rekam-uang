import "server-only";

/**
 * Minimal Google OAuth 2.0 (authorization-code) helper. Active only when
 * GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET are set; otherwise the app uses the
 * demo sign-in. To enable real Google login, create an OAuth client at
 * https://console.cloud.google.com and add `${APP_URL}/api/auth/google/callback`
 * as an authorized redirect URI.
 */

function appUrl(): string {
  return process.env.APP_URL || "http://localhost:3000";
}

export function redirectUri(): string {
  return `${appUrl()}/api/auth/google/callback`;
}

export function googleConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
}

export function googleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface GoogleProfile {
  email: string;
  name?: string;
  picture?: string;
}

export async function exchangeCode(code: string): Promise<GoogleProfile> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) throw new Error("Google token exchange failed");
  const tokens = (await tokenRes.json()) as { access_token: string };

  const infoRes = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  );
  if (!infoRes.ok) throw new Error("Google userinfo failed");
  const info = (await infoRes.json()) as {
    email: string;
    name?: string;
    picture?: string;
  };
  return { email: info.email, name: info.name, picture: info.picture };
}
