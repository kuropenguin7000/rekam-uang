import "server-only";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatCurrency } from "./format";
import type { Locale } from "@/i18n/config";
import type { Transaction } from "./types";

export type ExportFormat = "csv" | "xlsx" | "pdf";

export interface ExportData {
  transactions: Transaction[];
  locale: Locale;
  account: { name: string | null; email: string };
  generatedAt: Date;
  /** optional inclusive period these rows cover, for the report header */
  from?: string;
  to?: string;
  /** category id -> display name (localized built-ins + custom labels) */
  categoryNames?: Record<string, string>;
}

/** Export-specific column/section labels, kept colocated to avoid bloating the UI dictionary. */
const LABELS: Record<Locale, Record<string, string>> = {
  id: {
    title: "Laporan Pengeluaran Rekam Uang",
    account: "Akun",
    period: "Periode",
    allTime: "Sepanjang waktu",
    generated: "Dibuat",
    totalSpent: "Total pengeluaran",
    txCount: "Jumlah transaksi",
    byCategory: "Per kategori",
    category: "Kategori",
    amount: "Jumlah",
    share: "Porsi",
    date: "Tanggal",
    merchant: "Toko",
    note: "Catatan",
    transactions: "Transaksi",
    summary: "Ringkasan",
    noData: "Tidak ada transaksi pada periode ini.",
  },
  en: {
    title: "Rekam Uang Spending Report",
    account: "Account",
    period: "Period",
    allTime: "All time",
    generated: "Generated",
    totalSpent: "Total spent",
    txCount: "Transactions",
    byCategory: "By category",
    category: "Category",
    amount: "Amount",
    share: "Share",
    date: "Date",
    merchant: "Merchant",
    note: "Note",
    transactions: "Transactions",
    summary: "Summary",
    noData: "No transactions in this period.",
  },
};

function categoryLabel(data: ExportData, id: string): string {
  return data.categoryNames?.[id] ?? id;
}

interface Summary {
  total: number;
  count: number;
  byCategory: { id: string; label: string; value: number; pct: number }[];
}

