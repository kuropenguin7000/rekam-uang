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
import {
  MEMBERS,
  sanitizeMembersConfig,
  type MembersConfig,
} from "./members";
import { todayISO } from "./format";
import type {
  BillingCycle,
  Commitment,
  CommitmentDraft,
  NewTransaction,
  Transaction,
  UserCategory,
  UserMember,
} from "./types";

/**
 * Client-side Firestore data layer. Layout:
 *   users/{uid}                      — profile + budgets + category config
 *   users/{uid}/transactions/{id}    — one doc per transaction
 *   users/{uid}/commitments/{id}     — one doc per subscription / instalment
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
  /**
   * Monthly take-home pay. Purely the denominator for "what's left after my
   * fixed commitments" — it is NOT income tracking (that stays removed); no
   * transaction is ever written from it. 0 means "not told us".
   */
  salary: number;
  /** Per-category monthly caps, e.g. { food: 1000000 }. */
  categoryBudgets: Record<string, number>;
  /** Custom categories + built-in rename/hide overrides. */
  categoriesConfig: CategoriesConfig;
  /** Custom family members + built-in rename/hide overrides. */
  membersConfig: MembersConfig;
}

const DEFAULT_BUDGET = 5_000_000;
/** Firestore batched writes are capped at 500 operations. */
const BATCH_LIMIT = 450;
const MAX_CUSTOM_CATEGORIES = 20;
const MAX_CUSTOM_MEMBERS = 20;
/** Caps mirrored in firestore.rules; a household has tens, not thousands. */
const MAX_TENOR = 600;
const MAX_INTRO_PERIODS = 120;
const MAX_SCHEDULE_ENTRIES = 120;
const MONTH_RE = /^\d{4}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function userRef(uid: string) {
  return doc(clientDb(), "users", uid);
}

function txCol(uid: string) {
  return collection(clientDb(), "users", uid, "transactions");
}

function commitmentCol(uid: string) {
  return collection(clientDb(), "users", uid, "commitments");
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
    salary:
      typeof data.salary === "number" && data.salary >= 0
        ? Math.round(data.salary)
        : 0,
    categoryBudgets: sanitizeCategoryBudgets(data.categoryBudgets),
    categoriesConfig: sanitizeCategoriesConfig(data.categoriesConfig),
    membersConfig: sanitizeMembersConfig(data.membersConfig),
  };
}

function txFromSnap(snap: DocumentSnapshot | QueryDocumentSnapshot): Transaction {
  const d = snap.data() ?? {};
  const created = d.createdAt;
  return {
    id: snap.id,
    amount: typeof d.amount === "number" ? d.amount : 0,
    category: typeof d.category === "string" ? d.category : "other",
    member: typeof d.member === "string" ? d.member : "",
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
      salary: 0,
      categoryBudgets: {},
      categoriesConfig: { custom: [], overrides: {} },
      membersConfig: { custom: [], overrides: {} },
    };
    await setDoc(ref, { ...docData, createdAt: Timestamp.now() });
    return docData;
  }
  const raw = snap.data() ?? {};
  const existing = userFromData(raw);
  const next: UserDoc = {
    ...existing,
    email: profile.email || existing.email,
    name: profile.name !== undefined ? (profile.name ?? null) : existing.name,
    image: profile.image !== undefined ? (profile.image ?? null) : existing.image,
  };
  const patch: Record<string, unknown> = {};
  if (
    next.email !== existing.email ||
    next.name !== existing.name ||
    next.image !== existing.image
  ) {
    patch.email = next.email;
    patch.name = next.name;
    patch.image = next.image;
  }
  // Backfill membersConfig on docs created before members existed, so the
  // field is always present once a user has signed in again.
  if (!raw.membersConfig) patch.membersConfig = next.membersConfig;
  if (Object.keys(patch).length > 0) await updateDoc(ref, patch);
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
    Pick<
      UserDoc,
      | "budget"
      | "dailyBudget"
      | "salary"
      | "categoryBudgets"
      | "categoriesConfig"
      | "membersConfig"
    >
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
 * routes enforced): positive integer amount, category and member from the
 * user's effective lists, length caps, valid date. Returns null if the amount
 * is invalid.
 */
