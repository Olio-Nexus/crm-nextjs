import { prisma } from "@/lib/prisma";
import { storeJson, handleOptions } from "@/lib/store";

export const OPTIONS = handleOptions;

/** Active home banners, shaped as storefront hero slides. */
export async function GET() {
  try {
    const banners = await prisma.homeBanner.findMany({
      where: { status: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return storeJson({
      banners: banners.map((b) => ({
        id: String(b.id),
        title: b.title,
        subtitle: b.description,
        ctaLabel: b.btnText,
        ctaHref: b.btnLink || "/products",
        image: b.bannerImg,
        mode: b.mode || "both", // "corporate" | "personal" | "both"
      })),
    });
  } catch (error) {
    console.error("GET /api/store/banners failed", error);
    return storeJson({ error: "Failed to load banners" }, 500);
  }
}
