import type { MessageKey } from "@/i18n/messages";
import { daysAgoISO, formatCurrency, todayISO } from "./format";

export type NotificationSeverity = "danger" | "warning" | "info" | "success";

/**
 * A localizable notification descriptor. Text is resolved on the client via
 * `t(titleKey, params)` so the server stays locale-agnostic. Currency params
 * are pre-formatted (the Rupiah format is locale-independent); dates are left
 * as ISO strings for the client to format in the active locale.
 */
export interface AppNotification {
  id: string;
  severity: NotificationSeverity;
  icon: string;
  titleKey: MessageKey;
  bodyKey: MessageKey;
  params: Record<string, string | number>;
  action?: { labelKey: MessageKey; href: string };
}

export interface NotificationInput {
  /** monthly budget in IDR */
  budget: number;
  /** raw daily budget setting (0 = auto = budget / 30) */
  dailyBudget: number;
  transactions: {
    amount: number;
    date: string;
    type?: string;
    category?: string;
  }[];
  /** per-category monthly caps, e.g. { food: 1000000 } */
  categoryBudgets?: Record<string, number>;
  /** resolves a category id to its localized name (for the alert text) */
  categoryLabel?: (id: string) => string;
}

/** Flag the monthly budget once spending crosses this fraction of it. */
const MONTHLY_NEAR_PCT = 0.8;

const SEVERITY_RANK: Record<NotificationSeverity, number> = {
  danger: 0,
  warning: 1,
  info: 2,
  success: 3,
};

/**
 * Derive the active notifications for a user from their spending.
 * Pure and side-effect free so it can be unit-tested and reused anywhere.
 *
 * Budget math mirrors the dashboard: the "monthly" window is the rolling last
 * 30 days, the "daily" window is today — so a notification never contradicts
 * the budget bar the user already sees.
 */
export function computeNotifications(input: NotificationInput): AppNotification[] {
  const out: AppNotification[] = [];

  // --- Budget usage ---
  const monthCutoff = daysAgoISO(29);
  const today = todayISO();
  let monthSpend = 0;
  let todaySpend = 0;
  const monthByCat: Record<string, number> = {};
  for (const t of input.transactions) {
    if (t.date >= monthCutoff) {
      monthSpend += t.amount;
      if (t.category) {
        monthByCat[t.category] = (monthByCat[t.category] ?? 0) + t.amount;
      }
    }
    if (t.date === today) todaySpend += t.amount;
  }

  const effectiveDaily =
    input.dailyBudget > 0 ? input.dailyBudget : input.budget / 30;

  if (input.budget > 0 && monthSpend > input.budget) {
    out.push({
      id: "month-exceeded",
      severity: "danger",
      icon: "📉",
      titleKey: "notif.monthExceeded.title",
      bodyKey: "notif.monthExceeded.body",
      params: { over: formatCurrency(monthSpend - input.budget) },
    });
  } else if (
    input.budget > 0 &&
    monthSpend >= input.budget * MONTHLY_NEAR_PCT
  ) {
    out.push({
      id: "month-near",
      severity: "warning",
      icon: "⚠️",
      titleKey: "notif.monthNear.title",
      bodyKey: "notif.monthNear.body",
      params: {
        pct: Math.round((monthSpend / input.budget) * 100),
        remaining: formatCurrency(Math.max(0, input.budget - monthSpend)),
      },
    });
  }

  if (effectiveDaily > 0 && todaySpend >= effectiveDaily) {
    out.push({
      id: "daily-reached",
      severity: "warning",
      icon: "🍽️",
      titleKey: "notif.dailyReached.title",
      bodyKey: "notif.dailyReached.body",
      params: {
        spent: formatCurrency(todaySpend),
        limit: formatCurrency(effectiveDaily),
      },
    });
  }

  // --- Per-category budgets exceeded (this month) ---
  if (input.categoryBudgets) {
    for (const [cat, cap] of Object.entries(input.categoryBudgets)) {
      const catSpend = monthByCat[cat] ?? 0;
      if (cap > 0 && catSpend > cap) {
        out.push({
          id: `cat-over-${cat}`,
          severity: "warning",
          icon: "🧾",
          titleKey: "notif.catOver.title",
          bodyKey: "notif.catOver.body",
          params: {
            category: input.categoryLabel ? input.categoryLabel(cat) : cat,
            over: formatCurrency(catSpend - cap),
          },
        });
      }
    }
  }

  // Most urgent first, stable within the same severity.
  return out.sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
  );
}