export function sanitizeNewTransaction(
  draft: NewTransaction,
  categories: UserCategory[],
  members: UserMember[]
): NewTransaction | null {
  const amount = Math.round(Number(draft.amount));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const allowed = new Set(categories.map((c) => c.id));
  const category =
    draft.category && allowed.has(draft.category) ? draft.category : "other";
  const allowedMembers = new Set(members.map((m) => m.id));
  const member =
    !draft.member || !allowedMembers.has(draft.member) ? "" : draft.member;
  return {
    amount,
    category,
    member,
    merchant: (draft.merchant ?? "").slice(0, 80),
    note: (draft.note ?? "").slice(0, 280),
    date: draft.date && DATE_RE.test(draft.date) ? draft.date : todayISO(),
  };
}

/**
 * The app tracks spending only. Income was dropped from the product, so any
 * `type: "income"` docs still in the database (logged before the change) are
 * excluded here, at the single data-layer boundary — everything downstream is
 * expense-only by construction and needs no type checks of its own.
 * `purgeIncomeTransactions` removes them for good.
 */
export async function listTransactions(uid: string): Promise<Transaction[]> {
  const snap = await getDocs(
    query(txCol(uid), orderBy("date", "desc"), orderBy("createdAt", "desc"))
  );
  return snap.docs.map(txFromSnap).filter((t) => t.type !== "income");
}

/** How many legacy income docs are still stored (0 once purged). */
export async function countIncomeTransactions(uid: string): Promise<number> {
  const snap = await getDocs(query(txCol(uid), where("type", "==", "income")));
  return snap.size;
}

/**
 * Permanently delete every income transaction. Irreversible: there is no
 * undo and no server-side backup — export first if the numbers still matter.
 * Batched like the category/member reassigns, so a partial failure is safe to
 * retry (it just picks up whatever is left).
 */
export async function purgeIncomeTransactions(uid: string): Promise<number> {
  const snap = await getDocs(query(txCol(uid), where("type", "==", "income")));
  const db = clientDb();
  for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const d of snap.docs.slice(i, i + BATCH_LIMIT)) batch.delete(d.ref);
    await batch.commit();
  }
  return snap.size;
}

