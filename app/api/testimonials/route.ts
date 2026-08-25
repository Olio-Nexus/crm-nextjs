import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/** GET /api/testimonials — admin list, ordered within each mode group. */
export async function GET() {
  try {
    const rows = await prisma.testimonial.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

/** POST /api/testimonials — create; appended to the end of its mode group. */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const b = await req.json();
    const { name, role, quote, rating, avatar, mode, status } = b;
    if (!name || !quote) {
      return NextResponse.json({ error: "Name and quote are required" }, { status: 400 });
    }
    const m = mode || "both";
    const max = await prisma.testimonial.aggregate({
      where: { mode: m },
      _max: { sortOrder: true },
    });
    const t = await prisma.testimonial.create({
      data: {
        name,
        role: role || null,
        quote,
        rating: typeof rating === "number" ? rating : 5,
        avatar: avatar || null,
        mode: m,
        status: status ?? true,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });
    return NextResponse.json(t, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
