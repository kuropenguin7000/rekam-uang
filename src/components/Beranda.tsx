"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useExpenses } from "@/store/ExpenseStore";
import { useI18n } from "./I18nProvider";
import { Avatar } from "./Avatar";
import { NotificationBell } from "./NotificationBell";
import { MonthChip } from "./MonthChip";
import { PeriodTabs } from "./PeriodTabs";
import { BudgetRing } from "./BudgetRing";
import { categoryDisplayName } from "@/lib/categoryName";
import { memberDisplayName } from "@/lib/memberName";
import {
  formatCurrency,
  formatCompact,
  formatDayMonth,
  startOfMonthISO,
  todayISO,
} from "@/lib/format";
import {
  daysLeftInMonth,
  isCurrentMonth,
  periodBounds,
  type HomePeriod,
} from "@/lib/period";
import { categoryBars, inBounds, spentOn, spentThisWeek } from "@/lib/stats";
import { total } from "@/lib/aggregate";
import type { MessageKey } from "@/i18n/messages";

/** Greeting keyed to the local clock, matching the mockup's "Selamat siang". */
function greetingKey(): MessageKey {
  const h = new Date().getHours();
  if (h < 11) return "home.greetMorning";
  if (h < 15) return "home.greetNoon";
  if (h < 19) return "home.greetAfternoon";
  return "home.greetEvening";
}

/** Which Beranda the user prefers: 1a's dense cards or 1b's budget ring. */
type HomeStyle = "dense" | "ring";
const STYLE_KEY = "sw_home_style";

