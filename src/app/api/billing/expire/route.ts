import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Batch subscription-expiry job. Downgrades every non-master Pro user whose
 * paid period has lapsed. Safe to call repeatedly and by anyone (it only ever
 * applies what the clock already dictates), but if CRON_SECRET is set we
 * require a matching `Authorization: Bearer <secret>` so a scheduler can own it.
 *
 * Wire a cron to: POST /api/billing/expire  (e.g. hourly). The lazy check in
 * getAuthUser already downgrades on access; this just makes it proactive.
 */
async function runExpiry(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const result = await prisma.user.updateMany({
    where: {
      role: { not: "master" },
      plan: "pro",
      planExpiresAt: { lt: new Date() },
    },
    data: { plan: "free" },
  });

  return NextResponse.json({ ok: true, downgraded: result.count });
}

export async function POST(req: Request) {
  return runExpiry(req);
}

// Allow GET too so platform cron schedulers that only issue GETs can trigger it.
export async function GET(req: Request) {
  return runExpiry(req);
}
