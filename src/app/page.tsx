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
            <h1 className="grad-text text-lg font-bold leading-tight">
              Rekam Uang
            </h1>
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
            className="grad-primary hidden items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold shadow-sm transition sm:inline-flex"
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
        ) : (
          /*
            Keyed on the tab so switching remounts and replays the entrance.
            Fades only — deliberately no transform. A transform here (even the
            translateY(0) an animation leaves behind) makes this element the
            containing block for every `position: fixed` descendant, which put
            the transaction modals and the DatePicker overlay off-screen. The
            motion lives on the cards and rows inside instead.
          */
          <div key={tab} className="animate-fade">
            {tab === "dashboard" ? <Dashboard /> : <InsightsPanel />}
          </div>
        )}
      </main>

      {/*
        The add button lives *in* the bottom bar rather than floating over the
        list. As a FAB it sat in the same bottom-right corner as each row's
        edit/delete buttons, so whichever row scrolled under it became
        unclickable — nudging the FAB only moves which row it covers.
      */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex items-stretch border-t border-border bg-surface/95 backdrop-blur sm:hidden">
        <TabBarButton
          active={tab === "dashboard"}
          onClick={() => setTab("dashboard")}
          icon={<DashboardIcon />}
          label={t("nav.dashboard")}
        />

        <div className="flex w-20 shrink-0 justify-center">
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
          onClick={() => setTab("insights")}
          icon={<InsightIcon />}
          label={t("nav.insights")}
        />
      </nav>

      {adding && <AddTransactionModal onClose={() => setAdding(false)} />}
    </div>
  );
}

/** Bottom-bar tab (mobile). */
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
      className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
        active ? "text-primary" : "text-muted"
      }`}
    >
      <span
        className={`transition-transform duration-200 ${active ? "scale-110" : ""}`}
      >
        {icon}
      </span>
      {label}
    </button>
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
