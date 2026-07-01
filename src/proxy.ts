import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Pages that don't require authentication.
const PUBLIC_PATHS = ["/login", "/pricing", "/terms"];

/**
 * Public base URL for redirects. Behind a tunnel/proxy the request reaching us
 * carries an internal host (e.g. localhost), so redirecting to `req.nextUrl`
 * would bounce the visitor to *their* localhost. Prefer the explicit APP_URL,
 * then the forwarded host, then the request origin.
 */
function baseUrl(req: NextRequest): string {
  const explicit = process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) {
    const proto =
      req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
      req.nextUrl.protocol.replace(":", "");
    return `${proto}://${host}`;
  }
  return req.nextUrl.origin;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const base = baseUrl(req);

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const valid = token ? await verifySession(token) : null;

  // Already signed in but visiting /login → send them into the app.
  if (valid && (pathname === "/login" || pathname.startsWith("/login/"))) {
    const from = req.nextUrl.searchParams.get("from");
    const target = from && from.startsWith("/") ? from : "/";
    return NextResponse.redirect(new URL(target, base));
  }

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (isPublic) return NextResponse.next();

  if (!valid) {
    const url = new URL("/login", base);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Run on everything except API routes, Next internals and static assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
