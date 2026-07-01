export type Locale = "id" | "en";

export interface LocaleMeta {
  code: Locale;
  /** native name shown in the switcher */
  label: string;
  /** short code shown on the trigger button */
  short: string;
  dir: "ltr" | "rtl";
}

export const LOCALES: LocaleMeta[] = [
  { code: "id", label: "Bahasa Indonesia", short: "ID", dir: "ltr" },
  { code: "en", label: "English (US)", short: "EN", dir: "ltr" },
];

export const DEFAULT_LOCALE: Locale = "id";
export const LOCALE_COOKIE = "lang";

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && LOCALES.some((l) => l.code === value);
}

export function dirOf(locale: Locale): "ltr" | "rtl" {
  return LOCALES.find((l) => l.code === locale)?.dir ?? "ltr";
}