function summarize(data: ExportData): Summary {
  const total = data.transactions.reduce((s, t) => s + t.amount, 0);
  const totals = new Map<string, number>();
  for (const t of data.transactions) {
    totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount);
  }
  const byCategory = [...totals.entries()]
    .map(([id, value]) => ({
      id,
      label: categoryLabel(data, id),
      value,
      pct: total > 0 ? (value / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
  return { total, count: data.transactions.length, byCategory };
}

function periodText(data: ExportData, L: Record<string, string>): string {
  if (data.from && data.to) return `${data.from} → ${data.to}`;
  if (data.to) return `… → ${data.to}`;
  return L.allTime;
}

/** Build a download filename stem like "rekam-uang-2026-06-26". */
export function exportFilename(format: ExportFormat, generatedAt: Date): string {
  const d = generatedAt.toISOString().slice(0, 10);
  return `rekam-uang-${d}.${format}`;
}

export const MIME: Record<ExportFormat, string> = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

// --------------------------------------------------------------------------
// CSV
// --------------------------------------------------------------------------

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(data: ExportData): string {
  const L = LABELS[data.locale];
  const header = [L.date, L.category, L.merchant, L.note, `${L.amount} (Rp)`];
  const lines = [header.map(csvCell).join(",")];
  for (const t of data.transactions) {
    lines.push(
      [
        t.date,
        categoryLabel(data, t.category),
        t.merchant,
        t.note,
        t.amount, // raw numeric, so the file stays analysable
      ]
        .map(csvCell)
        .join(",")
    );
  }
  // Prepend a UTF-8 BOM so Excel opens it with correct encoding.
  return "﻿" + lines.join("\r\n");
}

// --------------------------------------------------------------------------
// XLSX (exceljs)
// --------------------------------------------------------------------------

export async function buildXlsx(data: ExportData): Promise<Buffer> {
  const L = LABELS[data.locale];
  const summary = summarize(data);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Rekam Uang";
  wb.created = data.generatedAt;

  const moneyFmt = '"Rp"#,##0';

  // ---- Transactions sheet (first, so the workbook opens on the full list) ----
  const tx = wb.addWorksheet(L.transactions);
  tx.columns = [
    { header: L.date, key: "date", width: 14 },
    { header: L.category, key: "category", width: 20 },
    { header: L.merchant, key: "merchant", width: 24 },
    { header: L.note, key: "note", width: 30 },
    { header: `${L.amount} (Rp)`, key: "amount", width: 16 },
  ];
  const head = tx.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
  head.alignment = { vertical: "middle" };
  for (const t of data.transactions) {
    const row = tx.addRow({
      date: t.date,
      category: categoryLabel(data, t.category),
      merchant: t.merchant,
      note: t.note,
      amount: t.amount,
    });
    row.getCell("amount").numFmt = moneyFmt;
  }
  // Total row under the list.
  const txTotal = tx.addRow({ note: L.totalSpent, amount: summary.total });
  txTotal.font = { bold: true };
  txTotal.getCell("amount").numFmt = moneyFmt;
  tx.views = [{ state: "frozen", ySplit: 1 }];
  tx.autoFilter = { from: "A1", to: "E1" };

  // ---- Summary sheet (second) ----
  const s = wb.addWorksheet(L.summary);
  s.columns = [{ width: 26 }, { width: 20 }, { width: 12 }];
  const titleRow = s.addRow([L.title]);
  titleRow.font = { size: 14, bold: true };
  s.addRow([L.account, `${data.account.name ?? ""} <${data.account.email}>`]);
  s.addRow([L.period, periodText(data, L)]);
  s.addRow([L.generated, data.generatedAt.toLocaleString(data.locale === "id" ? "id-ID" : "en-GB")]);
  s.addRow([]);
  const totalRow = s.addRow([L.totalSpent, summary.total]);
  totalRow.getCell(2).numFmt = moneyFmt;
  totalRow.font = { bold: true };
  s.addRow([L.txCount, summary.count]);
  s.addRow([]);
  const catHeader = s.addRow([L.byCategory, L.amount, L.share]);
  catHeader.font = { bold: true };
  catHeader.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } };
  });
  for (const c of summary.byCategory) {
    const r = s.addRow([c.label, c.value, `${c.pct.toFixed(1)}%`]);
    r.getCell(2).numFmt = moneyFmt;
  }

  // Open the workbook on the transactions sheet (first tab).
  wb.views = [
    {
      x: 0,
      y: 0,
      width: 20000,
      height: 12000,
      firstSheet: 0,
      activeTab: 0,
      visibility: "visible",
    },
  ];

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

// --------------------------------------------------------------------------
// PDF (pdf-lib — standard fonts, no external font files)
// --------------------------------------------------------------------------

