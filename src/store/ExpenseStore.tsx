"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { onAuthStateChanged } from "firebase/auth";
import { clientAuth } from "@/lib/firebaseClient";
import * as db from "@/lib/firestore";
import type { NewTransaction, Transaction, UserCategory } from "@/lib/types";
import { effectiveCategories, resolveCategory } from "@/lib/categories";

export interface MeUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  budget: number;
  dailyBudget: number;
  /** Per-category monthly caps, e.g. { food: 1000000 }. */
  categoryBudgets: Record<string, number>;
  /** Effective category list (built-ins + overrides + custom). */
  categories: UserCategory[];
}

interface AppState {
  ready: boolean;
  user: MeUser | null;
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
  addExpense: (draft: NewTransaction) => Promise<Transaction | null>;
  updateTransaction: (id: string, patch: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  setBudget: (value: number) => Promise<void>;
  setDailyBudget: (value: number) => Promise<void>;
  setCategoryBudget: (category: string, amount: number) => Promise<void>;
  refresh: () => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

function toMeUser(uid: string, doc: db.UserDoc): MeUser {
  return {
    id: uid,
    email: doc.email,
    name: doc.name,
    image: doc.image,
    budget: doc.budget,
    dailyBudget: doc.dailyBudget,
    categoryBudgets: doc.categoryBudgets,
    categories: effectiveCategories(doc.categoriesConfig),
  };
}

function byDateDesc(a: Transaction, b: Transaction): number {
  return a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1;
}

export function ExpenseProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<MeUser | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budget, setBudgetState] = useState(5_000_000);
  const [dailyBudgetState, setDailyBudgetState] = useState(0);

  const loadFor = useCallback(async (uid: string) => {
    const [doc, txs] = await Promise.all([
      db.getUserDoc(uid),
      db.listTransactions(uid),
    ]);
    if (doc) {
      const me = toMeUser(uid, doc);
      setUser(me);
      setBudgetState(me.budget);
      setDailyBudgetState(me.dailyBudget ?? 0);
    }
    setTransactions(txs);
  }, []);

  const refresh = useCallback(async () => {
    const fbUser = clientAuth().currentUser;
    if (!fbUser) return;
    await loadFor(fbUser.uid);
  }, [loadFor]);

  // The Firebase client SDK session is the session: when it resolves to
  // signed-out, bounce to /login (there is no server middleware on static
  // hosting to do this for us).
  useEffect(() => {
    const unsub = onAuthStateChanged(clientAuth(), async (fbUser) => {
      if (!fbUser) {
        window.location.replace("/login");
        return;
      }
      try {
        const doc = await db.ensureUser(fbUser.uid, {
          email: fbUser.email ?? "",
          name: fbUser.displayName ?? null,
          image: fbUser.photoURL ?? null,
        });
        const me = toMeUser(fbUser.uid, doc);
        setUser(me);
        setBudgetState(me.budget);
        setDailyBudgetState(me.dailyBudget ?? 0);
        setTransactions(await db.listTransactions(fbUser.uid));
      } catch (err) {
        console.error("initial load failed", err);
      }
      setReady(true);
    });
    return unsub;
  }, []);

  const addExpense = useCallback(
    async (draft: NewTransaction): Promise<Transaction | null> => {
      if (!user) return null;
      const clean = db.sanitizeNewTransaction(draft, user.categories);
      if (!clean) return null;
      const transaction = await db.createTransaction(user.id, clean);
      setTransactions((prev) => [transaction, ...prev].sort(byDateDesc));
      return transaction;
    },
    [user]
  );

  const updateTransaction = useCallback(
    async (id: string, patch: Partial<Transaction>) => {
      if (!user) return;
      const clean: Partial<NewTransaction> = {};
      if (patch.amount !== undefined) {
        const amount = Math.round(Number(patch.amount));
        if (!Number.isFinite(amount) || amount <= 0) return;
        clean.amount = amount;
      }
      if (patch.category !== undefined) {
        const allowed = new Set(user.categories.map((c) => c.id));
        clean.category = allowed.has(patch.category) ? patch.category : "other";
      }
      if (patch.merchant !== undefined) clean.merchant = patch.merchant.slice(0, 80);
      if (patch.note !== undefined) clean.note = patch.note.slice(0, 280);
      if (patch.date !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(patch.date)) {
        clean.date = patch.date;
      }
      if (Object.keys(clean).length === 0) return;
      const transaction = await db.updateTransaction(user.id, id, clean);
      setTransactions((prev) =>
        prev.map((t) => (t.id === id ? transaction : t)).sort(byDateDesc)
      );
    },
    [user]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      if (!user) return;
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      await db.deleteTransaction(user.id, id);
    },
    [user]
  );

  const setBudget = useCallback(
    async (value: number) => {
      if (!user) return;
      const v = Math.max(0, Math.round(value));
      setBudgetState(v);
      setUser((u) => (u ? { ...u, budget: v } : u));
      await db.updateUser(user.id, { budget: v });
    },
    [user]
  );

  const setDailyBudget = useCallback(
    async (value: number) => {
      if (!user) return;
      const v = Math.max(0, Math.round(value));
      setDailyBudgetState(v);
      setUser((u) => (u ? { ...u, dailyBudget: v } : u));
      await db.updateUser(user.id, { dailyBudget: v });
    },
    [user]
  );

  const setCategoryBudget = useCallback(
    async (category: string, amount: number) => {
      if (!user) return;
      const v = Math.max(0, Math.round(amount));
      const next = { ...user.categoryBudgets };
      if (v > 0) next[category] = v;
      else delete next[category];
      setUser((u) => (u ? { ...u, categoryBudgets: next } : u));
      // Full map replace — updateUser uses update(), not merge.
      await db.updateUser(user.id, { categoryBudgets: next });
    },
    [user]
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
      if (!user) return;
      await db.addCategory(user.id, { label, icon, color });
      await refresh();
    },
    [user, refresh]
  );
  const updateCategory = useCallback(
    async (
      id: string,
      patch: { label?: string; icon?: string; color?: string; hidden?: boolean }
    ) => {
      if (!user) return;
      await db.updateCategory(user.id, id, patch);
      await refresh();
    },
    [user, refresh]
  );
  const deleteCategory = useCallback(
    async (id: string) => {
      if (!user) return;
      await db.deleteCategory(user.id, id);
      await refresh();
    },
    [user, refresh]
  );

  const value = useMemo<AppState>(
    () => ({
      ready,
      user,
      transactions,
      budget,
      dailyBudget,
      categoryBudgets,
      categories,
      categoryMeta,
      addExpense,
      updateTransaction,
      deleteTransaction,
      setBudget,
      setDailyBudget,
      setCategoryBudget,
      addCategory,
      updateCategory,
      deleteCategory,
      refresh,
    }),
    [
      ready,
      user,
      transactions,
      budget,
      dailyBudget,
      categoryBudgets,
      categories,
      categoryMeta,
      addExpense,
      updateTransaction,
      deleteTransaction,
      setBudget,
      setDailyBudget,
      setCategoryBudget,
      addCategory,
      updateCategory,
      deleteCategory,
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
