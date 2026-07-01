"use client";

import { useState } from "react";
import { formatCurrency, formatDate } from "@/lib/format";
import { categoryDisplayName } from "@/lib/categoryName";
import type { ParsedExpense } from "@/lib/types";
import { useExpenses } from "@/store/ExpenseStore";
import { useI18n } from "./I18nProvider";

interface Props {
  draft: ParsedExpense;
  /** null once the card has been resolved (confirmed/discarded) */
  status: "pending" | "confirmed" | "discarded";
  onConfirm: (final: ParsedExpense) => void;
  onDiscard: () => void;
}

export function ReceiptCard({ draft, status, onConfirm, onDiscard }: Props) {
  const { t } = useI18n();
  const { categories, categoryMeta } = useExpenses();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ParsedExpense>(draft);

  const cat = categoryMeta(form.category);
  const locked = status !== "pending";
  const isIncome = form.type === "income";

  if (status === "discarded") {
    return (
      <div className="rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm text-muted">
        {t("receipt.discarded")}
      </div>
    );
  }

  return (
    <div className="animate-pop w-full max-w-sm rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          {status === "confirmed" ? t("receipt.saved") : t("receipt.confirm")}
        </span>
        {isIncome ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
            <span>💰</span>
            {t("receipt.income")}
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ background: cat.color + "22", color: cat.color }}
          >
            <span>{cat.icon}</span>
            {categoryDisplayName(cat, t)}
          </span>
        )}
      </div>

      <div className="px-4 py-3">
        {editing ? (
          <div className="space-y-3">
            <Field label={t("receipt.amount")}>
              <input
                type="text"
                inputMode="numeric"
                value={form.amount ? String(form.amount) : ""}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  setForm({ ...form, amount: digits ? Number(digits) : 0 });
                }}
                className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
              />
            </Field>
            {!isIncome && (
              <Field label={t("receipt.category")}>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
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
            )}
            <Field label={isIncome ? t("receipt.source") : t("receipt.merchant")}>
              <input
                value={form.merchant}
                placeholder={t("receipt.merchantPlaceholder")}
                onChange={(e) =>
                  setForm({ ...form, merchant: e.target.value })
                }
                className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-primary"
              />
            </Field>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <span className={`text-2xl font-bold ${isIncome ? "text-success" : ""}`}>
                {isIncome ? "+" : ""}
                {formatCurrency(form.amount)}
              </span>
            </div>
            <Row
              label={isIncome ? t("receipt.source") : t("receipt.merchantShort")}
              value={form.merchant || "—"}
            />
            <Row label={t("receipt.date")} value={formatDate(form.date)} />
            {status === "pending" && form.confidence < 0.7 && (
              <p className="pt-1 text-xs text-warning">
                {t("receipt.lowConfidence")}
              </p>
            )}
          </div>
        )}
      </div>

      {!locked && (
        <div className="flex items-center gap-2 border-t border-border px-4 py-2.5">
          {editing ? (
            <>
              <button
                onClick={() => setEditing(false)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface-muted"
              >
                {t("receipt.cancel")}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="ml-auto rounded-lg bg-surface-muted px-3 py-1.5 text-sm font-medium hover:bg-border"
              >
                {t("receipt.done")}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onDiscard}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger-soft"
              >
                {t("receipt.discard")}
              </button>
              <button
                onClick={() => setEditing(true)}
                className="ml-auto rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface-muted"
              >
                {t("receipt.edit")}
              </button>
              <button
                onClick={() => onConfirm(form)}
                className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90"
              >
                {t("receipt.confirmBtn")}
              </button>
            </>
          )}
        </div>
      )}
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
