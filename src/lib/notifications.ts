import type { MessageKey } from "@/i18n/messages";
import { daysAgoISO, formatCurrency, todayISO } from "./format";
import type { PlanId, Role } from "./plans";

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
  plan: PlanId;
  role: Role;
  /** ISO string for when the paid period ends, or null. */
  planExpiresAt: string | null;
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
  /** injectable clock for testing; defaults to now */
  now?: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Warn this many days before the paid period ends. */
const ENDING_SOON_DAYS = 7;
/** Flag the monthly budget once spending crosses this fraction of it. */
const MONTHLY_NEAR_PCT = 0.8;

const SEVERITY_RANK: Record<NotificationSeverity, number> = {
  danger: 0,
  warning: 1,
  info: 2,
  success: 3,
};

/**
 * Derive the active notifications for a user from their plan + spending.
 * Pure and side-effect free so it can be unit-tested and reused anywhere.
 *
 * Budget math mirrors the dashboard: the "monthly" window is the rolling last
 * 30 days, the "daily" window is today — so a notification never contradicts
 * the budget bar the user already sees.
 */
export function computeNotifications(input: NotificationInput): AppNotification[] {
  const now = input.now ?? new Date();
  const out: AppNotification[] = [];

  // --- Subscription expiry ---
  if (input.plan === "pro" && input.planExpiresAt) {
    const expires = new Date(input.planExpiresAt);
    const msLeft = expires.getTime() - now.getTime();
    const daysLeft = Math.ceil(msLeft / DAY_MS);

    if (msLeft <= 0) {
      // Brief window before the auto-downgrade job flips the plan to free.
      out.push({
        id: "sub-expired",
        severity: "danger",
        icon: "⛔",
        titleKey: "notif.subExpired.title",
        bodyKey: "notif.subExpired.body",
        params: {},
        action: { labelKey: "notif.renew", href: "/pricing?renew=1" },
      });
    } else if (daysLeft <= ENDING_SOON_DAYS) {
      out.push({
        id: "sub-ending",
        severity: "warning",
        icon: "⏳",
        titleKey: "notif.subEnding.title",
        bodyKey: "notif.subEnding.body",
        params: { days: daysLeft },
        action: { labelKey: "notif.renew", href: "/pricing?renew=1" },
      });
    }
  } else if (
    input.plan === "free" &&
    input.planExpiresAt &&
    new Date(input.planExpiresAt).getTime() <= now.getTime()
  ) {
    // The account was Pro and has since been downgraded to free. Let the user
    // know and nudge a renewal. Stays until they renew or mark it read.
    out.push({
      id: "plan-expired",
      severity: "warning",
      icon: "⬇️",
      titleKey: "notif.planExpired.title",
      bodyKey: "notif.planExpired.body",
      params: {},
      action: { labelKey: "notif.renew", href: "/pricing?renew=1" },
    });
  }

  // --- Budget usage (expenses only; income doesn't count against budgets) ---
  const monthCutoff = daysAgoISO(29);
  const today = todayISO();
  let monthSpend = 0;
  let todaySpend = 0;
  const monthByCat: Record<string, number> = {};
  for (const t of input.transactions) {
    if (t.type === "income") continue;
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