export function Beranda({
  onSeeAll,
}: {
  /** Hands the active filter to the list so it opens on the same window. */
  onSeeAll: (period: HomePeriod, month: string) => void;
}) {
  const { transactions, budget, user, categoryMeta, memberMeta } = useExpenses();
  const { t } = useI18n();
  const [month, setMonth] = useState(() => startOfMonthISO(todayISO()));
  const [period, setPeriod] = useState<HomePeriod>("month");
  const [style, setStyle] = useState<HomeStyle>("dense");

  // Restore the preferred layout after hydration, never as a state initializer
  // — reading localStorage during render would desync the prerendered HTML.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STYLE_KEY);
      if (saved === "ring" || saved === "dense") setStyle(saved);
    } catch {
      /* storage unavailable — keep the default */
    }
  }, []);

  function chooseStyle(next: HomeStyle) {
    setStyle(next);
    try {
      localStorage.setItem(STYLE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const bounds = useMemo(() => periodBounds(period, month), [period, month]);
  const rows = useMemo(() => inBounds(transactions, bounds), [transactions, bounds]);
  const spent = useMemo(() => total(rows), [rows]);
  const bars = useMemo(() => categoryBars(rows), [rows]);
  const recent = rows.slice(0, 3);

  const remaining = budget - spent;
  const pctLeft = budget > 0 ? Math.max(0, Math.round((remaining / budget) * 100)) : 0;
  const usedPct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  const over = remaining < 0;
  const todaySpend = spentOn(transactions, todayISO());
  const weekSpend = useMemo(() => spentThisWeek(transactions), [transactions]);
  const firstName = (user?.name ?? "").split(" ")[0] || t("acc.user");

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted">{t(greetingKey())}</p>
          <p className="truncate text-[17px] font-semibold">{firstName} 👋</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StyleToggle value={style} onChange={chooseStyle} />
          <div className="sm:hidden">
            <NotificationBell />
          </div>
          <Link href="/account" aria-label={t("account.aria")} className="sm:hidden">
            <Avatar
              name={user?.name}
              email={user?.email}
              image={user?.image}
              className="h-9 w-9 text-sm"
            />
          </Link>
        </div>
      </header>

      <PeriodTabs value={period} onChange={setPeriod} />

      {style === "ring" ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{t("home.byCategory")}</h2>
            <PeriodLabel period={period} month={month} onMonth={setMonth} />
          </div>
          <BudgetRing bars={bars} spent={spent} budget={budget} />
        </>
      ) : (
        <>
          {/* HERO — the single "answer first" figure. */}
          <section className="hero-grad relative overflow-hidden rounded-[22px] p-[18px]">
            {/*
              Kept fully inside the hero's box. It used to sit at -right-5/-top-8
              and rely on the parent's overflow-hidden to clip it, but Safari
              does not reliably clip absolutely-positioned children inside a
              rounded overflow-hidden box — the 4px that escaped past the right
              edge was enough to make the whole page scroll sideways on iOS.
              The gradient fades to transparent, so containing it looks the same.
            */}
            <div
              aria-hidden
              className="pointer-events-none absolute right-0 top-0 h-[120px] w-[120px] rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(255,255,255,.22), transparent 70%)",
              }}
            />
            <div className="relative flex items-center justify-between gap-2">
              <span className="whitespace-nowrap text-[12.5px] text-white/85">
                {over ? t("home.overBudget") : t("home.remaining")}
              </span>
              <PeriodLabel
                period={period}
                month={month}
                onMonth={setMonth}
                tone="onHero"
              />
            </div>
            <p className="num relative mt-1.5 text-[32px] font-bold leading-none tracking-tight">
              {formatCurrency(Math.abs(remaining))}
            </p>
            <p className="relative mt-1 text-xs text-white/80">
              {over
                ? t("home.overOf", { budget: formatCurrency(budget) })
                : t("home.pctLeft", {
                    pct: pctLeft,
                    budget: formatCurrency(budget),
                  })}
            </p>
            <div className="relative my-3 h-[7px] overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full rounded-full bg-white transition-[width] duration-500"
                style={{ width: `${usedPct}%` }}
              />
            </div>
            <div className="relative flex justify-between gap-2 text-[11.5px] text-white/80">
              <span className="truncate">
                {t("home.used", { amount: formatCurrency(spent) })}
              </span>
              {period === "month" && isCurrentMonth(month) && (
                <span className="shrink-0">
                  {t("home.daysLeft", { n: daysLeftInMonth(month) })}
                </span>
              )}
            </div>
          </section>

          {/* Quick stat strip */}
          <div className="grid grid-cols-3 gap-2">
            <QuickStat label={t("home.today")} value={"Rp " + formatCompact(todaySpend)} />
            <QuickStat
              label={t("period.week")}
              value={"Rp " + formatCompact(weekSpend)}
            />
            <QuickStat label={t("dash.txCount")} value={String(rows.length)} />
          </div>

          {/* Category bars — these replaced the pie chart. */}
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">{t("home.byCategory")}</h2>
            </div>
            {bars.length === 0 ? (
              <p className="card p-4 text-center text-xs text-muted">
                {t("home.empty")}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {bars.slice(0, 5).map((b) => {
                  const meta = categoryMeta(b.id);
                  return (
                    <div key={b.id} className="flex items-center gap-[11px]">
                      <span
                        className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[10px] text-[15px]"
                        style={{ background: meta.color + "22" }}
                      >
                        {meta.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between gap-2 text-[12.5px]">
                          <span className="truncate">
                            {categoryDisplayName(meta, t)}
                          </span>
                          <span className="num shrink-0 font-semibold">
                            {formatCurrency(b.value)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-surface-muted">
                          <div
                            className="h-full rounded-full transition-[width] duration-500"
                            style={{
                              width: `${Math.max(4, b.ratio * 100)}%`,
                              background: meta.color,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {/* Recent activity — condensed; the full list lives behind "Lihat semua". */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">{t("home.recent")}</h2>
          <button
            onClick={() => onSeeAll(period, month)}
            className="text-[11.5px] font-medium text-primary hover:underline"
          >
            {t("home.seeAll")}
          </button>
        </div>
        {recent.length === 0 ? (
          <p className="card p-4 text-center text-xs text-muted">{t("dash.noTx")}</p>
        ) : (
          <ul>
            {recent.map((tx, i) => {
              const cat = categoryMeta(tx.category);
              const mem = memberMeta(tx.member);
              return (
                <li
                  key={tx.id}
                  style={{ animationDelay: `${i * 40}ms` }}
                  className="animate-row flex items-center gap-[11px] border-t border-surface-muted py-2.5 first:border-t-0"
                >
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[15px]"
                    style={{ background: cat.color + "22" }}
                  >
                    {cat.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium">
                      {tx.merchant || categoryDisplayName(cat, t)}
                    </p>
                    <p className="truncate text-[11px] text-muted">
                      {mem ? `${mem.icon} ${memberDisplayName(mem, t)} · ` : ""}
                      {formatDayMonth(tx.date)}
                    </p>
                  </div>
                  <span className="num shrink-0 text-[12.5px] font-semibold">
                    {formatCurrency(tx.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * The month stepper only means something while the month filter is active;
 * for week/all it becomes a static label so the row keeps its shape.
 */
function PeriodLabel({
  period,
  month,
  onMonth,
  tone = "solid",
}: {
  period: HomePeriod;
  month: string;
  onMonth: (iso: string) => void;
  tone?: "solid" | "onHero";
}) {
  const { t } = useI18n();
  if (period === "month") {
    return <MonthChip month={month} onChange={onMonth} tone={tone} />;
  }
  return (
    <span
      className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        tone === "onHero" ? "bg-white/20 text-white" : "card text-muted"
      }`}
    >
      {t(period === "week" ? "period.week" : "period.all")}
    </span>
  );
}

/** Switches Beranda between 1a (dense) and 1b (ring). */
function StyleToggle({
  value,
  onChange,
}: {
  value: HomeStyle;
  onChange: (v: HomeStyle) => void;
}) {
  const { t } = useI18n();
  return (
    <button
      onClick={() => onChange(value === "dense" ? "ring" : "dense")}
      aria-label={t("home.toggleLayout")}
      title={t("home.toggleLayout")}
      className="card grid h-9 w-9 place-items-center rounded-full text-muted transition hover:text-foreground"
    >
      {value === "dense" ? (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3.5" />
        </svg>
      ) : (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h10" />
        </svg>
      )}
    </button>
  );
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-[11px]">
      <p className="truncate text-[11px] text-muted">{label}</p>
      <p className="num mt-1 text-[15px] font-bold">{value}</p>
    </div>
  );
}
