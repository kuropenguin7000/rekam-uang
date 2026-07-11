import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { clientDb } from "./firebaseClient";
import {
  CATEGORIES,
  sanitizeCategoriesConfig,
  type CategoriesConfig,
} from "./categories";
import { todayISO } from "./format";
import type { NewTransaction, Transaction, UserCategory } from "./types";

/**
 * Client-side Firestore data layer. Layout:
 *   users/{uid}                      — profile + budgets + category config
 *   users/{uid}/transactions/{id}    — one doc per transaction
 *
 * Access control lives in firestore.rules (each user can only touch their own
 * subtree). `date` stays a yyyy-mm-dd string (lexicographic ordering + all
 * client aggregation depend on it); only `createdAt` is a Timestamp, converted
 * to millis at this boundary.
 */

export interface UserDoc {
  email: string;
  name: string | null;
  image: string | null;
  budget: number;
  dailyBudget: number;
  /** Per-category monthly caps, e.g. { food: 1000000 }. */
  categoryBudgets: Record<string, number>;
  /** Custom categories + built-in rename/hide overrides. */
  categoriesConfig: CategoriesConfig;
}

const DEFAULT_BUDGET = 5_000_000;
/** Firestore batched writes are capped at 500 operations. */
const BATCH_LIMIT = 450;
const MAX_CUSTOM_CATEGORIES = 20;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function userRef(uid: string) {
  return doc(clientDb(), "users", uid);
}

function txCol(uid: string) {
  return collection(clientDb(), "users", uid, "transactions");
}

function sanitizeCategoryBudgets(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      out[k] = Math.round(v);
    }
  }
  return out;
}

function userFromData(data: Record<string, unknown>): UserDoc {
  return {
    email: typeof data.email === "string" ? data.email : "",
    name: typeof data.name === "string" ? data.name : null,
    image: typeof data.image === "string" ? data.image : null,
    budget:
      typeof data.budget === "number" && data.budget >= 0
        ? Math.round(data.budget)
        : DEFAULT_BUDGET,
    dailyBudget:
      typeof data.dailyBudget === "number" && data.dailyBudget >= 0
        ? Math.round(data.dailyBudget)
        : 0,
    categoryBudgets: sanitizeCategoryBudgets(data.categoryBudgets),
    categoriesConfig: sanitizeCategoriesConfig(data.categoriesConfig),
  };
}

function txFromSnap(snap: DocumentSnapshot | QueryDocumentSnapshot): Transaction {
  const d = snap.data() ?? {};
  const created = d.createdAt;
  return {
    id: snap.id,
    amount: typeof d.amount === "number" ? d.amount : 0,
    category: typeof d.category === "string" ? d.category : "other",
    type: d.type === "income" ? "income" : "expense",
    merchant: typeof d.merchant === "string" ? d.merchant : "",
    note: typeof d.note === "string" ? d.note : "",
    date: typeof d.date === "string" ? d.date : "",
    createdAt:
      created instanceof Timestamp
        ? created.toMillis()
        : typeof created === "number"
          ? created
          : 0,
  };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/** Create the user doc with defaults on first sign-in; refresh the profile otherwise. */
export async function ensureUser(
  uid: string,
  profile: { email: string; name?: string | null; image?: string | null }
): Promise<UserDoc> {
  const ref = userRef(uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const docData: UserDoc = {
      email: profile.email,
      name: profile.name ?? null,
      image: profile.image ?? null,
      budget: DEFAULT_BUDGET,
      dailyBudget: 0,
      categoryBudgets: {},
      categoriesConfig: { custom: [], overrides: {} },
    };
    await setDoc(ref, { ...docData, createdAt: Timestamp.now() });
    return docData;
  }
  const existing = userFromData(snap.data() ?? {});
  const next: UserDoc = {
    ...existing,
    email: profile.email || existing.email,
    name: profile.name !== undefined ? (profile.name ?? null) : existing.name,
    image: profile.image !== undefined ? (profile.image ?? null) : existing.image,
  };
  if (
    next.email !== existing.email ||
    next.name !== existing.name ||
    next.image !== existing.image
  ) {
    await updateDoc(ref, { email: next.email, name: next.name, image: next.image });
  }
  return next;
}

export async function getUserDoc(uid: string): Promise<UserDoc | null> {
  const snap = await getDoc(userRef(uid));
  if (!snap.exists()) return null;
  return userFromData(snap.data() ?? {});
}

/**
 * Patch user settings. Uses updateDoc so map fields (categoryBudgets,
 * categoriesConfig) are replaced wholesale — callers always send the full
 * next value, and merge semantics would resurrect deleted keys.
 */
export async function updateUser(
  uid: string,
  patch: Partial<
    Pick<UserDoc, "budget" | "dailyBudget" | "categoryBudgets" | "categoriesConfig">
  >
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  await updateDoc(userRef(uid), patch as Record<string, never>);
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

/**
 * Validate + normalize a draft before writing (the same checks the old API
 * routes enforced): positive integer amount, category from the user's
 * effective list (income is always "other"), length caps, valid date.
 * Returns null if the amount is invalid.
 */
export function sanitizeNewTransaction(
  draft: NewTransaction,
  categories: UserCategory[]
): NewTransaction | null {
  const amount = Math.round(Number(draft.amount));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const type = draft.type === "income" ? "income" : "expense";
  const allowed = new Set(categories.map((c) => c.id));
  const category =
    type === "income"
      ? "other"
      : draft.category && allowed.has(draft.category)
        ? draft.category
        : "other";
  return {
    amount,
    category,
    type,
    merchant: (draft.merchant ?? "").slice(0, 80),
    note: (draft.note ?? "").slice(0, 280),
    date: draft.date && DATE_RE.test(draft.date) ? draft.date : todayISO(),
  };
}

export async function listTransactions(uid: string): Promise<Transaction[]> {
  const snap = await getDocs(
    query(txCol(uid), orderBy("date", "desc"), orderBy("createdAt", "desc"))
  );
  return snap.docs.map(txFromSnap);
}

export async function createTransaction(
  uid: string,
  data: NewTransaction
): Promise<Transaction> {
  const ref = doc(txCol(uid));
  const createdAt = Timestamp.now();
  await setDoc(ref, { ...data, createdAt });
  return { id: ref.id, ...data, createdAt: createdAt.toMillis() };
}

export async function updateTransaction(
  uid: string,
  id: string,
  patch: Partial<NewTransaction>
): Promise<Transaction> {
  const ref = doc(txCol(uid), id);
  await updateDoc(ref, patch);
  return txFromSnap(await getDoc(ref));
}

export async function deleteTransaction(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(txCol(uid), id));
}

/**
 * Reassign every transaction in `fromId` to "other" (custom-category delete).
 * Batched in chunks; runs before the category-config write so a partial
 * failure leaves a retryable state.
 */
async function reassignCategory(uid: string, fromId: string): Promise<void> {
  const snap = await getDocs(query(txCol(uid), where("category", "==", fromId)));
  const db = clientDb();
  for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const d of snap.docs.slice(i, i + BATCH_LIMIT)) {
      batch.update(d.ref, { category: "other" });
    }
    await batch.commit();
  }
}

