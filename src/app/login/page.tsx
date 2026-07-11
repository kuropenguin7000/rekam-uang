"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
} from "firebase/auth";
import { clientAuth, firebaseConfigured } from "@/lib/firebaseClient";
import { GoogleIcon } from "@/components/icons";
import { BrandMark } from "@/components/Logo";
import { useI18n } from "@/components/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function LoginPage() {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in (the Firebase SDK persists the session) → into the app.
  useEffect(() => {
    if (!firebaseConfigured()) return;
    return onAuthStateChanged(clientAuth(), (u) => {
      if (u) window.location.replace("/");
    });
  }, []);

  async function signIn() {
    if (!firebaseConfigured()) {
      setError(t("login.errNoGoogle"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signInWithPopup(clientAuth(), new GoogleAuthProvider());
      window.location.replace("/");
    } catch {
      setError(t("login.errOauth"));
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="fixed end-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <BrandMark className="mx-auto mb-3 h-12 w-12" />
          <h1 className="text-2xl font-bold">Rekam Uang</h1>
          <p className="mt-1 text-sm text-muted">{t("login.tagline")}</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          {error && (
            <p className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <button
            onClick={signIn}
            disabled={busy}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold transition hover:bg-surface-muted disabled:opacity-60"
          >
            <GoogleIcon />
            {t("login.google")}
          </button>

          <p className="mt-4 text-center text-xs text-muted">
            {t("login.termsPre")}
            <Link
              href="/terms"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              {t("login.termsLink")}
            </Link>
            {t("login.termsPost")}
          </p>
        </div>
      </div>
    </div>
  );
}
