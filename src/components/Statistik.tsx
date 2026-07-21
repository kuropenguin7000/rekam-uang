"use client";

import { useMemo, useState } from "react";
import { useExpenses } from "@/store/ExpenseStore";
import { useI18n } from "./I18nProvider";
import { MonthChip } from "./MonthChip";
import { memberDisplayName } from "@/lib/memberName";
import { formatCurrency, formatDate, startOfMonthISO, todayISO } from "@/lib/format";
import { addMonths } from "@/lib/period";
import { heatmap, inMonth, memberSplit, monthOverMonth, weeklyTrend } from "@/lib/stats";
import { total } from "@/lib/aggregate";

/** Monday-first initials, matching the mockup's S S R K J S M header. */
const WEEKDAY_KEYS = ["Sn", "Sl", "Rb", "Km", "Jm", "Sb", "Mg"] as const;
const WEEKDAY_EN = ["M", "T", "W", "T", "F", "S", "S"] as const;

export function Statistik() {
  const { transactions, dailyBudget, memberMeta } = useExpenses();
  const { t, locale } = useI18n();
  const [month, setMonth] = useState(() => startOfMonthISO(todayISO()));

  const rows = useMemo(() => inMonth(transactions, month), [transactions, month]);
  const spent = useMemo(() => total(rows), [rows]);
  const heat = useMemo(
    () => heatmap(transactions, month, dailyBudget),
    [transactions, month, dailyBudget]
  );
  const members = useMemo(() => memberSplit(rows), [rows]);
  const weeks = useMemo(() => weeklyTrend(transactions, month), [transactions, month]);
  const delta = useMemo(
    () => monthOverMonth(transactions, month, addMonths(month, -1)),
    [transactions, month]
  );

  const dayLabels = locale === "id" ? WEEKDAY_KEYS : WEEKDAY_EN;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">{t("nav.stats")}</h1>
        <MonthChip month={month} onChange={setMonth} />
      </header>

      {/* Heatmap calendar */}
      <section className="card p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[13.5px] font-semibold">{t("stats.heatTitle")}</h2>
          <span className="text-[11px] text-muted">{t("stats.heatSub")}</span>
        </div>

        <div className="mb-1.5 grid grid-cols-7 gap-1.5 text-center text-[9.5px] text-muted">
          {dayLabels.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>

        {/* Cells carry their day-of-month number, so the grid reads as a real
            calendar rather than an anonymous intensity chart. */}
        <div className="num grid grid-cols-7 gap-1.5">
          {heat.cells.map((cell, i) =>
            cell === null ? (
              <div key={`b${i}`} aria-hidden />
            ) : (
              <div
                key={cell.date}
                title={`${formatDate(cell.date)} · ${formatCurrency(cell.amount)}`}
                className="grid aspect-square place-items-center rounded-[7px] text-[9px] font-semibold transition-colors"
                style={cellStyle(cell)}
              >
                {Number(cell.date.slice(8, 10))}
              </div>
            )
          )}
        </div>

        <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted">
          <span>{t("stats.less")}</span>
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <span
              key={v}
              className="h-3 w-3 rounded-[3px]"
              style={{
                background:
                  v === 0 ? "var(--surface-muted)" : `rgb(99 102 241 / ${0.2 + v * 0.65})`,
              }}
            />
          ))}
          <span>{t("stats.more")}</span>
        </div>
      </section>

      {/* Per-member split */}
      <section className="card p-4">
        <h2 className="mb-3 text-[13.5px] font-semibold">{t("stats.byMember")}</h2>
        {members.length === 0 ? (
          <p className="py-2 text-center text-xs text-muted">{t("home.empty")}</p>
        ) : (
          <>
            {/* One stacked bar reads the whole split at a glance. */}
            <div className="mb-3 flex h-2.5 overflow-hidden rounded-full bg-surface-muted">
              {members.map((m, i) => (
                <div
                  key={m.id || `untagged${i}`}
                  style={{
                    width: `${m.pct}%`,
                    background: MEMBER_COLORS[i % MEMBER_COLORS.length],
                  }}
                />
              ))}
            </div>
            <ul className="flex flex-col gap-2.5">
              {members.map((m, i) => {
                const meta = memberMeta(m.id);
                return (
                  <li
                    key={m.id || `untagged${i}`}
                    className="flex items-center gap-2.5 text-[12.5px]"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: MEMBER_COLORS[i % MEMBER_COLORS.length] }}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {meta ? `${meta.icon} ${memberDisplayName(meta, t)}` : t("stats.untagged")}
                    </span>
                    <span className="num shrink-0 text-muted">
                      {formatCurrency(m.value)}
                    </span>
                    <span className="num w-9 shrink-0 text-right font-semibold">
                      {Math.round(m.pct)}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {/* Weekly trend */}
      <section className="card p-4">
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <h2 className="text-[13.5px] font-semibold">{t("stats.weekly")}</h2>
          {delta !== null && (
            <span
              className={`text-[11px] font-medium ${
                delta > 0 ? "text-danger" : "text-success"
              }`}
            >
              {delta > 0 ? "↑" : "↓"} {Math.abs(Math.round(delta))}%{" "}
              {t("stats.vsLastMonth")}
            </span>
          )}
        </div>
        <div className="flex h-28 items-end justify-between gap-2.5">
          {weeks.map((w) => (
            <div key={w.index} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t-lg bg-primary transition-[height] duration-500"
                  style={{ height: `${Math.max(3, w.ratio * 100)}%` }}
                  title={formatCurrency(w.value)}
                />
              </div>
              <span className="text-[10px] text-muted">
                {t("stats.week", { n: w.index })}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 border-t border-border pt-3 text-[11.5px] text-muted">
          {t("stats.monthTotal", { amount: formatCurrency(spent) })}
        </p>
      </section>
    </div>
  );
}

/** Distinct hues for the member split; independent of category colours. */
const MEMBER_COLORS = ["#6366f1", "#0ea5e9", "#22c55e", "#f59e0b", "#ec4899", "#14b8a6"];

function cellStyle(cell: {
  intensity: number;
  over: boolean;
  isToday: boolean;
  future: boolean;
  amount: number;
}): React.CSSProperties {
  // Future days are dimmed rather than shown as zero — "not yet" is not "none".
  if (cell.future) {
    return { background: "var(--background)", opacity: 0.5, color: "var(--muted)" };
  }

  // Numerals ride on top of the fill, so they need their own contrast: light
  // over a saturated cell, muted over an empty one.
  const style: React.CSSProperties = cell.over
    ? { background: "rgb(239 68 68 / 0.85)", color: "#fff" }
    : cell.amount === 0
      ? { background: "var(--surface-muted)", color: "var(--muted)" }
      : {
          background: `rgb(99 102 241 / ${0.2 + cell.intensity * 0.65})`,
          color: cell.intensity > 0.45 ? "#fff" : "var(--foreground)",
        };

  if (cell.isToday) {
    style.outline = "1.5px solid var(--primary)";
    style.outlineOffset = "-1.5px";
  }
  return style;
}
