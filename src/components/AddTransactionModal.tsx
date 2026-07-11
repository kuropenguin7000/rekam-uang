"use client";

import { useState } from "react";
import { groupDigits, todayISO } from "@/lib/format";
import { categoryDisplayName } from "@/lib/categoryName";
import type { TxType } from "@/lib/types";
import { useExpenses } from "@/store/ExpenseStore";
import { useI18n } from "./I18nProvider";
import { DatePicker } from "./DatePicker";

interface Props {
  onClose: () => void;
}

export function AddTransactionModal({ onClose }: Props) {
  const { addExpense, categories } = useExpenses();
  const { t } = useI18n();
  const visible = categories.filter((c) => !c.hidden);
  const [type, setType] = useState<TxType>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>(visible[0]?.id ?? "other");
  const [merchant, setMerchant] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  const isIncome = type === "income";

  async function save() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    setSaving(true);
    await addExpense({
      amount: Math.round(value),
      category: isIncome ? "other" : category,
      type,
      merchant: merchant.trim(),
      note: note.trim(),
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
        <h3 className="mb-4 text-base font-semibold">{t("add.title")}</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface-muted p-1">
            <button
              type="button"
              onClick={() => setType("expense")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                !isIncome ? "bg-surface shadow-sm" : "text-muted"
              }`}
            >
              {t("add.typeExpense")}
            </button>
            <button
              type="button"
              onClick={() => setType("income")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                isIncome ? "bg-surface text-success shadow-sm" : "text-muted"
              }`}
            >
              {t("add.typeIncome")}
            </button>
          </div>
          <Field label={t("receipt.amount")}>
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              value={groupDigits(amount)}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
            />
          </Field>
          {!isIncome && (
            <Field label={t("receipt.category")}>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
              >
                {visible.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {categoryDisplayName(c, t)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label={isIncome ? t("receipt.source") : t("receipt.merchant")}>
            <input
              value={merchant}
              placeholder={isIncome ? "" : t("receipt.merchantPlaceholder")}
              maxLength={80}
              onChange={(e) => setMerchant(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
            />
          </Field>
          <Field label={t("receipt.date")}>
            <DatePicker value={date} onChange={setDate} max={todayISO()} />
          </Field>
          <Field label={t("add.note")}>
            <input
              value={note}
              maxLength={280}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
            />
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
            disabled={saving || !amount}
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
