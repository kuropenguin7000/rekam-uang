"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  dirOf,
  isLocale,
  type Locale,
} from "@/i18n/config";
import { messages, type MessageKey } from "@/i18n/messages";

type Vars = Record<string, string | number>;

interface I18nState {
  locale: Locale;
  dir: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, vars?: Vars) => string;
}

const I18nContext = createContext<I18nState | null>(null);

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    k in vars ? String(vars[k]) : `{${k}}`
  );
}

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    const dir = dirOf(next);
    document.documentElement.lang = next;
    document.documentElement.dir = dir;
    try {
      localStorage.setItem(LOCALE_COOKIE, next);
    } catch {
      /* ignore */
    }
  }, []);

  // Static export: the prerendered HTML is always in the default locale, so
  // restore the visitor's stored preference after hydration (an effect, not a
  // state initializer, to avoid hydration mismatches).
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(LOCALE_COOKIE);
    } catch {
      /* ignore */
    }
    if (isLocale(stored) && stored !== initialLocale) setLocale(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const t = useCallback(
    (key: MessageKey, vars?: Vars) => {
      const dict = messages[locale] ?? messages[DEFAULT_LOCALE];
      const template = dict[key] ?? messages[DEFAULT_LOCALE][key] ?? key;
      return interpolate(template, vars);
    },
    [locale]
  );

  const value = useMemo<I18nState>(
    () => ({ locale, dir: dirOf(locale), setLocale, t }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nState {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within an I18nProvider");
  return ctx;
}

export { isLocale };
