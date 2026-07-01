import { CATEGORIES, CATEGORY_LIST } from "./categories";
import { toISO } from "./format";
import type { CategoryId, ParsedExpense } from "./types";

// Words that signal money coming IN rather than out.
const INCOME_RE =
  /\b(gaji|gajian|salary|thr|bonus|pemasukan|pendapatan|penghasilan|terima|diterima|refund|cashback|bunga|dividen|komisi|honor|fee|untung|profit|terjual|penjualan|income)\b/i;

/**
 * Mock client-side NLP. Stands in for the Gemini parsing call described
 * in the PRD so the frontend works end-to-end without a backend. Swap the body
 * of {@link parseExpense} for a real API call later — the return shape matches.
 */
export function parseExpense(input: string): ParsedExpense | null {
  const text = input.trim();
  if (!text) return null;

  const amount = extractAmount(text);
  if (amount == null) return null;

  const lower = text.toLowerCase();
  const isIncome = INCOME_RE.test(lower);
  const { category, matched } = detectCategory(lower);
  const merchant = extractMerchant(text);

  // confidence: higher when we matched a category keyword and/or a merchant
  let confidence = 0.55;
  if (matched || isIncome) confidence += 0.3;
  if (merchant) confidence += 0.1;
  confidence = Math.min(confidence, 0.98);

  return {
    amount,
    // income isn't tied to an expense category
    category: isIncome ? "other" : category,
    type: isIncome ? "income" : "expense",
    merchant: merchant ?? "",
    note: text,
    date: resolveRelativeDate(text),
    confidence,
  };
}

const WEEKDAYS: Record<string, number> = {
  minggu: 0,
  ahad: 0,
  sunday: 0,
  senin: 1,
  monday: 1,
  selasa: 2,
  tuesday: 2,
  rabu: 3,
  wednesday: 3,
  kamis: 4,
  thursday: 4,
  jumat: 5,
  "jum'at": 5,
  friday: 5,
  sabtu: 6,
  saturday: 6,
};

/**
 * Resolve a relative date expression in the text to an absolute yyyy-mm-dd —
 * the deterministic, offline counterpart to the date reasoning Gemini does.
 * Covers the common Indonesian/English phrasings; falls back to today when
 * nothing date-like is found, and never returns a future date.
 *
 * Order matters: a named weekday ("senin kemarin") is resolved before the bare
 * "kemarin" rule, and "minggu/pekan lalu" before it too, so those aren't read
 * as plain "yesterday".
 */
export function resolveRelativeDate(text: string, now: Date = new Date()): string {
  const lower = text.toLowerCase();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const minus = (days: number) =>
    toISO(new Date(base.getFullYear(), base.getMonth(), base.getDate() - days));

  // today
  if (/\b(hari ini|today|barusan|tadi)\b/.test(lower)) return toISO(base);

  // day before yesterday — must be checked before bare "kemarin"
  if (/\bkemarin lusa\b/.test(lower)) return minus(2);

  // a named weekday (optionally with "hari"/"kemarin"/"lalu") -> the most
  // recent past occurrence strictly before today.
  for (const [name, dow] of Object.entries(WEEKDAYS)) {
    // "minggu"/"ahad" also mean "week"/Sunday — require an explicit "hari"
    // prefix so "minggu lalu" (last week) isn't misread as "Sunday".
    const needsHari = dow === 0 && name !== "sunday";
    const namePat = escapeRegExp(name);
    const re = needsHari
      ? new RegExp(`\\bhari\\s+${namePat}\\b`, "i")
      : new RegExp(`\\b${namePat}\\b`, "i");
    if (re.test(lower)) {
      const diff = ((base.getDay() - dow + 7) % 7) || 7;
      return minus(diff);
    }
  }

  // "N minggu lalu" / "minggu|pekan lalu" / "seminggu lalu" / "last week"
  const nWeeks = lower.match(/\b(\d{1,3})\s*minggu\s*(?:yang\s*)?lalu\b/);
  if (nWeeks) return minus(parseInt(nWeeks[1], 10) * 7);
  if (
    /\b(?:se)?minggu\s+(?:lalu|kemarin)\b/.test(lower) ||
    /\bpekan\s+(?:lalu|kemarin)\b/.test(lower) ||
    /\blast\s+week\b/.test(lower)
  ) {
    return minus(7);
  }

  // "N hari lalu" / "N days ago"
  const nDays =
    lower.match(/\b(\d{1,3})\s*hari\s*(?:yang\s*)?lalu\b/) ||
    lower.match(/\b(\d{1,3})\s*days?\s*ago\b/);
  if (nDays) return minus(parseInt(nDays[1], 10));

  // yesterday
  if (/\b(kemarin|yesterday)\b/.test(lower)) return minus(1);

  return toISO(base);
}

