"use client";

import { useEffect, useState } from "react";
import { PLANS } from "@/lib/plans";
import { formatCurrency } from "@/lib/format";
import { useI18n } from "@/components/I18nProvider";

/**
 * Simulated Midtrans payment page. In production Midtrans hosts this (Snap);
 * here we mimic it so the upgrade flow works end-to-end. The buttons POST the
 * same notification shape Midtrans would send to /api/billing/webhook.
 */
export default function PayPage() {
  const { t } = useI18n();
  const [orderId, setOrderId] = useState("");
  const [amount, setAmount] = useState(PLANS.pro.price);
  const [cycle, setCycle] = useState("monthly");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setOrderId(q.get("order_id") ?? "");
    const a = Number(q.get("amount"));
    if (Number.isFinite(a) && a > 0) setAmount(a);
    setCycle(q.get("cycle") ?? "monthly");
  }, []);

  async function settle(status: "settlement" | "cancel") {
    if (!orderId) return;
    setBusy(true);
    await fetch("/api/billing/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_id: orderId,
        transaction_status: status,
        status_code: "200",
        gross_amount: String(amount),
      }),
    });
    window.location.href =
      status === "settlement" ? "/account?upgraded=1" : "/pricing";
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
          <span className="rounded bg-surface-muted px-2 py-0.5">Midtrans</span>
          <span>{t("pay.badge")}</span>
        </div>

        <h1 className="text-lg font-bold">{t("pay.title")}</h1>
        <p className="mt-1 text-sm text-muted">
          {cycle === "yearly" ? t("pay.subYearly") : t("pay.sub")}
        </p>

        <div className="my-5 flex items-baseline justify-between border-y border-border py-4">
          <span className="text-sm text-muted">{t("pay.total")}</span>
          <span className="text-2xl font-bold">{formatCurrency(amount)}</span>
        </div>

        <p className="mb-4 truncate text-xs text-muted">
          {t("pay.order", { id: orderId || "—" })}
        </p>

        <button
          onClick={() => settle("settlement")}
          disabled={busy || !orderId}
          className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? t("pay.processing") : t("pay.payNow")}
        </button>
        <button
          onClick={() => settle("cancel")}
          disabled={busy}
          className="mt-2 w-full rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted hover:bg-surface-muted"
        >
          {t("pay.cancel")}
        </button>
      </div>
    </div>
  );
}
