"use client";

import { useCallback, useMemo, useState } from "react";
import { AppContext, type AppState, type MeUser } from "./ExpenseStore";
import {
  effectiveCategories,
  resolveCategory,
  type CategoriesConfig,
} from "@/lib/categories";
import {
  effectiveMembers,
  resolveMember,
  type MembersConfig,
} from "@/lib/members";
import type {
  Commitment,
  CommitmentDraft,
  NewTransaction,
  Transaction,
} from "@/lib/types";
import { todayISO, toISO } from "@/lib/format";
import {
  LIMITS,
  MAX_AMOUNT,
  safeAmount,
  safeColor,
  safeCount,
  safeDate as guardDate,
  safeSchedule,
  safeText,
} from "@/lib/demoGuards";

export { LIMITS } from "@/lib/demoGuards";

/**
 * The landing page's playable demo, backed entirely by React state.
 *
 * ## Why in-memory, and why that IS the security design
 *
 * This provider deliberately imports nothing from `firebase/*` or
 * `@/lib/firestore`. An anonymous visitor therefore cannot reach the database
 * at all, which closes the only attack that actually matters here: the app
 * runs on Firebase's free Spark tier with a hard daily quota, so a demo that
 * wrote to Firestore would let anyone exhaust that quota and take the real
 * app down for its actual user. There is no backend behind this demo to
 * overload, no credentials to abuse, and no rules to probe.
 *
 * What remains is only what a visitor can do to their own browser tab, so the
 * rest of the hardening is about bounding that:
 *
 * - every list has a hard cap (see LIMITS) enforced on insert, so the demo
 *   cannot be grown until the tab dies;
 * - every number is clamped to a positive, finite, sane integer — NaN,
 *   Infinity and 1e308 all collapse to a rejected write;
 * - every string is trimmed and length-capped before it enters state;
 * - nothing is persisted: no localStorage, no sessionStorage, no cookies, so
 *   the demo cannot pollute the real app's stored state (notably the theme,
 *   the locale and `sw_signed_in`) or survive a reload.
 *
 * Text is rendered by React, which escapes it, and no demo value is ever fed
 * to `dangerouslySetInnerHTML` — so a visitor typing a `<script>` tag as a
 * merchant name gets a merchant literally named "<script>".
 */

const safeDate = (v: unknown) => guardDate(v, todayISO());

/** Ids are local and monotonic — no crypto, no collisions, no persistence. */
let seq = 0;
const nextId = (prefix: string) => `${prefix}_${++seq}`;

// ---------------------------------------------------------------------------
// Seed data — relative to today, so the demo always looks current
// ---------------------------------------------------------------------------

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISO(d);
}

function seedTransactions(): Transaction[] {
  const rows: [number, number, string, string, string][] = [
    [0, 38_000, "food", "shared", "Warung Padang"],
    [0, 25_000, "transport", "father", "Gojek"],
    [1, 187_500, "groceries", "mother", "Indomaret"],
    [1, 55_000, "food", "kids", "Es teh & martabak"],
    [2, 320_000, "shopping", "mother", "Shopee"],
    [3, 100_000, "transport", "father", "Bensin"],
    [4, 45_000, "food", "shared", "Kopi Kenangan"],
    [5, 1_250_000, "bills", "shared", "Listrik & air"],
    [6, 89_000, "entertainment", "kids", "Netflix patungan"],
    [8, 210_000, "health", "mother", "Apotek"],
    [9, 67_500, "food", "father", "Sate ayam"],
    [11, 430_000, "groceries", "mother", "Superindo"],
    [13, 150_000, "transport", "shared", "Servis motor"],
    [15, 75_000, "entertainment", "kids", "Bioskop"],
    [18, 95_000, "food", "shared", "Bakso malam"],
  ];
  return rows.map(([ago, amount, category, member, merchant], i) => ({
    id: nextId("tx"),
    amount,
    category,
    member,
    type: "expense" as const,
    merchant,
    note: "",
    date: daysAgo(ago),
    createdAt: Date.now() - i * 60_000,
  }));
}

