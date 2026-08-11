"use client";

import { useMemo, useState } from "react";
import { useExpenses } from "@/store/ExpenseStore";
import { useI18n } from "./I18nProvider";
import { Modal } from "./Modal";
import { CommitmentForm } from "./CommitmentForm";
import { CommitmentSimulator } from "./CommitmentSimulator";
import { OutlookChart } from "./OutlookChart";
import { groupDigits } from "@/lib/format";
import { formatCurrency } from "@/lib/format";
import { monthLabel } from "@/lib/period";
import { todayISO } from "@/lib/format";
import {
  chargeInMonth,
  finalMonth,
  installmentNumber,
  nextChargeMonth,
  nextMonthOf,
  promoLeft,
  remainingPayments,
  remainingTotal,
  totalPayments,
  totalsForMonth,
} from "@/lib/commitments";
import type { Commitment } from "@/lib/types";

type Filter = "all" | "subscription" | "installment";

/**
 * "Komitmen" — everything already promised to someone else, and what that
 * means for next month. A sub-view of Beranda rather than a tab, so the
 * five-slot bottom bar stays intact (same treatment as the full transaction
 * list).
 *
 * Nothing here writes an expense: static hosting has no cron to bill you on
 * the 1st, and materialising charges client-side would double-count on every
 * device. This is a schedule of what *will* be owed, kept beside the ledger
 * of what *was* spent.
 */
