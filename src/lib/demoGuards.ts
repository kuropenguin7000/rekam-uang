/**
 * Input guards for the public landing-page demo.
 *
 * The demo is the one place in this app where a completely anonymous visitor
 * can drive application code, so its whole input surface is collected here:
 * one small, pure, testable module rather than clamping scattered through a
 * component.
 *
 * The demo holds no database connection at all (see DemoStore for why that is
 * the actual security design), so nothing here defends a server. These guards
 * bound what a visitor can do to their own tab: unbounded growth, absurd
 * numbers reaching the formatters, and oversized strings.
 */

/** Row caps. Small enough to stay obviously a demo, big enough to play with. */
export const LIMITS = {
  transactions: 25,
  commitments: 8,
  customCategories: 6,
  customMembers: 6,
  /** Entries in one custom instalment plan. */
  scheduleEntries: 24,
} as const;

/** Nothing in a demo needs to exceed a billion rupiah. */
export const MAX_AMOUNT = 1_000_000_000;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

/**
 * A positive integer, or 0 meaning "reject this write".
 *
 * Everything hostile collapses to 0: NaN, Infinity, -1, "abc", null, objects,
 * and 1e308 (which would otherwise reach toLocaleString and render as a
 * screenful of digits). Values above MAX_AMOUNT are clamped rather than
 * rejected, so a fat-fingered 99999999999 still does something sensible.
 */
export function safeAmount(value: unknown): number {
  // Only numbers and numeric strings are money. Without this, JS coercion
  // quietly accepts `true` as 1 rupiah and `["5"]` as 5.
  if (typeof value !== "number" && typeof value !== "string") return 0;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, MAX_AMOUNT);
}

/** Trimmed and hard-truncated. Non-strings become "". */
export function safeText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, Math.max(0, max));
}

/** A yyyy-mm-dd string, or the supplied fallback. */
export function safeDate(value: unknown, fallback: string): string {
  return typeof value === "string" && DATE_RE.test(value) ? value : fallback;
}

/** True for a well-formed yyyy-mm schedule key. */
export function isMonthKey(value: unknown): value is string {
  return typeof value === "string" && MONTH_RE.test(value);
}

/** A #rgb/#rrggbb(aa) colour, or the fallback. */
export function safeColor(value: unknown, fallback = "#94a3b8"): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{3,8}$/.test(value)
    ? value
    : fallback;
}

/** Clamp an integer into [min, max]; non-numbers become `min`. */
export function safeCount(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" && typeof value !== "string") return min;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/**
 * Sanitize a whole custom payment plan: yyyy-mm keys, positive amounts, and
 * never more entries than the cap — so a pasted object with 100k keys cannot
 * be turned into 100k React nodes.
 */
export function safeSchedule(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isMonthKey(k)) continue;
    const amount = safeAmount(v);
    if (amount <= 0) continue;
    out[k] = amount;
    if (Object.keys(out).length >= LIMITS.scheduleEntries) break;
  }
  return out;
}
