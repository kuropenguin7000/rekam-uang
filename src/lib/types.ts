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

export type Range = "week" | "month" | "all";

export interface Insight {
  id: string;
  kind: "warning" | "tip" | "positive";
  title: string;
  detail: string;
  /** estimated monthly saving in currency units, if applicable */
  estimatedSaving?: number;
}
