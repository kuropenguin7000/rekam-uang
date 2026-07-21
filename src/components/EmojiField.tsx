"use client";

import { useI18n } from "./I18nProvider";

/**
 * Emoji picker for categories and family members.
 *
 * The input is the source of truth — ANY emoji the user can type (every phone
 * keyboard has an emoji panel) is accepted. The row underneath is shortcuts,
 * not the menu: an earlier version offered a fixed set of eight and that was
 * the whole vocabulary, so a household with a dog had no way to say so.
 */
export function EmojiField({
  value,
  onChange,
  suggestions,
  autoFocus,
}: {
  value: string;
  onChange: (next: string) => void;
  suggestions: string[];
  autoFocus?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-start gap-2">
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 8))}
        aria-label={t("emoji.label")}
        placeholder="🙂"
        className="h-10 w-11 shrink-0 rounded-lg border border-border bg-surface text-center text-lg outline-none focus:border-primary"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1">
          {suggestions.map((ic) => (
            <button
              key={ic}
              type="button"
              onClick={() => onChange(ic)}
              aria-label={ic}
              className={`grid h-8 w-8 place-items-center rounded-lg border text-base transition ${
                value === ic ? "border-primary bg-surface" : "border-transparent"
              }`}
            >
              {ic}
            </button>
          ))}
        </div>
        <p className="mt-0.5 text-[11px] text-muted">{t("emoji.hint")}</p>
      </div>
    </div>
  );
}
