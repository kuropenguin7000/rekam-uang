"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import type { Insight } from "@/lib/types";
import { useExpenses } from "@/store/ExpenseStore";
import { useI18n } from "./I18nProvider";
import type { MessageKey } from "@/i18n/messages";
import { SparkIcon } from "./icons";

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
  // insights live in the store so they survive switching tabs
  const { analyze, aiEnabled, insights } = useExpenses();
  const { t } = useI18n();
  const [analyzing, setAnalyzing] = useState(false);
  const [limitMsg, setLimitMsg] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  async function runAnalyze() {
    setAnalyzing(true);
    setLimitMsg(null);
    const result = await analyze();
    setAnalyzing(false);
    if (result.error === "limit_reached" || result.error === "cooldown") {
      setLimitMsg(result.message ?? t("chat.limitDefault"));
      setShowUpgrade(result.error === "limit_reached");
    }
    // on success the store holds the new insights
  }

  const totalSaving =
    insights?.reduce((s, i) => s + (i.estimatedSaving ?? 0), 0) ?? 0;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary-soft to-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold">{t("ins.title")}</h2>
        <p className="mt-1 max-w-md text-sm text-muted">
          {t("ins.desc")}
          {aiEnabled ? t("ins.poweredClaude") : t("ins.poweredLocal")}
        </p>
        <button
          onClick={runAnalyze}
          disabled={analyzing}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-70"
        >
          {analyzing ? (
            <Spinner className="h-4 w-4" />
          ) : (
            <SparkIcon className="h-4 w-4" />
          )}
          {analyzing ? t("ins.analyzing") : t("ins.analyze")}
        </button>
      </div>

      {limitMsg && (
        <div className="rounded-2xl border border-warning/40 bg-danger-soft px-5 py-4">
          <p className="text-sm font-medium text-warning">{limitMsg}</p>
          {showUpgrade && (
            <Link
              href="/pricing"
              className="mt-1 inline-block text-sm font-semibold text-primary underline"
            >
              {t("ins.upgrade")}
            </Link>
          )}
        </div>
      )}

      {analyzing && (
        <div className="grid place-items-center gap-3 rounded-2xl border border-border bg-surface py-14 text-center shadow-sm">
          <Spinner className="h-7 w-7 text-primary" />
          <p className="text-sm font-medium text-muted">
            {t("ins.analyzingCard")}
          </p>
        </div>
      )}

      {!analyzing && insights && (
        <>
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
        </>
      )}

      {!insights && !analyzing && !limitMsg && (
        <div className="grid place-items-center rounded-2xl border border-dashed border-border py-12 text-center">
          <p className="text-sm text-muted">
            {t("ins.emptyPre")}
            <span className="font-medium">{t("ins.analyze")}</span>
            {t("ins.emptyPost")}
          </p>
        </div>
      )}
    </div>
  );
}

function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