export async function buildPdf(data: ExportData): Promise<Uint8Array> {
  const L = LABELS[data.locale];
  const summary = summarize(data);
  const dtLocale = data.locale === "id" ? "id-ID" : "en-GB";

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const PAGE = { w: 595.28, h: 841.89 }; // A4 portrait
  const M = 40;
  const ink = rgb(0.12, 0.12, 0.15);
  const muted = rgb(0.45, 0.47, 0.55);
  const accent = rgb(0.31, 0.27, 0.9);
  const stripe = rgb(0.96, 0.97, 0.99);

  let page = doc.addPage([PAGE.w, PAGE.h]);
  let y = PAGE.h - M;

  // pdf-lib's StandardFonts are Latin-1 only — strip anything outside it so a
  // stray non-Latin glyph can't throw during encoding.
  const safe = (s: string) => (s ?? "").replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "");

  const text = (
    s: string,
    x: number,
    yy: number,
    opts: { size?: number; font?: typeof font; color?: typeof ink } = {}
  ) => {
    page.drawText(safe(s), {
      x,
      y: yy,
      size: opts.size ?? 10,
      font: opts.font ?? font,
      color: opts.color ?? ink,
    });
  };

  // Truncate a string to fit a max width at a given size.
  const fit = (s: string, max: number, size: number, f = font): string => {
    s = safe(s);
    if (f.widthOfTextAtSize(s, size) <= max) return s;
    let out = s;
    while (out.length > 1 && f.widthOfTextAtSize(out + "…", size) > max) {
      out = out.slice(0, -1);
    }
    return out + "…";
  };

  // ---- Header ----
  text(L.title, M, y, { size: 18, font: bold });
  y -= 22;
  text(
    `${L.account}: ${data.account.name ?? data.account.email} <${data.account.email}>`,
    M,
    y,
    { size: 9, color: muted }
  );
  y -= 13;
  text(`${L.period}: ${periodText(data, L)}`, M, y, { size: 9, color: muted });
  y -= 13;
  text(`${L.generated}: ${data.generatedAt.toLocaleString(dtLocale)}`, M, y, {
    size: 9,
    color: muted,
  });
  y -= 24;

  // ---- Total + count line ----
  text(`${L.totalSpent}: `, M, y, { size: 11, font: bold });
  text(formatCurrency(summary.total), M + 95, y, { size: 11, font: bold, color: accent });
  text(`${L.txCount}: ${summary.count}`, M + 300, y, { size: 11, font: bold });
  y -= 26;

  // ---- Transactions table (primary content: every filtered line item) ----
  // Columns: Date | Category | Merchant | Amount (right-aligned)
  const cols = [
    { key: "date", label: L.date, x: M, w: 70 },
    { key: "category", label: L.category, x: M + 74, w: 95 },
    { key: "merchant", label: L.merchant, x: M + 173, w: 210 },
    { key: "amount", label: L.amount, x: PAGE.w - M, w: 100, right: true },
  ] as const;
  const rowH = 18;
  const tableRight = PAGE.w - M;

  const drawHeader = () => {
    page.drawRectangle({
      x: M - 4,
      y: y - 4,
      width: tableRight - M + 8,
      height: rowH,
      color: accent,
    });
    for (const c of cols) {
      if ("right" in c && c.right) {
        const w = bold.widthOfTextAtSize(c.label, 9);
        text(c.label, c.x - w, y, { size: 9, font: bold, color: rgb(1, 1, 1) });
      } else {
        text(c.label, c.x, y, { size: 9, font: bold, color: rgb(1, 1, 1) });
      }
    }
    y -= rowH + 2;
  };

  const ensureSpace = () => {
    if (y < M + rowH) {
      page = doc.addPage([PAGE.w, PAGE.h]);
      y = PAGE.h - M;
      drawHeader();
    }
  };

  text(`${L.transactions} (${summary.count})`, M, y, { size: 12, font: bold });
  y -= 18;
  drawHeader();

  if (data.transactions.length === 0) {
    text(L.noData, M, y, { size: 9, color: muted });
    y -= rowH;
  }

  data.transactions.forEach((t, i) => {
    ensureSpace();
    if (i % 2 === 1) {
      page.drawRectangle({
        x: M - 4,
        y: y - 4,
        width: tableRight - M + 8,
        height: rowH,
        color: stripe,
      });
    }
    text(t.date, cols[0].x, y, { size: 9 });
    text(fit(categoryLabel(data, t.category), cols[1].w, 9), cols[1].x, y, {
      size: 9,
    });
    text(fit(t.merchant || "—", cols[2].w, 9), cols[2].x, y, { size: 9 });
    const amt = formatCurrency(t.amount);
    const w = font.widthOfTextAtSize(amt, 9);
    text(amt, tableRight - w, y, { size: 9 });
    y -= rowH;
  });

  // ---- Category breakdown (trailing summary, after the full item list) ----
  if (summary.byCategory.length > 0) {
    const needed = (summary.byCategory.length + 2) * 14 + 12;
    if (y - needed < M) {
      page = doc.addPage([PAGE.w, PAGE.h]);
      y = PAGE.h - M;
    } else {
      y -= 18;
    }
    text(L.byCategory, M, y, { size: 11, font: bold });
    y -= 16;
    for (const c of summary.byCategory) {
      text(`• ${c.label}`, M + 6, y, { size: 9, color: muted });
      text(
        `${formatCurrency(c.value)}  (${c.pct.toFixed(1)}%)`,
        M + 220,
        y,
        { size: 9, color: muted }
      );
      y -= 14;
    }
  }

  return doc.save();
}

/** Dispatch to the right builder; returns bytes + content type. */
export async function buildExport(
  format: ExportFormat,
  data: ExportData
): Promise<{ body: Buffer | Uint8Array | string; contentType: string }> {
  if (format === "csv") return { body: buildCsv(data), contentType: MIME.csv };
  if (format === "pdf") return { body: await buildPdf(data), contentType: MIME.pdf };
  return { body: await buildXlsx(data), contentType: MIME.xlsx };
}
