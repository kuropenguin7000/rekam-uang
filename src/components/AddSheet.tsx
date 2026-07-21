"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

/** Drag further than this and releasing dismisses instead of snapping back. */
const DISMISS_PX = 110;

/** Must match .sheet-move's transform duration so onClose fires on arrival. */
const CLOSE_MS = 260;

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

  // --- swipe-to-dismiss -----------------------------------------------------
  // drag: live finger offset in px. touched: the entrance animation must not
  // replay after a snap-back, so it is dropped for good on the first drag.
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [touched, setTouched] = useState(false);
  const [closing, setClosing] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const active = useRef(false);

  /** Play the exit transition, then unmount. */
  const requestClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, CLOSE_MS);
  }, [onClose]);

  function onTouchStart(e: React.TouchEvent) {
    // Only the phone sheet drags; from sm: up this is a centred dialog.
    if (window.innerWidth >= 640 || closing) return;
    const fromHandle = (e.target as HTMLElement).closest("[data-sheet-grip]");
    // Anywhere else, dragging must not steal a scroll that has somewhere to go.
    if (!fromHandle && (sheetRef.current?.scrollTop ?? 0) > 0) return;
    startY.current = e.touches[0].clientY;
    active.current = true;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!active.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy <= 0) {
      // Upward: hand the gesture back to the scroller.
      setDrag(0);
      setDragging(false);
      return;
    }
    setTouched(true);
    setDragging(true);
    setDrag(dy);
  }

  function onTouchEnd() {
    if (!active.current) return;
    active.current = false;
    setDragging(false);
    // Either way the inline offset goes: on dismiss .sheet-closing takes over
    // and carries it the rest of the way down, so a leftover inline transform
    // would just pin the sheet where the finger left it.
    setDrag(0);
    if (drag > DISMISS_PX) requestClose();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [requestClose]);

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
    requestClose();
  }

  const tiles = showAllCats ? visibleCats : visibleCats.slice(0, TILE_LIMIT);
  const hiddenCount = visibleCats.length - TILE_LIMIT;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm transition-opacity duration-200 sm:justify-center sm:p-4 ${
        closing ? "opacity-0" : "animate-fade"
      }`}
      onClick={requestClose}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-sheet-title"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        style={drag ? { transform: `translateY(${drag}px)` } : undefined}
        className={`mx-auto flex max-h-[92vh] w-full flex-col overflow-y-auto rounded-t-[28px] border-t border-border bg-surface px-[18px] pb-5 pt-2.5 shadow-[0_-20px_50px_-10px_rgba(0,0,0,.6)] sm:max-w-md sm:rounded-[24px] sm:border ${
          touched || closing ? "" : "animate-sheet"
        } ${dragging ? "" : "sheet-move"} ${closing ? "sheet-closing" : ""}`}
      >
        {/* Grab handle — the affordance that says "this drags", phone only.
            touch-action: none on the grip so the gesture is ours even when the
            sheet content is scrolled down. */}
        <div data-sheet-grip className="shrink-0 touch-none">
          <div className="mx-auto mb-3.5 mt-0.5 h-[5px] w-10 rounded-full bg-surface-muted sm:hidden" />

          <h3 id="add-sheet-title" className="mb-3 text-[15px] font-semibold">
            {t("add.title")}
          </h3>
        </div>

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
                        ? "grad-primary"
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
