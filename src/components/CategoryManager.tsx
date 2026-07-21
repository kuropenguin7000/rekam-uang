"use client";

import { useCallback, useEffect, useState } from "react";
import { categoryDisplayName } from "@/lib/categoryName";
import { effectiveCategories } from "@/lib/categories";
import { clientAuth } from "@/lib/firebaseClient";
import * as db from "@/lib/firestore";
import type { UserCategory } from "@/lib/types";
import { EmojiField } from "./EmojiField";
import { useI18n } from "./I18nProvider";

/** Shortcuts only — EmojiField accepts anything the keyboard can type. */
const ICON_SUGGESTIONS = ["🍽️", "🚗", "🛍️", "🛒", "🎬", "🧾", "💊", "🏷️"];

const COLORS = [
  "#f97316",
  "#0ea5e9",
  "#ec4899",
  "#22c55e",
  "#a855f7",
  "#eab308",
  "#ef4444",
  "#14b8a6",
  "#6366f1",
  "#94a3b8",
];

/**
 * Manage categories: rename/hide the 8 built-ins, and add/edit/delete custom
 * ones. Deleting a custom category moves its transactions to "Lainnya".
 * Self-contained (reads Firestore directly) so it works on the account page,
 * which is outside the dashboard store.
 */
export function CategoryManager() {
  const { t } = useI18n();
  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newIcon, setNewIcon] = useState("🏷️");
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [busy, setBusy] = useState(false);

  function startEdit(c: UserCategory) {
    setEditLabel(categoryDisplayName(c, t));
    setEditIcon(c.icon);
    setEditId(c.id);
  }

  const reload = useCallback(async () => {
    const uid = clientAuth().currentUser?.uid;
    if (!uid) return;
    const doc = await db.getUserDoc(uid);
    setCategories(effectiveCategories(doc?.categoriesConfig ?? null));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function run(action: (uid: string) => Promise<void>) {
    const uid = clientAuth().currentUser?.uid;
    if (!uid) return;
    setBusy(true);
    await action(uid);
    await reload();
    setBusy(false);
  }

  async function add() {
    const label = newLabel.trim();
    if (!label) return;
    await run((uid) =>
      db.addCategory(uid, { label, icon: newIcon || "🏷️", color: newColor })
    );
    setAdding(false);
    setNewLabel("");
    setNewIcon("🏷️");
    setNewColor(COLORS[0]);
  }

  async function saveEdit(id: string) {
    await run((uid) =>
      db.updateCategory(uid, id, {
        label: editLabel.trim(),
        icon: editIcon.trim(),
      })
    );
    setEditId(null);
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(t("cat.deleteConfirm", { name }))) return;
    await run((uid) => db.deleteCategory(uid, id));
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t("cat.manageTitle")}</h2>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-xs font-medium text-primary hover:underline"
          >
            + {t("cat.add")}
          </button>
        )}
      </div>

      {adding && (
        <div className="mb-3 space-y-2 rounded-xl border border-border bg-surface-muted p-3">
          <input
            autoFocus
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value.slice(0, 40))}
            placeholder={t("cat.namePlaceholder")}
            className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
          <EmojiField
            value={newIcon}
            onChange={setNewIcon}
            suggestions={ICON_SUGGESTIONS}
          />
          <div className="flex flex-wrap items-center gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColor(c)}
                aria-label={c}
                className={`h-6 w-6 rounded-full border-2 ${
                  newColor === c ? "border-foreground" : "border-transparent"
                }`}
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setAdding(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface"
            >
              {t("cat.cancel")}
            </button>
            <button
              onClick={add}
              disabled={busy || !newLabel.trim()}
              className="grad-primary rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              {t("cat.save")}
            </button>
          </div>
        </div>
      )}

      <ul className="divide-y divide-border">
        {categories.map((c) =>
          editId === c.id ? (
            /* Editing takes the whole row: name and icon side by side needs
               more width than the list row leaves. */
            <li key={c.id} className="py-2.5">
              <div className="space-y-2 rounded-xl border border-border bg-surface-muted p-3">
                <input
                  autoFocus
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value.slice(0, 40))}
                  onKeyDown={(e) => e.key === "Enter" && saveEdit(c.id)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
                />
                <EmojiField
                  value={editIcon}
                  onChange={setEditIcon}
                  suggestions={ICON_SUGGESTIONS}
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setEditId(null)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface"
                  >
                    {t("cat.cancel")}
                  </button>
                  <button
                    onClick={() => saveEdit(c.id)}
                    disabled={busy}
                    className="grad-primary rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                  >
                    {t("cat.save")}
                  </button>
                </div>
              </div>
            </li>
          ) : (
            <li key={c.id} className="flex items-center gap-3 py-2.5">
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm"
                style={{ background: c.color + "22" }}
              >
                {c.icon}
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-sm ${
                  c.hidden ? "text-muted line-through" : "font-medium"
                }`}
              >
                {categoryDisplayName(c, t)}
                {c.builtin && (
                  <span className="ml-1.5 text-xs font-normal text-muted">
                    · {t("cat.builtin")}
                  </span>
                )}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => startEdit(c)}
                  aria-label={t("cat.rename")}
                  className="grid h-7 w-7 place-items-center rounded-md text-muted transition hover:bg-surface-muted hover:text-primary"
                >
                  ✎
                </button>
                {c.builtin ? (
                  <button
                    onClick={() =>
                      run((uid) => db.updateCategory(uid, c.id, { hidden: !c.hidden }))
                    }
                    aria-label={t("cat.hide")}
                    className="grid h-7 w-7 place-items-center rounded-md text-muted transition hover:bg-surface-muted"
                  >
                    {c.hidden ? "🙈" : "👁️"}
                  </button>
                ) : (
                  <button
                    onClick={() => remove(c.id, categoryDisplayName(c, t))}
                    aria-label={t("cat.delete")}
                    className="grid h-7 w-7 place-items-center rounded-md text-muted transition hover:bg-danger-soft hover:text-danger"
                  >
                    ✕
                  </button>
                )}
              </div>
            </li>
          )
        )}
      </ul>
    </div>
  );
}
