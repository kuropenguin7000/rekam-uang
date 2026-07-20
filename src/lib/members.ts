import type { UserMember } from "./types";

/**
 * Family members a transaction can be attributed to ("who spent this?").
 * Same shape as categories.ts: 4 built-ins the user can rename or hide, plus
 * custom members (`m_*` ids) for households that need more. "shared" is the
 * catch-all for household spending that isn't one person's.
 */

export interface Member {
  id: MemberId;
  label: string;
  icon: string;
}

export type MemberId = "father" | "mother" | "kids" | "shared";

export const MEMBERS: Record<MemberId, Member> = {
  father: { id: "father", label: "Ayah", icon: "👨" },
  mother: { id: "mother", label: "Ibu", icon: "👩" },
  kids: { id: "kids", label: "Anak", icon: "🧒" },
  shared: { id: "shared", label: "Bersama", icon: "🏠" },
};

export const MEMBER_LIST: Member[] = Object.values(MEMBERS);

/** The member new transactions default to — household spending. */
export const DEFAULT_MEMBER: string = "shared";

/** Per-user member customisation, persisted as a map on the user doc. */
export interface MembersConfig {
  custom: { id: string; label: string; icon: string }[];
  overrides: Record<string, { label?: string; hidden?: boolean }>;
}

export const EMPTY_MEMBERS_CONFIG: MembersConfig = { custom: [], overrides: {} };

const FALLBACK_MEMBER: UserMember = {
  id: "shared",
  label: "",
  icon: MEMBERS.shared.icon,
  builtin: true,
  hidden: false,
};

/** Merge built-ins (with overrides applied) + custom members. */
export function effectiveMembers(
  config: MembersConfig | null | undefined
): UserMember[] {
  const out: UserMember[] = [];
  for (const m of MEMBER_LIST) {
    const ov = config?.overrides?.[m.id];
    out.push({
      id: m.id,
      label: ov?.label ?? "",
      icon: m.icon,
      builtin: true,
      hidden: !!ov?.hidden,
    });
  }
  for (const m of config?.custom ?? []) {
    out.push({
      id: m.id,
      label: m.label,
      icon: m.icon,
      builtin: false,
      hidden: false,
    });
  }
  return out;
}

/**
 * Resolve a member id to its meta, falling back to "shared". Returns null for
 * an empty id: transactions saved before this feature existed are untagged,
 * and labelling them "Bersama" would invent data the user never entered.
 */
export function resolveMember(
  id: string,
  list: UserMember[]
): UserMember | null {
  if (!id) return null;
  return (
    list.find((m) => m.id === id) ??
    list.find((m) => m.id === "shared") ??
    FALLBACK_MEMBER
  );
}

/** Sanitize an arbitrary stored value into a well-formed MembersConfig. */
export function sanitizeMembersConfig(obj: unknown): MembersConfig {
  if (!obj || typeof obj !== "object") return { custom: [], overrides: {} };
  const rec = obj as { custom?: unknown; overrides?: unknown };

  const custom: MembersConfig["custom"] = Array.isArray(rec.custom)
    ? rec.custom
        .filter(
          (m): m is Record<string, unknown> =>
            !!m && typeof m === "object" && typeof (m as { id?: unknown }).id === "string"
        )
        .map((m) => ({
          id: String(m.id),
          label: String(m.label ?? "").slice(0, 40),
          icon: typeof m.icon === "string" && m.icon ? m.icon : "🧑",
        }))
    : [];

  const overrides: MembersConfig["overrides"] = {};
  if (rec.overrides && typeof rec.overrides === "object") {
    for (const [k, v] of Object.entries(rec.overrides as Record<string, unknown>)) {
      if (!(k in MEMBERS) || !v || typeof v !== "object") continue;
      const vv = v as { label?: unknown; hidden?: unknown };
      const o: { label?: string; hidden?: boolean } = {};
      if (typeof vv.label === "string" && vv.label.trim())
        o.label = vv.label.slice(0, 40);
      if (typeof vv.hidden === "boolean") o.hidden = vv.hidden;
      if (Object.keys(o).length) overrides[k] = o;
    }
  }
  return { custom, overrides };
}
