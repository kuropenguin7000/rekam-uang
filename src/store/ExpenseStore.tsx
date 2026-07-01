"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Entitlements, PlanId, Role } from "@/lib/plans";
import type {
  Insight,
  ParsedExpense,
  Transaction,
  UserCategory,
} from "@/lib/types";
import { effectiveCategories, resolveCategory } from "@/lib/categories";

export interface MeUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: Role;
  plan: PlanId;
  budget: number;
  dailyBudget: number;
  /** ISO string for when the paid period ends, or null. */
  planExpiresAt: string | null;
  /** Per-category monthly caps, e.g. { food: 1000000 }. */
  categoryBudgets: Record<string, number>;
  /** Effective category list (built-ins + overrides + custom). */
  categories: UserCategory[];
}

export interface UsageInfo {
  parse: { used: number; limit: number };
  analyze: { used: number; limit: number };
}

interface ParseResult {
  draft?: ParsedExpense;
  error?: string;
  message?: string;
}

interface AnalyzeResult {
  insights?: Insight[];
  error?: string;
  message?: string;
}

interface AppState {
  ready: boolean;
  user: MeUser | null;
  entitlements: Entitlements | null;
  usage: UsageInfo | null;
  aiEnabled: boolean;
  transactions: Transaction[];
  budget: number;
  /** effective daily budget threshold (explicit setting, or budget/30) */
  dailyBudget: number;
  /** per-category monthly caps */
  categoryBudgets: Record<string, number>;
  /** effective category list (built-ins + overrides + custom) */
  categories: UserCategory[];
  /** resolve a category id (built-in/custom) to its meta, fallback "other" */
  categoryMeta: (id: string) => UserCategory;
  addCategory: (label: string, icon: string, color: string) => Promise<void>;
  updateCategory: (
    id: string,
    patch: { label?: string; icon?: string; color?: string; hidden?: boolean }
  ) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  /** last generated AI insights, kept across tab switches */
  insights: Insight[] | null;
  addExpense: (draft: ParsedExpense) => Promise<Transaction | null>;
  updateTransaction: (id: string, patch: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  setBudget: (value: number) => Promise<void>;
  setDailyBudget: (value: number) => Promise<void>;
  setCategoryBudget: (category: string, amount: number) => Promise<void>;
  parse: (text: string) => Promise<ParseResult>;
  analyze: () => Promise<AnalyzeResult>;
  refresh: () => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

export function ExpenseProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<MeUser | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budget, setBudgetState] = useState(5_000_000);
  const [dailyBudgetState, setDailyBudgetState] = useState(0);
  const [insights, setInsights] = useState<Insight[] | null>(null);

