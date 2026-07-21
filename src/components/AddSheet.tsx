"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useExpenses } from "@/store/ExpenseStore";
import { useI18n } from "./I18nProvider";
import { DatePicker } from "./DatePicker";
import { categoryDisplayName } from "@/lib/categoryName";
import { memberDisplayName } from "@/lib/memberName";
import { DEFAULT_MEMBER } from "@/lib/members";
import { groupDigits, todayISO } from "@/lib/format";

/** Quick-amount chips from the mockup, in rupiah. */
const QUICK = [25_000, 50_000, 100_000, 250_000];

/** How many category tiles before the rest collapse behind "•••". */
const TILE_LIMIT = 6;

/**
 * Direction 1c — logging as a thumb-friendly bottom sheet instead of a form.
 *
 * Portalled to <body> for the same reason the old modal was: any ancestor with
 * a transform would capture the fixed overlay and push it off-screen.
 *
 * Below sm: it slides up from the bottom edge as a sheet; from sm: up the same
 * content centres as a dialog, because a bottom sheet is a phone idiom and
 * looks stranded on a wide screen.
 */
export function AddSheet({ onClose }: { onClose: () => void }) {
  const { addExpense, categories, members } = useExpenses();
  const { t } = useI18n();

  const visibleCats = categories.filter((c) => !c.hidden);
  const visibleMembers = members.filter((m) => !m.hidden);

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(visibleCats[0]?.id ?? "other");
  const [member, setMember] = useState(
    visibleMembers.some((m) => m.id === DEFAULT_MEMBER)
      ? DEFAULT_MEMBER
      : (visibleMembers[0]?.id ?? "")
  );
  const [merchant, setMerchant] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO());
  const [showAllCats, setShowAllCats] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

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

  const tiles = showAllCats ? visibleCats : visibleCats.slice(0, TILE_LIMIT);
  const hiddenCount = visibleCats.length - TILE_LIMIT;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="animate-fade fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm sm:justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-sheet-title"
        onClick={(e) => e.stopPropagation()}
        className="animate-sheet mx-auto flex max-h-[92vh] w-full flex-col overflow-y-auto rounded-t-[28px] border-t border-border bg-surface px-[18px] pb-5 pt-2.5 shadow-[0_-20px_50px_-10px_rgba(0,0,0,.6)] sm:max-w-md sm:rounded-[24px] sm:border"
      >
        {/* Grab handle — the affordance that says "this drags", phone only. */}
        <div className="mx-auto mb-3.5 mt-0.5 h-[5px] w-10 shrink-0 rounded-full bg-surface-muted sm:hidden" />

        <h3 id="add-sheet-title" className="mb-3 text-[15px] font-semibold">
          {t("add.title")}
        </h3>

        {/* Amount, as the sheet's headline figure. */}
        <div className="py-1.5 text-center">
          <p className="text-[11px] text-muted">{t("receipt.amount")}</p>
          <input
            autoFocus
            inputMode="numeric"
            value={amount ? "Rp " + groupDigits(amount) : ""}
            placeholder="Rp 0"
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
            aria-label={t("receipt.amount")}
            className="num mt-0.5 w-full bg-transparent text-center text-[34px] font-bold tracking-tight outline-none placeholder:text-muted/40"
          />
        </div>

        <div className="mb-4 flex flex-wrap justify-center gap-1.5">
          {QUICK.map((q) => {
            const active = amount === String(q);
            return (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(String(q))}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "grad-chip"
                    : "bg-surface-muted text-foreground hover:text-primary"
                }`}
              >
                {q / 1000}rb
              </button>
            );
          })}
        </div>

        <p className="mb-1.5 text-[11px] text-muted">{t("receipt.category")}</p>
        <div className="mb-4 flex flex-wrap gap-2">
          {tiles.map((c) => {
            const active = category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                title={categoryDisplayName(c, t)}
                aria-label={categoryDisplayName(c, t)}
                aria-pressed={active}
                className="grid h-10 w-10 place-items-center rounded-xl text-lg transition"
                style={
                  active
                    ? { background: c.color, boxShadow: `0 0 0 2px ${c.color}55` }
                    : { background: "var(--surface-muted)" }
                }
              >
                {c.icon}
              </button>
            );
          })}
          {!showAllCats && hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAllCats(true)}
              aria-label={t("add.moreCategories", { n: hiddenCount })}
              className="grid h-10 w-10 place-items-center rounded-xl bg-surface-muted text-base text-muted transition hover:text-foreground"
            >
              •••
            </button>
          )}
        </div>

        {visibleMembers.length > 0 && (
          <>
            <p className="mb-1.5 text-[11px] text-muted">{t("receipt.member")}</p>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {visibleMembers.map((m) => {
                const active = member === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMember(m.id)}
                    aria-pressed={active}
                    className={`rounded-[10px] px-2.5 py-1.5 text-[12.5px] font-medium transition ${
                      active
                        ? "grad-chip"
                        : "bg-surface-muted text-foreground hover:text-primary"
                    }`}
                  >
                    <span className="mr-1">{m.icon}</span>
                    {memberDisplayName(m, t)}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <input
          value={merchant}
          maxLength={80}
          placeholder={t("receipt.merchant")}
          onChange={(e) => setMerchant(e.target.value)}
          className="mb-2 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
        />

        <input
          value={note}
          maxLength={280}
          placeholder={t("add.note")}
          onChange={(e) => setNote(e.target.value)}
          className="mb-4 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
        />

        <div className="mt-auto flex items-center gap-2.5">
          <div className="shrink-0">
            <DatePicker value={date} onChange={setDate} max={todayISO()} />
          </div>
          <button
            onClick={save}
            disabled={saving || !amount}
            className="grad-primary flex-1 rounded-[14px] px-4 py-3 text-sm font-semibold transition disabled:opacity-50"
          >
            {saving ? t("edit.saving") : t("add.save")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