export async function createTransaction(
  uid: string,
  data: NewTransaction
): Promise<Transaction> {
  const ref = doc(txCol(uid));
  const createdAt = Timestamp.now();
  // `type` is no longer a user choice, but firestore.rules still requires the
  // field — everything the app writes is an expense.
  const type = "expense" as const;
  await setDoc(ref, { ...data, type, createdAt });
  return { id: ref.id, ...data, type, createdAt: createdAt.toMillis() };
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

/** Same as reassignCategory, but for members — deleted members become "shared". */
async function reassignMember(uid: string, fromId: string): Promise<void> {
  const snap = await getDocs(query(txCol(uid), where("member", "==", fromId)));
  const db = clientDb();
  for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const d of snap.docs.slice(i, i + BATCH_LIMIT)) {
      batch.update(d.ref, { member: "shared" });
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
    // An empty icon clears the override, restoring the built-in default.
    if (typeof patch.icon === "string") {
      const ic = patch.icon.trim().slice(0, 8);
      if (ic) ov.icon = ic;
      else delete ov.icon;
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

// ---------------------------------------------------------------------------
// Member management (mirrors the category functions above)
// ---------------------------------------------------------------------------

function genMemberId(): string {
  return "m_" + Math.random().toString(36).slice(2, 10);
}

async function loadMembers(uid: string): Promise<MembersConfig> {
  const docData = await getUserDoc(uid);
  return docData?.membersConfig ?? { custom: [], overrides: {} };
}

/** Add a custom family member (max 20). */
export async function addMember(
  uid: string,
  input: { label: string; icon?: string }
): Promise<void> {
  const label = input.label.trim().slice(0, 40);
  if (!label) return;
  const config = await loadMembers(uid);
  if (config.custom.length >= MAX_CUSTOM_MEMBERS) return;
  config.custom.push({
    id: genMemberId(),
    label,
    icon: (input.icon || "🧑").slice(0, 8),
  });
  await updateUser(uid, { membersConfig: config });
}

/** Edit a member. Built-ins: rename + hide only. Custom: label/icon. */
export async function updateMember(
  uid: string,
  id: string,
  patch: { label?: string; icon?: string; hidden?: boolean }
): Promise<void> {
  const config = await loadMembers(uid);

  if (id in MEMBERS) {
    const ov = config.overrides[id] ?? {};
    if (typeof patch.label === "string") {
      const l = patch.label.trim().slice(0, 40);
      if (l) ov.label = l;
      else delete ov.label;
    }
    // An empty icon clears the override, restoring the built-in default.
    if (typeof patch.icon === "string") {
      const ic = patch.icon.trim().slice(0, 8);
      if (ic) ov.icon = ic;
      else delete ov.icon;
    }
    if (typeof patch.hidden === "boolean") ov.hidden = patch.hidden;
    if (Object.keys(ov).length) config.overrides[id] = ov;
    else delete config.overrides[id];
  } else {
    const m = config.custom.find((x) => x.id === id);
    if (!m) return;
    if (typeof patch.label === "string" && patch.label.trim())
      m.label = patch.label.trim().slice(0, 40);
    if (typeof patch.icon === "string" && patch.icon) m.icon = patch.icon.slice(0, 8);
  }
  await updateUser(uid, { membersConfig: config });
}

/** Delete a custom member and reassign its transactions to "shared". */
export async function deleteMember(uid: string, id: string): Promise<void> {
  if (id in MEMBERS) return; // built-ins can't be deleted
  const config = await loadMembers(uid);
  const idx = config.custom.findIndex((x) => x.id === id);
  if (idx === -1) return;
  config.custom.splice(idx, 1);

  // Transactions first, config last — same retry-safe ordering as categories.
  await reassignMember(uid, id);
  await updateUser(uid, { membersConfig: config });
}

// ---------------------------------------------------------------------------
// Commitments — subscriptions and instalment plans
// ---------------------------------------------------------------------------

/**
 * Coerce a stored payment plan into { "yyyy-mm": positiveInt }. The rules can
 * only check that this is a map of a sane size — Firestore rules cannot walk a
 * map's entries — so element validation lives here and nowhere else.
 */
function readSchedule(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!MONTH_RE.test(k)) continue;
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) continue;
    out[k] = Math.round(v);
    if (Object.keys(out).length >= MAX_SCHEDULE_ENTRIES) break;
  }
  return out;
}

function commitmentFromSnap(
  snap: DocumentSnapshot | QueryDocumentSnapshot
): Commitment {
  const d = snap.data() ?? {};
  const created = d.createdAt;
  const kind = d.kind === "installment" ? "installment" : "subscription";
  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : 0;
  return {
    id: snap.id,
    kind,
    name: typeof d.name === "string" ? d.name : "",
    amount: num(d.amount),
    // An instalment is monthly by definition; never trust a stored value that
    // would make a 12x plan bill once a year.
    cycle: kind === "installment" || d.cycle !== "yearly" ? "monthly" : "yearly",
    startDate: typeof d.startDate === "string" ? d.startDate : todayISO(),
    // Zero is meaningful here (a free trial), so it survives `num`'s > 0 test
    // only because introPeriods is what switches the promo on.
    introAmount:
      typeof d.introAmount === "number" && d.introAmount >= 0
        ? Math.round(d.introAmount)
        : 0,
    introPeriods: kind === "installment" ? 0 : num(d.introPeriods),
    tenor: kind === "installment" ? num(d.tenor) : 0,
    schedule: kind === "installment" ? readSchedule(d.schedule) : {},
    category: typeof d.category === "string" ? d.category : "other",
    member: typeof d.member === "string" ? d.member : "",
    note: typeof d.note === "string" ? d.note : "",
    // Missing means active: docs written before a pause switch existed should
    // still count toward the bill.
    active: d.active !== false,
    createdAt:
      created instanceof Timestamp
        ? created.toMillis()
        : typeof created === "number"
          ? created
          : 0,
  };
}

