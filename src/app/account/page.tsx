"use client";

import Link from "next/link";
import { AccountPanel } from "@/components/AccountPanel";
import { useI18n } from "@/components/I18nProvider";
import { ExpenseProvider } from "@/store/ExpenseStore";

/**
 * Standalone /account route. Akun is a tab in the app shell now, so this page
 * exists for deep links and the avatar shortcut on Beranda; it renders the same
 * panel inside its own store provider (which also guards auth).
 */
export default function AccountPage() {
  return (
    <ExpenseProvider>
      <AccountRoute />
    </ExpenseProvider>
  );
}

function AccountRoute() {
  const { t } = useI18n();
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6 sm:px-6">
      <Link
        href="/"
        className="mb-5 inline-block text-sm font-medium text-muted hover:text-foreground"
      >
        ‹ {t("acc.back")}
      </Link>
      <AccountPanel />
    </div>
  );
}
