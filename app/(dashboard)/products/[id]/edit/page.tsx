import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ProductForm from "@/components/shared/ProductForm";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id: parseInt(id) },
    include: {
      variations: { orderBy: { orderSort: "asc" } },
      // Parent category id, so the form can pre-select the category dropdown
      // (and thus load + pre-select the right subcategory) on edit.
      subcategory: { select: { categoryId: true } },
    },
  });
  if (!product) notFound();
  return <ProductForm mode="edit" initial={product} />;
}
