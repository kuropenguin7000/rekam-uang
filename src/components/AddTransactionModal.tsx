"use client";

import { useState } from "react";
import { groupDigits, todayISO } from "@/lib/format";
import { categoryDisplayName } from "@/lib/categoryName";
import { memberDisplayName } from "@/lib/memberName";
import { DEFAULT_MEMBER } from "@/lib/members";
import { useExpenses } from "@/store/ExpenseStore";
import { useI18n } from "./I18nProvider";
import { DatePicker } from "./DatePicker";
import { Modal } from "./Modal";

interface Props {
  onClose: () => void;
}

export function AddTransactionModal({ onClose }: Props) {
  const { addExpense, categories, members } = useExpenses();
  const { t } = useI18n();
  const visible = categories.filter((c) => !c.hidden);
  const visibleMembers = members.filter((m) => !m.hidden);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>(visible[0]?.id ?? "other");
  // Default to household spending; the user picks a person when it's theirs.
  const [member, setMember] = useState<string>(
    visibleMembers.some((m) => m.id === DEFAULT_MEMBER)
      ? DEFAULT_MEMBER
      : (visibleMembers[0]?.id ?? "")
  );
  const [merchant, setMerchant] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  async function save() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    setSaving(true);
    await addExpense({
      amount: Math.round(value),
      category,
      member,
      merchant: merchant.trim(),
      note: note.trim(),
      date,
    });
    setSaving(false);
    onClose();
  }

  return (
    <Modal onClose={onClose} labelledBy="add-tx-title">
      <h3 id="add-tx-title" className="mb-4 text-base font-semibold">
        {t("add.title")}
      </h3>
      <div className="space-y-3">
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
          {visibleMembers.length > 0 && (
            <Field label={t("receipt.member")}>
              {/* Pills, not a <select>: one tap on mobile, and the whole
                  household fits on screen at a glance. */}
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
              placeholder={t("receipt.merchantPlaceholder")}
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
