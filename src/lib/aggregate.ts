import {
  dateRange,
  endOfMonthISO,
  endOfWeekISO,
  formatDayMonth,
  startOfMonthISO,
  startOfWeekISO,
  todayISO,
} from "./format";
import type { Range, Transaction } from "./types";

/**
 * Inclusive calendar bounds for a preset range; null for "all time".
 *
 * The single source of truth for what a preset covers — the filter, the chart,
 * the export window and the dates shown in the UI all derive from this, so they
 * cannot drift apart.
 */
export function rangeBounds(range: Range): { from: string; to: string } | null {
  if (range === "all") return null;
  if (range === "week") return { from: startOfWeekISO(), to: endOfWeekISO() };
  return { from: startOfMonthISO(), to: endOfMonthISO() };
}

export function filterByRange(
  transactions: Transaction[],
  range: Range
): Transaction[] {
  const bounds = rangeBounds(range);
  if (!bounds) return transactions;
  return transactions.filter(
    (t) => t.date >= bounds.from && t.date <= bounds.to
  );
}

export interface CategorySlice {
  id: string;
  label: string;
  color: string;
  value: number;
}

/** Sum amounts per category id; `resolve` supplies each id's label + color. */
export function byCategory(
  transactions: Transaction[],
  resolve: (id: string) => { label: string; color: string }
): CategorySlice[] {
  const totals = new Map<string, number>();
  for (const t of transactions) {
    totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount);
  }
  return [...totals.entries()]
    .map(([id, value]) => {
      const meta = resolve(id);
      return { id, label: meta.label, color: meta.color, value };
    })
    .sort((a, b) => b.value - a.value);
}

export interface DayPoint {
  date: string;
  label: string;
  amount: number;
}

/** Daily spending velocity over the range (zero-filled for empty days). */
export function dailySeries(
  transactions: Transaction[],
  range: Range
): DayPoint[] {
  const bounds = rangeBounds(range);
  let startISO: string;
  // The period may still be running (it's the 3rd of a 31-day month), and
  // charting a fortnight of guaranteed-empty future bars just squeezes the
  // real ones. Totals and filtering still cover the full period — only the
  // chart's axis stops at today.
  const today = todayISO();
  let endISO = today;
  if (!bounds) {
    if (transactions.length === 0) return [];
    startISO = transactions.reduce(
      (min, t) => (t.date < min ? t.date : min),
      transactions[0].date
    );
  } else {
    startISO = bounds.from;
    endISO = bounds.to < today ? bounds.to : today;
  }

  const buckets = new Map<string, number>();
  for (const t of transactions) {
    if (t.date < startISO) continue;
    buckets.set(t.date, (buckets.get(t.date) ?? 0) + t.amount);
  }

  return dateRange(startISO, endISO).map((date) => ({
    date,
    label: formatDayMonth(date),
    amount: buckets.get(date) ?? 0,
  }));
}

export function total(transactions: Transaction[]): number {
  return transactions.reduce((s, t) => s + t.amount, 0);
}

/** Filter to an inclusive [startISO, endISO] date window. */
export function filterBetween(
  transactions: Transaction[],
  startISO: string,
  endISO: string
): Transaction[] {
  const [lo, hi] = startISO <= endISO ? [startISO, endISO] : [endISO, startISO];
  return transactions.filter((t) => t.date >= lo && t.date <= hi);
}

/** Zero-filled daily series across an explicit [startISO, endISO] window. */
export function dailySeriesBetween(
  transactions: Transaction[],
  startISO: string,
  endISO: string
): DayPoint[] {
  const [lo, hi] = startISO <= endISO ? [startISO, endISO] : [endISO, startISO];
  const buckets = new Map<string, number>();
  for (const t of transactions) {
    if (t.date < lo || t.date > hi) continue;
    buckets.set(t.date, (buckets.get(t.date) ?? 0) + t.amount);
  }
  return dateRange(lo, hi).map((date) => ({
    date,
    label: formatDayMonth(date),
    amount: buckets.get(date) ?? 0,
  }));
}

/** Inclusive day count between two ISO dates. */
export function dayCount(startISO: string, endISO: string): number {
  return dateRange(
    startISO <= endISO ? startISO : endISO,
    startISO <= endISO ? endISO : startISO
  ).length;
}
