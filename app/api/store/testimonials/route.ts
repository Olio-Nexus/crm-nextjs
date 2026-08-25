import { prisma } from "@/lib/prisma";
import { storeJson, handleOptions } from "@/lib/store";

export const OPTIONS = handleOptions;
// Always fresh so CRM edits appear without a redeploy.
export const dynamic = "force-dynamic";

/** GET /api/store/testimonials — active client testimonials for the storefront. */
export async function GET() {
  try {
    const rows = await prisma.testimonial.findMany({
      where: { status: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return storeJson({
      testimonials: rows.map((t) => ({
        id: String(t.id),
        name: t.name,
        role: t.role || "",
        quote: t.quote,
        rating: t.rating,
        avatar: t.avatar || "",
        mode: t.mode || "both", // "corporate" | "personal" | "both"
      })),
    });
  } catch (error) {
    console.error("GET /api/store/testimonials failed", error);
    return storeJson({ error: "Failed to load testimonials" }, 500);
  }
}
