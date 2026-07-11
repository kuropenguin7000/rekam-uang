"use client";

import { useMemo } from "react";
import { formatCurrency } from "@/lib/format";
import { generateInsights } from "@/lib/insights";
import type { Insight } from "@/lib/types";
import { useExpenses } from "@/store/ExpenseStore";
import { useI18n } from "./I18nProvider";
import type { MessageKey } from "@/i18n/messages";

const KIND_STYLE: Record<
  Insight["kind"],
  { ring: string; chip: string; labelKey: MessageKey; emoji: string }
> = {
  warning: {
    ring: "border-l-danger",
    chip: "bg-danger-soft text-danger",
    labelKey: "ins.kindWarning",
    emoji: "⚠️",
  },
  tip: {
    ring: "border-l-primary",
    chip: "bg-primary-soft text-primary",
    labelKey: "ins.kindTip",
    emoji: "💡",
  },
  positive: {
    ring: "border-l-success",
    chip: "bg-success-soft text-success",
    labelKey: "ins.kindPositive",
    emoji: "✅",
  },
};

export function InsightsPanel() {
  const { transactions, budget } = useExpenses();
  const { t, locale } = useI18n();

  const insights = useMemo(
    () => generateInsights(transactions, budget, locale),
    [transactions, budget, locale]
  );

  const totalSaving = insights.reduce((s, i) => s + (i.estimatedSaving ?? 0), 0);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary-soft to-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold">{t("ins.title")}</h2>
        <p className="mt-1 max-w-md text-sm text-muted">{t("ins.desc")}</p>
      </div>

      {totalSaving > 0 && (
        <div className="rounded-2xl border border-success/30 bg-success-soft px-5 py-4">
          <p className="text-sm text-muted">{t("ins.potential")}</p>
          <p className="text-2xl font-bold text-success">
            {formatCurrency(totalSaving)}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {insights.map((insight) => {
          const style = KIND_STYLE[insight.kind];
          return (
            <div
              key={insight.id}
              className={`animate-pop rounded-2xl border border-border border-l-4 bg-surface p-4 shadow-sm ${style.ring}`}
            >
              <div className="mb-1 flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${style.chip}`}
                >
                  {style.emoji} {t(style.labelKey)}
                </span>
                {insight.estimatedSaving ? (
                  <span className="ml-auto text-sm font-semibold text-success">
                    {t("ins.save", {
                      amount: formatCurrency(insight.estimatedSaving),
                    })}
                  </span>
                ) : null}
              </div>
              <h3 className="font-semibold">{insight.title}</h3>
              <p className="mt-1 text-sm text-muted">{insight.detail}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
