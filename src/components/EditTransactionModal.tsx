"use client";

import { useState } from "react";
import { todayISO } from "@/lib/format";
import { categoryDisplayName } from "@/lib/categoryName";
import type { Transaction } from "@/lib/types";
import { useExpenses } from "@/store/ExpenseStore";
import { useI18n } from "./I18nProvider";
import { DatePicker } from "./DatePicker";

interface Props {
  transaction: Transaction;
  onClose: () => void;
}

export function EditTransactionModal({ transaction, onClose }: Props) {
  const { updateTransaction, categories } = useExpenses();
  const { t } = useI18n();
  const [amount, setAmount] = useState(String(transaction.amount));
  const [category, setCategory] = useState<string>(transaction.category);
  const [merchant, setMerchant] = useState(transaction.merchant);
  const [date, setDate] = useState(transaction.date);
  const [saving, setSaving] = useState(false);

  async function save() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    setSaving(true);
    await updateTransaction(transaction.id, {
      amount: Math.round(value),
      category,
      merchant,
      date,
    });
    setSaving(false);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="animate-pop w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-base font-semibold">{t("edit.title")}</h3>
        <div className="space-y-3">
          <Field label={t("receipt.amount")}>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
            />
          </Field>
          <Field label={t("receipt.category")}>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
            >
              {categories
                .filter((c) => !c.hidden)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {categoryDisplayName(c, t)}
                  </option>
                ))}
            </select>
          </Field>
          <Field label={t("receipt.merchant")}>
            <input
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
            />
          </Field>
          <Field label={t("receipt.date")}>
            <DatePicker value={date} onChange={setDate} max={todayISO()} />
          </Field>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface-muted"
          >
            {t("receipt.cancel")}
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {saving ? t("edit.saving") : t("edit.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}
