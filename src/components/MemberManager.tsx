"use client";

import { useCallback, useEffect, useState } from "react";
import { memberDisplayName } from "@/lib/memberName";
import { effectiveMembers } from "@/lib/members";
import { clientAuth } from "@/lib/firebaseClient";
import * as db from "@/lib/firestore";
import type { UserMember } from "@/lib/types";
import { useI18n } from "./I18nProvider";

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
  const [busy, setBusy] = useState(false);

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
    await run((uid) => db.updateMember(uid, id, { label: editLabel.trim() }));
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
          <div className="flex flex-wrap items-center gap-1.5">
            {ICONS.map((ic) => (
              <button
                key={ic}
                type="button"
                onClick={() => setNewIcon(ic)}
                aria-label={ic}
                className={`grid h-8 w-8 place-items-center rounded-lg border text-base ${
                  newIcon === ic ? "border-primary bg-surface" : "border-transparent"
                }`}
              >
                {ic}
              </button>
            ))}
          </div>
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
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {t("mem.save")}
            </button>
          </div>
        </div>
      )}

      <ul className="divide-y divide-border">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-muted text-sm">
              {m.icon}
            </span>
            {editId === m.id ? (
              <input
                autoFocus
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value.slice(0, 40))}
                onKeyDown={(e) => e.key === "Enter" && saveEdit(m.id)}
                className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-primary"
              />
            ) : (
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
            )}
            <div className="flex shrink-0 items-center gap-1">
              {editId === m.id ? (
                <button
                  onClick={() => saveEdit(m.id)}
                  disabled={busy}
                  className="rounded-md px-2 py-1 text-xs font-semibold text-primary"
                >
                  {t("mem.save")}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setEditLabel(memberDisplayName(m, t));
                      setEditId(m.id);
                    }}
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
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
