"use client";

import { useState } from "react";
import Link from "next/link";
import { Dashboard } from "@/components/Dashboard";
import { InsightsPanel } from "@/components/InsightsPanel";
import { AddTransactionModal } from "@/components/AddTransactionModal";
import { DashboardIcon, InsightIcon, PlusIcon } from "@/components/icons";
import { Avatar } from "@/components/Avatar";
import { NotificationBell } from "@/components/NotificationBell";
import { BrandMark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/components/I18nProvider";
import type { MessageKey } from "@/i18n/messages";
import { ExpenseProvider, useExpenses } from "@/store/ExpenseStore";

type Tab = "dashboard" | "insights";

const TABS: { id: Tab; labelKey: MessageKey; icon: React.ReactNode }[] = [
  { id: "dashboard", labelKey: "nav.dashboard", icon: <DashboardIcon /> },
  { id: "insights", labelKey: "nav.insights", icon: <InsightIcon /> },
];

export default function Page() {
  return (
    <ExpenseProvider>
      <Shell />
    </ExpenseProvider>
  );
}

function Shell() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [adding, setAdding] = useState(false);
  const { ready, user } = useExpenses();
  const { t } = useI18n();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between py-5">
        <div className="flex items-center gap-2.5">
          <BrandMark className="h-9 w-9" />
          <div>
            <h1 className="text-lg font-bold leading-tight">Rekam Uang</h1>
            <p className="hidden text-xs text-muted sm:block">{t("app.tagline")}</p>
          </div>
        </div>

        <nav className="hidden rounded-xl border border-border bg-surface p-1 sm:flex">
          {TABS.map((tab2) => (
            <TabButton
              key={tab2.id}
              active={tab === tab2.id}
              onClick={() => setTab(tab2.id)}
              icon={tab2.icon}
              label={t(tab2.labelKey)}
            />
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAdding(true)}
            aria-label={t("add.title")}
            className="hidden items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90 sm:inline-flex"
          >
            <PlusIcon className="h-4 w-4" />
            {t("add.button")}
          </button>
          <NotificationBell />
          <LanguageSwitcher />
          <ThemeToggle />
          <Link href="/account" aria-label={t("account.aria")} className="rounded-full">
            <Avatar
              name={user?.name}
              email={user?.email}
              image={user?.image}
              className="h-9 w-9 text-sm"
            />
          </Link>
        </div>
      </header>

      <main className="flex-1 pb-24 sm:pb-8">
        {!ready ? (
          <div className="grid h-64 place-items-center text-sm text-muted">
            {t("common.loading")}
          </div>
        ) : tab === "dashboard" ? (
          <Dashboard />
        ) : (
          <InsightsPanel />
        )}
      </main>

      <button
        onClick={() => setAdding(true)}
        aria-label={t("add.title")}
        className="fixed bottom-20 right-4 z-20 grid h-14 w-14 place-items-center rounded-full bg-primary text-white shadow-lg hover:opacity-90 sm:hidden"
      >
        <PlusIcon className="h-6 w-6" />
      </button>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-surface/95 backdrop-blur sm:hidden">
        {TABS.map((tab2) => (
          <button
            key={tab2.id}
            onClick={() => setTab(tab2.id)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition ${
              tab === tab2.id ? "text-primary" : "text-muted"
            }`}
          >
            {tab2.icon}
            {t(tab2.labelKey)}
          </button>
        ))}
      </nav>

      {adding && <AddTransactionModal onClose={() => setAdding(false)} />}
    </div>
  );
}

function TabButton({
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
      className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
        active ? "bg-primary text-white" : "text-muted hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
