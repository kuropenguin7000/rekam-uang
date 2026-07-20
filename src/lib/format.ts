/** Format a number as Indonesian Rupiah, e.g. 50000 -> "Rp 50.000". */
export function formatCurrency(value: number): string {
  return "Rp " + Math.round(value).toLocaleString("id-ID");
}

/**
 * Group a raw digit string with dots for money inputs while typing,
 * e.g. "1500000" -> "1.500.000". Empty stays empty.
 */
export function groupDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Compact currency for axis labels, e.g. 50000 -> "50k", 1500000 -> "1.5jt". */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return (value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1) + "jt";
  }
  if (abs >= 1_000) {
    return Math.round(value / 1_000) + "k";
  }
  return String(value);
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function todayISO(): string {
  return toISO(new Date());
}

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDayMonth(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function daysAgoISO(n: number): string {
  return toISO(new Date(Date.now() - n * DAY_MS));
}

// ---------------------------------------------------------------------------
// Calendar period boundaries
//
// "This week" and "this month" mean real calendar periods, not rolling windows:
// the week runs Monday→Sunday (Indonesian convention — getDay() is 0 for
// Sunday, so shifting by 6 makes Monday index 0), and the month runs from the
// 1st to the last day.
// ---------------------------------------------------------------------------

function parseISO(iso: string): Date {
  return new Date(iso + "T00:00:00");
}

/** Monday of the week containing `iso`. */
export function startOfWeekISO(iso: string = todayISO()): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toISO(d);
}

/** Sunday of the week containing `iso`. */
export function endOfWeekISO(iso: string = todayISO()): string {
  const d = parseISO(startOfWeekISO(iso));
  d.setDate(d.getDate() + 6);
  return toISO(d);
}

export function startOfMonthISO(iso: string = todayISO()): string {
  const d = parseISO(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth(), 1));
}

/** Day 0 of the next month is the last day of this one (handles leap years). */
export function endOfMonthISO(iso: string = todayISO()): string {
  const d = parseISO(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/** Inclusive list of ISO dates between two dates (oldest first). */
export function dateRange(startISO: string, endISO: string): string[] {
  const out: string[] = [];
  const start = new Date(startISO + "T00:00:00");
  const end = new Date(endISO + "T00:00:00");
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    out.push(toISO(new Date(t)));
  }
  return out;
}
