"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  byCategory,
  dailySeries,
  dailySeriesBetween,
  dayCount,
  filterBetween,
  filterByRange,
  total,
} from "@/lib/aggregate";
import {
  daysAgoISO,
  formatCurrency,
  formatDate,
  todayISO,
} from "@/lib/format";
import { categoryDisplayName } from "@/lib/categoryName";
import type { Range } from "@/lib/types";
import { useExpenses } from "@/store/ExpenseStore";
import { useI18n } from "./I18nProvider";
import type { MessageKey } from "@/i18n/messages";
import { CategoryPie } from "./charts/CategoryPie";
import { DailyBars } from "./charts/DailyBars";
import { DatePicker } from "./DatePicker";
import { EditTransactionModal } from "./EditTransactionModal";
import { ExportMenu } from "./ExportMenu";
import { CategoryBudgets } from "./CategoryBudgets";

/** Transactions shown per page in the list. */
const TX_PAGE_SIZE = 10;

const RANGES: { id: Range; labelKey: MessageKey }[] = [
  { id: "week", labelKey: "dash.week" },
  { id: "month", labelKey: "dash.month" },
  { id: "all", labelKey: "dash.all" },
];

export function Dashboard() {
  const {
    transactions,
    budget,
    dailyBudget,
    setBudget,
    setDailyBudget,
    deleteTransaction,
    entitlements,
    user,
    categoryMeta,
  } = useExpenses();
  const { t } = useI18n();
  const [range, setRange] = useState<Range | "custom">("month");
  const [start, setStart] = useState(() => daysAgoISO(29));
  const [end, setEnd] = useState(() => todayISO());
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState(String(budget));
  const [editingDaily, setEditingDaily] = useState(false);
  const [dailyDraft, setDailyDraft] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const canCustomRange = entitlements?.customDateRange ?? false;
  const canExport = entitlements?.exportData ?? false;
  const isCustom = range === "custom";

  // The date window the export should cover, derived from the active filter.
  const exportRange = useMemo<{ from?: string; to?: string }>(() => {
    if (isCustom) return { from: start, to: end };
    if (range === "week") return { from: daysAgoISO(6), to: todayISO() };
    if (range === "month") return { from: daysAgoISO(29), to: todayISO() };
    return {}; // all time
  }, [range, isCustom, start, end]);

  const filtered = useMemo(
    () =>
      isCustom
        ? filterBetween(transactions, start, end)
        : filterByRange(transactions, range as Range),
    [transactions, range, isCustom, start, end]
  );
  // Expenses drive the charts + budget; income feeds the cash-flow totals.
  const expenses = useMemo(
    () => filtered.filter((tx) => tx.type !== "income"),
    [filtered]
  );
  const spent = useMemo(() => total(expenses), [expenses]);
  const incomeTotal = useMemo(
    () => total(filtered.filter((tx) => tx.type === "income")),
    [filtered]
  );
  const net = incomeTotal - spent;
  const categories = useMemo(
    () =>
      byCategory(expenses, (id) => {
        const m = categoryMeta(id);
        return { label: categoryDisplayName(m, t), color: m.color };
      }),
    [expenses, categoryMeta, t]
  );
  const daily = useMemo(
    () =>
      isCustom
        ? dailySeriesBetween(expenses, start, end)
        : dailySeries(expenses, range as Range),
    [expenses, range, isCustom, start, end]
  );

  // Number of days the active filter covers. The budget shown for a range is
  // the monthly budget prorated to this many days (monthly ÷ 30 × days), so the
  // limit scales the same way no matter how you slice the data. These day counts
  // match the data windows in filterByRange/filterBetween. "All time" = no limit.
  const rangeDays = isCustom
    ? dayCount(start, end)
    : range === "week"
      ? 7
      : range === "month"
        ? 30
        : null;
  const budgetForRange = rangeDays ? (budget * rangeDays) / 30 : 0;
  const pct = budgetForRange > 0 ? (spent / budgetForRange) * 100 : 0;
  const over = budgetForRange > 0 && spent > budgetForRange;
  // 0 = auto (monthly / 30); a positive value is an explicit daily budget.
  const isDailyAuto = (user?.dailyBudget ?? 0) === 0;

  const editing = transactions.find((t) => t.id === editId) ?? null;
  const confirming = transactions.find((t) => t.id === confirmId) ?? null;

  // Paginated slice of the filtered transactions.
  const totalPages = Math.max(1, Math.ceil(filtered.length / TX_PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * TX_PAGE_SIZE, page * TX_PAGE_SIZE);
  // Pad a short last page with invisible spacer rows so the list keeps a
  // constant height and the pager buttons never shift. Only when paginating.
  const fillerCount =
    totalPages > 1 ? Math.max(0, TX_PAGE_SIZE - pageItems.length) : 0;
  // Jump back to page 1 when the filter changes; clamp if the list shrinks.
  useEffect(() => setPage(1), [range, isCustom, start, end]);
  useEffect(() => setPage((p) => Math.min(p, totalPages)), [totalPages]);

  function saveDaily() {
    const value = Number(dailyDraft.replace(/[^\d]/g, ""));
    setDailyBudget(Number.isNaN(value) ? 0 : value);
    setEditingDaily(false);
  }

  function saveBudget() {
    const value = Number(budgetDraft.replace(/[^\d]/g, ""));
    if (!Number.isNaN(value)) setBudget(value);
    setEditingBudget(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("dash.title")}</h2>
        <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap rounded-xl border border-border bg-surface p-1">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                range === r.id
                  ? "bg-primary text-white"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {t(r.labelKey)}
            </button>
          ))}
          {canCustomRange ? (
            <button
              onClick={() => setRange("custom")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                isCustom
                  ? "bg-primary text-white"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {t("dash.custom")}
            </button>
          ) : (
            <Link
              href="/pricing"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted/60 hover:text-primary"
            >
              {t("dash.custom")} 🔒
            </Link>
          )}
        </div>
          <ExportMenu
            from={exportRange.from}
            to={exportRange.to}
            canExport={canExport}
          />
        </div>
      </div>

      {isCustom && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-sm">
          <span className="text-sm font-medium text-muted">{t("dash.pickPeriod")}</span>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">{t("dash.from")}</span>
            <DatePicker value={start} max={end} onChange={setStart} />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">{t("dash.to")}</span>
            <DatePicker value={end} min={start} max={todayISO()} onChange={setEnd} />
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label={t("dash.income")}
          value={"+" + formatCurrency(incomeTotal)}
          valueClassName="text-success"
        />
        <Stat label={t("dash.expense")} value={formatCurrency(spent)} accent />
        <Stat
          label={t("dash.net")}
          value={(net >= 0 ? "+" : "−") + formatCurrency(Math.abs(net))}
          valueClassName={net >= 0 ? "text-success" : "text-danger"}
        />
      </div>

      {/* Monthly budget — editable from any view. */}
      <div className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm">
        <span className="text-sm text-muted">{t("dash.monthlyBudget")}</span>
        {editingBudget ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              inputMode="numeric"
              value={budgetDraft}
              onChange={(e) => setBudgetDraft(e.target.value.replace(/[^\d]/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && saveBudget()}
              className="w-36 rounded-lg border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-primary"
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
            className="text-sm font-semibold hover:text-primary"
          >
            {formatCurrency(budget)}{" "}
            <span className="text-xs font-medium text-primary">
              · {t("dash.change")}
            </span>
          </button>
        )}
      </div>

      {budgetForRange > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">
              {isCustom
                ? t("dash.usagePeriod")
                : range === "week"
                  ? t("dash.usageWeekly")
                  : t("dash.usageMonthly")}
            </span>
            <span className={over ? "font-semibold text-danger" : "text-muted"}>
              {formatCurrency(spent)} / {formatCurrency(budgetForRange)}
            </span>
          </div>
          <p className="mb-2 text-xs text-muted">
            {t("dash.budgetBasis", {
              budget: formatCurrency(budget),
              days: rangeDays ?? 0,
            })}
          </p>
          <div className="h-3 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(pct, 100)}%`,
                background: over ? "var(--danger)" : "var(--success)",
              }}
            />
          </div>
          <p className="mt-2 text-xs text-muted">
            {over
              ? t("dash.over", {
                  amount: formatCurrency(spent - budgetForRange),
                })
              : t("dash.remaining", {
                  amount: formatCurrency(budgetForRange - spent),
                  pct: Math.round(100 - pct),
                })}
          </p>
        </div>
      )}

      <CategoryBudgets />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("dash.byCategory")}>
          <CategoryPie data={categories} />
        </Card>
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              {t("dash.dailyRate")}
            </h3>
            {editingDaily ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  inputMode="numeric"
                  value={dailyDraft}
                  placeholder={t("dash.autoPlaceholder")}
                  onChange={(e) => setDailyDraft(e.target.value.replace(/[^\d]/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && saveDaily()}
                  className="w-28 rounded-lg border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-primary"
                />
                <button
                  onClick={saveDaily}
                  className="rounded-lg bg-primary px-2 py-1 text-xs font-semibold text-white"
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
                className="text-xs font-medium text-primary hover:underline"
              >
                {t("dash.dailyBudgetLabel", {
                  amount: formatCurrency(dailyBudget),
                  auto: isDailyAuto ? t("dash.auto") : "",
                })}
              </button>
            )}
          </div>
          <DailyBars data={daily} dailyBudget={dailyBudget} />
        </div>
      </div>

      <Card title={t("dash.txTitle", { n: filtered.length })}>
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">{t("dash.noTx")}</p>
        ) : (
          <>
          <ul>
            {pageItems.map((tx) => {
              const isIncome = tx.type === "income";
              const cat = categoryMeta(tx.category);
              const catLabel = isIncome
                ? t("receipt.income")
                : categoryDisplayName(cat, t);
              return (
                <li
                  key={tx.id}
                  className="group flex items-center gap-3 border-t border-border py-2.5 first:border-t-0"
                >
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-base ${
                      isIncome ? "bg-success-soft" : ""
                    }`}
                    style={isIncome ? undefined : { background: cat.color + "22" }}
                  >
                    {isIncome ? "💰" : cat.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {tx.merchant || catLabel}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {catLabel} · {formatDate(tx.date)}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-semibold ${isIncome ? "text-success" : ""}`}
                  >
                    {isIncome ? "+" : ""}
                    {formatCurrency(tx.amount)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditId(tx.id)}
                      aria-label={t("dash.editAria")}
                      className="grid h-7 w-7 place-items-center rounded-md text-muted transition hover:bg-surface-muted hover:text-primary"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => setConfirmId(tx.id)}
                      aria-label={t("dash.deleteAria")}
                      className="grid h-7 w-7 place-items-center rounded-md text-muted transition hover:bg-danger-soft hover:text-danger"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              );
            })}
            {Array.from({ length: fillerCount }).map((_, i) => (
              <li
                key={`filler-${i}`}
                aria-hidden
                className="flex items-center gap-3 border-t border-transparent py-2.5"
              >
                <div className="h-9 w-9 shrink-0" />
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t("dash.prev")}
              </button>
              <span className="text-xs text-muted">
                {t("dash.pageInfo", { page, total: totalPages })}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t("dash.next")}
              </button>
            </div>
          )}
          </>
        )}
      </Card>

      {editing && (
        <EditTransactionModal
          transaction={editing}
          onClose={() => setEditId(null)}
        />
      )}

      {confirming && (
        <ConfirmDeleteDialog
          label={
            confirming.merchant ||
            categoryDisplayName(categoryMeta(confirming.category), t)
          }
          amount={formatCurrency(confirming.amount)}
          onCancel={() => setConfirmId(null)}
          onConfirm={async () => {
            await deleteTransaction(confirming.id);
            setConfirmId(null);
          }}
        />
      )}
    </div>
  );
}

function ConfirmDeleteDialog({
  label,
  amount,
  onCancel,
  onConfirm,
}: {
  label: string;
  amount: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        className="animate-pop w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold">{t("dash.confirmTitle")}</h3>
        <p className="mt-1.5 text-sm text-muted">
          {t("dash.confirmBody", { label, amount })}
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface-muted"
          >
            {t("dash.cancel")}
          </button>
          <button
            onClick={async () => {
              setBusy(true);
              await onConfirm();
            }}
            disabled={busy}
            className="rounded-lg bg-danger px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {busy ? t("dash.deleting") : t("dash.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  valueClassName,
}: {
  label: string;
  value: string;
  accent?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <span className="text-sm text-muted">{label}</span>
      <p
        className={`mt-1 text-2xl font-bold ${valueClassName ?? (accent ? "text-primary" : "")}`}
      >
        {value}
      </p>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}
