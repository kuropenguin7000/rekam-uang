"use client";

import { useEffect, useRef, useState } from "react";
import { LOCALES } from "@/i18n/config";
import { useI18n } from "./I18nProvider";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t("lang.aria")}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="grid h-9 min-w-9 place-items-center rounded-xl border border-border px-2 text-sm font-semibold text-muted transition hover:text-foreground"
      >
        {current.short}
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute end-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg"
        >
          {LOCALES.map((l) => (
            <li key={l.code}>
              <button
                role="option"
                aria-selected={l.code === locale}
                onClick={() => {
                  setLocale(l.code);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-sm transition hover:bg-surface-muted ${
                  l.code === locale ? "font-semibold text-primary" : "text-foreground"
                }`}
              >
                <span>{l.label}</span>
                {l.code === locale && <span aria-hidden>✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
