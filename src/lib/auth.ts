import { cookies } from "next/headers";
import type { User } from "@prisma/client";
import { prisma } from "./db";
import { entitlementsFor, isMasterEmail, type Entitlements, type PlanId, type Role } from "./plans";
import { effectiveCategories, parseCategoriesConfig } from "./categories";
import type { UserCategory } from "./types";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSession,
  verifySession,
} from "./session";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: Role;
  plan: PlanId;
  budget: number;
  dailyBudget: number;
  /** When the current paid period ends, or null (free/master/no expiry). */
  planExpiresAt: Date | null;
  /** Per-category monthly caps, e.g. { food: 1000000 }. Empty = none set. */
  categoryBudgets: Record<string, number>;
  /** Effective category list (built-ins + overrides + custom). */
  categories: UserCategory[];
  entitlements: Entitlements;
}

/** Parse the stored categoryBudgets JSON into a sanitized {category: amount} map. */
export function parseCategoryBudgets(raw: string | null): Record<string, number> {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw) as unknown;
    if (!obj || typeof obj !== "object") return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof v === "number" && v > 0) out[k] = Math.round(v);
    }
    return out;
  } catch {
    return {};
  }
}

function toAuthUser(u: User): AuthUser {
  const role = (u.role === "master" ? "master" : "user") as Role;
  const plan = (u.plan === "pro" ? "pro" : "free") as PlanId;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    image: u.image,
    role,
    plan,
    budget: u.budget,
    dailyBudget: u.dailyBudget,
    planExpiresAt: u.planExpiresAt,
    categoryBudgets: parseCategoryBudgets(u.categoryBudgets),
    categories: effectiveCategories(parseCategoriesConfig(u.categoriesConfig)),
    entitlements: entitlementsFor(role, plan),
  };
}

/**
 * Auto-downgrade an expired Pro user to free. This is the "subscription expiry
 * job": rather than relying on a scheduler, it runs lazily on every auth read
 * so an account self-heals the moment its paid period lapses. Master accounts
 * (no expiry) and already-free users are untouched. `planExpiresAt` is kept for
 * the record (win-back / history); the gating is the `plan` field.
 */
export async function downgradeIfExpired(u: User): Promise<User> {
  if (
    u.role !== "master" &&
    u.plan === "pro" &&
    u.planExpiresAt &&
    u.planExpiresAt.getTime() <= Date.now()
  ) {
    return prisma.user.update({
      where: { id: u.id },
      data: { plan: "free" },
    });
  }
  return u;
}

/** Read the current user from the session cookie, or null if signed out. */
export async function getAuthUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySession(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) return null;
  return toAuthUser(await downgradeIfExpired(user));
}

/** Create or update a user signing in via Google (or the demo flow). */
export async function upsertUser(input: {
  email: string;
  name?: string | null;
  image?: string | null;
}): Promise<AuthUser> {
  const email = input.email.toLowerCase().trim();
  const master = isMasterEmail(email);

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: input.name ?? null,
      image: input.image ?? null,
      role: master ? "master" : "user",
      plan: master ? "pro" : "free",
    },
    update: {
      name: input.name ?? undefined,
      image: input.image ?? undefined,
      // keep master role/plan enforced even if the row predates the env var
      ...(master ? { role: "master", plan: "pro" } : {}),
    },
  });
  return toAuthUser(user);
}

export async function startSession(user: AuthUser): Promise<void> {
  const token = await signSession({
    sub: user.id,
    email: user.email,
    name: user.name ?? undefined,
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
