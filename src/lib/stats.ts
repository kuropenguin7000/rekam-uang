import { dateRange, endOfWeekISO, startOfWeekISO, todayISO } from "./format";
import { monthPeriod } from "./period";
import type { Transaction } from "./types";

/**
 * Derived figures for the redesigned Beranda and Statistik screens. All pure
 * and computed client-side from the already-loaded transaction list — the app
 * has no server, so every number here is a fold over the same array.
 */

/** Sum of a list. */
function sum(rows: Transaction[]): number {
  return rows.reduce((s, t) => s + t.amount, 0);
}

export function inMonth(rows: Transaction[], iso: string): Transaction[] {
  const { from, to } = monthPeriod(iso);
  return rows.filter((t) => t.date >= from && t.date <= to);
}

/** Rows inside an inclusive window; null bounds mean everything. */
export function inBounds(
  rows: Transaction[],
  bounds: { from: string; to: string } | null
): Transaction[] {
  if (!bounds) return rows;
  return rows.filter((t) => t.date >= bounds.from && t.date <= bounds.to);
}

/** Total spent in the calendar week containing today — the "Minggu ini" stat. */
export function spentThisWeek(rows: Transaction[]): number {
  const from = startOfWeekISO();
  const to = endOfWeekISO();
  return sum(rows.filter((t) => t.date >= from && t.date <= to));
}

/** Total spent on a single day. */
export function spentOn(rows: Transaction[], iso: string): number {
  return sum(rows.filter((t) => t.date === iso));
}

// ---------------------------------------------------------------------------
// Category breakdown (Beranda's bars, which replaced the pie)
// ---------------------------------------------------------------------------

export interface CategoryBar {
  id: string;
  value: number;
  /** Share of the largest category, 0-1 — the bar's fill width. */
  ratio: number;
}

/**
 * Categories sorted biggest first. `ratio` is relative to the *largest*
 * category rather than the total, so the top bar always fills the track and
 * the rest read as proportions of it.
 */
export function categoryBars(rows: Transaction[]): CategoryBar[] {
  const totals = new Map<string, number>();
  for (const t of rows) totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount);
  const list = [...totals.entries()]
    .map(([id, value]) => ({ id, value, ratio: 0 }))
    .sort((a, b) => b.value - a.value);
  const max = list[0]?.value ?? 0;
  if (max > 0) for (const c of list) c.ratio = c.value / max;
  return list;
}

// ---------------------------------------------------------------------------
// Member split (Statistik)
// ---------------------------------------------------------------------------

export interface MemberSlice {
  id: string;
  value: number;
  /** Share of the month's total, 0-100. */
  pct: number;
}

export function memberSplit(rows: Transaction[]): MemberSlice[] {
  const total = sum(rows);
  const totals = new Map<string, number>();
  for (const t of rows) totals.set(t.member, (totals.get(t.member) ?? 0) + t.amount);
  return [...totals.entries()]
    .map(([id, value]) => ({
      id,
      value,
      pct: total > 0 ? (value / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

// ---------------------------------------------------------------------------
// Heatmap calendar (Statistik)
// ---------------------------------------------------------------------------

export interface HeatCell {
  date: string;
  amount: number;
  /** 0-1 against the month's busiest day; drives the cell's opacity. */
  intensity: number;
  /** Past the daily budget — drawn in the danger colour, not the ramp. */
  over: boolean;
  isToday: boolean;
  /** Later than today: dimmed, since "no spending yet" isn't "no spending". */
  future: boolean;
  /** Leading blanks so the 1st lands under its weekday column. */
  blank?: false;
}

/**
 * One cell per day of the month, padded at the front so the grid starts on
 * Monday (the mockup's S-S-R-K-J-S-M header, and the same Monday-first week
 * the range filters use).
 */
export function heatmap(
  rows: Transaction[],
  iso: string,
  dailyBudget: number
): { cells: (HeatCell | null)[]; max: number } {
  const { from, to } = monthPeriod(iso);
  const today = todayISO();

  const byDay = new Map<string, number>();
  for (const t of rows) {
    if (t.date < from || t.date > to) continue;
    byDay.set(t.date, (byDay.get(t.date) ?? 0) + t.amount);
  }
  const max = Math.max(0, ...byDay.values());

  // How many blanks before the 1st: Monday-first index of that weekday.
  const firstWeekday = (new Date(from + "T00:00:00").getDay() + 6) % 7;
  const cells: (HeatCell | null)[] = Array.from({ length: firstWeekday }, () => null);

  for (const date of dateRange(from, to)) {
    const amount = byDay.get(date) ?? 0;
    cells.push({
      date,
      amount,
      intensity: max > 0 ? amount / max : 0,
      over: dailyBudget > 0 && amount > dailyBudget,
      isToday: date === today,
      future: date > today,
    });
  }
  return { cells, max };
}

// ---------------------------------------------------------------------------
// Weekly trend (Statistik)
// ---------------------------------------------------------------------------

export interface WeekBar {
  /** 1-based index within the month — rendered as M1…M5. */
  index: number;
  value: number;
  /** Share of the busiest week, 0-1. */
  ratio: number;
}

/**
 * Spending grouped into the month's calendar weeks. Weeks are keyed by their
 * Monday, so a week straddling the month boundary counts only the days that
 * actually fall inside the month.
 */
export function weeklyTrend(rows: Transaction[], iso: string): WeekBar[] {
  const { from, to } = monthPeriod(iso);
  const totals = new Map<string, number>();
  for (const date of dateRange(from, to)) totals.set(startOfWeekISO(date), 0);
  for (const t of rows) {
    if (t.date < from || t.date > to) continue;
    const key = startOfWeekISO(t.date);
    totals.set(key, (totals.get(key) ?? 0) + t.amount);
  }
  const ordered = [...totals.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const max = Math.max(0, ...ordered.map(([, v]) => v));
  return ordered.map(([, value], i) => ({
    index: i + 1,
    value,
    ratio: max > 0 ? value / max : 0,
  }));
}

/**
 * Percent change against the same-length window of the previous month.
 * Returns null when there is no prior spending to compare with, so the UI can
 * omit the comparison rather than print a meaningless "+100%".
 */
export function monthOverMonth(
  rows: Transaction[],
  iso: string,
  previousIso: string
): number | null {
  const current = sum(inMonth(rows, iso));
  const previous = sum(inMonth(rows, previousIso));
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}
