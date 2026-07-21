import {
  endOfMonthISO,
  endOfWeekISO,
  startOfMonthISO,
  startOfWeekISO,
  todayISO,
  toISO,
} from "./format";
import type { Locale } from "@/i18n/config";

/**
 * Month navigation for the redesign. Beranda and Statistik are both scoped to
 * one calendar month, chosen with the "Juli 2026" chip, so the selected month
 * is the app's primary period control.
 *
 * A month is identified by any ISO date inside it; helpers always normalise to
 * the 1st, so callers can pass whatever they have.
 */

export interface MonthPeriod {
  /** First day of the month, yyyy-mm-01. */
  from: string;
  /** Last day of the month. */
  to: string;
  /** Days in the month (28-31). */
  days: number;
}

export function monthPeriod(iso: string = todayISO()): MonthPeriod {
  const from = startOfMonthISO(iso);
  const to = endOfMonthISO(iso);
  return { from, to, days: Number(to.slice(8, 10)) };
}

/**
 * The Beranda period filter added in the design revision: a three-way segmented
 * control above the hero. The month chip only means anything for "month", so
 * the UI swaps it for a static label on the other two.
 */
export type HomePeriod = "week" | "month" | "all";

/** Inclusive bounds for a home period; null means all time (unbounded). */
export function periodBounds(
  period: HomePeriod,
  monthIso: string
): { from: string; to: string } | null {
  if (period === "all") return null;
  if (period === "week") return { from: startOfWeekISO(), to: endOfWeekISO() };
  const { from, to } = monthPeriod(monthIso);
  return { from, to };
}

/** Shift by whole months. Clamps to the 1st, so month lengths never skew it. */
export function addMonths(iso: string, delta: number): string {
  const d = new Date(iso + "T00:00:00");
  return toISO(new Date(d.getFullYear(), d.getMonth() + delta, 1));
}

/** "Juli 2026" / "July 2026". */
export function monthLabel(iso: string, locale: Locale): string {
  return new Date(iso + "T00:00:00").toLocaleDateString(
    locale === "id" ? "id-ID" : "en-GB",
    { month: "long", year: "numeric" }
  );
}

export function isSameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** True when the month holding `iso` is the one we are living through. */
export function isCurrentMonth(iso: string): boolean {
  return isSameMonth(iso, todayISO());
}

/**
 * Days remaining in the month, counting today. Zero for past months and the
 * full month for future ones — the hero's "19 hari lagi" only makes sense for
 * a month in progress, and callers hide it otherwise.
 */
export function daysLeftInMonth(iso: string): number {
  const today = todayISO();
  const { to, days } = monthPeriod(iso);
  if (iso.slice(0, 7) < today.slice(0, 7)) return 0;
  if (iso.slice(0, 7) > today.slice(0, 7)) return days;
  return Number(to.slice(8, 10)) - Number(today.slice(8, 10)) + 1;
}

/**
 * Days already elapsed in the month, counting today — the denominator for the
 * "Harian" average. Never zero, so callers can divide safely.
 */
export function daysElapsedInMonth(iso: string): number {
  const today = todayISO();
  const { days } = monthPeriod(iso);
  if (iso.slice(0, 7) < today.slice(0, 7)) return days;
  if (iso.slice(0, 7) > today.slice(0, 7)) return 1;
  return Number(today.slice(8, 10));
}
