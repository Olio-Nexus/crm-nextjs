import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { storeJson, handleOptions } from "@/lib/store";

export const OPTIONS = handleOptions;

/** GET /api/store/products/:slug/reviews — approved reviews + summary. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const product = await prisma.product.findFirst({
    where: { OR: [{ urlSlug: slug }, { productId: slug }] },
    select: { id: true },
  });
  if (!product) {
    return storeJson({ reviews: [], summary: { average: 0, count: 0 } });
  }

  const rows = await prisma.review.findMany({
    where: { productId: product.id, status: "approved" },
    include: { customer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const reviews = rows.map((r) => ({
    id: r.id,
    rating: r.rating,
    title: r.title,
    body: r.body,
    // Admin-added reviews carry a customerName; customer reviews use the account.
    customerName: r.customerName ?? r.customer?.name ?? "Anonymous",
    createdAt: r.createdAt.toISOString(),
  }));
  const count = reviews.length;
  const average = count
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10
    : 0;

  return storeJson({ reviews, summary: { average, count } });
}
