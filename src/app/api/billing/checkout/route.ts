import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PLANS, priceFor, type BillingCycle } from "@/lib/plans";
import { createTransaction } from "@/lib/midtrans";

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    plan?: string;
    cycle?: string;
  };
  if (body.plan !== "pro") {
    return NextResponse.json({ error: "invalid plan" }, { status: 400 });
  }
  // Master accounts are permanently Pro — buying is meaningless. Regular Pro
  // users CAN buy again: it's a renewal and the webhook stacks the new period
  // on top of any remaining time.
  if (user.role === "master") {
    return NextResponse.json({ error: "already_pro" }, { status: 400 });
  }

  const cycle: BillingCycle = body.cycle === "yearly" ? "yearly" : "monthly";
  const grossAmount = priceFor("pro", cycle);
  const orderId = `SW-${user.id.slice(0, 6)}-${Date.now()}`;

  const tx = await createTransaction({
    orderId,
    grossAmount,
    customerEmail: user.email,
    itemName: `Rekam Uang ${PLANS.pro.name} (${cycle})`,
    cycle,
  });

  await prisma.subscription.create({
    data: {
      userId: user.id,
      plan: "pro",
      status: "pending",
      cycle,
      orderId,
      grossAmount,
      midtransToken: tx.token,
    },
  });

  return NextResponse.json({
    orderId,
    redirectUrl: tx.redirectUrl,
    token: tx.token,
    grossAmount,
    cycle,
  });
}