// ---------------------------------------------------------------------------
// Category management (was /api/categories)
// ---------------------------------------------------------------------------

function genCategoryId(): string {
  return "c_" + Math.random().toString(36).slice(2, 10);
}

async function loadConfig(uid: string): Promise<CategoriesConfig> {
  const docData = await getUserDoc(uid);
  return docData?.categoriesConfig ?? { custom: [], overrides: {} };
}

/** Add a custom category (max 20). */
export async function addCategory(
  uid: string,
  input: { label: string; icon?: string; color?: string }
): Promise<void> {
  const label = input.label.trim().slice(0, 40);
  if (!label) return;
  const config = await loadConfig(uid);
  if (config.custom.length >= MAX_CUSTOM_CATEGORIES) return;
  config.custom.push({
    id: genCategoryId(),
    label,
    icon: (input.icon || "🏷️").slice(0, 8),
    color: typeof input.color === "string" && input.color ? input.color : "#94a3b8",
  });
  await updateUser(uid, { categoriesConfig: config });
}

/** Edit a category. Built-ins: rename + hide only. Custom: label/icon/color. */
export async function updateCategory(
  uid: string,
  id: string,
  patch: { label?: string; icon?: string; color?: string; hidden?: boolean }
): Promise<void> {
  const config = await loadConfig(uid);

  if (id in CATEGORIES) {
    const ov = config.overrides[id] ?? {};
    if (typeof patch.label === "string") {
      const l = patch.label.trim().slice(0, 40);
      if (l) ov.label = l;
      else delete ov.label;
    }
    if (typeof patch.hidden === "boolean") ov.hidden = patch.hidden;
    if (Object.keys(ov).length) config.overrides[id] = ov;
    else delete config.overrides[id];
  } else {
    const c = config.custom.find((x) => x.id === id);
    if (!c) return;
    if (typeof patch.label === "string" && patch.label.trim())
      c.label = patch.label.trim().slice(0, 40);
    if (typeof patch.icon === "string" && patch.icon) c.icon = patch.icon.slice(0, 8);
    if (typeof patch.color === "string" && patch.color) c.color = patch.color;
  }
  await updateUser(uid, { categoriesConfig: config });
}

/** Delete a custom category and reassign its transactions to "other". */
export async function deleteCategory(uid: string, id: string): Promise<void> {
  if (id in CATEGORIES) return; // built-ins can't be deleted
  const config = await loadConfig(uid);
  const idx = config.custom.findIndex((x) => x.id === id);
  if (idx === -1) return;
  config.custom.splice(idx, 1);

  // Transactions first, config last: a partial failure leaves the category
  // still listed, so retrying the delete is safe and picks up the stragglers.
  await reassignCategory(uid, id);
  await updateUser(uid, { categoriesConfig: config });
}
