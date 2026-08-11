import type { Commitment, CommitmentDraft } from "./types";

/**
 * Recurring money the user is already locked into: subscriptions (YouTube
 * Premium, Claude, CapCut …) and instalment plans (Shopee PayLater, credit
 * card cicilan).
 *
 * Both answer the same question — "how much of next month is already spoken
 * for?" — so they share one collection and one fold, discriminated by `kind`.
 *
 * Every function here is a pure fold over the list, which is what makes the
 * simulator honest: simulating is just running the same maths over
 * `[...saved, ...drafts]`. There is no separate "what if" code path to drift.
 *
 * All month maths is done on the yyyy-mm prefix as integers — never Date —
 * so month arithmetic can't be skewed by timezones or month lengths, the same
 * reason transaction dates are stored as strings.
 */

/** Year+month as a single ordinal, so month deltas are plain subtraction. */
function monthOrdinal(iso: string): number {
  return Number(iso.slice(0, 4)) * 12 + (Number(iso.slice(5, 7)) - 1);
}

/** yyyy-mm-dd or yyyy-mm → yyyy-mm, the key a schedule is stored under. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

// ---------------------------------------------------------------------------
// Custom payment schedules
// ---------------------------------------------------------------------------

/**
 * A real instalment invoice rarely divides evenly: amounts step down over the
 * year and months get skipped. When a plan carries a schedule it wins over
 * `amount`/`tenor` entirely — those stay only as display fallbacks.
 */
export function hasSchedule(c: Commitment | CommitmentDraft): boolean {
  return c.kind === "installment" && Object.keys(c.schedule ?? {}).length > 0;
}

/** Scheduled months in calendar order (yyyy-mm sorts lexicographically). */
export function scheduleMonths(c: Commitment | CommitmentDraft): string[] {
  return Object.entries(c.schedule ?? {})
    .filter(([, v]) => v > 0)
    .map(([m]) => m)
    .sort();
}

/** Everything the plan will ever cost — the figure printed on the invoice. */
export function scheduleTotal(c: Commitment | CommitmentDraft): number {
  return Object.values(c.schedule ?? {}).reduce((sum, v) => sum + (v > 0 ? v : 0), 0);
}

/** Whole months from `from` to `to`. Negative when `to` precedes `from`. */
export function monthsBetween(from: string, to: string): number {
  return monthOrdinal(to) - monthOrdinal(from);
}

