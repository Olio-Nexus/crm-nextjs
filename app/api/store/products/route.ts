import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  storeJson,
  handleOptions,
  storeProductInclude,
  shapeProductCard,
} from "@/lib/store";

export const OPTIONS = handleOptions;

/**
 * GET /api/store/products
 * Public product listing for the storefront.
 *
 * Query params:
 *   q            full-text-ish search over name / descriptions / SKU
 *   category     category slug
 *   subcategory  subcategory slug
 *   badge        "bestseller" | "new" | "featured"
 *   minPrice / maxPrice   (filters on variation price)
 *   sort         "newest" | "price-asc" | "price-desc" | "bestseller"
 *   page, limit  pagination (defaults 1, 12)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const category = searchParams.get("category");
    const subcategory = searchParams.get("subcategory");
    const badge = searchParams.get("badge");
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const sort = searchParams.get("sort") ?? "newest";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    // The storefront pulls a wide page and filters/paginates client-side, so
    // allow a high ceiling; keep it bounded to avoid an unbounded query.
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") ?? "12")));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { status: true };

    if (q) {
      where.OR = [
        { productName: { contains: q, mode: "insensitive" } },
        { shortDescription: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { productId: { contains: q, mode: "insensitive" } },
      ];
    }

    if (subcategory) where.subcategory = { slug: subcategory };
    else if (category) where.subcategory = { category: { slug: category } };

    if (badge === "bestseller") where.isBestSeller = true;
    else if (badge === "new") where.isNew = true;
    else if (badge === "featured") where.isFeatured = true;

    // Trending / Most-Loved products, curated per mode ("corporate"|"personal").
    const trending = searchParams.get("trending");
    if (trending === "corporate" || trending === "personal") {
      where.trendingModes = { has: trending };
    }

    // Filter by an occasion label (e.g. "Personalised", "Diwali").
    const occasion = searchParams.get("occasion");
    if (occasion) where.occasions = { has: occasion };

    if (minPrice || maxPrice) {
      where.variations = {
        some: {
          price: {
            ...(minPrice ? { gte: parseFloat(minPrice) } : {}),
            ...(maxPrice ? { lte: parseFloat(maxPrice) } : {}),
          },
        },
      };
    }

    // Column-level sorts happen in the DB; price sorts are applied after
    // shaping (price lives on the cheapest variation).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orderBy: any =
      sort === "bestseller"
        ? [{ isBestSeller: "desc" }, { createdAt: "desc" }]
        : { createdAt: "desc" };

    const [total, rows] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: storeProductInclude,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    let products = rows.map(shapeProductCard);
    if (sort === "price-asc") products = products.sort((a, b) => a.price - b.price);
    if (sort === "price-desc") products = products.sort((a, b) => b.price - a.price);

    return storeJson({
      products,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("GET /api/store/products failed", error);
    return storeJson({ error: "Failed to load products" }, 500);
  }
}
