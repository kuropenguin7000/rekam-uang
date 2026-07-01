import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode } from "@/lib/google";
import { startSession, upsertUser } from "@/lib/auth";
import { publicBaseUrl } from "@/lib/url";

const STATE_COOKIE = "g_state";

export async function GET(req: Request) {
  // Build redirects from the public base (APP_URL / forwarded host) so they
  // land back on the tunnel/domain the user is on, not the internal localhost.
  const base = publicBaseUrl(req);
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const store = await cookies();
  const expected = store.get(STATE_COOKIE)?.value;
  store.delete(STATE_COOKIE);

  if (!code || !state || !expected || state !== expected) {
    return NextResponse.redirect(new URL("/login?error=oauth", base));
  }

  try {
    const profile = await exchangeCode(code);
    const user = await upsertUser({
      email: profile.email,
      name: profile.name,
      image: profile.picture,
    });
    await startSession(user);
    return NextResponse.redirect(new URL("/", base));
  } catch {
    return NextResponse.redirect(new URL("/login?error=oauth", base));
  }
}
