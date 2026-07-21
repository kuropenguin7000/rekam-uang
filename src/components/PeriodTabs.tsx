"use client";

import type { HomePeriod } from "@/lib/period";
import { useI18n } from "./I18nProvider";

const ITEMS: { id: HomePeriod; key: "period.week" | "period.month" | "period.all" }[] = [
  { id: "week", key: "period.week" },
  { id: "month", key: "period.month" },
  { id: "all", key: "period.all" },
];

/**
 * Minggu ini / Bulan ini / Semua — the segmented period control that sits above
 * the hero on both Beranda variants. The active segment takes the indigo
 * gradient from the mockup; the others are plain cards.
 */
export function PeriodTabs({
  value,
  onChange,
}: {
  value: HomePeriod;
  onChange: (p: HomePeriod) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex gap-1.5">
      {ITEMS.map((item) => {
        const active = value === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={`flex-1 whitespace-nowrap rounded-[11px] py-2 text-center text-[12.5px] font-semibold transition ${
              active ? "grad-chip" : "card text-muted hover:text-foreground"
            }`}
          >
            {t(item.key)}
          </button>
        );
      })}
    </div>
  );
}
