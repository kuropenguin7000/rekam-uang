"use client";

import { useState } from "react";
import { Beranda } from "@/components/Beranda";
import { Statistik } from "@/components/Statistik";
import { Transactions } from "@/components/Transactions";
import { AccountPanel } from "@/components/AccountPanel";
import { InsightsPanel } from "@/components/InsightsPanel";
import { AddSheet } from "@/components/AddSheet";
import { HomeIcon, InsightIcon, PlusIcon, StatsIcon, UserIcon } from "@/components/icons";
import { BrandMark } from "@/components/Logo";
import { useI18n } from "@/components/I18nProvider";
import type { MessageKey } from "@/i18n/messages";
import type { HomePeriod } from "@/lib/period";
import { ExpenseProvider, useExpenses } from "@/store/ExpenseStore";

type Tab = "home" | "stats" | "insights" | "account";

const TABS: { id: Tab; labelKey: MessageKey; icon: React.ReactNode }[] = [
  { id: "home", labelKey: "nav.home", icon: <HomeIcon /> },
  { id: "stats", labelKey: "nav.stats", icon: <StatsIcon /> },
  { id: "insights", labelKey: "nav.insights", icon: <InsightIcon /> },
  { id: "account", labelKey: "nav.account", icon: <UserIcon /> },
];

export default function Page() {
  return (
    <ExpenseProvider>
      <Shell />
    </ExpenseProvider>
  );
}

function Shell() {
  const [tab, setTab] = useState<Tab>("home");
  // Full transaction list is a sub-view of Home, not its own tab — it is
  // reached from Beranda's "Lihat semua" and returns with the back arrow.
  // Non-null means the list is open; it carries the filter Beranda was showing
  // so the list opens on the same window rather than resetting to the month.
  const [showAll, setShowAll] = useState<{
    period: HomePeriod;
    month: string;
  } | null>(null);
  const [adding, setAdding] = useState(false);
  const { ready } = useExpenses();
  const { t } = useI18n();

  function go(next: Tab) {
    setTab(next);
    setShowAll(null);
  }

  const view =
    tab === "home" ? (
      showAll ? (
        <Transactions
          onBack={() => setShowAll(null)}
          initialPeriod={showAll.period}
          initialMonth={showAll.month}
        />
      ) : (
        <Beranda onSeeAll={(period, month) => setShowAll({ period, month })} />
      )
    ) : tab === "stats" ? (
      <Statistik />
    ) : tab === "insights" ? (
      <InsightsPanel />
    ) : (
      <AccountPanel />
    );

  return (
    <div className="min-h-screen sm:flex">
      {/*
        Tablet / desktop: the bottom bar becomes a fixed side rail. Same items,
        same icons, same active colour as the phone bar — only the axis changes,
        so the two viewports read as one design rather than two.
      */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[236px] flex-col border-r border-border bg-surface px-3 py-5 sm:flex">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <BrandMark className="h-9 w-9" />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold leading-tight">Rekam Uang</p>
            <p className="truncate text-[11px] text-muted">{t("app.tagline")}</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              onClick={() => go(item.id)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                tab === item.id
                  ? "bg-primary-soft text-primary"
                  : "text-muted hover:bg-surface-muted hover:text-foreground"
              }`}
            >
              {item.icon}
              {t(item.labelKey)}
            </button>
          ))}
        </nav>

        <button
          onClick={() => setAdding(true)}
          className="grad-primary mt-5 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition"
        >
          <PlusIcon className="h-4 w-4" />
          {t("add.button")}
        </button>
      </aside>

      <main className="flex-1 px-4 pb-28 pt-5 sm:ml-[236px] sm:px-8 sm:pb-10">
        {/* One column at every width, so tablet and desktop show the same
            layout the phone does rather than a re-flowed variant. */}
        <div className="mx-auto w-full max-w-lg">
          {!ready ? (
            <div className="grid h-64 place-items-center text-sm text-muted">
              {t("common.loading")}
            </div>
          ) : (
            <div key={tab + (showAll ? ":all" : "")} className="animate-fade">
              {view}
            </div>
          )}
        </div>
      </main>

      {/* Phone: 5-slot bottom bar with the raised add button in the middle. */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex items-stretch border-t border-border bg-surface/95 pb-2 backdrop-blur sm:hidden">
        <TabBarButton
          active={tab === "home"}
          onClick={() => go("home")}
          icon={<HomeIcon className="h-[21px] w-[21px]" />}
          label={t("nav.home")}
        />
        <TabBarButton
          active={tab === "stats"}
          onClick={() => go("stats")}
          icon={<StatsIcon className="h-[21px] w-[21px]" />}
          label={t("nav.stats")}
        />

        <div className="flex w-[74px] shrink-0 justify-center">
          <button
            onClick={() => setAdding(true)}
            aria-label={t("add.title")}
            className="grad-primary -mt-5 grid h-14 w-14 place-items-center rounded-full shadow-lg ring-4 ring-background transition active:scale-90"
          >
            <PlusIcon className="h-6 w-6" />
          </button>
        </div>

        <TabBarButton
          active={tab === "insights"}
          onClick={() => go("insights")}
          icon={<InsightIcon className="h-[21px] w-[21px]" />}
          label={t("nav.insights")}
        />
        <TabBarButton
          active={tab === "account"}
          onClick={() => go("account")}
          icon={<UserIcon className="h-[21px] w-[21px]" />}
          label={t("nav.account")}
        />
      </nav>

      {adding && <AddSheet onClose={() => setAdding(false)} />}
    </div>
  );
}

function TabBarButton({
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
      className={`flex flex-1 flex-col items-center gap-[3px] pt-2 text-[10px] font-semibold transition-colors ${
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
