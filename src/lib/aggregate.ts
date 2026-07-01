import { dateRange, daysAgoISO, formatDayMonth, todayISO } from "./format";
import type { Range, Transaction } from "./types";

export function filterByRange(
  transactions: Transaction[],
  range: Range
): Transaction[] {
  if (range === "all") return transactions;
  const days = range === "week" ? 7 : 30;
  const cutoff = daysAgoISO(days - 1);
  return transactions.filter((t) => t.date >= cutoff);
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
  const days = range === "week" ? 7 : 30;
  let startISO: string;
  const endISO = todayISO();
  if (range === "all") {
    if (transactions.length === 0) return [];
    startISO = transactions.reduce(
      (min, t) => (t.date < min ? t.date : min),
      transactions[0].date
    );
  } else {
    startISO = daysAgoISO(days - 1);
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
