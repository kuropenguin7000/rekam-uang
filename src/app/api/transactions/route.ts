import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CATEGORIES } from "@/lib/categories";
import { txToClient } from "@/lib/serialize";
import { todayISO } from "@/lib/format";
import type { CategoryId } from "@/lib/types";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await prisma.transaction.findMany({
    where: { userId: user.id },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ transactions: rows.map(txToClient) });
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    amount?: number;
    category?: string;
    type?: string;
    merchant?: string;
    note?: string;
    date?: string;
  };

  const amount = Math.round(Number(body.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "invalid amount" }, { status: 400 });
  }
  const type = body.type === "income" ? "income" : "expense";
  // Income isn't tied to an expense category.
  const category = (
    type === "income"
      ? "other"
      : body.category && body.category in CATEGORIES
        ? body.category
        : "other"
  ) as CategoryId;

  const row = await prisma.transaction.create({
    data: {
      userId: user.id,
      amount,
      category,
      type,
      merchant: (body.merchant ?? "").slice(0, 80),
      note: (body.note ?? "").slice(0, 280),
      date: body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : todayISO(),
    },
  });
  return NextResponse.json({ transaction: txToClient(row) }, { status: 201 });
}
