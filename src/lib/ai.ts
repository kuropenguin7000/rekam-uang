import "server-only";
import {
  GoogleGenAI,
  Type,
  type Schema,
  type GenerateContentParameters,
  type GenerateContentResponse,
} from "@google/genai";
import { CATEGORY_LIST } from "./categories";
import { generateInsights } from "./insights";
import { parseExpense } from "./parser";
import { todayISO, toISO } from "./format";
import type { CategoryId, Insight, ParsedExpense, Transaction } from "./types";

// Free-tier friendly default. Override with GEMINI_MODEL (e.g.
// gemini-2.5-flash-lite / gemini-2.0-flash-lite) if you hit daily limits.
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const CATEGORY_IDS = CATEGORY_LIST.map((c) => c.id);

// ---------------------------------------------------------------------------
// Multi-key failover
//
// Reads every configured Gemini key (GEMINI_API_KEY, GEMINI_API_KEY_2/_3, and
// an optional comma-separated GEMINI_API_KEYS). When a key hits its quota / rate
// limit (429 / RESOURCE_EXHAUSTED) or is overloaded (503), we roll over to the
// next key and remember it for subsequent requests, so a single exhausted
// free-tier key doesn't take the AI features down.
// ---------------------------------------------------------------------------

function getKeys(): string[] {
  const raw = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    ...(process.env.GEMINI_API_KEYS ?? "").split(","),
  ];
  // de-dupe while preserving order
  return [...new Set(raw.map((k) => (k ?? "").trim()).filter(Boolean))];
}

export function aiEnabled(): boolean {
  return getKeys().length > 0;
}

const clients = new Map<string, GoogleGenAI>();
function clientFor(key: string): GoogleGenAI {
  let c = clients.get(key);
  if (!c) {
    c = new GoogleGenAI({ apiKey: key });
    clients.set(key, c);
  }
  return c;
}

// The key index to try first. Advances to whichever key last worked so we don't
// keep retrying an exhausted one. In-memory only (resets on restart — fine,
// since free-tier quotas reset daily anyway).
let activeKeyIndex = 0;

/**
 * True for errors worth retrying on a different key: quota / rate-limit (429),
 * overload (503), or an unusable key (401/403/invalid) — all of which a
 * different key may resolve. Genuine bad-request errors aren't matched (they'd
 * fail identically on every key).
 */
function isRetryable(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /\b(429|401|403|503)\b|RESOURCE_EXHAUSTED|PERMISSION_DENIED|API[_ ]KEY[_ ]INVALID|api key not valid|quota|exceeded|overloaded|UNAVAILABLE/i.test(
    msg
  );
}

/**
 * Call Gemini, rotating through the configured keys when one is exhausted or
 * overloaded. Returns null when no key is configured; throws only when *every*
 * key fails (callers then fall back to the local engine).
 */
async function generateWithFailover(
  params: GenerateContentParameters
): Promise<GenerateContentResponse | null> {
  const keys = getKeys();
  if (keys.length === 0) return null;

  let lastErr: unknown;
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const idx = (activeKeyIndex + attempt) % keys.length;
    try {
      const res = await clientFor(keys[idx]).models.generateContent(params);
      activeKeyIndex = idx; // remember the key that worked
      return res;
    } catch (e) {
      lastErr = e;
      // Non-quota error (bad request, network): stop and let the caller fall
      // back to local — trying other keys won't help.
      if (!isRetryable(e)) throw e;
      // Otherwise roll over to the next key.
    }
  }
  throw lastErr; // all keys exhausted/overloaded
}

// ---------------------------------------------------------------------------
// Expense parsing
// ---------------------------------------------------------------------------

/**
 * System prompt. Mostly stable, but injects today's date + weekday so the model
 * can resolve relative dates ("kemarin", "senin kemarin", "3 hari lalu", …) to
 * an absolute calendar date.
 */
