import type { Category, CategoryId, UserCategory } from "./types";

export const CATEGORIES: Record<CategoryId, Category> = {
  food: { id: "food", label: "Makanan & Minuman", color: "#f97316", icon: "🍽️" },
  transport: { id: "transport", label: "Transportasi", color: "#0ea5e9", icon: "🚗" },
  shopping: { id: "shopping", label: "Belanja", color: "#ec4899", icon: "🛍️" },
  groceries: { id: "groceries", label: "Kebutuhan Pokok", color: "#22c55e", icon: "🛒" },
  entertainment: { id: "entertainment", label: "Hiburan", color: "#a855f7", icon: "🎬" },
  bills: { id: "bills", label: "Tagihan & Utilitas", color: "#eab308", icon: "🧾" },
  health: { id: "health", label: "Kesehatan", color: "#ef4444", icon: "💊" },
  other: { id: "other", label: "Lainnya", color: "#94a3b8", icon: "📦" },
};

export const CATEGORY_LIST: Category[] = Object.values(CATEGORIES);

export function categoryColor(id: CategoryId): string {
  return CATEGORIES[id].color;
}

// ---------------------------------------------------------------------------
// User-editable categories: 8 built-ins (rename/hide via overrides) + custom.
// ---------------------------------------------------------------------------

/** Per-user category customisation, persisted as JSON on the user. */
export interface CategoriesConfig {
  custom: { id: string; label: string; icon: string; color: string }[];
  /** Built-ins can be renamed, re-iconed and hidden — never deleted. */
  overrides: Record<string, { label?: string; icon?: string; hidden?: boolean }>;
}

export const EMPTY_CATEGORIES_CONFIG: CategoriesConfig = {
  custom: [],
  overrides: {},
};

const FALLBACK_CATEGORY: UserCategory = {
  id: "other",
  label: "",
  icon: CATEGORIES.other.icon,
  color: CATEGORIES.other.color,
  builtin: true,
  hidden: false,
};

/** Merge built-ins (with overrides applied) + custom categories. */
export function effectiveCategories(
  config: CategoriesConfig | null | undefined
): UserCategory[] {
  const out: UserCategory[] = [];
  for (const c of CATEGORY_LIST) {
    const ov = config?.overrides?.[c.id];
    out.push({
      id: c.id,
      label: ov?.label ?? "",
      icon: ov?.icon || c.icon,
      color: c.color,
      builtin: true,
      hidden: !!ov?.hidden,
    });
  }
  for (const c of config?.custom ?? []) {
    out.push({
      id: c.id,
      label: c.label,
      icon: c.icon,
      color: c.color,
      builtin: false,
      hidden: false,
    });
  }
  return out;
}

/** Resolve any category id to its meta, falling back to "other". */
export function resolveCategory(
  id: string,
  list: UserCategory[]
): UserCategory {
  return (
    list.find((c) => c.id === id) ??
    list.find((c) => c.id === "other") ??
    FALLBACK_CATEGORY
  );
}

/** Sanitize an arbitrary stored value into a well-formed CategoriesConfig. */
export function sanitizeCategoriesConfig(obj: unknown): CategoriesConfig {
  if (!obj || typeof obj !== "object") return { custom: [], overrides: {} };
  const rec = obj as { custom?: unknown; overrides?: unknown };

  const custom: CategoriesConfig["custom"] = Array.isArray(rec.custom)
    ? rec.custom
        .filter(
          (c): c is Record<string, unknown> =>
            !!c && typeof c === "object" && typeof (c as { id?: unknown }).id === "string"
        )
        .map((c) => ({
          id: String(c.id),
          label: String((c.label ?? "")).slice(0, 40),
          icon: typeof c.icon === "string" && c.icon ? c.icon : "🏷️",
          color: typeof c.color === "string" && c.color ? c.color : "#94a3b8",
        }))
    : [];

  const overrides: CategoriesConfig["overrides"] = {};
  if (rec.overrides && typeof rec.overrides === "object") {
    for (const [k, v] of Object.entries(
      rec.overrides as Record<string, unknown>
    )) {
      if (!(k in CATEGORIES) || !v || typeof v !== "object") continue;
      const vv = v as { label?: unknown; icon?: unknown; hidden?: unknown };
      const o: { label?: string; icon?: string; hidden?: boolean } = {};
      if (typeof vv.label === "string" && vv.label.trim())
        o.label = vv.label.slice(0, 40);
      if (typeof vv.icon === "string" && vv.icon.trim())
        o.icon = vv.icon.slice(0, 8);
      if (typeof vv.hidden === "boolean") o.hidden = vv.hidden;
      if (Object.keys(o).length) overrides[k] = o;
    }
  }
  return { custom, overrides };
}
