"use client";

import { useMemo, useState } from "react";
import { daysAgoISO, formatCurrency } from "@/lib/format";
import { categoryDisplayName } from "@/lib/categoryName";
import { useExpenses } from "@/store/ExpenseStore";
import { useI18n } from "./I18nProvider";

/**
 * Per-category monthly budget caps. Progress is measured against the last 30
 * days of *expenses* (income excluded), so a cap is a rolling-monthly ceiling.
 * Lists every non-hidden category (built-in or custom) that has a cap or spend.
 */
export function CategoryBudgets() {
  const { transactions, categories, categoryBudgets, setCategoryBudget } =
    useExpenses();
  const { t } = useI18n();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  // This month's (rolling 30 days) expense spend per category.
  const spend = useMemo(() => {
    const cutoff = daysAgoISO(29);
    const m: Record<string, number> = {};
    for (const tx of transactions) {
      if (tx.type === "income" || tx.date < cutoff) continue;
      m[tx.category] = (m[tx.category] ?? 0) + tx.amount;
    }
    return m;
  }, [transactions]);

  const rows = useMemo(
    () =>
      categories
        .filter((c) => !c.hidden)
        .map((c) => ({
          cat: c,
          cap: categoryBudgets[c.id] ?? 0,
          spent: spend[c.id] ?? 0,
        }))
        .filter((r) => r.cap > 0 || r.spent > 0)
        .sort((a, b) => b.spent - a.spent),
    [categories, categoryBudgets, spend]
  );

  function save(id: string) {
    const value = Number(draft.replace(/[^\d]/g, ""));
    setCategoryBudget(id, Number.isNaN(value) ? 0 : value);
    setEditing(null);
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <h3 className="text-sm font-semibold">{t("dash.catBudgetTitle")}</h3>
      <p className="mb-3 mt-0.5 text-xs text-muted">{t("dash.catBudgetHint")}</p>

      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">
          {t("dash.catBudgetEmpty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const pct = r.cap > 0 ? (r.spent / r.cap) * 100 : 0;
            const over = r.cap > 0 && r.spent > r.cap;
            return (
              <li key={r.cat.id}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs"
                      style={{ background: r.cat.color + "22" }}
                    >
                      {r.cat.icon}
                    </span>
                    <span className="truncate font-medium">
                      {categoryDisplayName(r.cat, t)}
                    </span>
                  </span>
                  {editing === r.cat.id ? (
                    <span className="flex shrink-0 items-center gap-1.5">
                      <input
                        autoFocus
                        inputMode="numeric"
                        value={draft}
                        placeholder={t("dash.catBudgetNoCap")}
                        onChange={(e) =>
                          setDraft(e.target.value.replace(/[^\d]/g, ""))
                        }
                        onKeyDown={(e) => e.key === "Enter" && save(r.cat.id)}
                        className="w-28 rounded-lg border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-primary"
                      />
                      <button
                        onClick={() => save(r.cat.id)}
                        className="rounded-lg bg-primary px-2 py-1 text-xs font-semibold text-white"
                      >
                        {t("dash.save")}
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setDraft(r.cap > 0 ? String(r.cap) : "");
                        setEditing(r.cat.id);
                      }}
                      className={`shrink-0 text-xs font-medium hover:text-primary ${
                        over ? "text-danger" : "text-muted"
                      }`}
                    >
                      {r.cap > 0
                        ? `${formatCurrency(r.spent)} / ${formatCurrency(r.cap)}`
                        : t("dash.catBudgetSet")}
                    </button>
                  )}
                </div>
                {r.cap > 0 && (
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(pct, 100)}%`,
                        background: over ? "var(--danger)" : "var(--success)",
                      }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