function parseSystem(): string {
  const now = new Date();
  const today = toISO(now);
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
  return `You extract a single transaction from a short Indonesian/English message.
Currency is Indonesian Rupiah. Interpret "k"/"rb"/"ribu" as thousands and "jt"/"juta" as millions (e.g. "50k" = 50000, "1.5jt" = 1500000).
Return the amount as a plain integer in rupiah. Set confidence 0-1.
Classify "kind": income (money IN) vs expense (money OUT). Income cues: gaji/salary/THR/bonus/komisi/honor/fee/refund/cashback/bunga/dividen/penjualan/"uang masuk"/"transfer masuk". Otherwise expense.
For an EXPENSE: pick the closest category and extract the merchant if named (after "at"/"di"/"from"). For INCOME: set category "other" and put the source (after "dari"/"from") in merchant. Never include the amount or date words in the merchant.
Today is ${weekday}, ${today}. Resolve any date the user mentions to an absolute yyyy-mm-dd (never in the future):
- "hari ini"/"today" = today; "kemarin"/"yesterday" = today-1; "kemarin lusa" = today-2; "N hari lalu"/"N days ago" = today-N.
- A weekday name, optionally with "kemarin"/"lalu" (e.g. "senin kemarin", "last Monday") = the most recent PAST occurrence of that weekday strictly before today.
- "minggu lalu"/"last week" = today-7. A bare date like "3 Juni" = that day in the current year.
If no date is mentioned, use today.`;
}

const PARSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    amount: { type: Type.INTEGER, description: "Amount in rupiah" },
    kind: { type: Type.STRING, enum: ["expense", "income"] },
    category: { type: Type.STRING, enum: CATEGORY_IDS },
    merchant: { type: Type.STRING },
    date: { type: Type.STRING, description: "Transaction date as yyyy-mm-dd" },
    confidence: { type: Type.NUMBER },
  },
  required: ["amount", "category", "confidence"],
  // Keeps Gemini's JSON key order stable, which is cheaper to emit.
  propertyOrdering: ["amount", "kind", "category", "merchant", "date", "confidence"],
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Accept the model's date only if it's a real yyyy-mm-dd, else fall back to today. */
function resolveDate(value?: string): string {
  if (typeof value === "string" && ISO_DATE_RE.test(value)) {
    const d = new Date(value + "T00:00:00");
    if (!Number.isNaN(d.getTime())) return value;
  }
  return todayISO();
}

/**
 * Parse one expense message. Uses Gemini (with key failover) when any key is
 * configured, otherwise the local regex parser — both return the same
 * {@link ParsedExpense}. Any error or full quota exhaustion degrades gracefully
 * to the local parser, which also handles relative dates.
 */
export async function parseExpenseAI(text: string): Promise<ParsedExpense | null> {
  try {
    const res = await generateWithFailover({
      model: MODEL,
      contents: text,
      config: {
        systemInstruction: parseSystem(),
        responseMimeType: "application/json",
        responseSchema: PARSE_SCHEMA,
        temperature: 0,
        maxOutputTokens: 200,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    if (!res) return parseExpense(text); // no keys configured

    const input = JSON.parse(res.text ?? "{}") as {
      amount?: number;
      kind?: string;
      category?: string;
      merchant?: string;
      date?: string;
      confidence?: number;
    };
    if (typeof input.amount !== "number" || input.amount <= 0) {
      return parseExpense(text);
    }
    const isIncome = input.kind === "income";
    const category = (
      isIncome
        ? "other"
        : CATEGORY_IDS.includes(input.category as CategoryId)
          ? input.category
          : "other"
    ) as CategoryId;
    return {
      amount: Math.round(input.amount),
      category,
      type: isIncome ? "income" : "expense",
      merchant: (input.merchant ?? "").trim(),
      note: text,
      date: resolveDate(input.date),
      confidence:
        typeof input.confidence === "number"
          ? Math.max(0, Math.min(1, input.confidence))
          : 0.8,
    };
  } catch {
    // network / all-keys-exhausted / parse failure — degrade to local parser
    return parseExpense(text);
  }
}

// ---------------------------------------------------------------------------
// Spending analysis
// ---------------------------------------------------------------------------

const INSIGHTS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    insights: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          kind: { type: Type.STRING, enum: ["warning", "tip", "positive"] },
          title: { type: Type.STRING },
          detail: { type: Type.STRING },
          estimatedSaving: { type: Type.INTEGER },
        },
        required: ["kind", "title", "detail"],
        propertyOrdering: ["kind", "title", "detail", "estimatedSaving"],
      },
    },
  },
  required: ["insights"],
};

