import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/** PATCH /api/reviews/:id — approve / hide a review. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const reviewId = Number(id);
    if (!Number.isInteger(reviewId))
      return NextResponse.json({ error: "Bad id" }, { status: 400 });

    const body = await req.json().catch(() => null);
    const status = body?.status;
    if (status !== "approved" && status !== "hidden") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const review = await prisma.review.update({
      where: { id: reviewId },
      data: { status },
    });
    return NextResponse.json({ review });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to update review" },
      { status: 500 },
    );
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** PUT /api/reviews/:id — edit a review's content. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const reviewId = Number(id);
    if (!Number.isInteger(reviewId))
      return NextResponse.json({ error: "Bad id" }, { status: 400 });

    const b = await req.json().catch(() => ({}));
    const data: any = {};
    if (typeof b.rating === "number") data.rating = Math.max(1, Math.min(5, b.rating));
    if (b.title !== undefined) data.title = b.title || null;
    if (typeof b.body === "string" && b.body.trim()) data.body = b.body.trim();
    if (b.customerName !== undefined) data.customerName = b.customerName || null;
    if (b.status === "approved" || b.status === "hidden") data.status = b.status;

    const review = await prisma.review.update({ where: { id: reviewId }, data });
    return NextResponse.json({ review });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update review" }, { status: 500 });
  }
}

/** DELETE /api/reviews/:id */
export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    await prisma.review.delete({ where: { id: Number(id) } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete review" }, { status: 500 });
  }
}
