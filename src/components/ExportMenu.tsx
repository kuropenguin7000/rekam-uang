"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "./I18nProvider";

type Fmt = "xlsx" | "pdf" | "csv";

function triggerDownload(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Export control for the dashboard. Pro/master users get a dropdown to download
 * the current view as Excel, PDF or CSV (the server enforces the entitlement
 * too). Free users see a lock that points to pricing.
 */
export function ExportMenu({
  from,
  to,
  canExport,
}: {
  from?: string;
  to?: string;
  canExport: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!canExport) {
    return (
      <Link
        href="/pricing"
        className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-sm font-medium text-muted/70 hover:text-primary"
      >
        {t("dash.export")} 🔒
      </Link>
    );
  }

  function download(fmt: Fmt) {
    const params = new URLSearchParams({ format: fmt });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    triggerDownload(`/api/export?${params.toString()}`);
    setOpen(false);
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
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-surface-muted"
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
