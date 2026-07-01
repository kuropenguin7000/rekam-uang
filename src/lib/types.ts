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
  /** keywords used by the mock NLP parser to detect this category */
  keywords: string[];
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

/** Whether a transaction is money out (expense) or money in (income). */
export type TxType = "expense" | "income";

export interface Transaction {
  id: string;
  amount: number;
  /** category id — a built-in id or a custom "c_*" id */
  category: string;
  /** "expense" (default) or "income" */
  type: TxType;
  merchant: string;
  note: string;
  /** ISO date string (yyyy-mm-dd) */
  date: string;
  createdAt: number;
}

/** A draft expense/income parsed from chat, pending user confirmation. */
export interface ParsedExpense {
  amount: number;
  category: string;
  type: TxType;
  merchant: string;
  note: string;
  date: string;
  /** parser confidence 0..1, used to hint the user to double-check */
  confidence: number;
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
