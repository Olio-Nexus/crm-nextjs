import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** GET /api/reviews — admin list of product reviews. */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const limit = parseInt(searchParams.get("limit") ?? "10");
    const status = searchParams.get("status") ?? "";

    const where: any = {};
    if (status) where.status = status;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          product: { select: { productName: true, urlSlug: true } },
          customer: { select: { name: true, email: true } },
        },
      }),
      prisma.review.count({ where }),
    ]);

    return NextResponse.json({
      reviews,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/reviews — admin-add a review (no customer account required).
 * Body: { productSlug | productId, customerName, rating, title?, body, status? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const b = await req.json().catch(() => ({}));
    const { productSlug, productId, customerName, rating, title, body, status } = b;
    if ((!productSlug && !productId) || !body || typeof rating !== "number") {
      return NextResponse.json(
        { error: "Product, rating and review text are required" },
        { status: 400 },
      );
    }

    const product = await prisma.product.findFirst({
      where: productId
        ? { id: Number(productId) }
        : { OR: [{ urlSlug: productSlug }, { productId: productSlug }] },
      select: { id: true },
    });
    if (!product)
      return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const review = await prisma.review.create({
      data: {
        productId: product.id,
        customerName: customerName || "Anonymous",
        rating: Math.max(1, Math.min(5, rating)),
        title: title || null,
        body,
        status: status === "hidden" ? "hidden" : "approved",
      },
    });
    return NextResponse.json({ review }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to add review" }, { status: 500 });
  }
}