  const loadMe = useCallback(async () => {
    const res = await fetch("/api/me", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setUser(data.user);
    setEntitlements(data.entitlements);
    setUsage(data.usage);
    setAiEnabled(data.aiEnabled);
    setBudgetState(data.user.budget);
    setDailyBudgetState(data.user.dailyBudget ?? 0);
  }, []);

  const loadTransactions = useCallback(async () => {
    const res = await fetch("/api/transactions", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setTransactions(data.transactions);
  }, []);

  // Reload the last analysis from the server cache so Wawasan survives full
  // navigation to /pricing or /account (which unmount this provider).
  const loadInsights = useCallback(async () => {
    const res = await fetch("/api/analyze", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setInsights(data.insights ?? null);
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([loadMe(), loadTransactions(), loadInsights()]);
  }, [loadMe, loadTransactions, loadInsights]);

  useEffect(() => {
    refresh().finally(() => setReady(true));
  }, [refresh]);

  const addExpense = useCallback(
    async (draft: ParsedExpense): Promise<Transaction | null> => {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: draft.amount,
          category: draft.category,
          type: draft.type,
          merchant: draft.merchant,
          note: draft.note,
          date: draft.date,
        }),
      });
      if (!res.ok) return null;
      const { transaction } = await res.json();
      setTransactions((prev) => [transaction, ...prev]);
      return transaction;
    },
    []
  );

  const updateTransaction = useCallback(
    async (id: string, patch: Partial<Transaction>) => {
      const res = await fetch(`/api/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) return;
      const { transaction } = await res.json();
      setTransactions((prev) =>
        prev
          .map((t) => (t.id === id ? transaction : t))
          .sort((a, b) =>
            a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1
          )
      );
    },
    []
  );

  const deleteTransaction = useCallback(async (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
  }, []);

  const setBudget = useCallback(async (value: number) => {
    const v = Math.max(0, Math.round(value));
    setBudgetState(v);
    setUser((u) => (u ? { ...u, budget: v } : u));
    await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ budget: v }),
    });
  }, []);

  const setDailyBudget = useCallback(async (value: number) => {
    const v = Math.max(0, Math.round(value));
    setDailyBudgetState(v);
    setUser((u) => (u ? { ...u, dailyBudget: v } : u));
    await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dailyBudget: v }),
    });
  }, []);

  const setCategoryBudget = useCallback(
    async (category: string, amount: number) => {
      const v = Math.max(0, Math.round(amount));
      setUser((u) => {
        if (!u) return u;
        const next = { ...u.categoryBudgets };
        if (v > 0) next[category] = v;
        else delete next[category];
        return { ...u, categoryBudgets: next };
      });
      await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryBudgets: { [category]: v } }),
      });
    },
    []
  );

  // effective threshold: explicit setting, or auto = monthly / 30
  const dailyBudget = dailyBudgetState > 0 ? dailyBudgetState : budget / 30;
  const categoryBudgets = user?.categoryBudgets ?? {};
  const categories = user?.categories ?? effectiveCategories(null);
  const categoryMeta = useCallback(
    (id: string) => resolveCategory(id, categories),
    [categories]
  );

  const addCategory = useCallback(
    async (label: string, icon: string, color: string) => {
      await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, icon, color }),
      });
      await refresh();
    },
    [refresh]
  );
  const updateCategory = useCallback(
    async (
      id: string,
      patch: { label?: string; icon?: string; color?: string; hidden?: boolean }
    ) => {
      await fetch("/api/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      await refresh();
    },
    [refresh]
  );
  const deleteCategory = useCallback(
    async (id: string) => {
      await fetch("/api/categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await refresh();
    },
    [refresh]
  );

  const parse = useCallback(async (text: string): Promise<ParseResult> => {
    const res = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.usage) {
      setUsage((u) => (u ? { ...u, parse: data.usage } : u));
    }
    if (!res.ok) {
      return { error: data.error ?? "error", message: data.message };
    }
    return { draft: data.draft };
  }, []);

  const analyze = useCallback(async (): Promise<AnalyzeResult> => {
    const res = await fetch("/api/analyze", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.usage) {
      setUsage((u) => (u ? { ...u, analyze: data.usage } : u));
    }
    if (!res.ok) {
      return { error: data.error ?? "error", message: data.message };
    }
    setInsights(data.insights ?? []);
    return { insights: data.insights };
  }, []);

  const value = useMemo<AppState>(
    () => ({
      ready,
      user,
      entitlements,
      usage,
      aiEnabled,
      transactions,
      budget,
      dailyBudget,
      categoryBudgets,
      categories,
      categoryMeta,
      insights,
      addExpense,
      updateTransaction,
      deleteTransaction,
      setBudget,
      setDailyBudget,
      setCategoryBudget,
      addCategory,
      updateCategory,
      deleteCategory,
      parse,
      analyze,
      refresh,
    }),
    [
      ready,
      user,
      entitlements,
      usage,
      aiEnabled,
      transactions,
      budget,
      dailyBudget,
      categoryBudgets,
      categories,
      categoryMeta,
      insights,
      addExpense,
      updateTransaction,
      deleteTransaction,
      setBudget,
      setDailyBudget,
      setCategoryBudget,
      addCategory,
      updateCategory,
      deleteCategory,
      parse,
      analyze,
      refresh,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useExpenses(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useExpenses must be used within an ExpenseProvider");
  }
  return ctx;
}