/**
 * Parse the first monetary amount in the text. Understands:
 *   50k / 50rb / 50 ribu   -> 50.000
 *   1.5jt / 1,5 juta / 2m  -> 1.500.000 / 2.000.000
 *   Rp 50.000 / 50,000     -> 50.000
 *   plain 50000            -> 50.000
 */
export function extractAmount(text: string): number | null {
  const lower = text.toLowerCase();

  // number followed by a magnitude suffix (k, rb, ribu, jt, juta, m)
  const suffixRe =
    /(\d+(?:[.,]\d+)?)\s*(jt|juta|jutaan|rb|ribu|k|m)\b/i;
  const suffixMatch = lower.match(suffixRe);
  if (suffixMatch) {
    const base = parseFloat(suffixMatch[1].replace(",", "."));
    const suffix = suffixMatch[2].toLowerCase();
    const million = ["jt", "juta", "jutaan", "m"].includes(suffix);
    return Math.round(base * (million ? 1_000_000 : 1_000));
  }

  // bare number, possibly with thousands separators: 50.000 / 50,000 / 50000
  const bareRe = /(?:rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})+|\d{3,})/i;
  const bareMatch = lower.match(bareRe);
  if (bareMatch) {
    const digits = bareMatch[1].replace(/[.,]/g, "");
    const value = parseInt(digits, 10);
    if (!Number.isNaN(value) && value > 0) return value;
  }

  return null;
}

function detectCategory(lower: string): {
  category: CategoryId;
  matched: boolean;
} {
  for (const cat of CATEGORY_LIST) {
    for (const kw of cat.keywords) {
      // word-boundary-ish match
      const re = new RegExp(`\\b${escapeRegExp(kw)}\\b`, "i");
      if (re.test(lower)) {
        return { category: cat.id, matched: true };
      }
    }
  }
  return { category: "other", matched: false };
}

// Words that should never be part of a merchant name: connectors, time-of-day,
// relative-date markers, weekdays, and amount/currency suffixes. They mark where
// the merchant phrase ends (e.g. "di supermarket 634rb rabu kemarin").
const MERCHANT_STOP = new Set([
  // english connectors / markers
  "for", "on", "to", "today", "yesterday", "ago", "last", "this", "because", "and",
  // indonesian connectors / markers
  "untuk", "buat", "karena", "dan", "yang", "tadi", "barusan", "tanggal",
  // time of day
  "pagi", "siang", "sore", "malam",
  // relative-date
  "hari", "ini", "kemarin", "lusa", "lalu", "pekan", "minggu", "mingguan",
  "bulan", "bulanan", "tahun",
  // weekdays
  "senin", "selasa", "rabu", "kamis", "jumat", "jum'at", "sabtu", "ahad",
  // amount / currency suffixes
  "rp", "rb", "ribu", "jt", "juta", "jutaan", "k", "m",
]);

/**
 * Pull a merchant name after "at"/"di"/"from"/"in", e.g. "di Starbucks".
 * Stops at the first token that is a number/amount (e.g. "634rb") or a
 * stop-word (date words, connectors), so the amount and relative-date phrases
 * aren't swallowed into the merchant.
 */
export function extractMerchant(text: string): string | null {
  const m = text.match(/\b(?:at|di|dari|from|in)\s+(.+)$/i);
  if (!m) return null;

  const picked: string[] = [];
  for (const raw of m[1].split(/\s+/)) {
    const word = raw.replace(/^[^A-Za-z0-9&'.\-]+|[^A-Za-z0-9&'.\-]+$/g, "");
    if (!word) break;
    if (/\d/.test(word)) break; // an amount or a numeric date — merchant is over
    if (MERCHANT_STOP.has(word.toLowerCase())) break;
    picked.push(word);
    if (picked.length >= 5) break; // don't run away on long sentences
  }

  if (picked.length === 0) return null;
  return titleCase(picked.join(" "));
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export { CATEGORIES };
