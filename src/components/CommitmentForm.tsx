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
import { monthLabel } from "@/lib/period";
import { monthKey, shiftMonth } from "@/lib/commitments";
import { lockBodyScroll } from "@/lib/scrollLock";
import type { CommitmentDraft, CommitmentKind } from "@/lib/types";

interface Row {
  month: string;
  amount: string;
}

/** Map → editable rows, in calendar order. */
function rowsFromSchedule(schedule: Record<string, number>): Row[] {
  return Object.entries(schedule)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({ month, amount: String(amount) }));
}

/** Rows → map. Later rows win if a month is picked twice. */
function scheduleFromRows(rows: Row[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const v = Math.round(Number(r.amount) || 0);
    if (v > 0) out[r.month] = v;
  }
  return out;
}

/**
 * Add / edit one subscription or instalment plan.
 *
 * Also used by the simulator to build a throwaway draft — it hands back a
 * CommitmentDraft and lets the caller decide whether to save it or just do
 * arithmetic with it, which is what keeps the simulation using exactly the
 * same shape as a real record.
 */
export function CommitmentForm({
  initial,
  submitLabel,
  onSubmit,
  onClose,
}: {
  initial?: CommitmentDraft;
  submitLabel?: string;
  onSubmit: (draft: CommitmentDraft) => void | Promise<void>;
  onClose: () => void;
}) {
  const { categories, members } = useExpenses();
  const { t, locale } = useI18n();

  const visibleCats = categories.filter((c) => !c.hidden);
  const visibleMembers = members.filter((m) => !m.hidden);

  const [kind, setKind] = useState<CommitmentKind>(initial?.kind ?? "subscription");
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [cycle, setCycle] = useState(initial?.cycle ?? "monthly");
  const [startDate, setStartDate] = useState(initial?.startDate ?? todayISO());
  const [tenor, setTenor] = useState(initial?.tenor ? String(initial.tenor) : "12");
  const [hasPromo, setHasPromo] = useState((initial?.introPeriods ?? 0) > 0);
  const [introAmount, setIntroAmount] = useState(
    initial?.introPeriods ? String(initial.introAmount) : ""
  );
  const [introPeriods, setIntroPeriods] = useState(
    initial?.introPeriods ? String(initial.introPeriods) : "3"
  );
  const [category, setCategory] = useState(
    initial?.category ?? visibleCats.find((c) => c.id === "bills")?.id ?? "other"
  );
  const [member, setMember] = useState(
    initial?.member ??
      (visibleMembers.some((m) => m.id === DEFAULT_MEMBER)
        ? DEFAULT_MEMBER
        : (visibleMembers[0]?.id ?? ""))
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);

  // Custom plan: one row per payment. Real invoices step the amount down and
  // skip months outright, which `amount × tenor` cannot express.
  const [custom, setCustom] = useState(
    Object.keys(initial?.schedule ?? {}).length > 0
  );
  const [rows, setRows] = useState<Row[]>(() =>
    rowsFromSchedule(initial?.schedule ?? {})
  );

  /** Seed the editor from the flat tenor/amount so it opens pre-filled. */
  function enableCustom() {
    setCustom(true);
    if (rows.length === 0) {
      const n = Math.min(24, Math.max(1, Math.round(Number(tenor) || 1)));
      const start = monthKey(startDate);
      setRows(
        Array.from({ length: n }, (_, i) => ({
          month: shiftMonth(start, i),
          amount: amount || "",
        }))
      );
    }
  }

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const customTotal = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const customCount = rows.filter((r) => Number(r.amount) > 0).length;

  const requestClose = () => {
    setClosing(true);
    setTimeout(onClose, 260);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    const release = lockBodyScroll();
    return () => {
      document.removeEventListener("keydown", onKey);
      release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const usingSchedule = kind === "installment" && custom;
  const amountValue = Number(amount);
  const valid =
    name.trim().length > 0 &&
    (usingSchedule
      ? customCount > 0
      : Number.isFinite(amountValue) && amountValue > 0);

  async function submit() {
    if (!valid) return;
    const schedule = usingSchedule ? scheduleFromRows(rows) : {};
    const months = Object.keys(schedule).sort();
    setSaving(true);
    await onSubmit({
      kind,
      name: name.trim(),
      // With a schedule these are display fallbacks: the first payment and the
      // number of payments. The schedule itself is what gets billed.
      amount: usingSchedule
        ? schedule[months[0]]
        : Math.round(amountValue),
      cycle: kind === "installment" ? "monthly" : cycle,
      startDate: usingSchedule ? months[0] + "-01" : startDate,
      introAmount: hasPromo && !usingSchedule ? Math.round(Number(introAmount) || 0) : 0,
      introPeriods:
        hasPromo && !usingSchedule ? Math.round(Number(introPeriods) || 0) : 0,
      tenor: usingSchedule
        ? months.length
        : kind === "installment"
          ? Math.round(Number(tenor) || 0)
          : 0,
      schedule,
      category,
      member,
      note: note.trim(),
      active: initial?.active ?? true,
    });
    setSaving(false);
    requestClose();
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm transition-opacity duration-200 sm:justify-center sm:p-4 ${
        closing ? "opacity-0" : "animate-fade"
      }`}
      onClick={requestClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="com-form-title"
        onClick={(e) => e.stopPropagation()}
        className={`mx-auto flex max-h-[92vh] w-full flex-col overflow-y-auto rounded-t-[28px] border-t border-border bg-surface px-[18px] pb-5 pt-2.5 shadow-[0_-20px_50px_-10px_rgba(0,0,0,.6)] sm:max-w-md sm:rounded-[24px] sm:border ${
          closing ? "sheet-move sheet-closing" : "animate-sheet"
        }`}
      >
        <div className="mx-auto mb-3.5 mt-0.5 h-[5px] w-10 shrink-0 rounded-full bg-surface-muted sm:hidden" />

        <h3 id="com-form-title" className="mb-3 text-[15px] font-semibold">
          {initial ? t("com.editTitle") : t("com.addTitle")}
        </h3>

        {/* Kind — the switch that decides which fields below matter. */}
        <div className="mb-4 flex gap-1.5">
          <KindTab
            active={kind === "subscription"}
            onClick={() => setKind("subscription")}
          >
            🔁 {t("com.kindSub")}
          </KindTab>
          <KindTab
            active={kind === "installment"}
            onClick={() => setKind("installment")}
          >
            🧾 {t("com.kindInst")}
          </KindTab>
        </div>

        <input
          autoFocus
          value={name}
          maxLength={60}
          placeholder={
            kind === "subscription" ? t("com.namePlaceSub") : t("com.namePlaceInst")
          }
          onChange={(e) => setName(e.target.value)}
          className="mb-3 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
        />

        {/* Hidden while a custom plan is on: each row carries its own amount,
            so a single headline figure would be a second source of truth. */}
        {!usingSchedule && (
          <div className="py-1 text-center">
            <p className="text-[11px] text-muted">
              {kind === "installment"
                ? t("com.amountPerMonth")
                : t("com.amountPerCycle")}
            </p>
            <input
              inputMode="numeric"
              value={amount ? "Rp " + groupDigits(amount) : ""}
              placeholder="Rp 0"
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              aria-label={t("com.amountPerCycle")}
              className="num mt-0.5 w-full bg-transparent text-center text-[30px] font-bold tracking-tight outline-none placeholder:text-muted/40"
            />
          </div>
        )}

        {kind === "subscription" ? (
          <>
            <p className="mb-1.5 mt-3 text-[11px] text-muted">{t("com.cycle")}</p>
            <div className="mb-4 flex gap-1.5">
              <KindTab active={cycle === "monthly"} onClick={() => setCycle("monthly")}>
                {t("com.monthly")}
              </KindTab>
              <KindTab active={cycle === "yearly"} onClick={() => setCycle("yearly")}>
                {t("com.yearly")}
              </KindTab>
            </div>

            {/* Promo. introPeriods is the switch, so a 0 price here is a free
                trial rather than "no promo". */}
            <label className="mb-2 flex items-center gap-2.5 text-[13px] font-medium">
              <input
                type="checkbox"
                checked={hasPromo}
                onChange={(e) => setHasPromo(e.target.checked)}
                className="h-4 w-4 accent-[#4f46e5]"
              />
              {t("com.hasPromo")}
            </label>

            {hasPromo && (
              <div className="mb-4 space-y-2 rounded-xl border border-border bg-surface-muted p-3">
                <div>
                  <p className="mb-1 text-[11px] text-muted">{t("com.promoPrice")}</p>
                  <input
                    inputMode="numeric"
                    value={introAmount ? "Rp " + groupDigits(introAmount) : ""}
                    placeholder={t("com.promoFree")}
                    onChange={(e) =>
                      setIntroAmount(e.target.value.replace(/\D/g, ""))
                    }
                    className="num w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <p className="mb-1 text-[11px] text-muted">
                    {cycle === "yearly" ? t("com.promoYears") : t("com.promoMonths")}
                  </p>
                  <input
                    inputMode="numeric"
                    value={introPeriods}
                    onChange={(e) =>
                      setIntroPeriods(e.target.value.replace(/\D/g, "").slice(0, 3))
                    }
                    className="num w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="mb-4 mt-3">
            <div className="mb-2 flex gap-1.5">
              <KindTab active={!custom} onClick={() => setCustom(false)}>
                {t("com.planFlat")}
              </KindTab>
              <KindTab active={custom} onClick={enableCustom}>
                {t("com.planCustom")}
              </KindTab>
            </div>

            {!custom ? (
              <>
                <p className="mb-1 text-[11px] text-muted">{t("com.tenor")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {[3, 6, 12, 24].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setTenor(String(n))}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        tenor === String(n)
                          ? "grad-chip"
                          : "bg-surface-muted text-foreground hover:text-primary"
                      }`}
                    >
                      {n}x
                    </button>
                  ))}
                  <input
                    inputMode="numeric"
                    value={tenor}
                    aria-label={t("com.tenor")}
                    onChange={(e) =>
                      setTenor(e.target.value.replace(/\D/g, "").slice(0, 3))
                    }
                    className="num w-16 rounded-full border border-border bg-surface px-3 py-1.5 text-center text-xs outline-none focus:border-primary"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-muted">{t("com.planCustomHint")}</p>

                <ul className="space-y-1.5">
                  {rows.map((r, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <span className="num w-6 shrink-0 text-[11px] text-muted">
                        {i + 1}.
                      </span>

                      {/* Month stepper — no keyboard, and it can jump over a
                          skipped month independently of its neighbours. */}
                      <div className="flex shrink-0 items-center rounded-lg border border-border bg-surface">
                        <button
                          type="button"
                          aria-label="−1"
                          onClick={() => setRow(i, { month: shiftMonth(r.month, -1) })}
                          className="grid h-8 w-6 place-items-center text-muted transition hover:text-foreground"
                        >
                          ‹
                        </button>
                        <span className="w-[74px] text-center text-[11.5px] font-medium">
                          {monthLabel(r.month + "-01", locale).slice(0, 3)}{" "}
                          {r.month.slice(2, 4)}
                        </span>
                        <button
                          type="button"
                          aria-label="+1"
                          onClick={() => setRow(i, { month: shiftMonth(r.month, 1) })}
                          className="grid h-8 w-6 place-items-center text-muted transition hover:text-foreground"
                        >
                          ›
                        </button>
                      </div>

                      <input
                        inputMode="numeric"
                        value={r.amount ? groupDigits(r.amount) : ""}
                        placeholder="0"
                        aria-label={t("com.planAmount", { n: i + 1 })}
                        onChange={(e) =>
                          setRow(i, { amount: e.target.value.replace(/\D/g, "") })
                        }
                        className="num min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-end text-[12.5px] outline-none focus:border-primary"
                      />

                      <button
                        type="button"
                        aria-label={t("dash.deleteAria")}
                        onClick={() => setRows((p) => p.filter((_, j) => j !== i))}
                        className="grid h-7 w-6 shrink-0 place-items-center rounded-md text-muted transition hover:text-danger"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setRows((p) => [
                        ...p,
                        {
                          month: p.length
                            ? shiftMonth(p[p.length - 1].month, 1)
                            : monthKey(startDate),
                          amount: "",
                        },
                      ])
                    }
                    className="rounded-lg bg-surface-muted px-3 py-1.5 text-xs font-semibold transition hover:text-primary"
                  >
                    + {t("com.planAddRow")}
                  </button>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setRows((p) =>
                          p.map((r, i) =>
                            i === 0 ? r : { ...r, amount: p[0].amount }
                          )
                        )
                      }
                      className="rounded-lg px-2 py-1.5 text-xs font-medium text-muted transition hover:text-foreground"
                    >
                      {t("com.planFill")}
                    </button>
                  )}
                </div>

                {/* The total is the number printed on the invoice — showing it
                    is how you catch a mistyped row. */}
                <div className="flex items-center justify-between rounded-xl bg-surface-muted px-3 py-2">
                  <span className="text-[11.5px] text-muted">
                    {t("com.planTotal", { n: customCount })}
                  </span>
                  <span className="num text-[13.5px] font-bold">
                    Rp {groupDigits(String(Math.round(customTotal)))}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <p className="mb-1.5 text-[11px] text-muted">{t("receipt.category")}</p>
        <div className="mb-4 flex flex-wrap gap-2">
          {visibleCats.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              title={categoryDisplayName(c, t)}
              aria-label={categoryDisplayName(c, t)}
              aria-pressed={category === c.id}
              className="grid h-10 w-10 place-items-center rounded-xl text-lg transition"
              style={
                category === c.id
                  ? { background: c.color, boxShadow: `0 0 0 2px ${c.color}55` }
                  : { background: "var(--surface-muted)" }
              }
            >
              {c.icon}
            </button>
          ))}
        </div>

        {visibleMembers.length > 0 && (
          <>
            <p className="mb-1.5 text-[11px] text-muted">{t("receipt.member")}</p>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {visibleMembers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMember(m.id)}
                  aria-pressed={member === m.id}
                  className={`rounded-[10px] px-2.5 py-1.5 text-[12.5px] font-medium transition ${
                    member === m.id
                      ? "grad-primary"
                      : "bg-surface-muted text-foreground hover:text-primary"
                  }`}
                >
                  <span className="mr-1">{m.icon}</span>
                  {memberDisplayName(m, t)}
                </button>
              ))}
            </div>
          </>
        )}

        <input
          value={note}
          maxLength={280}
          placeholder={t("add.note")}
          onChange={(e) => setNote(e.target.value)}
          className="mb-4 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
        />

        <div className="mt-auto flex items-center gap-2.5">
          {/* A custom plan sets its own start from the first row. */}
          {!usingSchedule && (
            <div className="shrink-0">
              <DatePicker value={startDate} onChange={setStartDate} />
            </div>
          )}
          <button
            onClick={submit}
            disabled={saving || !valid}
            className="grad-primary flex-1 rounded-[14px] px-4 py-3 text-sm font-semibold transition disabled:opacity-50"
          >
            {saving ? t("edit.saving") : (submitLabel ?? t("com.save"))}
          </button>
        </div>
        {!usingSchedule && (
          <p className="mt-2 text-center text-[11px] text-muted">
            {t("com.startHint")}
          </p>
        )}
      </div>
    </div>,
    document.body
  );
}

function KindTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-[11px] py-2 text-center text-[12.5px] font-semibold transition ${
        active ? "grad-primary" : "bg-surface-muted text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
