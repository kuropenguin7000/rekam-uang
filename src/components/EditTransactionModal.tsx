"use client";

import { useState } from "react";
import { groupDigits, todayISO } from "@/lib/format";
import { categoryDisplayName } from "@/lib/categoryName";
import { memberDisplayName } from "@/lib/memberName";
import type { Transaction } from "@/lib/types";
import { useExpenses } from "@/store/ExpenseStore";
import { useI18n } from "./I18nProvider";
import { DatePicker } from "./DatePicker";
import { Modal } from "./Modal";

interface Props {
  transaction: Transaction;
  onClose: () => void;
}

export function EditTransactionModal({ transaction, onClose }: Props) {
  const { updateTransaction, categories, members } = useExpenses();
  const { t } = useI18n();
  const visibleMembers = members.filter((m) => !m.hidden);
  const [amount, setAmount] = useState(String(transaction.amount));
  const [category, setCategory] = useState<string>(transaction.category);
  const [member, setMember] = useState<string>(transaction.member);
  const [merchant, setMerchant] = useState(transaction.merchant);
  const [note, setNote] = useState(transaction.note);
  const [date, setDate] = useState(transaction.date);
  const [saving, setSaving] = useState(false);

  async function save() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    setSaving(true);
    await updateTransaction(transaction.id, {
      amount: Math.round(value),
      category,
      member,
      merchant,
      note,
      date,
    });
    setSaving(false);
    onClose();
  }

  return (
    <Modal onClose={onClose} labelledBy="edit-tx-title">
      <h3 id="edit-tx-title" className="mb-4 text-base font-semibold">
        {t("edit.title")}
      </h3>
      <div className="space-y-3">
          <Field label={t("receipt.amount")}>
            <input
              type="text"
              inputMode="numeric"
              value={groupDigits(amount)}
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
          {visibleMembers.length > 0 && (
            <Field label={t("receipt.member")}>
              <div className="flex flex-wrap gap-1.5">
                {visibleMembers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMember(m.id)}
                    className={`rounded-lg border px-2.5 py-1.5 text-sm font-medium transition ${
                      member === m.id
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-surface text-muted hover:text-foreground"
                    }`}
                  >
                    <span className="mr-1">{m.icon}</span>
                    {memberDisplayName(m, t)}
                  </button>
                ))}
              </div>
            </Field>
          )}
          <Field label={t("receipt.merchant")}>
            <input
              value={merchant}
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
          disabled={saving}
          className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {saving ? t("edit.saving") : t("edit.save")}
        </button>
      </div>
    </Modal>
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
