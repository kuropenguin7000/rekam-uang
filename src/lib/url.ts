import "server-only";

/**
 * The public base URL of the app — used to build absolute redirects that point
 * at the URL the user is actually on (a tunnel host, a custom domain, …) rather
 * than the internal origin the request hit. Behind a tunnel/proxy the request
 * that reaches Next has `Host: localhost:3000`, so `req.url` can't be trusted
 * for redirects.
 *
 * Priority:
 *   1. APP_URL — explicit override (also what the OAuth redirect_uri is built
 *      from, so they stay consistent).
 *   2. X-Forwarded-Host / -Proto — set by tunnels and most reverse proxies.
 *   3. The request's own origin — plain localhost dev.
 */
export function publicBaseUrl(req: Request): string {
  const explicit = process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    return `${proto}://${host}`;
  }
  return new URL(req.url).origin;
}
