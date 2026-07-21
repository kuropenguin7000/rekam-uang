"use client";

import { useExpenses } from "@/store/ExpenseStore";
import { useI18n } from "./I18nProvider";
import { categoryDisplayName } from "@/lib/categoryName";
import { formatCompact, formatCurrency } from "@/lib/format";
import type { CategoryBar } from "@/lib/stats";

/**
 * The 1b donut: one ring segmented by category, with spent / budget / left in
 * the middle.
 *
 * Drawn with a conic-gradient rather than SVG arcs — the segments are just
 * cumulative percentages, and a masked centre gives the donut hole, so there is
 * no path maths and nothing to keep in sync when a category is renamed.
 */
export function BudgetRing({
  bars,
  spent,
  budget,
}: {
  bars: CategoryBar[];
  spent: number;
  budget: number;
}) {
  const { categoryMeta } = useExpenses();
  const { t } = useI18n();

  const totalSpent = bars.reduce((s, b) => s + b.value, 0);
  const remaining = budget - spent;

  // Build the conic stops: each category occupies its share of the circle.
  let acc = 0;
  const stops: string[] = [];
  for (const b of bars) {
    const share = totalSpent > 0 ? (b.value / totalSpent) * 100 : 0;
    const color = categoryMeta(b.id).color;
    stops.push(`${color} ${acc}% ${acc + share}%`);
    acc += share;
  }
  // An empty month still needs a full circle, or the ring collapses.
  const ring =
    stops.length > 0
      ? `conic-gradient(${stops.join(",")})`
      : "conic-gradient(var(--surface-muted) 0 100%)";

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative grid h-[216px] w-[216px] place-items-center rounded-full"
        style={{ background: ring }}
        role="img"
        aria-label={t("ring.spentOf", {
          spent: formatCurrency(spent),
          budget: formatCurrency(budget),
        })}
      >
        {/* The hole is filled with the page colour, which is what turns the
            pie into a ring. */}
        <div className="absolute inset-[30px] flex flex-col items-center justify-center rounded-full bg-background text-center">
          <span className="text-xs text-muted">{t("ring.spentThisMonth")}</span>
          <span className="num my-0.5 text-[28px] font-bold leading-none tracking-tight">
            Rp {formatCompact(spent)}
          </span>
          <span className="text-xs text-muted">
            {t("ring.ofBudget", { budget: "Rp " + formatCompact(budget) })}
          </span>
          <span
            className={`mt-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              remaining >= 0
                ? "bg-success-soft text-success"
                : "bg-danger-soft text-danger"
            }`}
          >
            {remaining >= 0
              ? t("ring.left", { amount: "Rp " + formatCompact(remaining) })
              : t("ring.over", { amount: "Rp " + formatCompact(-remaining) })}
          </span>
        </div>
      </div>

      {/* Legend chips — the ring's key, and a compact per-category readout. */}
      {bars.length > 0 && (
        <div className="mt-4 flex w-full flex-wrap gap-2">
          {bars.map((b) => {
            const meta = categoryMeta(b.id);
            return (
              <span
                key={b.id}
                className="card flex min-w-[calc(50%-0.25rem)] flex-1 items-center gap-2 rounded-xl px-2.5 py-2 text-xs"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                  style={{ background: meta.color }}
                />
                <span className="min-w-0 truncate">
                  {categoryDisplayName(meta, t)}
                </span>
                <b className="num ml-auto shrink-0 font-semibold">
                  {formatCompact(b.value)}
                </b>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
