import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidateStorefront } from "@/lib/revalidate";

/**
 * "Trending & Bestsellers" management — a category-style view over the existing
 * Product.trendingModes field (an EXTRA label on top of a product's real
 * category, so URLs/breadcrumbs are never affected). Each membership carries a
 * per-product mode flag ("corporate" / "personal") that controls which
 * storefront it shows on, exactly as today. isBestSeller is mirrored (in-set =>
 * true) so the storefront "Bestseller" badge + sort keep working.
 */

const VALID_MODES = ["corporate", "personal"];
const cleanModes = (modes: unknown): string[] =>
  Array.isArray(modes)
    ? [...new Set(modes.map(String))].filter((m) => VALID_MODES.includes(m))
    : [];

/** GET — all products currently in Trending & Bestsellers, with their modes. */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.product.findMany({
    where: { NOT: { trendingModes: { isEmpty: true } } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      productName: true,
      productId: true, // SKU
      images: true,
      status: true,
      trendingModes: true,
      subcategory: { select: { category: { select: { name: true } } } },
    },
  });

  const products = rows.map((p) => ({
    id: p.id,
    name: p.productName,
    sku: p.productId,
    image: Array.isArray(p.images) ? (p.images as string[])[0] ?? null : null,
    status: p.status,
    modes: p.trendingModes,
    category: p.subcategory?.category?.name ?? null,
  }));
  return NextResponse.json({ products });
}

/** POST { productId, modes:[...] } — add a product (or update its modes). */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const productId = Number(body?.productId);
  const modes = cleanModes(body?.modes);
  if (!productId) return NextResponse.json({ error: "productId is required" }, { status: 400 });
  if (modes.length === 0) {
    return NextResponse.json(
      { error: "Choose at least one mode (Corporate / Personal)." },
      { status: 400 },
    );
  }
  const exists = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  await prisma.product.update({
    where: { id: productId },
    data: { trendingModes: modes, isBestSeller: true },
  });
  void revalidateStorefront(["products"]);
  return NextResponse.json({ ok: true });
}

/** DELETE ?productId= — remove a product from Trending & Bestsellers. */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const productId = Number(new URL(req.url).searchParams.get("productId"));
  if (!productId) return NextResponse.json({ error: "productId is required" }, { status: 400 });

  await prisma.product.update({
    where: { id: productId },
    data: { trendingModes: [], isBestSeller: false },
  });
  void revalidateStorefront(["products"]);
  return NextResponse.json({ ok: true });
}
