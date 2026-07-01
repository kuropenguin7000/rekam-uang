import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { parseExpenseAI } from "@/lib/ai";
import { consumeUsage } from "@/lib/usage";

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { text?: string };
  const text = (body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "empty" }, { status: 400 });

  const usage = await consumeUsage(
    user.id,
    "parse",
    user.entitlements.aiParsePerDay
  );
  if (!usage.allowed) {
    if (usage.reason === "cooldown") {
      return NextResponse.json(
        {
          error: "cooldown",
          message: `Tunggu ${usage.retryAfter} detik sebelum mencatat lagi.`,
          retryAfter: usage.retryAfter,
        },
        { status: 429, headers: { "Retry-After": String(usage.retryAfter ?? 2) } }
      );
    }
    const message =
      usage.reason === "abuse"
        ? `Kamu mencapai batas keamanan ${usage.limit} parsing AI hari ini. Coba lagi besok.`
        : `Batas ${usage.limit} parsing AI hari ini sudah tercapai. Upgrade ke Pro untuk tanpa batas.`;
    return NextResponse.json(
      { error: "limit_reached", message, used: usage.used, limit: usage.limit },
      { status: 429 }
    );
  }

  const draft = await parseExpenseAI(text);
  if (!draft) {
    return NextResponse.json({ error: "unparsed" }, { status: 422 });
  }
  return NextResponse.json({ draft, usage });
}
