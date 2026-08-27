import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { revalidateStorefront } from "@/lib/revalidate";

// GET /api/categories — list all categories
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { subCategories: true } } },
    });
    return NextResponse.json(categories);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}

// POST /api/categories — create a new category
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, description, image, altTag, metaTitle, metaDescription,
      metaKeywords, isFeatured, status, hsnCode, gst } = body;

    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const slug = slugify(name);

    const category = await prisma.category.create({
      data: {
        name, slug, description, image, altTag,
        metaTitle, metaDescription, metaKeywords,
        isFeatured: isFeatured ?? false,
        status: status ?? false,
        hsnCode, gst: gst ? parseInt(gst) : null,
      },
    });
    void revalidateStorefront(["categories", "products"]);
    return NextResponse.json(category, { status: 201 });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "A category with this name already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
