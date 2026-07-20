"use client";

import { useCallback, useEffect, useState } from "react";
import { clientAuth } from "@/lib/firebaseClient";
import * as db from "@/lib/firestore";
import { useI18n } from "./I18nProvider";

/**
 * One-time cleanup for income entries logged before income tracking was
 * removed. They are already hidden everywhere (listTransactions filters them
 * out) — this deletes them for good.
 *
 * Renders nothing once the count reaches zero, so the card disappears by
 * itself after a successful purge and this component can then be deleted.
 */
export function IncomePurge() {
  const { t } = useI18n();
  const [count, setCount] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  const reload = useCallback(async () => {
    const uid = clientAuth().currentUser?.uid;
    if (!uid) return;
    try {
      setCount(await db.countIncomeTransactions(uid));
    } catch {
      setCount(0); // never block the account page on this
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function purge() {
    const uid = clientAuth().currentUser?.uid;
    if (!uid) return;
    setBusy(true);
    const removed = await db.purgeIncomeTransactions(uid);
    setDone(removed);
    setBusy(false);
    setConfirming(false);
    await reload();
  }

  if (done !== null) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5 text-sm shadow-sm">
        {t("purge.done", { n: done })}
      </div>
    );
  }

  if (count === null || count === 0) return null;

  return (
    <div className="rounded-2xl border border-danger/40 bg-surface p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-danger">{t("purge.title")}</h2>
      <p className="mt-1.5 text-xs text-muted">{t("purge.body", { n: count })}</p>
      <p className="mt-1.5 text-xs font-medium text-danger">{t("purge.warning")}</p>

      {confirming ? (
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            onClick={() => setConfirming(false)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface-muted"
          >
            {t("purge.cancel")}
          </button>
          <button
            onClick={purge}
            disabled={busy}
            className="rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            {busy ? t("purge.deleting") : t("purge.confirm", { n: count })}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="mt-3 rounded-lg border border-danger/40 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger-soft"
        >
          {t("purge.button")}
        </button>
      )}
    </div>
  );
}
