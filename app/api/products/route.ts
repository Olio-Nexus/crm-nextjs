import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { prismaErrorResponse } from "@/lib/prisma-error";
import { revalidateStorefront } from "@/lib/revalidate";
import { toDirectImageUrl } from "@/lib/images";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const limit = parseInt(searchParams.get("limit") ?? "10");
    const search = searchParams.get("search") ?? "";
    const status = searchParams.get("status");
    const subcategoryId = searchParams.get("subcategoryId");

    const where: any = {};
    if (search) {
      const q = search.trim();
      where.OR = [
        { productName: { contains: q, mode: "insensitive" } },
        { productId: { contains: q, mode: "insensitive" } }, // SKU
        { subcategory: { name: { contains: q, mode: "insensitive" } } },
        { subcategory: { category: { name: { contains: q, mode: "insensitive" } } } }, // Category
        { variations: { some: { sku: { contains: q, mode: "insensitive" } } } }, // variation SKU
      ];
    }
    if (status !== null && status !== "") where.status = status === "true";
    if (subcategoryId) where.subcategoryId = parseInt(subcategoryId);

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          subcategory: {
            include: { category: { select: { id: true, name: true } } },
          },
          variations: { orderBy: { orderSort: "asc" } },
          _count: { select: { variations: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return NextResponse.json({ products, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch {
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
      subcategoryId, productName, urlSlug, productId,
      images, shortDescription, description, altTag,
      metaTitle, metaDescription, metaKeywords, productSchema,
      isFeatured, status, isNew, isBestSeller, variations,
      personalizationEnabled, personalizationPrice,
    } = body;

    if (!subcategoryId || !productName) {
      return NextResponse.json({ error: "Subcategory and product name are required" }, { status: 400 });
    }

    // Give a clear, specific SKU-conflict message (names the exact value) so the
    // admin immediately knows what to fix — before the generic DB error fires.
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
        where: { sku: { in: skus } },
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

    const product = await prisma.product.create({
      data: {
        subcategoryId: parseInt(subcategoryId),
        productName, urlSlug, productId,
        images: Array.isArray(images) ? images.map(toDirectImageUrl) : [],
        shortDescription, description, altTag,
        metaTitle, metaDescription, metaKeywords, productSchema,
        isFeatured: isFeatured ?? false,
        status: status ?? false,
        isNew: isNew ?? false,
        // Bestseller is unified with Trending & Bestsellers — mirror it from the
        // trending modes so the storefront "Bestseller" badge/sort stay in sync.
        isBestSeller: Array.isArray(body.trendingModes) && body.trendingModes.length > 0,
        personalizationEnabled: personalizationEnabled ?? false,
        personalizationPrice:
          personalizationPrice === "" || personalizationPrice == null
            ? null
            : parseFloat(personalizationPrice),
        giftMode: body.giftMode || "both",
        occasions: Array.isArray(body.occasions) ? body.occasions : [],
        recipients: Array.isArray(body.recipients) ? body.recipients : [],
        trendingModes: Array.isArray(body.trendingModes) ? body.trendingModes : [],
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
      include: { variations: true },
    });

    void revalidateStorefront(["products", "categories"]);
    return NextResponse.json(product, { status: 201 });
  } catch (error: any) {
    return prismaErrorResponse(
      error,
      "Could not save the product. Please check the fields and try again.",
    );
  }
}
