"use client";

import { useEffect, useRef, useState } from "react";
import { categoryDisplayName } from "@/lib/categoryName";
import { memberDisplayName } from "@/lib/memberName";
import { useExpenses } from "@/store/ExpenseStore";
import { useI18n } from "./I18nProvider";

type Fmt = "xlsx" | "pdf" | "csv";

/**
 * Export control for the dashboard: a dropdown to download the current view as
 * Excel, PDF or CSV. Files are generated in the browser from store data (the
 * app is a static export — there is no server); the heavy builders load on
 * demand via a dynamic import.
 */
export function ExportMenu({
  from,
  to,
  member,
}: {
  from?: string;
  to?: string;
  /** "" = every member; otherwise export only that member's expenses. */
  member?: string;
}) {
  const { t, locale } = useI18n();
  const { user, transactions, categories, members } = useExpenses();
  const [open, setOpen] = useState(false);
  const [building, setBuilding] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function download(fmt: Fmt) {
    if (!user || building) return;
    setBuilding(true);
    try {
      const { downloadExport } = await import("@/lib/export");
      // Report over the active date window, newest first (the store list is
      // already ordered by date desc, createdAt desc).
      const rows = transactions.filter(
        (tx) =>
          (!from || tx.date >= from) &&
          (!to || tx.date <= to) &&
          (!member || tx.member === member)
      );
      const categoryNames: Record<string, string> = {};
      for (const c of categories) {
        categoryNames[c.id] = categoryDisplayName(c, t);
      }
      const memberNames: Record<string, string> = {};
      for (const m of members) {
        memberNames[m.id] = memberDisplayName(m, t);
      }
      await downloadExport(fmt, {
        transactions: rows,
        locale,
        account: { name: user.name, email: user.email },
        generatedAt: new Date(),
        from,
        to,
        categoryNames,
        memberNames,
        memberFilter: member ? memberNames[member] : undefined,
      });
    } finally {
      setBuilding(false);
      setOpen(false);
    }
  }

  const items: { fmt: Fmt; label: string; icon: string }[] = [
    { fmt: "xlsx", label: t("dash.exportExcel"), icon: "📊" },
    { fmt: "pdf", label: t("dash.exportPdf"), icon: "📄" },
    { fmt: "csv", label: t("dash.exportCsv"), icon: "📑" },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted transition hover:text-foreground"
      >
        {t("dash.export")}
        <svg
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-2 w-48 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-xl sm:left-auto sm:right-0">
          {items.map((it) => (
            <button
              key={it.fmt}
              onClick={() => download(it.fmt)}
              disabled={building}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-surface-muted disabled:opacity-50"
            >
              <span>{it.icon}</span>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
