"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { clientAuth } from "@/lib/firebaseClient";
import { ThemeToggle } from "@/components/ThemeProvider";
import { Avatar } from "@/components/Avatar";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { CategoryManager } from "@/components/CategoryManager";
import { MemberManager } from "@/components/MemberManager";
import { IncomePurge } from "@/components/IncomePurge";
import { useI18n } from "@/components/I18nProvider";

interface Profile {
  email: string;
  name: string | null;
  image: string | null;
}

export default function AccountPage() {
  const { t } = useI18n();
  const [profile, setProfile] = useState<Profile | null>(null);

  // No server middleware on static hosting — guard the page client-side.
  useEffect(() => {
    return onAuthStateChanged(clientAuth(), (u) => {
      if (!u) {
        window.location.replace("/login");
        return;
      }
      setProfile({
        email: u.email ?? "",
        name: u.displayName,
        image: u.photoURL,
      });
    });
  }, []);

  async function logout() {
    // Drop the notification log so the next sign-in starts clean (it is
    // per-browser, not per-user).
    try {
      localStorage.removeItem("sw_notif_log_v2");
    } catch {
      /* storage unavailable — ignore */
    }
    await signOut(clientAuth());
    window.location.href = "/login";
  }

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

      {!profile ? (
        <div className="grid h-32 place-items-center text-sm text-muted">
          {t("common.loading")}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <Avatar
              name={profile.name}
              email={profile.email}
              image={profile.image}
              className="h-14 w-14 text-xl"
            />
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {profile.name ?? t("acc.user")}
              </p>
              <p className="truncate text-sm text-muted">{profile.email}</p>
            </div>
          </div>

          <MemberManager />

          <CategoryManager />

          <IncomePurge />

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
