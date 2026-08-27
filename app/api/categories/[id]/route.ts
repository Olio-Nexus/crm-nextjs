import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidateStorefront } from "@/lib/revalidate";
import { slugify } from "@/lib/utils";

// GET /api/categories/:id
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const category = await prisma.category.findUnique({
      where: { id: parseInt(id) },
      include: { subCategories: true },
    });
    if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(category);
  } catch {
    return NextResponse.json({ error: "Failed to fetch category" }, { status: 500 });
  }
}

// PUT /api/categories/:id
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { name, description, image, altTag, metaTitle, metaDescription,
      metaKeywords, isFeatured, status, hsnCode, gst } = body;

    const category = await prisma.category.update({
      where: { id: parseInt(id) },
      data: {
        name, slug: slugify(name), description, image, altTag,
        metaTitle, metaDescription, metaKeywords,
        isFeatured, status,
        hsnCode, gst: gst ? parseInt(gst) : null,
      },
    });
    void revalidateStorefront(["categories", "products"]);
    return NextResponse.json(category);
  } catch {
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}

// DELETE /api/categories/:id
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    await prisma.category.delete({ where: { id: parseInt(id) } });
    void revalidateStorefront(["categories", "products"]);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
