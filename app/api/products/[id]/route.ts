import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { prismaErrorResponse } from "@/lib/prisma-error";
import { revalidateStorefront } from "@/lib/revalidate";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: {
        subcategory: { include: { category: true } },
        variations: {
          orderBy: { orderSort: "asc" },
          include: { attributeValues: { include: { attribute: true } } },
        },
      },
    });
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(product);
  } catch {
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const pid = parseInt(id);
    const body = await req.json();
    const {
      subcategoryId, productName, urlSlug, productId,
      images, shortDescription, description, altTag,
      metaTitle, metaDescription, metaKeywords, productSchema,
      isFeatured, status, isNew, isBestSeller,
      personalizationEnabled, personalizationPrice, variations,
    } = body;

    // Same friendly SKU checks as create — but ignore this product's own
    // variations (they're about to be replaced), only conflicting with OTHERS.
    const skus: string[] = (variations ?? [])
      .map((v: any) => (v?.sku ?? "").trim())
      .filter(Boolean);
    const dupInForm = skus.find((s, i) => skus.indexOf(s) !== i);
    if (dupInForm) {
      return NextResponse.json(
        { error: `Duplicate SKU "${dupInForm}" within this product — each variation needs its own unique SKU.` },
        { status: 400 },
      );
    }
    if (skus.length) {
      const taken = await prisma.productVariation.findMany({
        where: { sku: { in: skus }, productId: { not: pid } },
        select: { sku: true },
      });
      if (taken.length) {
        const list = [...new Set(taken.map((t) => t.sku))].map((s) => `"${s}"`).join(", ");
        return NextResponse.json(
          { error: `SKU ${list} is already used by another product. Each SKU must be unique — please change it.` },
          { status: 400 },
        );
      }
    }

    // Replace variations wholesale (delete + recreate) so edits to price/stock/
    // SKU/dimensions/image actually persist. Delete-first frees the SKUs.
    await prisma.$transaction([
      prisma.productVariation.deleteMany({ where: { productId: pid } }),
      prisma.product.update({
        where: { id: pid },
        data: {
          subcategoryId: parseInt(subcategoryId),
          productName, urlSlug, productId,
          images: images ?? [],
          shortDescription, description, altTag,
          metaTitle, metaDescription, metaKeywords, productSchema,
          isFeatured, status, isNew, isBestSeller,
          personalizationEnabled: personalizationEnabled ?? false,
          personalizationPrice:
            personalizationPrice === "" || personalizationPrice == null
              ? null
              : parseFloat(personalizationPrice),
          giftMode: body.giftMode || "both",
          occasions: Array.isArray(body.occasions) ? body.occasions : [],
          recipients: Array.isArray(body.recipients) ? body.recipients : [],
          hamperTier: body.hamperTier || null,
          rating:
            body.rating === "" || body.rating == null ? null : parseFloat(body.rating),
          reviewCount:
            body.reviewCount === "" || body.reviewCount == null
              ? null
              : parseInt(body.reviewCount),
          badge: body.badge || null,
          deliveryTimeline: body.deliveryTimeline || null,
          maxQtyPerOrder:
            body.maxQtyPerOrder === "" || body.maxQtyPerOrder == null
              ? null
              : parseInt(body.maxQtyPerOrder),
          variations: variations?.length
            ? {
                create: variations.map((v: any, i: number) => ({
                  sku: v.sku,
                  // Blank price → 0 (storefront shows "Request a Quote").
                  price: v.price !== "" && v.price != null ? parseFloat(v.price) : 0,
                  specialPrice: v.specialPrice ? parseFloat(v.specialPrice) : null,
                  stock: parseInt(v.stock),
                  variationImage: v.variationImage ?? null,
                  weightUnit: v.weightUnit ?? "kg",
                  weight: parseFloat(v.weight) || 0,
                  dimensionUnit: v.dimensionUnit ?? "cm",
                  length: parseFloat(v.length) || 0,
                  width: parseFloat(v.width) || 0,
                  height: parseFloat(v.height) || 0,
                  orderSort: i,
                })),
              }
            : undefined,
        },
      }),
    ]);

    const product = await prisma.product.findUnique({
      where: { id: pid },
      include: { variations: { orderBy: { orderSort: "asc" } } },
    });
    void revalidateStorefront(["products", "categories"]);
    return NextResponse.json(product);
  } catch (error: any) {
    return prismaErrorResponse(
      error,
      "Could not update the product. Please check the fields and try again.",
    );
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    await prisma.product.delete({ where: { id: parseInt(id) } });
    void revalidateStorefront(["products", "categories"]);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
