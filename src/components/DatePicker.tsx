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

// month-name → 0-based index, for every locale we render ("juni", "jun", "june" …)
const MONTH_LOOKUP: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  for (const tag of ["id-ID", "en-US"]) {
    for (const width of ["long", "short"] as const) {
      const fmt = new Intl.DateTimeFormat(tag, { month: width });
      for (let m = 0; m < 12; m++) {
        const name = fmt
          .format(new Date(2024, m, 1))
          .toLowerCase()
          .replace(/\.$/, "");
        map[name] = m;
      }
    }
  }
  return map;
})();

/** Build a validated ISO date, or null when out of range (e.g. 31 Feb). */
function buildISO(y: number, m1: number, d: number): string | null {
  if (m1 < 1 || m1 > 12) return null;
  if (d < 1 || d > new Date(y, m1, 0).getDate()) return null;
  return toISO(new Date(y, m1 - 1, d));
}

/**
 * Parse a typed date. Accepts ISO (2026-06-23), numeric dd/mm/yyyy (also with
 * "-" or "."), and "23 Jun 2026" / "23 Juni 2026" with ID/EN month names.
 */
function parseInputDate(text: string): string | null {
  const s = text.trim().toLowerCase();
  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return buildISO(+m[1], +m[2], +m[3]);

  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    let y = +m[3];
    if (y < 100) y += 2000;
    return buildISO(y, +m[2], +m[1]);
  }

  m = s.match(/^(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})$/);
  if (m) {
    const month = MONTH_LOOKUP[m[2]];
    if (month === undefined) return null;
    return buildISO(+m[3], month + 1, +m[1]);
  }

  // "Jun 23, 2026" (en-US display order)
  m = s.match(/^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const month = MONTH_LOOKUP[m[1]];
    if (month === undefined) return null;
    return buildISO(+m[3], month + 1, +m[2]);
  }

  return null;
}

/** A themed calendar date picker that replaces the native `<input type=date>`. */
export function DatePicker({ value, onChange, min, max }: Props) {
  const { locale, t } = useI18n();
  const tag = locale === "en" ? "en-US" : "id-ID";
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [view, setView] = useState(() => parseISO(value || todayISO()));
  // Text being typed; null = not editing, show the formatted value.
  const [draft, setDraft] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Approximate rendered height of the calendar popover (header + grid + footer).
  const POPOVER_HEIGHT = 360;

  function openPopover() {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // Open upward when the calendar wouldn't fit below but does fit above.
      setDropUp(spaceBelow < POPOVER_HEIGHT && rect.top > POPOVER_HEIGHT);
    }
    setOpen(true);
  }

  /** Apply the typed text if it parses to an allowed date; else keep the old value. */
  function commitDraft() {
    if (draft !== null) {
      const iso = parseInputDate(draft);
      if (iso && !disabled(iso)) onChange(iso);
      setDraft(null);
    }
  }

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
    // Always 6 rows (42 cells) so the popover height never changes between
    // months — a 6-row month (e.g. March 2026) would otherwise shift layout.
    while (days.length < 42) days.push(null);
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
      <div
        onClick={() => {
          inputRef.current?.focus();
          openPopover();
        }}
        className="flex cursor-text items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm transition hover:border-primary focus-within:border-primary"
      >
        <CalendarIcon />
        <input
          ref={inputRef}
          type="text"
          value={draft ?? triggerLabel}
          onFocus={() => {
            setDraft(triggerLabel === "—" ? "" : triggerLabel);
            openPopover();
          }}
          onChange={(e) => {
            setDraft(e.target.value);
            // live-preview the typed month in the calendar
            const iso = parseInputDate(e.target.value);
            if (iso) setView(parseISO(iso));
          }}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault(); // don't submit an enclosing form
              commitDraft();
              setOpen(false);
              inputRef.current?.blur();
            } else if (e.key === "Escape") {
              setDraft(null);
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
          placeholder="23/06/2026"
          className="w-24 bg-transparent tabular-nums outline-none placeholder:text-muted/50"
          aria-label={triggerLabel}
        />
      </div>

      {open && (
        <div
          className={`absolute start-0 z-30 w-72 rounded-2xl border border-border bg-surface p-3 shadow-xl ${
            dropUp ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
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
              if (!d) return <span key={i} className="h-8" />;
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
