import type { UserMember } from "./types";
import type { MessageKey } from "@/i18n/messages";

/**
 * Display name for a member: a renamed built-in or custom member uses its own
 * label; a built-in with no override uses the localized `mem.<id>` name.
 */
export function memberDisplayName(
  member: UserMember,
  t: (key: MessageKey) => string
): string {
  if (member.builtin && !member.label) return t(`mem.${member.id}` as MessageKey);
  return member.label || member.id;
}
