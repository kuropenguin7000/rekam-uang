import { prisma } from "./db";
import { todayISO } from "./format";

export type Feature = "parse" | "analyze";

/**
 * Absolute per-day ceiling on *actual* AI generations, applied to EVERY account
 * — including pro and master. The plan limit controls the trial experience; this
 * is the anti-abuse backstop so a script (e.g. add a transaction → analyze in a
 * loop) can't run up the AI bill / quota. Far above any human's daily use.
 */
const HARD_CAP: Record<Feature, number> = {
  parse: 150,
  analyze: 30,
};

/**
 * Minimum gap between two *actual* generations of the same feature, per user.
 * This throttles scripted loops (a request faster than this is rejected with a
 * Retry-After) without affecting normal human use.
 */
const COOLDOWN_MS: Record<Feature, number> = {
  parse: 1500, // 1.5s between expense parses
  analyze: 8000, // 8s between analyses
};

export interface UsageResult {
  allowed: boolean;
  used: number;
  /** the effective limit that applied (plan limit or hard cap, whichever is lower) */
  limit: number;
  /** which limit blocked the request, when not allowed */
  reason?: "plan" | "abuse" | "cooldown";
  /** seconds to wait before retrying, when reason === "cooldown" */
  retryAfter?: number;
}

/**
 * Atomically check today's usage for a feature and, if under the effective
 * limit, increment it. The effective limit is min(planLimit, HARD_CAP), so even
 * "unlimited" (Infinity) plans are capped by the abuse backstop.
 */
export async function consumeUsage(
  userId: string,
  feature: Feature,
  planLimit: number
): Promise<UsageResult> {
  const cap = HARD_CAP[feature];
  const effectiveLimit = Math.min(planLimit, cap);
  const day = todayISO();

  const existing = await prisma.usage.findUnique({
    where: { userId_day_feature: { userId, day, feature } },
  });
  const used = existing?.count ?? 0;

  if (used >= effectiveLimit) {
    // If the plan itself is the binding limit it's a "plan" block (upgradeable);
    // otherwise the request hit the global abuse cap.
    const reason = used >= planLimit ? "plan" : "abuse";
    return { allowed: false, used, limit: effectiveLimit, reason };
  }

  // Per-request cooldown: reject calls that come faster than the allowed gap.
  if (existing?.updatedAt) {
    const elapsed = Date.now() - existing.updatedAt.getTime();
    const gap = COOLDOWN_MS[feature];
    if (elapsed < gap) {
      return {
        allowed: false,
        used,
        limit: effectiveLimit,
        reason: "cooldown",
        retryAfter: Math.ceil((gap - elapsed) / 1000),
      };
    }
  }

  await prisma.usage.upsert({
    where: { userId_day_feature: { userId, day, feature } },
    create: { userId, day, feature, count: 1 },
    update: { count: { increment: 1 } },
  });
  return { allowed: true, used: used + 1, limit: effectiveLimit };
}

/** Read today's usage without incrementing (for the /api/me payload). */
export async function todayUsage(userId: string, feature: Feature): Promise<number> {
  const day = todayISO();
  const row = await prisma.usage.findUnique({
    where: { userId_day_feature: { userId, day, feature } },
  });
  return row?.count ?? 0;
}
