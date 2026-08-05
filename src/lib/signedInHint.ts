/**
 * A synchronously readable hint that a Firebase session probably exists.
 *
 * Firebase persists its session in IndexedDB, which is asynchronous: on a cold
 * load nothing can know the visitor is signed in until a round-trip finishes.
 * That gap is long enough for the landing page to paint, so a daily user
 * opening "/" would watch a marketing page flash by before being forwarded to
 * /app. localStorage is synchronous, so an inline script can read this before
 * the first paint and redirect immediately.
 *
 * It is a HINT and never an authorization decision. A stale "1" costs one
 * extra hop — /app's real auth check bounces to /login and clears the flag —
 * and a missing flag just means the visitor sees the landing page for a moment
 * longer. Nothing is unlocked by forging it.
 */
export const SIGNED_IN_HINT = "sw_signed_in";

/** Mirror the resolved auth state into the pre-paint hint. */
export function markSignedIn(signedIn: boolean): void {
  try {
    if (signedIn) localStorage.setItem(SIGNED_IN_HINT, "1");
    else localStorage.removeItem(SIGNED_IN_HINT);
  } catch {
    /* Private mode or storage disabled — the hint is strictly optional. */
  }
}
