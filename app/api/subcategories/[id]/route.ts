import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { revalidateStorefront } from "@/lib/revalidate";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const sub = await prisma.subCategory.findUnique({
      where: { id: parseInt(id) },
      include: { category: true },
    });
    if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(sub);
  } catch {
    return NextResponse.json({ error: "Failed to fetch subcategory" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { name, categoryId, description, image, headerImage, altTag,
      metaTitle, metaDescription, metaKeywords, isFeatured, status } = body;

    const sub = await prisma.subCategory.update({
      where: { id: parseInt(id) },
      data: {
        name, categoryId: parseInt(categoryId),
        slug: slugify(name), description, image, headerImage, altTag,
        metaTitle, metaDescription, metaKeywords, isFeatured, status,
      },
    });
    void revalidateStorefront(["categories", "products"]);
    return NextResponse.json(sub);
  } catch {
    return NextResponse.json({ error: "Failed to update subcategory" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    await prisma.subCategory.delete({ where: { id: parseInt(id) } });
    void revalidateStorefront(["categories", "products"]);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete subcategory" }, { status: 500 });
  }
}
