"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { priceFor, type BillingCycle, type PlanId } from "@/lib/plans";
import { formatCurrency } from "@/lib/format";
import { CheckIcon } from "@/components/icons";
import { useI18n } from "@/components/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import type { MessageKey } from "@/i18n/messages";

const FEATURE_KEYS: Record<PlanId, MessageKey[]> = {
  free: ["plan.free.f1", "plan.free.f2", "plan.free.f3", "plan.free.f4", "plan.free.f5"],
  pro: [
    "plan.pro.f1",
    "plan.pro.f2",
    "plan.pro.f3",
    "plan.pro.f4",
    "plan.pro.f5",
    "plan.pro.f6",
  ],
};

export default function PricingPage() {
  const { t } = useI18n();
  const [plan, setPlan] = useState<PlanId | null>(null);
  const [isMaster, setIsMaster] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [wantRenew, setWantRenew] = useState(false);

  useEffect(() => {
    setWantRenew(
      new URLSearchParams(window.location.search).get("renew") === "1"
    );
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) {
          setAuthed(true);
          setPlan(d.user.plan);
          setIsMaster(d.user.role === "master");
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  async function upgrade() {
    if (!authed) {
      window.location.href = "/login?from=/pricing";
      return;
    }
    setBusy(true);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "pro", cycle }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok && data.redirectUrl) {
      window.location.href = data.redirectUrl;
    }
  }

  const isPro = plan === "pro" || isMaster;
  // A regular Pro user who arrived via "Renew" wants the purchase UI (to extend),
  // not the benefits comparison. Master can never buy.
  const renewing = plan === "pro" && !isMaster && wantRenew;
  const planIds: PlanId[] = renewing ? ["pro"] : ["free", "pro"];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <Link href="/" className="text-sm font-medium text-muted hover:text-foreground">
          {t("price.back")}
        </Link>
        <div className="flex items-center gap-3">
          {loaded && !isPro && (
            <span className="hidden text-xs text-muted sm:inline">
              {t("price.perMonthNote")}
            </span>
          )}
          <LanguageSwitcher />
        </div>
      </div>

      {!loaded ? (
        <div className="grid h-64 place-items-center text-sm text-muted">
          {t("common.loading")}
        </div>
      ) : isPro && !renewing ? (
        /* ---- Already Pro: benefits comparison, no prices or actions ---- */
        <>
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold">
              {isMaster ? t("price.masterActive") : t("price.proHeading")}
            </h1>
            <p className="mt-2 text-muted">{t("price.proSub")}</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {(["free", "pro"] as PlanId[]).map((id) => {
              const highlight = id === "pro";
              return (
                <div
                  key={id}
                  className={`relative rounded-3xl border p-7 ${
                    highlight
                      ? "border-primary bg-surface shadow-sm ring-1 ring-primary"
                      : "border-border bg-surface/60"
                  }`}
                >
                  {highlight && (
                    <span className="absolute -top-3 start-7 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
                      {t("price.yourPlan")}
                    </span>
                  )}
                  <h2 className="text-lg font-bold">
                    {t(`plan.${id}.name` as MessageKey)}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {t(`plan.${id}.tagline` as MessageKey)}
                  </p>
                  <ul className="mt-5 space-y-2.5">
                    {FEATURE_KEYS[id].map((fk) => (
                      <li key={fk} className="flex items-start gap-2 text-sm">
                        <CheckIcon
                          className={`mt-0.5 h-4 w-4 shrink-0 ${
                            highlight ? "text-success" : "text-muted"
                          }`}
                        />
                        <span className={highlight ? "" : "text-muted"}>{t(fk)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/"
              className="inline-block rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              {t("price.backToApp")}
            </Link>
          </div>
        </>
      ) : (
        /* ---- Not Pro: purchase UI with prices + cycle toggle ---- */
        <>
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold">
              {renewing ? t("price.renewHeading") : t("price.heading")}
            </h1>
            <p className="mt-2 text-muted">
              {renewing ? t("price.renewSub") : t("price.sub")}
            </p>
          </div>

          <div className="mb-10 flex justify-center">
            <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface p-1">
              <button
                onClick={() => setCycle("monthly")}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                  cycle === "monthly"
                    ? "bg-primary text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {t("price.monthly")}
              </button>
              <button
                onClick={() => setCycle("yearly")}
                className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                  cycle === "yearly"
                    ? "bg-primary text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {t("price.yearly")}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    cycle === "yearly"
                      ? "bg-white/20 text-white"
                      : "bg-success-soft text-success"
                  }`}
                >
                  {t("price.yearlySave")}
                </span>
              </button>
            </div>
          </div>

          <div
            className={`grid gap-6 ${
              renewing ? "mx-auto max-w-md" : "md:grid-cols-2"
            }`}
          >
            {planIds.map((id) => {
              const amount = priceFor(id, cycle);
              const highlight = id === "pro";
              return (
                <div
                  key={id}
                  className={`relative rounded-3xl border bg-surface p-7 shadow-sm ${
                    highlight ? "border-primary ring-1 ring-primary" : "border-border"
                  }`}
                >
                  {highlight && (
                    <span className="absolute -top-3 start-7 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
                      {t("price.popular")}
                    </span>
                  )}
                  <h2 className="text-lg font-bold">
                    {t(`plan.${id}.name` as MessageKey)}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {t(`plan.${id}.tagline` as MessageKey)}
                  </p>
                  <p className="mt-4 text-3xl font-bold">
                    {amount === 0 ? t("price.free") : formatCurrency(amount)}
                    {amount > 0 && (
                      <span className="text-base font-normal text-muted">
                        {cycle === "yearly" ? t("price.perYear") : t("price.perMonth")}
                      </span>
                    )}
                  </p>
                  {amount > 0 && cycle === "yearly" && (
                    <p className="mt-1 text-xs text-success">{t("price.yearlySave")}</p>
                  )}

                  <ul className="mt-5 space-y-2.5">
                    {FEATURE_KEYS[id].map((fk) => (
                      <li key={fk} className="flex items-start gap-2 text-sm">
                        <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        <span>{t(fk)}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-7">
                    {id === "free" ? (
                      <Link
                        href="/"
                        className="block w-full rounded-xl border border-border px-4 py-2.5 text-center text-sm font-semibold hover:bg-surface-muted"
                      >
                        {t("price.startFree")}
                      </Link>
                    ) : (
                      <button
                        onClick={upgrade}
                        disabled={busy}
                        className="block w-full rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                      >
                        {busy
                          ? t("price.processing")
                          : renewing
                            ? t("price.extend")
                            : t("price.upgrade")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-8 text-center text-xs text-muted">
            {t("price.midtransNote")}
          </p>
        </>
      )}
    </div>
  );
}
