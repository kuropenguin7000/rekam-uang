"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useExpenses } from "@/store/ExpenseStore";
import { useI18n } from "./I18nProvider";
import { BellIcon } from "./icons";
import type { MessageKey } from "@/i18n/messages";
import {
  computeNotifications,
  type AppNotification,
  type NotificationSeverity,
} from "@/lib/notifications";

const LOG_STORAGE_KEY = "sw_notif_log";
/** Keep at most this many notifications; older ones are dropped (FIFO). */
const MAX_ITEMS = 20;

/** A notification materialised into the persistent log. */
type LogEntry = AppNotification & {
  /** dedupe signature (id + params) */
  key: string;
  createdAt: number;
  read: boolean;
};

const SEVERITY_STYLE: Record<NotificationSeverity, string> = {
  danger: "border-danger/30 bg-danger-soft",
  warning: "border-warning/30 bg-warning/10",
  info: "border-primary/30 bg-primary-soft",
  success: "border-success/30 bg-success-soft",
};

const SEVERITY_TEXT: Record<NotificationSeverity, string> = {
  danger: "text-danger",
  warning: "text-warning",
  info: "text-primary",
  success: "text-success",
};

/**
 * A notification's identity. Includes the params so a changed alert (a new
 * day's "daily budget reached", a higher over-budget amount) logs as a new
 * entry instead of being treated as the same one.
 */
function signatureOf(n: AppNotification): string {
  return `${n.id}|${JSON.stringify(n.params)}`;
}

function loadLog(): LogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is LogEntry =>
          e && typeof e.key === "string" && typeof e.titleKey === "string"
      )
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

function saveLog(log: LogEntry[]) {
  try {
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(log));
  } catch {
    /* ignore quota / availability errors */
  }
}

/**
 * Header notification bell. Alerts are derived from the live store (transactions
 * + budget + plan) via {@link computeNotifications}, then *materialised* into a
 * persistent log: each newly-active alert is appended once, the list is capped
 * at {@link MAX_ITEMS} (oldest dropped), and entries stay after being read (just
 * dimmed). The badge counts unread.
 */
export function NotificationBell() {
  const { user, transactions, budget, categoryBudgets } = useExpenses();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Load the persisted log on mount (client only — avoids hydration drift).
  useEffect(() => {
    setLog(loadLog());
    setLoaded(true);
  }, []);

  const persist = useCallback((next: LogEntry[]) => {
    setLog(next);
    saveLog(next);
  }, []);

  const notifications = useMemo(() => {
    if (!user) return [];
    return computeNotifications({
      plan: user.plan,
      role: user.role,
      planExpiresAt: user.planExpiresAt ?? null,
      budget,
      dailyBudget: user.dailyBudget,
      transactions,
      categoryBudgets,
      categoryLabel: (id) => t(`cat.${id}` as MessageKey),
    });
  }, [user, transactions, budget, categoryBudgets, t]);

  // Materialise newly-active alerts into the log (newest first, FIFO-capped).
  useEffect(() => {
    if (!loaded || !user) return;
    const existing = new Set(log.map((e) => e.key));
    const additions: LogEntry[] = notifications
      .filter((n) => !existing.has(signatureOf(n)))
      .map((n) => ({
        ...n,
        key: signatureOf(n),
        createdAt: Date.now(),
        read: false,
      }));
    if (additions.length === 0) return;
    persist([...additions, ...log].slice(0, MAX_ITEMS));
  }, [notifications, user, log, loaded, persist]);

  const unreadCount = useMemo(() => log.filter((e) => !e.read).length, [log]);

  const markRead = useCallback(
    (key: string) => {
      persist(log.map((e) => (e.key === key ? { ...e, read: true } : e)));
    },
    [log, persist]
  );

  const markAllRead = useCallback(() => {
    persist(log.map((e) => ({ ...e, read: true })));
  }, [log, persist]);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const count = log.length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("notif.aria")}
        aria-expanded={open}
        className="relative grid h-9 w-9 place-items-center rounded-full border border-border text-muted transition hover:text-foreground"
      >
        <BellIcon className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed right-3 top-[4.75rem] z-40 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-border bg-surface shadow-xl sm:absolute sm:right-0 sm:top-full sm:mt-2 sm:w-80">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">{t("notif.title")}</h3>
            {unreadCount > 0 ? (
              <button
                onClick={markAllRead}
                className="text-xs font-medium text-primary hover:underline"
              >
                {t("notif.markAllRead")}
              </button>
            ) : (
              count > 0 && (
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-muted">
                  {t("notif.allRead")}
                </span>
              )
            )}
          </div>

          {count === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">
              {t("notif.empty")}
            </p>
          ) : (
            <ul className="max-h-[60vh] space-y-2 overflow-y-auto p-3">
              {log.map((n) => {
                const unread = !n.read;
                return (
                  <li
                    key={n.key}
                    onClick={() => unread && markRead(n.key)}
                    className={`relative flex gap-3 rounded-xl border p-3 transition ${SEVERITY_STYLE[n.severity]} ${
                      unread ? "cursor-pointer" : "opacity-60"
                    }`}
                  >
                    {unread && (
                      <span
                        aria-hidden
                        className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger"
                      />
                    )}
                    <span className="text-lg leading-none">{n.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className={`pr-3 text-sm font-semibold ${SEVERITY_TEXT[n.severity]}`}>
                        {t(n.titleKey, n.params)}
                      </p>
                      <p className="mt-0.5 text-sm text-foreground/80">
                        {t(n.bodyKey, n.params)}
                      </p>
                      <div className="mt-2 flex items-center gap-3">
                        {n.action && (
                          <Link
                            href={n.action.href}
                            onClick={(e) => {
                              e.stopPropagation();
                              markRead(n.key);
                              setOpen(false);
                            }}
                            className={`text-xs font-semibold underline-offset-2 hover:underline ${SEVERITY_TEXT[n.severity]}`}
                          >
                            {t(n.action.labelKey)} →
                          </Link>
                        )}
                        {unread && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markRead(n.key);
                            }}
                            className="text-xs font-medium text-muted hover:text-foreground"
                          >
                            {t("notif.markRead")}
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
