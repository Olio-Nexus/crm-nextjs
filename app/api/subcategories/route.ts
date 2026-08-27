import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { revalidateStorefront } from "@/lib/revalidate";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId");

    const subcategories = await prisma.subCategory.findMany({
      where: categoryId ? { categoryId: parseInt(categoryId) } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        category: { select: { id: true, name: true } },
        _count: { select: { products: true } },
      },
    });
    return NextResponse.json(subcategories);
  } catch {
    return NextResponse.json({ error: "Failed to fetch subcategories" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, categoryId, description, image, headerImage, altTag,
      metaTitle, metaDescription, metaKeywords, isFeatured, status } = body;

    if (!name || !categoryId) {
      return NextResponse.json({ error: "Name and category are required" }, { status: 400 });
    }

    const subcategory = await prisma.subCategory.create({
      data: {
        name, categoryId: parseInt(categoryId),
        slug: slugify(name), description, image, headerImage, altTag,
        metaTitle, metaDescription, metaKeywords,
        isFeatured: isFeatured ?? false,
        status: status ?? false,
      },
    });
    void revalidateStorefront(["categories", "products"]);
    return NextResponse.json(subcategory, { status: 201 });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "A subcategory with this name already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create subcategory" }, { status: 500 });
  }
}
