"use client";

import { useState } from "react";
import { useI18n } from "./I18nProvider";
import { Modal } from "./Modal";
import { useExpenses } from "@/store/ExpenseStore";
import { formatCurrency, groupDigits } from "@/lib/format";
import { monthLabel } from "@/lib/period";
import {
  chargeInMonth,
  installmentNumber,
  outlook,
  outlookPeak,
  shiftMonth,
  totalPayments,
} from "@/lib/commitments";
import type { Commitment, CommitmentDraft } from "@/lib/types";

/** How far the window may be paged either way, in months. */
const RANGE = 36;
const WINDOW = 6;

type Entry = Commitment | CommitmentDraft;

/** Saved records carry an id; simulator drafts do not. */
function isDraft(c: Entry): boolean {
  return !("id" in c);
}

/**
 * A six-month window of upcoming charges, pageable with ‹ › and with every bar
 * clickable for the per-commitment breakdown behind it.
 *
 * Shared by the Komitmen screen and the simulator so there is exactly one
 * implementation — the simulator's copy used to be a duplicate of the markup,
 * which is how the two would have drifted.
 *
 * Bars are plain divs with a percentage height: this project has no chart
 * library and a shape this simple does not justify one.
 */
export function OutlookChart({
  list,
  fromMonth,
  barHeight = 72,
}: {
  list: Entry[];
  /** yyyy-mm the unpaged window starts at (normally next month). */
  fromMonth: string;
  barHeight?: number;
}) {
  const { t, locale } = useI18n();
  // Offset in months from `fromMonth`; negative pages into the past, which is
  // how you check what a plan cost before an intro price lapsed.
  const [offset, setOffset] = useState(0);
  const [detail, setDetail] = useState<string | null>(null);

  const start = shiftMonth(fromMonth, offset);
  const points = outlook(list, start, WINDOW);
  const peak = outlookPeak(points);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[12.5px] font-semibold">{t("com.outlook")}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setOffset((o) => Math.max(-RANGE, o - WINDOW))}
            disabled={offset <= -RANGE}
            aria-label={t("com.outlookPrev")}
            className="grid h-7 w-7 place-items-center rounded-lg bg-surface-muted text-muted transition hover:text-foreground disabled:opacity-30"
          >
            ‹
          </button>
          {offset !== 0 && (
            <button
              type="button"
              onClick={() => setOffset(0)}
              className="rounded-lg px-2 py-1 text-[10.5px] font-semibold text-primary transition hover:underline"
            >
              {t("com.outlookNow")}
            </button>
          )}
          <button
            type="button"
            onClick={() => setOffset((o) => Math.min(RANGE, o + WINDOW))}
            disabled={offset >= RANGE}
            aria-label={t("com.outlookNext")}
            className="grid h-7 w-7 place-items-center rounded-lg bg-surface-muted text-muted transition hover:text-foreground disabled:opacity-30"
          >
            ›
          </button>
        </div>
      </div>

      <div className="flex items-end gap-1.5">
        {points.map((p) => (
          <button
            key={p.month}
            type="button"
            onClick={() => setDetail(p.month)}
            aria-label={t("com.detailOpen", {
              month: monthLabel(p.month + "-01", locale),
              amount: formatCurrency(p.due),
            })}
            className="flex min-w-0 flex-1 flex-col items-center rounded-lg py-1 transition hover:bg-surface-muted"
          >
            <span className="num mb-1 text-[9px] text-muted">
              {p.due > 0 ? compactRupiah(p.due) : "–"}
            </span>
            <div
              className="w-full rounded-t-[5px] bg-primary/80 transition-colors"
              style={{ height: `${Math.max(3, (p.due / peak) * barHeight)}px` }}
            />
            <span className="mt-1 truncate text-[9.5px] text-muted">
              {monthLabel(p.month + "-01", locale).slice(0, 3)}
            </span>
          </button>
        ))}
      </div>

      {/* The window can sit years away, so say which months these are. */}
      <p className="mt-2 text-center text-[10px] text-muted">
        {monthLabel(points[0].month + "-01", locale)} –{" "}
        {monthLabel(points[points.length - 1].month + "-01", locale)}
      </p>

      {detail && (
        <MonthDetail list={list} month={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}

/** What actually makes up one month's bar. */
function MonthDetail({
  list,
  month,
  onClose,
}: {
  list: Entry[];
  month: string;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const { categoryMeta } = useExpenses();

  // Only what bills in this month, biggest first — the order you'd audit a
  // bill in, and it makes the reason for a spike the top row.
  const rows = list
    .map((c) => ({ c, charge: chargeInMonth(c, month) }))
    .filter((r) => r.charge > 0)
    .sort((a, b) => b.charge - a.charge);

  const subs = rows
    .filter((r) => r.c.kind === "subscription")
    .reduce((s, r) => s + r.charge, 0);
  const inst = rows
    .filter((r) => r.c.kind === "installment")
    .reduce((s, r) => s + r.charge, 0);

  return (
    <Modal onClose={onClose} labelledBy="com-detail-title">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id="com-detail-title" className="text-base font-semibold">
            {monthLabel(month + "-01", locale)}
          </h3>
          <p className="num mt-0.5 text-[22px] font-bold leading-none tracking-tight">
            {formatCurrency(subs + inst)}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label={t("dash.cancel")}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted transition hover:bg-surface-muted"
        >
          ✕
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl bg-surface-muted p-4 text-center text-sm text-muted">
          {t("com.detailEmpty")}
        </p>
      ) : (
        <>
          <p className="mb-2.5 text-[11px] text-muted">
            {t("com.dueBreakdown", {
              subs: formatCurrency(subs),
              inst: formatCurrency(inst),
            })}
          </p>

          <ul className="divide-y divide-border">
            {rows.map((r, i) => {
              const cat = categoryMeta(r.c.category);
              const n = installmentNumber(r.c, month);
              return (
                <li key={i} className="flex items-center gap-2.5 py-2.5">
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm"
                    style={{ background: cat.color + "22" }}
                  >
                    {cat.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">
                      {r.c.name}
                      {isDraft(r.c) && (
                        <span className="ms-1.5 rounded-full bg-primary-soft px-1.5 py-0.5 text-[9.5px] font-semibold text-primary">
                          {t("com.detailDraft")}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-[11px] text-muted">
                      {r.c.kind === "installment"
                        ? t("com.detailInst", { n, total: totalPayments(r.c) })
                        : t(
                            r.c.cycle === "yearly"
                              ? "com.rowYearly"
                              : "com.rowMonthly"
                          )}
                    </p>
                  </div>
                  <span className="num shrink-0 text-[13px] font-semibold">
                    {formatCurrency(r.charge)}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Modal>
  );
}

/**
 * Thousands-separated short rupiah: 5487390 → "5.487rb", 950000 → "950rb".
 * Without the dots a bar label like "5487rb" is unreadable at a glance.
 */
function compactRupiah(value: number): string {
  return groupDigits(String(Math.round(value / 1000))) + "rb";
}