const LANGUAGE_NAME: Record<string, string> = {
  id: "Indonesian",
  en: "English",
};

function analyzeSystem(locale: string): string {
  const language = LANGUAGE_NAME[locale] ?? "Indonesian";
  return `You are a frugal personal-finance assistant.
Given a compact spending summary (amounts in Indonesian rupiah), return 2-4 concrete, friendly insights written in ${language}.
Flag spikes, subscription traps and savings chances; include an estimatedSaving (rupiah) when relevant. Be specific and concise.`;
}

/**
 * Generate "Analyze My Spending" insights. Sends a *pre-aggregated* compact
 * summary (not raw rows) to keep the prompt small, uses key failover, then falls
 * back to the local engine on any failure or when no API key is configured.
 * `locale` controls the language Gemini writes the insights in.
 */
export async function analyzeSpendingAI(
  transactions: Transaction[],
  budget: number,
  locale = "id"
): Promise<Insight[]> {
  const lang = locale === "en" ? "en" : "id";

  try {
    const summary = buildSummary(transactions, budget);
    const res = await generateWithFailover({
      model: MODEL,
      contents: JSON.stringify(summary),
      config: {
        systemInstruction: analyzeSystem(locale),
        responseMimeType: "application/json",
        responseSchema: INSIGHTS_SCHEMA,
        temperature: 0.4,
        maxOutputTokens: 900,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    if (!res) return generateInsights(transactions, budget, lang);

    const input = JSON.parse(res.text ?? "{}") as {
      insights?: Array<{
        kind?: string;
        title?: string;
        detail?: string;
        estimatedSaving?: number;
      }>;
    };
    if (!Array.isArray(input.insights) || input.insights.length === 0) {
      return generateInsights(transactions, budget, lang);
    }
    return input.insights.map((i, idx) => ({
      id: `ai-${idx}`,
      kind: i.kind === "warning" || i.kind === "positive" ? i.kind : "tip",
      title: i.title ?? "Insight",
      detail: i.detail ?? "",
      estimatedSaving:
        typeof i.estimatedSaving === "number" ? i.estimatedSaving : undefined,
    }));
  } catch {
    return generateInsights(transactions, budget, lang);
  }
}

/** Compact aggregation sent to the model instead of every transaction row. */
function buildSummary(transactions: Transaction[], budget: number) {
  const byCat: Record<string, number> = {};
  const byMerchant: Record<string, { total: number; count: number }> = {};
  let total = 0;
  for (const t of transactions) {
    byCat[t.category] = (byCat[t.category] ?? 0) + t.amount;
    total += t.amount;
    if (t.merchant) {
      const m = byMerchant[t.merchant] ?? { total: 0, count: 0 };
      m.total += t.amount;
      m.count += 1;
      byMerchant[t.merchant] = m;
    }
  }
  // only merchants seen 2+ times matter for subscription/recurring detection
  const recurring = Object.entries(byMerchant)
    .filter(([, v]) => v.count >= 2)
    .map(([name, v]) => ({ name, total: v.total, count: v.count }));
  return {
    currency: "IDR",
    monthlyBudget: budget,
    totalSpent: total,
    byCategory: byCat,
    recurringMerchants: recurring,
    transactionCount: transactions.length,
  };
}
