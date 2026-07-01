import { createHash } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { analyzeSpendingAI } from "@/lib/ai";
import { consumeUsage } from "@/lib/usage";
import { txToClient } from "@/lib/serialize";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "@/i18n/config";
import type { Insight, Transaction } from "@/lib/types";

/** Stable fingerprint of the data + locale an analysis was generated from. */
function signature(txs: Transaction[], budget: number, locale: string): string {
  const basis = txs
    .map((t) => `${t.id}:${t.amount}:${t.category}:${t.date}`)
    .sort()
    .join("|");
  return createHash("sha1")
    .update(`${locale}#${budget}#${basis}`)
    .digest("hex");
}

async function currentLocale(): Promise<string> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Return the cached analysis if it still matches the current data, else null. */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await prisma.transaction.findMany({ where: { userId: user.id } });
  const sig = signature(rows.map(txToClient), user.budget, await currentLocale());
  const cached = await prisma.user.findUnique({
    where: { id: user.id },
    select: { analysisSig: true, analysisJson: true },
  });
  if (cached?.analysisSig === sig && cached.analysisJson) {
    try {
      return NextResponse.json({
        insights: JSON.parse(cached.analysisJson) as Insight[],
      });
    } catch {
      /* ignore */
    }
  }
  return NextResponse.json({ insights: null });
}

export async function POST() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const locale = await currentLocale();
  const rows = await prisma.transaction.findMany({ where: { userId: user.id } });
  const txs = rows.map(txToClient);
  const sig = signature(txs, user.budget, locale);

  // Cache hit: same data as last time → return stored insights. No Gemini call,
  // no token spend, and it doesn't count against the daily usage limit. This is
  // what stops repeated clicks from running up the bill.
  const cached = await prisma.user.findUnique({
    where: { id: user.id },
    select: { analysisSig: true, analysisJson: true },
  });
  if (cached?.analysisSig === sig && cached.analysisJson) {
    try {
      const insights = JSON.parse(cached.analysisJson) as Insight[];
      return NextResponse.json({ insights, cached: true });
    } catch {
      /* fall through and regenerate */
    }
  }

  // Cache miss: enforce the daily limit, then generate fresh.
  const usage = await consumeUsage(
    user.id,
    "analyze",
    user.entitlements.aiAnalyzePerDay
  );
  if (!usage.allowed) {
    if (usage.reason === "cooldown") {
      return NextResponse.json(
        {
          error: "cooldown",
          message: `Tunggu ${usage.retryAfter} detik sebelum menganalisa lagi.`,
          retryAfter: usage.retryAfter,
        },
        { status: 429, headers: { "Retry-After": String(usage.retryAfter ?? 8) } }
      );
    }
    const message =
      usage.reason === "abuse"
        ? `Kamu mencapai batas keamanan ${usage.limit} analisa AI hari ini. Coba lagi besok.`
        : `Batas ${usage.limit} analisa AI hari ini sudah tercapai. Upgrade ke Pro untuk tanpa batas.`;
    return NextResponse.json(
      { error: "limit_reached", message, used: usage.used, limit: usage.limit },
      { status: 429 }
    );
  }

  const insights = await analyzeSpendingAI(txs, user.budget, locale);
  await prisma.user.update({
    where: { id: user.id },
    data: { analysisSig: sig, analysisJson: JSON.stringify(insights) },
  });
  return NextResponse.json({ insights, usage, cached: false });
}
