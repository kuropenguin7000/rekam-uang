import type { UserCategory } from "./types";
import type { MessageKey } from "@/i18n/messages";

/**
 * Display name for a category: a renamed built-in or custom category uses its
 * own label; a built-in with no override uses the localized `cat.<id>` name.
 */
export function categoryDisplayName(
  cat: UserCategory,
  t: (key: MessageKey) => string
): string {
  if (cat.builtin && !cat.label) return t(`cat.${cat.id}` as MessageKey);
  return cat.label || cat.id;
}
