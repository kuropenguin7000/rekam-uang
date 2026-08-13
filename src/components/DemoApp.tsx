"use client";

import { useState } from "react";
import { DemoProvider } from "@/store/DemoStore";
import { LIMITS } from "@/lib/demoGuards";
import { useExpenses } from "@/store/ExpenseStore";
import { useI18n } from "./I18nProvider";
import { Beranda } from "./Beranda";
import { Statistik } from "./Statistik";
import { Transactions } from "./Transactions";
import { Commitments } from "./Commitments";
import { InsightsPanel } from "./InsightsPanel";
import { AddSheet } from "./AddSheet";
import { HomeIcon, InsightIcon, PlusIcon, StatsIcon } from "./icons";
import type { HomePeriod } from "@/lib/period";

type Tab = "home" | "stats" | "insights";

/**
 * The playable demo embedded in the landing page.
 *
 * It mounts the *real* Beranda / Statistik / Komitmen / AddSheet against
 * DemoProvider instead of ExpenseProvider, so what a visitor plays with is
 * the actual product rather than a mock that can drift from it.
 *
 * Everything lives in React state — see DemoStore for why that is the security
 * design and not just a shortcut. The Akun tab is deliberately absent: it owns
 * sign-out, which would reach for Firebase Auth.
 */
export function DemoApp() {
  return (
    <DemoProvider>
      <DemoShell />
    </DemoProvider>
  );
}

function DemoShell() {
  const { t } = useI18n();
  const { transactions, commitments } = useExpenses();
  const [tab, setTab] = useState<Tab>("home");
  const [showAll, setShowAll] = useState<{
    period: HomePeriod;
    month: string;
  } | null>(null);
  const [showCommitments, setShowCommitments] = useState(false);
  const [adding, setAdding] = useState(false);

  function go(next: Tab) {
    setTab(next);
    setShowAll(null);
    setShowCommitments(false);
  }

  const txFull = transactions.length >= LIMITS.transactions;

  const view =
    tab === "home" ? (
      showAll ? (
        <Transactions
          onBack={() => setShowAll(null)}
          initialPeriod={showAll.period}
          initialMonth={showAll.month}
        />
      ) : showCommitments ? (
        <Commitments onBack={() => setShowCommitments(false)} />
      ) : (
        <Beranda
          onSeeAll={(period, month) => setShowAll({ period, month })}
          onOpenCommitments={() => setShowCommitments(true)}
        />
      )
    ) : tab === "stats" ? (
      <Statistik />
    ) : (
      <InsightsPanel />
    );

  return (
    <div className="mx-auto w-full max-w-[420px]">
      {/* Sandbox notice. Says plainly that nothing is stored and nothing is
          sent anywhere — the two facts that make this safe to expose. */}
      <div className="card mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {t("demo.badge")}
        </span>
        <span className="text-[11px] text-muted">{t("demo.local")}</span>
        <span className="num ms-auto text-[10.5px] text-muted">
          {transactions.length}/{LIMITS.transactions} · {commitments.length}/
          {LIMITS.commitments}
        </span>
      </div>

      {txFull && (
        <p className="mb-3 rounded-xl bg-surface-muted px-3.5 py-2 text-[11.5px] text-muted">
          {t("demo.full", { n: LIMITS.transactions })}
        </p>
      )}

      {/* A phone-shaped frame so the demo reads as the mobile app it is. */}
      <div className="card overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto px-4 pb-4 pt-4">{view}</div>

        <nav className="flex items-stretch border-t border-border bg-surface/95 pb-1">
          <DemoTab
            active={tab === "home"}
            onClick={() => go("home")}
            icon={<HomeIcon className="h-[19px] w-[19px]" />}
            label={t("nav.home")}
          />
          <DemoTab
            active={tab === "stats"}
            onClick={() => go("stats")}
            icon={<StatsIcon className="h-[19px] w-[19px]" />}
            label={t("nav.stats")}
          />

          <div className="flex w-[64px] shrink-0 justify-center">
            <button
              onClick={() => setAdding(true)}
              disabled={txFull}
              aria-label={t("add.title")}
              className="grad-primary -mt-4 grid h-12 w-12 place-items-center rounded-full shadow-lg ring-4 ring-surface transition active:scale-90 disabled:opacity-40"
            >
              <PlusIcon className="h-5 w-5" />
            </button>
          </div>

          <DemoTab
            active={tab === "insights"}
            onClick={() => go("insights")}
            icon={<InsightIcon className="h-[19px] w-[19px]" />}
            label={t("nav.insights")}
          />
          {/* Fifth slot kept empty so the raised + stays centred, matching the
              real bar. Akun is absent: it owns sign-out. */}
          <div className="flex-1" aria-hidden />
        </nav>
      </div>

      {adding && <AddSheet onClose={() => setAdding(false)} />}
    </div>
  );
}

function DemoTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-[3px] pt-2 text-[9.5px] font-semibold transition-colors ${
        active ? "text-primary" : "text-muted"
      }`}
    >
      <span className={`transition-transform duration-200 ${active ? "scale-110" : ""}`}>
        {icon}
      </span>
      {label}
    </button>
  );
}
