import { daysAgoISO } from "./format";
import type { CategoryId, Insight, Transaction } from "./types";
import type { Locale } from "../i18n/config";
import { messages, type MessageKey } from "../i18n/messages";

const CATEGORY_IDS: CategoryId[] = [
  "food",
  "transport",
  "shopping",
  "groceries",
  "entertainment",
  "bills",
  "health",
  "other",
];

function catLabel(locale: Locale, id: CategoryId): string {
  return messages[locale][`cat.${id}` as MessageKey];
}

/**
 * Rule-based insights engine. Inspects the logs for anomalies, subscription
 * traps and benchmark drift, returning concrete tips in the requested language.
 */
export function generateInsights(
  allTransactions: Transaction[],
  budget: number,
  locale: Locale = "id"
): Insight[] {
  const en = locale === "en";
  const insights: Insight[] = [];

  const transactions = allTransactions;

  if (transactions.length === 0) {
    return [
      {
        id: "empty",
        kind: "tip",
        title: en ? "No data yet" : "Belum ada data",
        detail: en
          ? "Add a few expenses with the Add button and check back here for personalised savings advice."
          : "Catat beberapa pengeluaran lewat tombol Tambah, lalu kembali ke sini untuk saran hemat yang personal.",
      },
    ];
  }

  const last7 = sumSince(transactions, 7);
  const prev7 = sumBetween(transactions, 14, 7);
  const monthTotal = sumSince(transactions, 30).reduce(
    (s, t) => s + t.amount,
    0
  );

  // 1. Week-over-week category spikes
  for (const cat of CATEGORY_IDS) {
    const now = categorySum(last7, cat);
    const before = categorySum(prev7, cat);
    if (before > 0 && now > before * 1.25 && now > 50_000) {
      const pct = Math.round(((now - before) / before) * 100);
      const label = catLabel(locale, cat);
      insights.push({
        id: `spike-${cat}`,
        kind: "warning",
        title: en
          ? `${label} up ${pct}% this week`
          : `${label} naik ${pct}% minggu ini`,
        detail: en
          ? `You spent ${rp(now)} on ${label.toLowerCase()} in the last 7 days vs ${rp(
              before
            )} the week before. Trimming this back to your usual level could save about ${rp(
              now - before
            )} next month.`
          : `Kamu menghabiskan ${rp(now)} untuk ${label.toLowerCase()} dalam 7 hari terakhir vs ${rp(
              before
            )} minggu sebelumnya. Mengembalikan ke level normal bisa menghemat sekitar ${rp(
              now - before
            )} bulan depan.`,
        estimatedSaving: Math.round((now - before) * 4),
      });
    }
  }

  // 2. Subscription / recurring trap detection
  for (const r of findRecurring(transactions)) {
    insights.push({
      id: `sub-${r.merchant}`,
      kind: "warning",
      title: en
        ? `Recurring charge: ${r.merchant}`
        : `Tagihan berulang: ${r.merchant}`,
      detail: en
        ? `${r.merchant} has billed you ${r.count} times (${rp(
            r.amount
          )} each). If this is a forgotten subscription or free trial, cancelling it saves ${rp(
            r.amount
          )} a month.`
        : `${r.merchant} menagihmu ${r.count} kali (${rp(
            r.amount
          )} per transaksi). Jika ini langganan terlupakan atau trial gratis, membatalkannya menghemat ${rp(
            r.amount
          )} per bulan.`,
      estimatedSaving: r.amount,
    });
  }

  // 3. Frequent small spends (the "coffee adds up" pattern)
  const coffee = transactions.filter(
    (t) => t.category === "food" && t.amount <= 70_000
  );
  if (coffee.length >= 5) {
    const totalCoffee = coffee.reduce((s, t) => s + t.amount, 0);
    const saving = Math.round(totalCoffee * 0.3);
    insights.push({
      id: "small-food",
      kind: "tip",
      title: en ? "Small food & drink runs add up" : "Jajan kecil makin menumpuk",
      detail: en
        ? `You made ${coffee.length} small food/drink purchases totalling ${rp(
            totalCoffee
          )}. Brewing at home twice a week could save roughly ${rp(saving)} a month.`
        : `Kamu melakukan ${coffee.length} pembelian makanan/minuman kecil senilai total ${rp(
            totalCoffee
          )}. Membuat sendiri di rumah dua kali seminggu bisa menghemat sekitar ${rp(
            saving
          )} per bulan.`,
      estimatedSaving: saving,
    });
  }

  // 4. Budget benchmark
  if (budget > 0) {
    const ratio = monthTotal / budget;
    if (ratio > 1) {
      const pct = Math.round((ratio - 1) * 100);
      insights.push({
        id: "over-budget",
        kind: "warning",
        title: en ? "Over monthly budget" : "Melebihi anggaran bulanan",
        detail: en
          ? `You've spent ${rp(monthTotal)} against a ${rp(budget)} budget — that's ${pct}% over.`
          : `Kamu sudah menghabiskan ${rp(monthTotal)} dari anggaran ${rp(
              budget
            )} — itu ${pct}% lebih tinggi.`,
      });
    } else if (ratio < 0.8) {
      const pct = Math.round(ratio * 100);
      insights.push({
        id: "under-budget",
        kind: "positive",
        title: en ? "Comfortably under budget" : "Masih nyaman di bawah anggaran",
        detail: en
          ? `Nice — you're at ${rp(monthTotal)} of your ${rp(
              budget
            )} budget (${pct}%). You have ${rp(budget - monthTotal)} of headroom left.`
          : `Mantap — kamu di ${rp(monthTotal)} dari anggaran ${rp(
              budget
            )} (${pct}%). Masih ada sisa ${rp(budget - monthTotal)}.`,
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      id: "steady",
      kind: "positive",
      title: en ? "Spending looks steady" : "Pengeluaran terlihat stabil",
      detail: en
        ? "No unusual spikes or subscription traps detected this period. Keep it up!"
        : "Tidak ada lonjakan tidak biasa atau jebakan langganan pada periode ini. Pertahankan!",
    });
  }

  return insights;
}

interface Recurring {
  merchant: string;
  amount: number;
  count: number;
}

function findRecurring(transactions: Transaction[]): Recurring[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (!t.merchant) continue;
    const key = `${t.merchant.toLowerCase()}|${t.amount}`;
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }
  const out: Recurring[] = [];
  for (const arr of groups.values()) {
    if (
      arr.length >= 2 &&
      (arr[0].category === "bills" || arr[0].category === "entertainment")
    ) {
      out.push({
        merchant: arr[0].merchant,
        amount: arr[0].amount,
        count: arr.length,
      });
    }
  }
  return out;
}

function sumSince(transactions: Transaction[], days: number): Transaction[] {
  const cutoff = daysAgoISO(days);
  return transactions.filter((t) => t.date >= cutoff);
}

function sumBetween(
  transactions: Transaction[],
  from: number,
  to: number
): Transaction[] {
  const start = daysAgoISO(from);
  const end = daysAgoISO(to);
  return transactions.filter((t) => t.date >= start && t.date < end);
}

function categorySum(transactions: Transaction[], cat: CategoryId): number {
  return transactions
    .filter((t) => t.category === cat)
    .reduce((s, t) => s + t.amount, 0);
}

function rp(value: number): string {
  return "Rp " + Math.round(value).toLocaleString("id-ID");
}
