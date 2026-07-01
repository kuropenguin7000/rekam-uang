import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CATEGORIES } from "@/lib/categories";
import { txToClient } from "@/lib/serialize";
import type { CategoryId } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.transaction.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    amount?: number;
    category?: string;
    merchant?: string;
    note?: string;
    date?: string;
  };

  const data: Record<string, unknown> = {};
  if (body.amount !== undefined) {
    const amount = Math.round(Number(body.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "invalid amount" }, { status: 400 });
    }
    data.amount = amount;
  }
  if (body.category !== undefined) {
    data.category = (
      body.category in CATEGORIES ? body.category : "other"
    ) as CategoryId;
  }
  if (body.merchant !== undefined) data.merchant = body.merchant.slice(0, 80);
  if (body.note !== undefined) data.note = body.note.slice(0, 280);
  if (body.date !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    data.date = body.date;
  }

  const row = await prisma.transaction.update({ where: { id }, data });
  return NextResponse.json({ transaction: txToClient(row) });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await prisma.transaction.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await prisma.transaction.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
