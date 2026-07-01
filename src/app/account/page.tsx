"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeProvider";
import { Avatar } from "@/components/Avatar";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { CategoryManager } from "@/components/CategoryManager";
import { useI18n } from "@/components/I18nProvider";

interface Me {
  user: {
    email: string;
    name: string | null;
    image: string | null;
    role: string;
    plan: string;
    planExpiresAt: string | null;
  };
  usage: {
    parse: { used: number; limit: number };
    analyze: { used: number; limit: number };
  };
  aiEnabled: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export default function AccountPage() {
  const { t, locale } = useI18n();
  const [me, setMe] = useState<Me | null>(null);
  const [upgraded, setUpgraded] = useState(false);

  const limitText = (used: number, limit: number) =>
    Number.isFinite(limit)
      ? t("acc.limitFmt", { used, limit })
      : t("acc.unlimitedFmt", { used });

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe);
    if (new URLSearchParams(window.location.search).get("upgraded") === "1") {
      setUpgraded(true);
    }
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    // Drop the per-tab chat transcript + notification log so the next sign-in
    // starts clean (these are per-browser, not per-user).
    try {
      sessionStorage.removeItem("sw_chat_messages");
      localStorage.removeItem("sw_notif_log");
    } catch {
      /* storage unavailable — ignore */
    }
    window.location.href = "/login";
  }

  const isMaster = me?.user.role === "master";
  const isPro = me?.user.plan === "pro" || isMaster;

  const dtLocale = locale === "id" ? "id-ID" : "en-GB";
  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString(dtLocale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const expiresAt = me?.user.planExpiresAt ?? null;
  const daysLeft = expiresAt
    ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / DAY_MS)
    : null;
  const daysLeftText =
    daysLeft === null
      ? ""
      : daysLeft <= 0
        ? t("acc.subExpiredLabel")
        : daysLeft === 1
          ? t("acc.subLastDay")
          : t("acc.subDaysLeft", { days: daysLeft });

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm font-medium text-muted hover:text-foreground">
          {t("acc.back")}
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>

      <h1 className="mb-6 text-2xl font-bold">{t("acc.title")}</h1>

      {upgraded && (
        <div className="mb-5 rounded-2xl border border-success/30 bg-success-soft px-4 py-3 text-sm font-medium text-success">
          {t("acc.upgraded")}
        </div>
      )}

      {!me ? (
        <div className="grid h-32 place-items-center text-sm text-muted">
          {t("common.loading")}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <Avatar
              name={me.user.name}
              email={me.user.email}
              image={me.user.image}
              className="h-14 w-14 text-xl"
            />
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {me.user.name ?? t("acc.user")}
              </p>
              <p className="truncate text-sm text-muted">{me.user.email}</p>
              <Link
                href="/pricing"
                className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold transition hover:opacity-80 ${
                  isPro ? "bg-primary-soft text-primary" : "bg-surface-muted text-muted"
                }`}
              >
                {isMaster
                  ? t("badge.master")
                  : isPro
                    ? t("badge.pro")
                    : t("badge.free")}
              </Link>
            </div>
          </div>

          {/* Subscription */}
          {isPro && (
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold">{t("acc.subTitle")}</h2>

              {isMaster ? (
                <p className="text-sm text-muted">{t("acc.subMasterNote")}</p>
              ) : expiresAt ? (
                <div className="space-y-1 text-sm">
                  <Row
                    label={t("acc.subActiveUntil")}
                    value={formatDateTime(expiresAt)}
                  />
                  <p
                    className={`text-right text-xs font-medium ${
                      daysLeft !== null && daysLeft <= 0
                        ? "text-danger"
                        : daysLeft !== null && daysLeft <= 7
                          ? "text-warning"
                          : "text-muted"
                    }`}
                  >
                    {daysLeftText}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted">{t("acc.subNoExpiry")}</p>
              )}

              {!isMaster && (
                <Link
                  href="/pricing?renew=1"
                  className="mt-4 block rounded-xl border border-primary px-4 py-2 text-center text-sm font-semibold text-primary hover:bg-primary-soft"
                >
                  {t("acc.subRenew")}
                </Link>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold">{t("acc.usageToday")}</h2>
            <div className="space-y-2 text-sm">
              <Row
                label={t("acc.parseRow")}
                value={limitText(me.usage.parse.used, me.usage.parse.limit)}
              />
              <Row
                label={t("acc.analyzeRow")}
                value={limitText(me.usage.analyze.used, me.usage.analyze.limit)}
              />
            </div>
            <p className="mt-3 text-xs text-muted">
              {me.aiEnabled ? t("acc.poweredClaude") : t("acc.poweredLocal")}
            </p>
          </div>

          <CategoryManager />

          {!isPro && (
            <Link
              href="/pricing"
              className="block rounded-2xl bg-primary px-5 py-3 text-center text-sm font-semibold text-white hover:opacity-90"
            >
              {t("acc.upgradeCta")}
            </Link>
          )}

          <button
            onClick={logout}
            className="w-full rounded-2xl border border-border px-5 py-3 text-sm font-semibold text-danger hover:bg-danger-soft"
          >
            {t("acc.logout")}
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