/**
 * Clamp a draft into something firestore.rules will accept. Mirrors the rules
 * exactly — when one changes the other has to follow, same contract as
 * `sanitizeNewTransaction`.
 */
export function sanitizeCommitment(draft: CommitmentDraft): CommitmentDraft | null {
  const name = draft.name.trim().slice(0, 60);
  const amount = Math.round(Number(draft.amount));
  if (!name || !Number.isFinite(amount) || amount <= 0) return null;
  if (!DATE_RE.test(draft.startDate)) return null;

  const kind = draft.kind === "installment" ? "installment" : "subscription";
  const cycle: BillingCycle =
    kind === "installment" ? "monthly" : draft.cycle === "yearly" ? "yearly" : "monthly";

  const schedule = kind === "installment" ? readSchedule(draft.schedule) : {};
  const scheduleSize = Object.keys(schedule).length;

  // An instalment with no tenor would bill forever, which is the one thing an
  // instalment must never do. A schedule sets its own length.
  const tenor =
    kind === "installment"
      ? scheduleSize > 0
        ? scheduleSize
        : Math.min(MAX_TENOR, Math.max(1, Math.round(Number(draft.tenor) || 0)))
      : 0;
  if (kind === "installment" && tenor < 1) return null;

  const introPeriods =
    kind === "subscription"
      ? Math.min(
          MAX_INTRO_PERIODS,
          Math.max(0, Math.round(Number(draft.introPeriods) || 0))
        )
      : 0;
  const introAmount =
    introPeriods > 0 ? Math.max(0, Math.round(Number(draft.introAmount) || 0)) : 0;

  return {
    kind,
    name,
    amount,
    cycle,
    // A scheduled plan starts on its own first month, whatever the picker said.
    startDate:
      scheduleSize > 0
        ? Object.keys(schedule).sort()[0] + "-01"
        : draft.startDate,
    introAmount,
    introPeriods,
    tenor,
    schedule,
    category: draft.category || "other",
    member: draft.member || "",
    note: draft.note.slice(0, 280),
    active: draft.active !== false,
  };
}

export async function listCommitments(uid: string): Promise<Commitment[]> {
  // No orderBy: a household has tens of these, so sorting client-side keeps
  // this off the composite-index list entirely.
  const snap = await getDocs(commitmentCol(uid));
  return snap.docs.map(commitmentFromSnap);
}

export async function createCommitment(
  uid: string,
  draft: CommitmentDraft
): Promise<Commitment | null> {
  const clean = sanitizeCommitment(draft);
  if (!clean) return null;
  const ref = doc(commitmentCol(uid));
  const createdAt = Timestamp.now();
  await setDoc(ref, { ...clean, createdAt });
  return { id: ref.id, ...clean, createdAt: createdAt.toMillis() };
}

export async function updateCommitment(
  uid: string,
  id: string,
  draft: CommitmentDraft
): Promise<Commitment | null> {
  const clean = sanitizeCommitment(draft);
  if (!clean) return null;
  const ref = doc(commitmentCol(uid), id);
  // Whole-document update: the kind switch rewrites tenor/intro/cycle together,
  // and a field-by-field patch would strand values from the previous kind.
  await updateDoc(ref, { ...clean });
  return commitmentFromSnap(await getDoc(ref));
}

export async function deleteCommitment(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(commitmentCol(uid), id));
}
