"use client";

import { useCallback, useEffect, useState } from "react";
import { memberDisplayName } from "@/lib/memberName";
import { effectiveMembers } from "@/lib/members";
import { clientAuth } from "@/lib/firebaseClient";
import * as db from "@/lib/firestore";
import type { UserMember } from "@/lib/types";
import { EmojiField } from "./EmojiField";
import { useI18n } from "./I18nProvider";

/**
 * Shortcuts only. The emoji field takes anything the keyboard can produce —
 * households are not limited to the faces we happened to list here.
 */
const ICONS = ["👨", "👩", "🧒", "👶", "🧑", "👴", "👵", "🏠"];

/**
 * Manage family members: rename/hide the 4 built-ins, and add/edit/delete
 * custom ones. Deleting a custom member moves its expenses to "Bersama".
 * Self-contained (reads Firestore directly) so it works on the account page,
 * which is outside the dashboard store — same as CategoryManager.
 */
export function MemberManager() {
  const { t } = useI18n();
  const [members, setMembers] = useState<UserMember[]>([]);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newIcon, setNewIcon] = useState(ICONS[4]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [busy, setBusy] = useState(false);

  function startEdit(m: UserMember) {
    setEditLabel(memberDisplayName(m, t));
    setEditIcon(m.icon);
    setEditId(m.id);
  }

  const reload = useCallback(async () => {
    const uid = clientAuth().currentUser?.uid;
    if (!uid) return;
    const doc = await db.getUserDoc(uid);
    setMembers(effectiveMembers(doc?.membersConfig ?? null));
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
    await run((uid) => db.addMember(uid, { label, icon: newIcon || "🧑" }));
    setAdding(false);
    setNewLabel("");
    setNewIcon(ICONS[4]);
  }

  async function saveEdit(id: string) {
    await run((uid) =>
      db.updateMember(uid, id, {
        label: editLabel.trim(),
        icon: editIcon.trim(),
      })
    );
    setEditId(null);
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(t("mem.deleteConfirm", { name }))) return;
    await run((uid) => db.deleteMember(uid, id));
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t("mem.manageTitle")}</h2>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-xs font-medium text-primary hover:underline"
          >
            + {t("mem.add")}
          </button>
        )}
      </div>
      <p className="mb-3 text-xs text-muted">{t("mem.manageHint")}</p>

      {adding && (
        <div className="mb-3 space-y-2 rounded-xl border border-border bg-surface-muted p-3">
          <input
            autoFocus
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value.slice(0, 40))}
            placeholder={t("mem.namePlaceholder")}
            className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
          <EmojiField value={newIcon} onChange={setNewIcon} suggestions={ICONS} />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setAdding(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface"
            >
              {t("mem.cancel")}
            </button>
            <button
              onClick={add}
              disabled={busy || !newLabel.trim()}
              className="grad-primary rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              {t("mem.save")}
            </button>
          </div>
        </div>
      )}

      <ul className="divide-y divide-border">
        {members.map((m) =>
          editId === m.id ? (
            /* Editing takes the whole row — name and emoji need the width. */
            <li key={m.id} className="py-2.5">
              <div className="space-y-2 rounded-xl border border-border bg-surface-muted p-3">
                <input
                  autoFocus
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value.slice(0, 40))}
                  onKeyDown={(e) => e.key === "Enter" && saveEdit(m.id)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
                />
                <EmojiField
                  value={editIcon}
                  onChange={setEditIcon}
                  suggestions={ICONS}
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setEditId(null)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface"
                  >
                    {t("mem.cancel")}
                  </button>
                  <button
                    onClick={() => saveEdit(m.id)}
                    disabled={busy}
                    className="grad-primary rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                  >
                    {t("mem.save")}
                  </button>
                </div>
              </div>
            </li>
          ) : (
            <li key={m.id} className="flex items-center gap-3 py-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-muted text-sm">
                {m.icon}
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-sm ${
                  m.hidden ? "text-muted line-through" : "font-medium"
                }`}
              >
                {memberDisplayName(m, t)}
                {m.builtin && (
                  <span className="ml-1.5 text-xs font-normal text-muted">
                    · {t("mem.builtin")}
                  </span>
                )}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => startEdit(m)}
                  aria-label={t("mem.rename")}
                  className="grid h-7 w-7 place-items-center rounded-md text-muted transition hover:bg-surface-muted hover:text-primary"
                >
                  ✎
                </button>
                {m.builtin ? (
                  <button
                    onClick={() =>
                      run((uid) => db.updateMember(uid, m.id, { hidden: !m.hidden }))
                    }
                    aria-label={t("mem.hide")}
                    className="grid h-7 w-7 place-items-center rounded-md text-muted transition hover:bg-surface-muted"
                  >
                    {m.hidden ? "🙈" : "👁️"}
                  </button>
                ) : (
                  <button
                    onClick={() => remove(m.id, memberDisplayName(m, t))}
                    aria-label={t("mem.delete")}
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
