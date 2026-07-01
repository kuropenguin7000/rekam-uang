import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { aiEnabled } from "@/lib/ai";
import { todayUsage } from "@/lib/usage";
import { CATEGORIES } from "@/lib/categories";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [parseUsed, analyzeUsed] = await Promise.all([
    todayUsage(user.id, "parse"),
    todayUsage(user.id, "analyze"),
  ]);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
      plan: user.plan,
      budget: user.budget,
      dailyBudget: user.dailyBudget,
      planExpiresAt: user.planExpiresAt ? user.planExpiresAt.toISOString() : null,
      categoryBudgets: user.categoryBudgets,
      categories: user.categories,
    },
    entitlements: user.entitlements,
    aiEnabled: aiEnabled(),
    usage: {
      parse: { used: parseUsed, limit: user.entitlements.aiParsePerDay },
      analyze: { used: analyzeUsed, limit: user.entitlements.aiAnalyzePerDay },
    },
  });
}

export async function PATCH(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    budget?: number;
    dailyBudget?: number;
    categoryBudgets?: Record<string, unknown>;
  };
  const data: {
    budget?: number;
    dailyBudget?: number;
    categoryBudgets?: string;
  } = {};
  if (typeof body.budget === "number" && body.budget >= 0) {
    data.budget = Math.round(body.budget);
  }
  if (typeof body.dailyBudget === "number" && body.dailyBudget >= 0) {
    data.dailyBudget = Math.round(body.dailyBudget);
  }
  if (body.categoryBudgets && typeof body.categoryBudgets === "object") {
    // Merge onto the existing caps; only valid categories, amount 0 clears a cap.
    const next = { ...user.categoryBudgets };
    for (const [cat, raw] of Object.entries(body.categoryBudgets)) {
      if (!(cat in CATEGORIES)) continue;
      const v = Math.round(Number(raw));
      if (Number.isFinite(v) && v > 0) next[cat] = v;
      else delete next[cat];
    }
    data.categoryBudgets = JSON.stringify(next);
  }
  if (Object.keys(data).length > 0) {
    await prisma.user.update({ where: { id: user.id }, data });
  }
  return NextResponse.json({ ok: true });
}
