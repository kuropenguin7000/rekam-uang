export type CategoryId =
  | "food"
  | "transport"
  | "shopping"
  | "groceries"
  | "entertainment"
  | "bills"
  | "health"
  | "other";

export interface Category {
  id: CategoryId;
  label: string;
  color: string;
  icon: string;
}

/**
 * A category as it applies to a given user: the 8 built-ins (optionally renamed
 * or hidden via overrides) plus any custom categories the user added. `label`
 * holds an explicit override/custom label; for a built-in with no override it
 * is "" and the localized `cat.<id>` name is used instead.
 */
export interface UserCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
  builtin: boolean;
  hidden: boolean;
}

/**
 * A family member as it applies to a given user: the 4 built-ins (optionally
 * renamed or hidden via overrides) plus any custom members the user added.
 * `label` holds an explicit override/custom label; for a built-in with no
 * override it is "" and the localized `mem.<id>` name is used instead.
 */
export interface UserMember {
  id: string;
  label: string;
  icon: string;
  builtin: boolean;
  hidden: boolean;
}

/**
 * Everything the app records is an expense. "income" exists only to recognise
 * and exclude documents written before income tracking was removed; nothing
 * creates one any more.
 */
export type TxType = "expense" | "income";

export interface Transaction {
  id: string;
  amount: number;
  /** category id — a built-in id or a custom "c_*" id */
  category: string;
  /**
   * Who the expense belongs to: a built-in member id or a custom "m_*" id.
   * "" for entries saved before members existed.
   */
  member: string;
  /** Always "expense" for anything the app writes today. */
  type: TxType;
  merchant: string;
  note: string;
  /** ISO date string (yyyy-mm-dd) */
  date: string;
  createdAt: number;
}

/** A new expense from the add form, before it is saved. */
export interface NewTransaction {
  amount: number;
  category: string;
  member: string;
  merchant: string;
  note: string;
  date: string;
}

/**
 * Money already committed for future months. One shape covers both kinds
 * because they answer the same question ("what is next month already spoken
 * for?"); `kind` selects which fields matter.
 *
 * - subscription: bills forever on `cycle` until `active` goes false.
 *   `introAmount`/`introPeriods` express a promo — "Rp 15rb for the first 3
 *   months", "half price the first year". `introPeriods` counts CYCLES.
 * - installment: bills monthly exactly `tenor` times from `startDate`, then
 *   stops on its own. `cycle` is always "monthly" and `introPeriods` is 0.
 */
export type CommitmentKind = "subscription" | "installment";

export type BillingCycle = "monthly" | "yearly";

export interface CommitmentDraft {
  kind: CommitmentKind;
  /** Display name, e.g. "YouTube Premium" or "iPhone 17 — Shopee PayLater". */
  name: string;
  /** The regular charge per cycle; for an instalment, the monthly payment. */
  amount: number;
  cycle: BillingCycle;
  /** yyyy-mm-dd of the first charge. */
  startDate: string;
  /** Promo price. Only meaningful while `introPeriods` > 0; 0 = free trial. */
  introAmount: number;
  /** Number of cycles charged at `introAmount`. 0 means no promo at all. */
  introPeriods: number;
  /** Instalment only: total number of monthly payments. 0 for subscriptions. */
  tenor: number;
  /**
   * Instalment only. A per-month payment plan keyed yyyy-mm, for the schedules
   * real invoices actually use: amounts that step down over the year, and
   * months that are skipped entirely. When this has any entry it is
   * authoritative and `amount`/`tenor` become display fallbacks only.
   *
   * A map rather than a list so a month can't appear twice and lookup is a
   * key hit; yyyy-mm keys sort lexicographically, so order is recoverable.
   */
  schedule: Record<string, number>;
  /** Reuses the expense categories, so commitments sit in the same taxonomy. */
  category: string;
  /** Reuses the family members; "" = untagged. */
  member: string;
  note: string;
  /** False = paused/cancelled: kept for history but excluded from every total. */
  active: boolean;
}

export interface Commitment extends CommitmentDraft {
  id: string;
  createdAt: number;
}

export type Range = "week" | "month" | "all";

export interface Insight {
  id: string;
  kind: "warning" | "tip" | "positive";
  title: string;
  detail: string;
  /** estimated monthly saving in currency units, if applicable */
  estimatedSaving?: number;
}
