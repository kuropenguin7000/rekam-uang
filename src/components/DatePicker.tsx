"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toISO, todayISO } from "@/lib/format";
import { useI18n } from "./I18nProvider";

interface Props {
  /** ISO yyyy-mm-dd */
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
}

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** A themed calendar date picker that replaces the native `<input type=date>`. */
export function DatePicker({ value, onChange, min, max }: Props) {
  const { locale, t } = useI18n();
  const tag = locale === "en" ? "en-US" : "id-ID";
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => parseISO(value || todayISO()));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setView(parseISO(value || todayISO()));
  }, [open, value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const triggerLabel = useMemo(() => {
    if (!value) return "—";
    return new Intl.DateTimeFormat(tag, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(parseISO(value));
  }, [value, tag]);

  const weekdays = useMemo(
    () =>
      [...Array(7)].map((_, i) =>
        // 2024-01-01 is a Monday → week starts Monday
        new Intl.DateTimeFormat(tag, { weekday: "short" }).format(
          new Date(2024, 0, 1 + i)
        )
      ),
    [tag]
  );

  const monthTitle = useMemo(
    () =>
      new Intl.DateTimeFormat(tag, { month: "long", year: "numeric" }).format(
        view
      ),
    [view, tag]
  );

  const grid = useMemo(() => {
    const year = view.getFullYear();
    const month = view.getMonth();
    const first = new Date(year, month, 1);
    // Monday-based offset (getDay: 0=Sun..6=Sat)
    const lead = (first.getDay() + 6) % 7;
    const days: (Date | null)[] = [];
    for (let i = 0; i < lead; i++) days.push(null);
    const count = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= count; d++) days.push(new Date(year, month, d));
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [view]);

  const disabled = (iso: string) =>
    (!!min && iso < min) || (!!max && iso > max);

  function pick(d: Date) {
    const iso = toISO(d);
    if (disabled(iso)) return;
    onChange(iso);
    setOpen(false);
  }

  const todayIso = todayISO();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none transition hover:border-primary focus:border-primary"
      >
        <CalendarIcon />
        <span className="tabular-nums">{triggerLabel}</span>
      </button>

      {open && (
        <div className="absolute start-0 top-full z-30 mt-2 w-72 rounded-2xl border border-border bg-surface p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-surface-muted hover:text-foreground"
              aria-label="Prev"
            >
              ‹
            </button>
            <span className="text-sm font-semibold capitalize">{monthTitle}</span>
            <button
              type="button"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-surface-muted hover:text-foreground"
              aria-label="Next"
            >
              ›
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted">
            {weekdays.map((w) => (
              <span key={w} className="py-1">
                {w}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {grid.map((d, i) => {
              if (!d) return <span key={i} />;
              const iso = toISO(d);
              const isSelected = iso === value;
              const isToday = iso === todayIso;
              const isDisabled = disabled(iso);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => pick(d)}
                  className={`grid h-8 place-items-center rounded-lg text-sm tabular-nums transition ${
                    isSelected
                      ? "bg-primary font-semibold text-white"
                      : isDisabled
                        ? "text-muted/40"
                        : "hover:bg-surface-muted"
                  } ${!isSelected && isToday ? "ring-1 ring-primary/50" : ""}`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-end border-t border-border pt-2">
            <button
              type="button"
              disabled={disabled(todayIso)}
              onClick={() => {
                onChange(todayIso);
                setOpen(false);
              }}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-primary transition hover:underline disabled:text-muted/50 disabled:no-underline"
            >
              {t("dash.today")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      className="h-4 w-4 text-muted"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
