import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyNotification } from "@/lib/midtrans";
import { addCycle, type BillingCycle } from "@/lib/plans";

/**
 * Midtrans payment notification handler. Real Midtrans POSTs here after a
 * payment; in mock mode our simulated pay page POSTs the same shape. This is
 * unauthenticated by design (it's a gateway callback) and is the single place
 * where a plan is actually upgraded.
 */
export async function POST(req: Request) {
  const payload = (await req.json().catch(() => ({}))) as {
    order_id?: string;
    transaction_status?: string;
    status_code?: string;
    gross_amount?: string;
    signature_key?: string;
  };

  if (!verifyNotification(payload)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 403 });
  }

  const sub = await prisma.subscription.findUnique({
    where: { orderId: payload.order_id! },
  });
  if (!sub) return NextResponse.json({ error: "not found" }, { status: 404 });

  const status = payload.transaction_status ?? "settlement";
  const success = status === "settlement" || status === "capture";
  const failed =
    status === "expire" || status === "cancel" || status === "deny";

  if (success) {
    // Stack the new period on top of any time still remaining so a renewal
    // never shortens the user's paid window.
    const user = await prisma.user.findUnique({ where: { id: sub.userId } });
    const now = new Date();
    const base =
      user?.planExpiresAt && user.planExpiresAt > now ? user.planExpiresAt : now;
    const periodEnd = addCycle(base, sub.cycle as BillingCycle);

    await prisma.$transaction([
      prisma.subscription.update({
        where: { orderId: sub.orderId },
        data: { status: "active", paymentType: "mock", currentPeriodEnd: periodEnd },
      }),
      prisma.user.update({
        where: { id: sub.userId },
        data: { plan: "pro", planExpiresAt: periodEnd },
      }),
    ]);
  } else if (failed) {
    await prisma.subscription.update({
      where: { orderId: sub.orderId },
      data: { status: "failed" },
    });
  }

  return NextResponse.json({ ok: true, status });
}
