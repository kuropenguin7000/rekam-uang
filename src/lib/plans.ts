export type PlanId = "free" | "pro";
export type Role = "user" | "master";

export interface Entitlements {
  /** max AI chat parses per day (Infinity = unlimited) */
  aiParsePerDay: number;
  /** max AI "Analyze My Spending" runs per day */
  aiAnalyzePerDay: number;
  /** custom date-range filtering on the dashboard */
  customDateRange: boolean;
  /** deeper AI insights (subscription traps, benchmarks) */
  advancedInsights: boolean;
  /** export data to CSV */
  exportData: boolean;
}

export type BillingCycle = "monthly" | "yearly";

export interface Plan {
  id: PlanId;
  /** Indonesian display name */
  name: string;
  /** monthly price in IDR */
  price: number;
  /** yearly price in IDR (0 for free) */
  priceYearly: number;
  tagline: string;
  features: string[];
  entitlements: Entitlements;
}

/** Resolve the charged amount for a plan + billing cycle. */
export function priceFor(plan: PlanId, cycle: BillingCycle): number {
  return cycle === "yearly" ? PLANS[plan].priceYearly : PLANS[plan].price;
}

/**
 * Add one billing cycle (calendar month or year) to a date. Used to compute
 * when a paid period ends. Calendar-accurate (handles month-length and leap
 * years) rather than a flat 30/365 days.
 */
export function addCycle(from: Date, cycle: BillingCycle): Date {
  const d = new Date(from);
  if (cycle === "yearly") {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Gratis",
    price: 0,
    priceYearly: 0,
    tagline: "Coba fitur AI dengan batas harian",
    features: [
      "Catat pengeluaran lewat chat",
      "Dashboard & grafik dasar",
      "5 parsing AI / hari (trial)",
      "1 analisa AI / hari (trial)",
      "Filter mingguan & bulanan",
    ],
    entitlements: {
      aiParsePerDay: 5,
      aiAnalyzePerDay: 1,
      customDateRange: false,
      advancedInsights: false,
      exportData: false,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 49000,
    // ~2 months free vs paying monthly (49000 * 10)
    priceYearly: 490000,
    tagline: "Tanpa batas untuk pengguna serius",
    features: [
      "Parsing AI tanpa batas",
      "Analisa AI tanpa batas",
      "Deteksi langganan & benchmark",
      "Filter periode tanggal",
      "Ekspor data ke Excel, PDF, CSV",
      "Dukungan prioritas",
    ],
    entitlements: {
      aiParsePerDay: Infinity,
      aiAnalyzePerDay: Infinity,
      customDateRange: true,
      advancedInsights: true,
      exportData: true,
    },
  },
};

const MASTER_ENTITLEMENTS: Entitlements = {
  aiParsePerDay: Infinity,
  aiAnalyzePerDay: Infinity,
  customDateRange: true,
  advancedInsights: true,
  exportData: true,
};

/** Resolve effective entitlements for a user. Master unlocks everything. */
export function entitlementsFor(role: Role, plan: PlanId): Entitlements {
  if (role === "master") return MASTER_ENTITLEMENTS;
  return PLANS[plan].entitlements;
}

export function isMasterEmail(email: string): boolean {
  const master = (process.env.MASTER_EMAIL ?? "").toLowerCase().trim();
  return !!master && email.toLowerCase().trim() === master;
}