export function Commitments({ onBack }: { onBack: () => void }) {
  const {
    commitments,
    salary,
    setSalary,
    deleteCommitment,
    addCommitment,
    updateCommitment,
  } = useExpenses();
  const { t, locale } = useI18n();

  const [editingSalary, setEditingSalary] = useState(false);
  const [salaryDraft, setSalaryDraft] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Commitment | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);

  // "Next month" is the question the user actually asked, so it is the anchor
  // for every figure on this screen.
  const nextMonth = useMemo(() => nextMonthOf(todayISO()), []);
  const totals = useMemo(
    () => totalsForMonth(commitments, nextMonth),
    [commitments, nextMonth]
  );
  const rows = useMemo(() => {
    const list =
      filter === "all" ? commitments : commitments.filter((c) => c.kind === filter);
    // Billing soonest first, then biggest — the order you'd read a bill in.
    return [...list].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      const ca = chargeInMonth(a, nextMonth);
      const cb = chargeInMonth(b, nextMonth);
      if ((ca > 0) !== (cb > 0)) return ca > 0 ? -1 : 1;
      return cb - ca || a.name.localeCompare(b.name);
    });
  }, [commitments, filter, nextMonth]);

  const confirming = commitments.find((c) => c.id === confirmId) ?? null;
  const leftover = salary - totals.due;

  function saveSalary() {
    const v = Number(salaryDraft.replace(/\D/g, ""));
    setSalary(Number.isNaN(v) ? 0 : v);
    setEditingSalary(false);
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={onBack}
            aria-label={t("acc.back")}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-muted hover:text-foreground"
          >
            ‹
          </button>
          <h1 className="truncate text-lg font-semibold">{t("com.title")}</h1>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="grad-primary shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition"
        >
          + {t("com.add")}
        </button>
      </header>

      {/* Headline: actual cash due next month. */}
      <div className="hero-grad rounded-[20px] p-5">
        <p className="text-[11px] opacity-85">
          {t("com.dueIn", { month: monthLabel(nextMonth + "-01", locale) })}
        </p>
        <p className="num mt-1 text-[32px] font-bold leading-none tracking-tight">
          {formatCurrency(totals.due)}
        </p>
        <p className="mt-2 text-[11px] opacity-85">
          {t("com.dueBreakdown", {
            subs: formatCurrency(totals.subscriptions),
            inst: formatCurrency(totals.installments),
          })}
        </p>
      </div>

      {/* Salary → what survives the fixed obligations. Deliberately not the
          spending budget: this is take-home pay, and no transaction is ever
          written from it. */}
      <div className="card p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12.5px] text-muted">{t("com.salary")}</span>
          {editingSalary ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                inputMode="numeric"
                value={groupDigits(salaryDraft)}
                placeholder="0"
                onChange={(e) => setSalaryDraft(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && saveSalary()}
                className="num w-32 rounded-lg border border-border bg-surface px-2 py-1 text-end text-sm outline-none focus:border-primary"
              />
              <button
                onClick={saveSalary}
                className="grad-primary rounded-lg px-2.5 py-1 text-xs font-semibold"
              >
                {t("dash.save")}
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setSalaryDraft(salary ? String(salary) : "");
                setEditingSalary(true);
              }}
              className="num text-[15px] font-bold transition hover:text-primary"
            >
              {salary > 0 ? formatCurrency(salary) : t("com.salarySet")}
            </button>
          )}
        </div>

        {salary > 0 && (
          <>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted">
              <div
                className={`h-full rounded-full ${
                  leftover < 0 ? "bg-danger" : "grad-primary"
                }`}
                style={{
                  width: `${Math.min(100, Math.round((totals.due / salary) * 100))}%`,
                }}
              />
            </div>
            <div className="mt-2.5 flex items-baseline justify-between gap-2">
              <span className="text-[11.5px] text-muted">{t("com.leftover")}</span>
              <span
                className={`num text-[17px] font-bold ${
                  leftover < 0 ? "text-danger" : ""
                }`}
              >
                {formatCurrency(leftover)}
              </span>
            </div>
            <p className="mt-1 text-[10.5px] text-muted">
              {t("com.leftoverHint", {
                salary: formatCurrency(salary),
                due: formatCurrency(totals.due),
              })}
            </p>
            {leftover < 0 && (
              <p className="mt-2 rounded-lg bg-danger-soft px-2.5 py-1.5 text-[11.5px] font-medium text-danger">
                {t("com.leftoverNegative")}
              </p>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="card p-3.5">
          <p className="text-[10.5px] text-muted">{t("com.normalized")}</p>
          <p className="num mt-0.5 text-[15px] font-bold">
            {formatCurrency(Math.round(totals.normalized))}
          </p>
        </div>
        <div className="card p-3.5">
          <p className="text-[10.5px] text-muted">{t("com.activeCount")}</p>
          <p className="num mt-0.5 text-[15px] font-bold">
            {commitments.filter((c) => c.active).length}
          </p>
        </div>
      </div>

      {/* Promo cliffs and finishing instalments are obvious as a shape and
          invisible as a single number. Pageable, so a plan years out is
          reachable without arithmetic. */}
      {commitments.length > 0 && (
        <div className="card p-4">
          <OutlookChart list={commitments} fromMonth={nextMonth} />
        </div>
      )}

      <button
        onClick={() => setSimulating(true)}
        className="card flex w-full items-center justify-between p-4 text-start transition hover:border-primary"
      >
        <span>
          <span className="block text-[13px] font-semibold">{t("com.simTitle")}</span>
          <span className="block text-[11.5px] text-muted">{t("com.simSub")}</span>
        </span>
        <span className="text-muted">›</span>
      </button>

      <div className="flex gap-1.5">
        {(["all", "subscription", "installment"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 whitespace-nowrap rounded-[11px] py-2 text-center text-[12.5px] font-semibold transition ${
              filter === f ? "grad-primary" : "card text-muted hover:text-foreground"
            }`}
          >
            {t(
              f === "all"
                ? "com.filterAll"
                : f === "subscription"
                  ? "com.kindSub"
                  : "com.kindInst"
            )}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="card p-6 text-center text-sm text-muted">{t("com.empty")}</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((c) => (
            <CommitmentRow
              key={c.id}
              commitment={c}
              month={nextMonth}
              onEdit={() => setEditing(c)}
              onDelete={() => setConfirmId(c.id)}
              onToggleActive={() =>
                updateCommitment(c.id, { ...c, active: !c.active })
              }
            />
          ))}
        </ul>
      )}

      {adding && (
        <CommitmentForm
          onSubmit={(draft) => addCommitment(draft)}
          onClose={() => setAdding(false)}
        />
      )}

      {editing && (
        <CommitmentForm
          initial={editing}
          onSubmit={(draft) => updateCommitment(editing.id, draft)}
          onClose={() => setEditing(null)}
        />
      )}

      {simulating && <CommitmentSimulator onClose={() => setSimulating(false)} />}

      {confirming && (
        <Modal onClose={() => setConfirmId(null)} labelledBy="com-del-title">
          <h3 id="com-del-title" className="text-base font-semibold">
            {t("com.deleteTitle")}
          </h3>
          <p className="mt-1.5 text-sm text-muted">
            {t("com.deleteBody", { name: confirming.name })}
          </p>
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              onClick={() => setConfirmId(null)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface-muted"
            >
              {t("dash.cancel")}
            </button>
            <button
              onClick={async () => {
                await deleteCommitment(confirming.id);
                setConfirmId(null);
              }}
              className="rounded-lg bg-danger px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90"
            >
              {t("dash.delete")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CommitmentRow({
  commitment: c,
  month,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  commitment: Commitment;
  month: string;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}) {
  const { t, locale } = useI18n();
  const { categoryMeta } = useExpenses();
  const cat = categoryMeta(c.category);

  const charge = chargeInMonth(c, month);
  const promo = promoLeft(c, month);
  const next = nextChargeMonth(c, month);

  return (
    <li className={`card p-4 ${c.active ? "" : "opacity-60"}`}>
      <div className="flex items-start gap-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-base"
          style={{ background: cat.color + "22" }}
        >
          {cat.icon}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold">{c.name}</p>
          <p className="mt-0.5 truncate text-[11.5px] text-muted">
            {c.kind === "installment"
              ? t("com.rowInst", {
                  n: installmentNumber(c, month) || remainingPayments(c, month),
                  total: totalPayments(c),
                  end: monthLabel(finalMonth(c) + "-01", locale),
                })
              : t(c.cycle === "yearly" ? "com.rowYearly" : "com.rowMonthly")}
          </p>
        </div>

        <div className="shrink-0 text-end">
          <p className="num text-[14px] font-bold">
            {charge > 0 ? formatCurrency(charge) : "–"}
          </p>
          {charge === 0 && next && (
            <p className="text-[10px] text-muted">
              {monthLabel(next + "-01", locale)}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {promo > 0 && (
          <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10.5px] font-semibold text-success">
            {t(c.cycle === "yearly" ? "com.promoLeftY" : "com.promoLeftM", { n: promo })}
          </span>
        )}
        {c.kind === "installment" && (
          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10.5px] font-medium text-muted">
            {t("com.remainingTotal", {
              amount: formatCurrency(remainingTotal(c, month)),
            })}
          </span>
        )}
        {!c.active && (
          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10.5px] font-medium text-muted">
            {t("com.paused")}
          </span>
        )}

        <div className="ms-auto flex items-center gap-1">
          <button
            onClick={onToggleActive}
            aria-label={c.active ? t("com.pause") : t("com.resume")}
            title={c.active ? t("com.pause") : t("com.resume")}
            className="grid h-7 w-7 place-items-center rounded-md text-muted transition hover:bg-surface-muted hover:text-foreground"
          >
            {c.active ? "⏸" : "▶"}
          </button>
          <button
            onClick={onEdit}
            aria-label={t("dash.editAria")}
            className="grid h-7 w-7 place-items-center rounded-md text-muted transition hover:bg-surface-muted hover:text-primary"
          >
            ✎
          </button>
          <button
            onClick={onDelete}
            aria-label={t("dash.deleteAria")}
            className="grid h-7 w-7 place-items-center rounded-md text-muted transition hover:bg-danger-soft hover:text-danger"
          >
            ✕
          </button>
        </div>
      </div>
    </li>
  );
}