function seedCommitments(): Commitment[] {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const shift = (delta: number) => {
    const o = now.getFullYear() * 12 + now.getMonth() + delta;
    return `${Math.floor(o / 12)}-${String((o % 12) + 1).padStart(2, "0")}`;
  };

  return [
    {
      id: nextId("com"),
      kind: "subscription",
      name: "YouTube Premium",
      amount: 59_000,
      cycle: "monthly",
      startDate: shift(-8) + "-05",
      introAmount: 0,
      introPeriods: 0,
      tenor: 0,
      schedule: {},
      category: "entertainment",
      member: "shared",
      note: "",
      active: true,
      createdAt: Date.now(),
    },
    {
      id: nextId("com"),
      kind: "subscription",
      name: "Claude Pro",
      amount: 300_000,
      cycle: "monthly",
      // Promo still running, so the outlook shows the price cliff.
      startDate: thisMonth + "-01",
      introAmount: 150_000,
      introPeriods: 3,
      tenor: 0,
      schedule: {},
      category: "bills",
      member: "father",
      note: "",
      active: true,
      createdAt: Date.now(),
    },
    {
      id: nextId("com"),
      kind: "installment",
      name: "iPhone — Shopee PayLater",
      amount: 1_150_000,
      cycle: "monthly",
      startDate: shift(-2) + "-10",
      introAmount: 0,
      introPeriods: 0,
      tenor: 12,
      schedule: {},
      category: "shopping",
      member: "mother",
      note: "",
      active: true,
      createdAt: Date.now(),
    },
    {
      id: nextId("com"),
      kind: "installment",
      name: "Uang masuk sekolah",
      amount: 5_000_000,
      cycle: "monthly",
      startDate: shift(0) + "-01",
      introAmount: 0,
      introPeriods: 0,
      tenor: 6,
      // A stepped plan that skips a month — the shape a real invoice has.
      schedule: {
        [shift(0)]: 5_000_000,
        [shift(2)]: 2_500_000,
        [shift(3)]: 2_500_000,
        [shift(4)]: 2_000_000,
        [shift(5)]: 2_000_000,
        [shift(6)]: 1_100_000,
      },
      category: "other",
      member: "kids",
      note: "",
      active: true,
      createdAt: Date.now(),
    },
  ];
}

const DEMO_USER: MeUser = {
  id: "demo",
  email: "demo@rekamuang.app",
  name: "Demo",
  image: null,
  budget: 8_000_000,
  dailyBudget: 0,
  salary: 15_000_000,
  categoryBudgets: { food: 2_000_000, transport: 1_000_000, groceries: 2_500_000 },
  categories: effectiveCategories(null),
  members: effectiveMembers(null),
};

function byDateDesc(a: Transaction, b: Transaction): number {
  return a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1;
}

