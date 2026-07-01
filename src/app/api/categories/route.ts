import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  CATEGORIES,
  parseCategoriesConfig,
  type CategoriesConfig,
} from "@/lib/categories";

const MAX_CUSTOM = 20;

function genId(): string {
  return "c_" + Math.random().toString(36).slice(2, 10);
}

async function loadConfig(userId: string): Promise<CategoriesConfig> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { categoriesConfig: true },
  });
  return parseCategoriesConfig(u?.categoriesConfig ?? null);
}

function save(userId: string, config: CategoriesConfig) {
  return prisma.user.update({
    where: { id: userId },
    data: { categoriesConfig: JSON.stringify(config) },
  });
}

/** Add a custom category. */
export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    label?: string;
    icon?: string;
    color?: string;
  };
  const label = (body.label ?? "").trim().slice(0, 40);
  if (!label) return NextResponse.json({ error: "label required" }, { status: 400 });

  const config = await loadConfig(user.id);
  if (config.custom.length >= MAX_CUSTOM) {
    return NextResponse.json({ error: "too_many" }, { status: 400 });
  }
  config.custom.push({
    id: genId(),
    label,
    icon: (body.icon || "🏷️").slice(0, 8),
    color: typeof body.color === "string" && body.color ? body.color : "#94a3b8",
  });
  await save(user.id, config);
  return NextResponse.json({ ok: true });
}

/** Edit a category. Built-ins: rename + hide only. Custom: label/icon/color. */
export async function PATCH(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    label?: string;
    icon?: string;
    color?: string;
    hidden?: boolean;
  };
  const id = body.id;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const config = await loadConfig(user.id);

  if (id in CATEGORIES) {
    const ov = config.overrides[id] ?? {};
    if (typeof body.label === "string") {
      const l = body.label.trim().slice(0, 40);
      if (l) ov.label = l;
      else delete ov.label;
    }
    if (typeof body.hidden === "boolean") ov.hidden = body.hidden;
    if (Object.keys(ov).length) config.overrides[id] = ov;
    else delete config.overrides[id];
  } else {
    const c = config.custom.find((x) => x.id === id);
    if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (typeof body.label === "string" && body.label.trim())
      c.label = body.label.trim().slice(0, 40);
    if (typeof body.icon === "string" && body.icon) c.icon = body.icon.slice(0, 8);
    if (typeof body.color === "string" && body.color) c.color = body.color;
  }
  await save(user.id, config);
  return NextResponse.json({ ok: true });
}

/** Delete a custom category and reassign its transactions to "other". */
export async function DELETE(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { id?: string };
  const id = body.id;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (id in CATEGORIES) {
    return NextResponse.json({ error: "cannot_delete_builtin" }, { status: 400 });
  }

  const config = await loadConfig(user.id);
  const idx = config.custom.findIndex((x) => x.id === id);
  if (idx === -1) return NextResponse.json({ error: "not_found" }, { status: 404 });
  config.custom.splice(idx, 1);

  await prisma.$transaction([
    prisma.transaction.updateMany({
      where: { userId: user.id, category: id },
      data: { category: "other" },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { categoriesConfig: JSON.stringify(config) },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
