"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { lockBodyScroll } from "@/lib/scrollLock";
import { useExpenses } from "@/store/ExpenseStore";
import { useI18n } from "./I18nProvider";
import { CommitmentForm } from "./CommitmentForm";
import { formatCurrency, todayISO } from "@/lib/format";
import { monthLabel } from "@/lib/period";
import { OutlookChart } from "./OutlookChart";
import { nextMonthOf, totalPayments, totalsForMonth } from "@/lib/commitments";
import type { CommitmentDraft } from "@/lib/types";

/**
 * "What happens to my bill if I also sign up for X?"
 *
 * Drafts live in local state and are never saved. The projection is the exact
 * same fold the real screen uses, run over `[...saved, ...drafts]` — there is
 * no parallel "estimate" formula that could drift from the real one, which is
 * the whole reason CommitmentForm hands back a plain draft.
 */
export function CommitmentSimulator({ onClose }: { onClose: () => void }) {
  const { commitments, salary, addCommitment } = useExpenses();
  const { t, locale } = useI18n();

  const [drafts, setDrafts] = useState<CommitmentDraft[]>([]);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const nextMonth = useMemo(() => nextMonthOf(todayISO()), []);

  // A full-screen sheet: without this the page behind scrolls under it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const release = lockBodyScroll();
    return () => {
      document.removeEventListener("keydown", onKey);
      release();
    };
  }, [onClose]);

  const before = useMemo(
    () => totalsForMonth(commitments, nextMonth),
    [commitments, nextMonth]
  );
  const combined = useMemo(() => [...commitments, ...drafts], [commitments, drafts]);
  const after = useMemo(
    () => totalsForMonth(combined, nextMonth),
    [combined, nextMonth]
  );
  const delta = after.due - before.due;
  const leftAfter = salary - after.due;

  async function keepAll() {
    setSaving(true);
    for (const d of drafts) await addCommitment(d);
    setSaving(false);
    onClose();
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="animate-fade fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm sm:justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="com-sim-title"
        onClick={(e) => e.stopPropagation()}
        className="animate-sheet mx-auto flex max-h-[92vh] w-full flex-col overflow-y-auto rounded-t-[28px] border-t border-border bg-surface px-[18px] pb-5 pt-2.5 shadow-[0_-20px_50px_-10px_rgba(0,0,0,.6)] sm:max-w-md sm:rounded-[24px] sm:border"
      >
        <div className="mx-auto mb-3.5 mt-0.5 h-[5px] w-10 shrink-0 rounded-full bg-surface-muted sm:hidden" />

        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 id="com-sim-title" className="text-[15px] font-semibold">
            {t("com.simTitle")}
          </h3>
          <button
            onClick={onClose}
            aria-label={t("dash.cancel")}
            className="grid h-7 w-7 place-items-center rounded-md text-muted transition hover:bg-surface-muted"
          >
            ✕
          </button>
        </div>

        <p className="mb-4 text-[12px] leading-relaxed text-muted">
          {t("com.simHelp")}
        </p>

        {/* Before → after, for the month the user actually asked about. */}
        <div className="hero-grad rounded-[18px] p-4">
          <p className="text-[11px] opacity-85">
            {t("com.dueIn", { month: monthLabel(nextMonth + "-01", locale) })}
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="num text-[15px] font-semibold line-through opacity-70">
              {formatCurrency(before.due)}
            </span>
            <span className="text-sm opacity-70">→</span>
            <span className="num text-[27px] font-bold leading-none tracking-tight">
              {formatCurrency(after.due)}
            </span>
          </div>
          <p className="mt-2 text-[11px] opacity-85">
            {delta === 0
              ? t("com.simNoChange")
              : t("com.simDelta", { amount: formatCurrency(Math.abs(delta)) })}
          </p>
        </div>

        {salary > 0 && (
          <div className="card mt-2.5 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11.5px] text-muted">{t("com.leftover")}</span>
              <span
                className={`num text-[15px] font-bold ${
                  leftAfter < 0 ? "text-danger" : ""
                }`}
              >
                {formatCurrency(leftAfter)}
              </span>
            </div>
            {leftAfter < 0 && (
              <p className="mt-2 rounded-lg bg-danger-soft px-2.5 py-1.5 text-[11.5px] font-medium text-danger">
                {t("com.leftoverNegative")}
              </p>
            )}
          </div>
        )}

        {drafts.length > 0 && (
          <>
            <p className="mb-2 mt-4 text-[11px] text-muted">{t("com.simDrafts")}</p>
            <ul className="space-y-2">
              {drafts.map((d, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2.5 rounded-xl border border-dashed border-border bg-surface-muted p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{d.name}</p>
                    <p className="truncate text-[11px] text-muted">
                      {d.kind === "installment"
                        ? t("com.rowInstShort", { n: totalPayments(d) })
                        : t(d.cycle === "yearly" ? "com.rowYearly" : "com.rowMonthly")}
                    </p>
                  </div>
                  <span className="num shrink-0 text-[13px] font-semibold">
                    {formatCurrency(d.amount)}
                  </span>
                  <button
                    onClick={() => setDrafts((p) => p.filter((_, j) => j !== i))}
                    aria-label={t("dash.deleteAria")}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted transition hover:bg-danger-soft hover:text-danger"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Outlook including the drafts, so a promo that lapses in month 4 is
            visible before signing up rather than after. */}
        {combined.length > 0 && (
          <div className="mt-4">
            <OutlookChart list={combined} fromMonth={nextMonth} barHeight={64} />
          </div>
        )}

        <div className="mt-5 flex items-center gap-2.5">
          <button
            onClick={() => setAdding(true)}
            className="card flex-1 px-4 py-3 text-sm font-semibold text-muted transition hover:text-foreground"
          >
            + {t("com.simAdd")}
          </button>
          <button
            onClick={keepAll}
            disabled={saving || drafts.length === 0}
            className="grad-primary flex-1 rounded-[14px] px-4 py-3 text-sm font-semibold transition disabled:opacity-50"
          >
            {saving ? t("edit.saving") : t("com.simKeep")}
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted">{t("com.simDiscard")}</p>

        {adding && (
          <CommitmentForm
            submitLabel={t("com.simAddAction")}
            onSubmit={(draft) => setDrafts((p) => [...p, draft])}
            onClose={() => setAdding(false)}
          />
        )}
      </div>
    </div>,
    document.body
  );
}