// ---------------------------------------------------------------------------

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    seedTransactions().sort(byDateDesc)
  );
  const [commitments, setCommitments] = useState<Commitment[]>(() => seedCommitments());
  const [budget, setBudgetState] = useState(DEMO_USER.budget);
  const [dailyBudgetState, setDailyBudgetState] = useState(0);
  const [salary, setSalaryState] = useState(DEMO_USER.salary);
  const [categoryBudgets, setCategoryBudgets] = useState(DEMO_USER.categoryBudgets);
  const [catConfig, setCatConfig] = useState<CategoriesConfig>({
    custom: [],
    overrides: {},
  });
  const [memConfig, setMemConfig] = useState<MembersConfig>({
    custom: [],
    overrides: {},
  });

  const categories = useMemo(() => effectiveCategories(catConfig), [catConfig]);
  const members = useMemo(() => effectiveMembers(memConfig), [memConfig]);

  const categoryMeta = useCallback(
    (id: string) => resolveCategory(id, categories),
    [categories]
  );
  const memberMeta = useCallback((id: string) => resolveMember(id, members), [members]);

  // ---- transactions ------------------------------------------------------

  const addExpense = useCallback(
    async (draft: NewTransaction): Promise<Transaction | null> => {
      const amount = safeAmount(draft.amount);
      if (amount <= 0) return null;
      let created: Transaction | null = null;
      setTransactions((prev) => {
        if (prev.length >= LIMITS.transactions) return prev; // cap: silently full
        const allowedCat = new Set(categories.map((c) => c.id));
        const allowedMem = new Set(members.map((m) => m.id));
        created = {
          id: nextId("tx"),
          amount,
          category: allowedCat.has(draft.category) ? draft.category : "other",
          member: allowedMem.has(draft.member) ? draft.member : "",
          type: "expense",
          merchant: safeText(draft.merchant, 80),
          note: safeText(draft.note, 280),
          date: safeDate(draft.date),
          createdAt: Date.now(),
        };
        return [created, ...prev].sort(byDateDesc);
      });
      return created;
    },
    [categories, members]
  );

  const updateTransaction = useCallback(
    async (id: string, patch: Partial<Transaction>) => {
      setTransactions((prev) =>
        prev
          .map((t) => {
            if (t.id !== id) return t;
            const next = { ...t };
            if (patch.amount !== undefined) {
              const a = safeAmount(patch.amount);
              if (a > 0) next.amount = a;
            }
            if (patch.category !== undefined) {
              next.category = categories.some((c) => c.id === patch.category)
                ? patch.category
                : "other";
            }
            if (patch.member !== undefined) {
              next.member = members.some((m) => m.id === patch.member)
                ? patch.member
                : "";
            }
            if (patch.merchant !== undefined)
              next.merchant = safeText(patch.merchant, 80);
            if (patch.note !== undefined) next.note = safeText(patch.note, 280);
            if (patch.date !== undefined) next.date = safeDate(patch.date);
            return next;
          })
          .sort(byDateDesc)
      );
    },
    [categories, members]
  );

  const deleteTransaction = useCallback(async (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ---- commitments -------------------------------------------------------

  /** Clamp a draft the same way firestore.ts would, minus the network. */
  const cleanCommitment = useCallback((d: CommitmentDraft): CommitmentDraft | null => {
    const name = safeText(d.name, 60);
    const amount = safeAmount(d.amount);
    if (!name || amount <= 0) return null;

    const kind = d.kind === "installment" ? "installment" : "subscription";
    const schedule = kind === "installment" ? safeSchedule(d.schedule) : {};
    const scheduled = Object.keys(schedule).length;

    return {
      kind,
      name,
      amount,
      cycle: kind === "installment" || d.cycle !== "yearly" ? "monthly" : "yearly",
      startDate: scheduled
        ? Object.keys(schedule).sort()[0] + "-01"
        : safeDate(d.startDate),
      introAmount:
        kind === "subscription" && d.introPeriods > 0 ? safeAmount(d.introAmount) : 0,
      introPeriods: kind === "subscription" ? safeCount(d.introPeriods, 0, 60) : 0,
      tenor:
        kind === "installment" ? scheduled || safeCount(d.tenor, 1, 120) : 0,
      schedule,
      category: categories.some((c) => c.id === d.category) ? d.category : "other",
      member: members.some((m) => m.id === d.member) ? d.member : "",
      note: safeText(d.note, 280),
      active: d.active !== false,
    };
  }, [categories, members]);

  const addCommitment = useCallback(
    async (draft: CommitmentDraft) => {
      const clean = cleanCommitment(draft);
      if (!clean) return;
      setCommitments((prev) =>
        prev.length >= LIMITS.commitments
          ? prev
          : [...prev, { ...clean, id: nextId("com"), createdAt: Date.now() }]
      );
    },
    [cleanCommitment]
  );

  const updateCommitment = useCallback(
    async (id: string, draft: CommitmentDraft) => {
      const clean = cleanCommitment(draft);
      if (!clean) return;
      setCommitments((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...clean } : c))
      );
    },
    [cleanCommitment]
  );

  const deleteCommitment = useCallback(async (id: string) => {
    setCommitments((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // ---- settings ----------------------------------------------------------

  const setBudget = useCallback(async (v: number) => setBudgetState(safeAmount(v)), []);
  const setDailyBudget = useCallback(async (v: number) => {
    const n = Math.round(Number(v));
    setDailyBudgetState(Number.isFinite(n) && n > 0 ? Math.min(n, MAX_AMOUNT) : 0);
  }, []);
  const setSalary = useCallback(async (v: number) => setSalaryState(safeAmount(v)), []);

  const setCategoryBudget = useCallback(async (category: string, amount: number) => {
    const v = safeAmount(amount);
    setCategoryBudgets((prev) => {
      const next = { ...prev };
      if (v > 0) next[safeText(category, 40)] = v;
      else delete next[category];
      return next;
    });
  }, []);

  // ---- categories & members ---------------------------------------------

  const addCategory = useCallback(
    async (label: string, icon: string, color: string) => {
      const l = safeText(label, 40);
      if (!l) return;
      setCatConfig((prev) =>
        prev.custom.length >= LIMITS.customCategories
          ? prev
          : {
              ...prev,
              custom: [
                ...prev.custom,
                {
                  id: nextId("c"),
                  label: l,
                  icon: safeText(icon, 8) || "🏷️",
                  color: safeColor(color),
                },
              ],
            }
      );
    },
    []
  );

  const updateCategory = useCallback(
    async (
      id: string,
      patch: { label?: string; icon?: string; color?: string; hidden?: boolean }
    ) => {
      setCatConfig((prev) => {
        const next: CategoriesConfig = {
          custom: prev.custom.map((c) => ({ ...c })),
          overrides: { ...prev.overrides },
        };
        const builtin = !id.startsWith("c_");
        if (builtin) {
          const ov = { ...(next.overrides[id] ?? {}) };
          if (patch.label !== undefined) {
            const l = safeText(patch.label, 40);
            if (l) ov.label = l;
            else delete ov.label;
          }
          if (patch.icon !== undefined) {
            const ic = safeText(patch.icon, 8);
            if (ic) ov.icon = ic;
            else delete ov.icon;
          }
          if (typeof patch.hidden === "boolean") ov.hidden = patch.hidden;
          if (Object.keys(ov).length) next.overrides[id] = ov;
          else delete next.overrides[id];
        } else {
          const c = next.custom.find((x) => x.id === id);
          if (c) {
            if (patch.label !== undefined) c.label = safeText(patch.label, 40) || c.label;
            if (patch.icon !== undefined) c.icon = safeText(patch.icon, 8) || c.icon;
            if (patch.color !== undefined) c.color = safeColor(patch.color, c.color);
          }
        }
        return next;
      });
    },
    []
  );

  const deleteCategory = useCallback(async (id: string) => {
    if (!id.startsWith("c_")) return; // built-ins can't be deleted, same as real
    setCatConfig((prev) => ({
      ...prev,
      custom: prev.custom.filter((c) => c.id !== id),
    }));
    // Mirror the real reassign so the totals stay consistent.
    setTransactions((prev) =>
      prev.map((t) => (t.category === id ? { ...t, category: "other" } : t))
    );
    setCommitments((prev) =>
      prev.map((c) => (c.category === id ? { ...c, category: "other" } : c))
    );
  }, []);

  const addMember = useCallback(async (label: string, icon: string) => {
    const l = safeText(label, 40);
    if (!l) return;
    setMemConfig((prev) =>
      prev.custom.length >= LIMITS.customMembers
        ? prev
        : {
            ...prev,
            custom: [
              ...prev.custom,
              { id: nextId("m"), label: l, icon: safeText(icon, 8) || "🧑" },
            ],
          }
    );
  }, []);

  const updateMember = useCallback(
    async (id: string, patch: { label?: string; icon?: string; hidden?: boolean }) => {
      setMemConfig((prev) => {
        const next: MembersConfig = {
          custom: prev.custom.map((m) => ({ ...m })),
          overrides: { ...prev.overrides },
        };
        const builtin = !id.startsWith("m_");
        if (builtin) {
          const ov = { ...(next.overrides[id] ?? {}) };
          if (patch.label !== undefined) {
            const l = safeText(patch.label, 40);
            if (l) ov.label = l;
            else delete ov.label;
          }
          if (patch.icon !== undefined) {
            const ic = safeText(patch.icon, 8);
            if (ic) ov.icon = ic;
            else delete ov.icon;
          }
          if (typeof patch.hidden === "boolean") ov.hidden = patch.hidden;
          if (Object.keys(ov).length) next.overrides[id] = ov;
          else delete next.overrides[id];
        } else {
          const m = next.custom.find((x) => x.id === id);
          if (m) {
            if (patch.label !== undefined) m.label = safeText(patch.label, 40) || m.label;
            if (patch.icon !== undefined) m.icon = safeText(patch.icon, 8) || m.icon;
          }
        }
        return next;
      });
    },
    []
  );

  const deleteMember = useCallback(async (id: string) => {
    if (!id.startsWith("m_")) return;
    setMemConfig((prev) => ({
      ...prev,
      custom: prev.custom.filter((m) => m.id !== id),
    }));
    setTransactions((prev) =>
      prev.map((t) => (t.member === id ? { ...t, member: "shared" } : t))
    );
  }, []);

  const refresh = useCallback(async () => {
    /* Nothing to refresh: there is no server behind the demo. */
  }, []);

  const user = useMemo<MeUser>(
    () => ({
      ...DEMO_USER,
      budget,
      dailyBudget: dailyBudgetState,
      salary,
      categoryBudgets,
      categories,
      members,
    }),
    [budget, dailyBudgetState, salary, categoryBudgets, categories, members]
  );

  const value = useMemo<AppState>(
    () => ({
      ready: true,
      demo: true,
      user,
      transactions,
      commitments,
      addCommitment,
      updateCommitment,
      deleteCommitment,
      budget,
      dailyBudget: dailyBudgetState > 0 ? dailyBudgetState : budget / 30,
      salary,
      setSalary,
      categoryBudgets,
      categories,
      categoryMeta,
      members,
      memberMeta,
      addExpense,
      updateTransaction,
      deleteTransaction,
      setBudget,
      setDailyBudget,
      setCategoryBudget,
      addCategory,
      updateCategory,
      deleteCategory,
      addMember,
      updateMember,
      deleteMember,
      refresh,
    }),
    [
      user,
      transactions,
      commitments,
      addCommitment,
      updateCommitment,
      deleteCommitment,
      budget,
      dailyBudgetState,
      salary,
      setSalary,
      categoryBudgets,
      categories,
      categoryMeta,
      members,
      memberMeta,
      addExpense,
      updateTransaction,
      deleteTransaction,
      setBudget,
      setDailyBudget,
      setCategoryBudget,
      addCategory,
      updateCategory,
      deleteCategory,
      addMember,
      updateMember,
      deleteMember,
      refresh,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