/** Shift a yyyy-mm(-dd) by whole months, returning yyyy-mm. */
export function shiftMonth(iso: string, delta: number): string {
  const o = monthOrdinal(iso) + delta;
  const y = Math.floor(o / 12);
  const m = (o % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** The yyyy-mm the app considers "next month" relative to a given month. */
export function nextMonthOf(iso: string): string {
  return shiftMonth(iso, 1);
}

/**
 * Which billing cycle covers `monthIso`, 0-based from the first charge.
 * Monthly subscriptions and instalments advance every month; yearly
 * subscriptions advance every twelve. Negative means it hasn't started.
 */
function cycleIndex(c: Commitment | CommitmentDraft, monthIso: string): number {
  const months = monthsBetween(c.startDate, monthIso);
  if (months < 0) return -1;
  return c.kind === "subscription" && c.cycle === "yearly"
    ? Math.floor(months / 12)
    : months;
}

/**
 * The price of the cycle covering `monthIso`, ignoring whether a charge
 * actually lands in that month. This is what a promo applies to: `introPeriods`
 * counts CYCLES, so 3 means three months on a monthly plan and three years on
 * a yearly one. A free trial is `introAmount: 0` with `introPeriods > 0`, so
 * the promo flag is the period count — never the amount.
 */
export function priceForMonth(
  c: Commitment | CommitmentDraft,
  monthIso: string
): number {
  // A custom schedule answers this directly — no start date, no tenor window.
  if (hasSchedule(c)) return c.schedule[monthKey(monthIso)] ?? 0;
  const idx = cycleIndex(c, monthIso);
  if (idx < 0) return 0;
  if (c.kind === "installment") return idx < c.tenor ? c.amount : 0;
  return c.introPeriods > 0 && idx < c.introPeriods ? c.introAmount : c.amount;
}

/**
 * Cash actually leaving the account in `monthIso`. A yearly subscription bills
 * in its anniversary month and is zero the other eleven — the whole point of
 * separating this from `normalizedMonthly` below.
 */
export function chargeInMonth(
  c: Commitment | CommitmentDraft,
  monthIso: string
): number {
  if (!c.active) return 0;
  // A scheduled plan bills exactly on the months it lists — skipped months
  // (the gap between Angsuran I and II on a real invoice) are simply absent.
  if (hasSchedule(c)) return c.schedule[monthKey(monthIso)] ?? 0;
  const months = monthsBetween(c.startDate, monthIso);
  if (months < 0) return 0;
  if (c.kind === "subscription" && c.cycle === "yearly" && months % 12 !== 0) {
    return 0;
  }
  return priceForMonth(c, monthIso);
}

/**
 * The same cost smeared evenly across the year, so a yearly plan can be
 * compared against a monthly one. Useful for budgeting; useless for "what
 * do I actually pay next month" — hence both exist.
 */
export function normalizedMonthly(
  c: Commitment | CommitmentDraft,
  monthIso: string
): number {
  if (!c.active) return 0;
  const price = priceForMonth(c, monthIso);
  return c.kind === "subscription" && c.cycle === "yearly" ? price / 12 : price;
}

// ---------------------------------------------------------------------------
// Instalment progress
// ---------------------------------------------------------------------------

/** 1-based number of the payment landing in `monthIso`; 0 when none does. */
export function installmentNumber(
  c: Commitment | CommitmentDraft,
  monthIso: string
): number {
  if (c.kind !== "installment") return 0;
  if (hasSchedule(c)) {
    // "Angsuran IV" is its position in the plan, which a skipped month makes
    // different from the number of months since the start.
    const i = scheduleMonths(c).indexOf(monthKey(monthIso));
    return i < 0 ? 0 : i + 1;
  }
  const idx = monthsBetween(c.startDate, monthIso);
  return idx < 0 || idx >= c.tenor ? 0 : idx + 1;
}

/** How many payments the plan has in total. */
export function totalPayments(c: Commitment | CommitmentDraft): number {
  if (c.kind !== "installment") return 0;
  return hasSchedule(c) ? scheduleMonths(c).length : c.tenor;
}

/** Payments still owed, counting `monthIso` itself as still to come. */
export function remainingPayments(
  c: Commitment | CommitmentDraft,
  monthIso: string
): number {
  if (c.kind !== "installment") return 0;
  if (hasSchedule(c)) {
    const key = monthKey(monthIso);
    return scheduleMonths(c).filter((m) => m >= key).length;
  }
  const idx = monthsBetween(c.startDate, monthIso);
  if (idx < 0) return c.tenor;
  return Math.max(0, c.tenor - idx);
}

/** Everything still owed on an instalment plan from `monthIso` onward. */
export function remainingTotal(
  c: Commitment | CommitmentDraft,
  monthIso: string
): number {
  if (hasSchedule(c)) {
    const key = monthKey(monthIso);
    return scheduleMonths(c)
      .filter((m) => m >= key)
      .reduce((sum, m) => sum + c.schedule[m], 0);
  }
  return remainingPayments(c, monthIso) * c.amount;
}

/** The month of the final payment, yyyy-mm. */
export function finalMonth(c: Commitment | CommitmentDraft): string {
  if (hasSchedule(c)) {
    const months = scheduleMonths(c);
    return months[months.length - 1] ?? monthKey(c.startDate);
  }
  return shiftMonth(c.startDate, Math.max(0, c.tenor - 1));
}

/**
 * How many cycles of promo pricing are left, counting `monthIso`. Zero when
 * there is no promo or it has already lapsed — the number behind the
 * "price goes up in N months" warning.
 */
export function promoLeft(
  c: Commitment | CommitmentDraft,
  monthIso: string
): number {
  if (c.kind !== "subscription" || c.introPeriods <= 0) return 0;
  const idx = cycleIndex(c, monthIso);
  if (idx < 0) return c.introPeriods;
  return Math.max(0, c.introPeriods - idx);
}

/** The first month billed at the full price, or "" when nothing changes. */
export function fullPriceFrom(c: Commitment | CommitmentDraft): string {
  if (c.kind !== "subscription" || c.introPeriods <= 0) return "";
  const step = c.cycle === "yearly" ? 12 : 1;
  return shiftMonth(c.startDate, c.introPeriods * step);
}

/** The next month from `monthIso` onward that carries a charge; "" if none. */
export function nextChargeMonth(
  c: Commitment | CommitmentDraft,
  monthIso: string
): string {
  if (!c.active) return "";
  // A schedule is answered by lookup: scanning forward would miss a plan that
  // resumes more than a year later, and there is no cycle to bound the scan.
  if (hasSchedule(c)) {
    const key = monthKey(monthIso);
    return scheduleMonths(c).find((m) => m >= key) ?? "";
  }
  // 13 covers a full yearly cycle plus the current month.
  for (let i = 0; i < 13; i++) {
    const m = shiftMonth(monthIso, i);
    if (chargeInMonth(c, m) > 0) return m;
  }
  return "";
}

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

export interface CommitmentTotals {
  /** Cash actually due in the month — the headline figure. */
  due: number;
  /** Split of `due`. */
  subscriptions: number;
  installments: number;
  /** Yearly plans smeared over 12 months, for budget comparison. */
  normalized: number;
  /** How many commitments actually bill in this month. */
  billingCount: number;
}

export function totalsForMonth(
  list: (Commitment | CommitmentDraft)[],
  monthIso: string
): CommitmentTotals {
  let subscriptions = 0;
  let installments = 0;
  let normalized = 0;
  let billingCount = 0;

  for (const c of list) {
    const charge = chargeInMonth(c, monthIso);
    if (charge > 0) {
      billingCount++;
      if (c.kind === "installment") installments += charge;
      else subscriptions += charge;
    }
    normalized += normalizedMonthly(c, monthIso);
  }

  return {
    due: subscriptions + installments,
    subscriptions,
    installments,
    normalized,
    billingCount,
  };
}

export interface OutlookPoint {
  /** yyyy-mm */
  month: string;
  due: number;
}

/**
 * `count` months of upcoming charges starting at `fromMonthIso`. This is where
 * promo cliffs and finishing instalments become visible: a bill that drops in
 * March because a plan ends, or jumps in May when an intro price lapses, is
 * obvious as a shape and invisible as a single number.
 */
export function outlook(
  list: (Commitment | CommitmentDraft)[],
  fromMonthIso: string,
  count = 6
): OutlookPoint[] {
  const out: OutlookPoint[] = [];
  for (let i = 0; i < count; i++) {
    const month = shiftMonth(fromMonthIso, i);
    out.push({ month, due: totalsForMonth(list, month).due });
  }
  return out;
}

/** Largest `due` in an outlook, for scaling bars. Never zero, so it divides. */
export function outlookPeak(points: OutlookPoint[]): number {
  return Math.max(1, ...points.map((p) => p.due));
}
