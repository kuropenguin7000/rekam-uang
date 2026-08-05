"use client";

import { useState } from "react";
import { signOut } from "firebase/auth";
import { clientAuth } from "@/lib/firebaseClient";
import { markSignedIn } from "@/lib/signedInHint";
import { useExpenses } from "@/store/ExpenseStore";
import { useI18n } from "./I18nProvider";
import { Avatar } from "./Avatar";
import { CategoryManager } from "./CategoryManager";
import { MemberManager } from "./MemberManager";
import { CategoryBudgets } from "./CategoryBudgets";
import { IncomePurge } from "./IncomePurge";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeProvider";
import { formatCurrency, groupDigits } from "@/lib/format";

/**
 * The Akun tab. Besides the profile it now owns the budget settings, which
 * used to sit inline on the dashboard — the redesign's Beranda shows the
 * budget as a single answer, so the controls for *setting* it belong here.
 */
export function AccountPanel() {
  const { user, budget, dailyBudget, setBudget, setDailyBudget } = useExpenses();
  const { t } = useI18n();
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState("");
  const [editingDaily, setEditingDaily] = useState(false);
  const [dailyDraft, setDailyDraft] = useState("");

  const isDailyAuto = (user?.dailyBudget ?? 0) === 0;

  async function logout() {
    try {
      localStorage.removeItem("sw_notif_log_v2");
    } catch {
      /* storage unavailable — ignore */
    }
    markSignedIn(false);
    await signOut(clientAuth());
    // Land on the public home, not /login: the previous history entry is /app,
    // which bounces a signed-out visitor back to /login — a loop with no exit.
    window.location.href = "/";
  }

  function saveBudget() {
    const v = Number(budgetDraft.replace(/\D/g, ""));
    if (!Number.isNaN(v)) setBudget(v);
    setEditingBudget(false);
  }

  function saveDaily() {
    const v = Number(dailyDraft.replace(/\D/g, ""));
    setDailyBudget(Number.isNaN(v) ? 0 : v);
    setEditingDaily(false);
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">{t("acc.title")}</h1>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>

      <div className="card flex items-center gap-4 p-4">
        <Avatar
          name={user?.name}
          email={user?.email}
          image={user?.image}
          className="h-14 w-14 text-xl"
        />
        <div className="min-w-0">
          <p className="truncate font-semibold">{user?.name ?? t("acc.user")}</p>
          <p className="truncate text-sm text-muted">{user?.email}</p>
        </div>
      </div>

      {/* Monthly budget */}
      <div className="card flex items-center justify-between gap-2 p-4">
        <span className="text-sm text-muted">{t("dash.monthlyBudget")}</span>
        {editingBudget ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              inputMode="numeric"
              value={groupDigits(budgetDraft)}
              onChange={(e) => setBudgetDraft(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && saveBudget()}
              className="w-32 rounded-lg border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={saveBudget}
              className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-white"
            >
              {t("dash.save")}
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setBudgetDraft(String(budget));
              setEditingBudget(true);
            }}
            className="num text-sm font-semibold hover:text-primary"
          >
            {formatCurrency(budget)}{" "}
            <span className="text-xs font-medium text-primary">· {t("dash.change")}</span>
          </button>
        )}
      </div>

      {/* Daily budget */}
      <div className="card flex items-center justify-between gap-2 p-4">
        <span className="text-sm text-muted">{t("dash.dailyBudgetName")}</span>
        {editingDaily ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              inputMode="numeric"
              placeholder={t("dash.autoPlaceholder")}
              value={groupDigits(dailyDraft)}
              onChange={(e) => setDailyDraft(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && saveDaily()}
              className="w-32 rounded-lg border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={saveDaily}
              className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-white"
            >
              {t("dash.save")}
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setDailyDraft(isDailyAuto ? "" : String(Math.round(dailyBudget)));
              setEditingDaily(true);
            }}
            className="num text-sm font-semibold hover:text-primary"
          >
            {formatCurrency(dailyBudget)}
            {isDailyAuto && (
              <span className="text-xs font-normal text-muted">{t("dash.auto")}</span>
            )}{" "}
            <span className="text-xs font-medium text-primary">· {t("dash.change")}</span>
          </button>
        )}
      </div>

      <CategoryBudgets />
      <MemberManager />
      <CategoryManager />
      <IncomePurge />

      <button
        onClick={logout}
        className="card w-full px-5 py-3 text-sm font-semibold text-danger hover:bg-danger-soft"
      >
        {t("acc.logout")}
      </button>
    </div>
  );
}
