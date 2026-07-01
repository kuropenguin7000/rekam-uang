import { cookies } from "next/headers";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { txToClient } from "@/lib/serialize";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "@/i18n/config";
import { messages } from "@/i18n/messages";
import {
  buildExport,
  exportFilename,
  type ExportFormat,
} from "@/lib/export";

// exceljs/pdf-lib need the Node runtime; this depends on the session cookie.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORMATS: ExportFormat[] = ["csv", "xlsx", "pdf"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  // Export is a Pro entitlement (master included).
  if (!user.entitlements.exportData) {
    return Response.json({ error: "upgrade_required" }, { status: 403 });
  }

  const url = new URL(req.url);
  const fmtParam = url.searchParams.get("format") ?? "xlsx";
  const format = (FORMATS.includes(fmtParam as ExportFormat)
    ? fmtParam
    : "xlsx") as ExportFormat;

  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const from = fromParam && DATE_RE.test(fromParam) ? fromParam : undefined;
  const to = toParam && DATE_RE.test(toParam) ? toParam : undefined;

  const store = await cookies();
  const langCookie = store.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(langCookie) ? langCookie : DEFAULT_LOCALE;

  const rows = await prisma.transaction.findMany({
    where: {
      userId: user.id,
      // v1 export is an expense report; income is tracked in-app only.
      type: "expense",
      ...(from || to
        ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  // Map every category id to a display name (localized built-ins + custom labels).
  const dict = messages[locale] as Record<string, string>;
  const categoryNames: Record<string, string> = {};
  for (const c of user.categories) {
    categoryNames[c.id] = c.label || dict[`cat.${c.id}`] || c.id;
  }

  const generatedAt = new Date();
  const { body, contentType } = await buildExport(format, {
    transactions: rows.map(txToClient),
    locale,
    account: { name: user.name, email: user.email },
    generatedAt,
    from,
    to,
    categoryNames,
  });

  return new Response(body as BodyInit, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${exportFilename(format, generatedAt)}"`,
      "Cache-Control": "no-store",
    },
  });
}
