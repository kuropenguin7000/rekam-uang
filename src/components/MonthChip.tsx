"use client";

import { addMonths, isCurrentMonth, monthLabel } from "@/lib/period";
import { useI18n } from "./I18nProvider";

/**
 * The "Juli 2026 ◂ ▸" period control shared by Beranda and Statistik.
 *
 * The mockup draws a single chip with a caret. A dropdown of months would need
 * a scrolling list on a phone, so this steps one month at a time instead —
 * same footprint, one tap per month, and it cannot land on an empty far-future
 * month because stepping forward past the current month is disabled.
 */
export function MonthChip({
  month,
  onChange,
  tone = "solid",
}: {
  month: string;
  onChange: (iso: string) => void;
  /** "onHero" sits on the gradient hero; "solid" on the page background. */
  tone?: "solid" | "onHero";
}) {
  const { locale } = useI18n();
  const atCurrent = isCurrentMonth(month);

  const base =
    tone === "onHero"
      ? "bg-white/20 text-white"
      : "card bg-surface text-foreground";
  const arrow =
    tone === "onHero"
      ? "text-white/70 hover:text-white disabled:text-white/25"
      : "text-muted hover:text-foreground disabled:text-muted/40";

  return (
    <div
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-1 py-0.5 text-[11px] font-semibold ${base}`}
    >
      <button
        type="button"
        onClick={() => onChange(addMonths(month, -1))}
        aria-label="−1"
        className={`grid h-5 w-5 place-items-center rounded-full transition ${arrow}`}
      >
        ‹
      </button>
      <span className="min-w-[68px] whitespace-nowrap text-center tabular-nums">
        {monthLabel(month, locale)}
      </span>
      <button
        type="button"
        onClick={() => onChange(addMonths(month, 1))}
        disabled={atCurrent}
        aria-label="+1"
        className={`grid h-5 w-5 place-items-center rounded-full transition disabled:cursor-not-allowed ${arrow}`}
      >
        ›
      </button>
    </div>
  );
}
