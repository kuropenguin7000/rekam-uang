import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { googleAuthUrl, googleConfigured } from "@/lib/google";
import { publicBaseUrl } from "@/lib/url";

const STATE_COOKIE = "g_state";

export async function GET(req: Request) {
  if (!googleConfigured()) {
    // No Google credentials configured on the server.
    return NextResponse.redirect(
      new URL("/login?error=nogoogle", publicBaseUrl(req))
    );
  }
  const state = crypto.randomUUID();
  const store = await cookies();
  store.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return NextResponse.redirect(googleAuthUrl(state));
}
