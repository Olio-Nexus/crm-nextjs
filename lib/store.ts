import { NextResponse } from "next/server";

/**
 * Storefront-facing API helpers (the `/api/store/*` endpoints the Plattera
 * ecommerce site consumes). These are public — no admin auth — and must send
 * CORS headers because the storefront runs on a different origin.
 *
 * Set STORE_ORIGIN in the CRM env to the storefront URL in production; it
 * defaults to "*" for open GETs during development.
 */
const STORE_ORIGIN = process.env.STORE_ORIGIN ?? "*";

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": STORE_ORIGIN,
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Guest-Token",
  };
}

export function storeJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders() });
}

/** Preflight handler — re-export as `OPTIONS` from each route. */
export function handleOptions() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

/** Prisma include used to shape a product for the storefront. */
export const storeProductInclude = {
  variations: { orderBy: { orderSort: "asc" as const } },
  subcategory: { include: { category: true } },
};

function toNumber(value: unknown): number {
  // Prisma Decimal → number.
  return value == null ? 0 : Number(value);
}

function parseImages(images: unknown): string[] {
  if (Array.isArray(images)) {
    return images.filter((x): x is string => typeof x === "string");
  }
  if (typeof images === "string") {
    try {
      const parsed = JSON.parse(images);
      return Array.isArray(parsed)
        ? parsed.filter((x): x is string => typeof x === "string")
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Pick the cheapest variation's effective price + its original (if discounted). */
function pricing(variations: any[]) {
  if (!variations.length) return { price: 0, compareAtPrice: undefined };
  const ranked = variations
    .map((v) => ({
      v,
      eff: toNumber(v.specialPrice ?? v.price),
    }))
    .sort((a, b) => a.eff - b.eff);
  const cheapest = ranked[0];
  return {
    price: cheapest.eff,
    compareAtPrice:
      cheapest.v.specialPrice != null ? toNumber(cheapest.v.price) : undefined,
  };
}

/** Card-level shape (list / grid). */
export function shapeProductCard(p: any) {
  const variations = p.variations ?? [];
  const { price, compareAtPrice } = pricing(variations);
  const images = [
    ...parseImages(p.images),
    ...variations.map((v: any) => v.variationImage).filter(Boolean),
  ];
  return {
    id: p.urlSlug,
    sku: p.productId,
    name: p.productName,
    shortDescription: p.shortDescription,
    href: `/products/${p.urlSlug}`,
    images,
    price,
    compareAtPrice,
    category: p.subcategory?.category?.name ?? null,
    subcategory: p.subcategory?.name ?? null,
    // Explicit badge field wins; else derive from the flags.
    badge:
      p.badge ??
      (p.isBestSeller
        ? "Bestseller"
        : p.isNew
          ? "New"
          : p.isFeatured
            ? "Featured"
            : undefined),
    inStock: variations.some((v: any) => v.stock > 0),
    // Storefront merchandising fields.
    giftMode: p.giftMode ?? "both",
    occasions: p.occasions ?? [],
    recipients: p.recipients ?? [],
    hamperTier: p.hamperTier ?? null,
    rating: p.rating ?? null,
    reviewCount: p.reviewCount ?? null,
    deliveryTimeline: p.deliveryTimeline ?? null,
    maxQtyPerOrder: p.maxQtyPerOrder ?? null,
  };
}

/** Full detail shape (product page): card fields + description, variations. */
export function shapeProductDetail(p: any) {
  const variations = (p.variations ?? []).map((v: any) => ({
    id: v.id,
    sku: v.sku,
    price: toNumber(v.price),
    specialPrice: v.specialPrice != null ? toNumber(v.specialPrice) : undefined,
    stock: v.stock,
    image: v.variationImage ?? null,
    weight: { value: v.weight, unit: v.weightUnit },
    dimensions: {
      length: v.length,
      width: v.width,
      height: v.height,
      unit: v.dimensionUnit,
    },
    attributes: (v.attributeValues ?? []).map((a: any) => ({
      attributeId: a.attributeId,
      value: a.value,
    })),
  }));
  return {
    ...shapeProductCard(p),
    // Numeric CRM product id — lets the CRM deep-link to the product's edit page
    // (the storefront ignores it; `id` stays the urlSlug).
    dbId: p.id,
    description: p.description,
    metaTitle: p.metaTitle ?? null,
    metaDescription: p.metaDescription ?? null,
    // Drives the storefront's "Add Personalized Text / Font / Image" block.
    personalization: {
      enabled: Boolean(p.personalizationEnabled),
      price: p.personalizationPrice != null ? toNumber(p.personalizationPrice) : 0,
    },
    variations,
  };
}
