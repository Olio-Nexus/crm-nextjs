import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * In-app admin notification feed for the Header bell (distinct from
 * /api/notifications, which manages email/SMS templates).
 *
 * GET   → { items: latest 20, unread: <count> }
 * PATCH → mark read. Body { id } marks one; { all: true } marks all.
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.notification.count({ where: { isRead: false } }),
  ]);
  return NextResponse.json({ items, unread });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (body?.all === true) {
    await prisma.notification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });
    return NextResponse.json({ ok: true });
  }
  const id = Number(body?.id);
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  await prisma.notification.update({ where: { id }, data: { isRead: true } });
  return NextResponse.json({ ok: true });
}
