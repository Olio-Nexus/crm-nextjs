/**
 * Insert a ₹1 test product so the LIVE Razorpay checkout can be tested with a
 * real-but-tiny charge (refund it after). Idempotent — re-running won't dupe.
 *
 * Run:  npx ts-node prisma/seed-test-product.ts
 */
import * as dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();
const prisma = new PrismaClient();

const SKU = "TEST-1RS";
const SLUG = "test-product-1-rupee";

async function main() {
  const existing = await prisma.productVariation.findUnique({ where: { sku: SKU } });
  if (existing) {
    console.log(`ℹ️  Test product already exists (SKU ${SKU}). Nothing to do.`);
    console.log(`   Storefront: /products/${SLUG}`);
    return;
  }

  // Prefer a subcategory under an ACTIVE category so the product shows on the storefront.
  let sub = await prisma.subCategory.findFirst({
    where: { category: { status: true } },
    orderBy: { id: "asc" },
  });
  if (!sub) {
    const cat = await prisma.category.create({
      data: { name: "Test", slug: "test", status: true },
    });
    sub = await prisma.subCategory.create({
      data: { categoryId: cat.id, name: "Test", slug: "test", status: true },
    });
    console.log(`🗂️  Created a Test category/subcategory (none active existed).`);
  }

  const product = await prisma.product.create({
    data: {
      subcategoryId: sub.id,
      productName: "Test Product (₹1)",
      urlSlug: SLUG,
      productId: SKU,
      images: [],
      shortDescription: "₹1 test product for verifying live payments. Safe to refund.",
      description: "Temporary product used to test the live Razorpay checkout with a minimal charge.",
      giftMode: "both",
      occasions: [],
      recipients: [],
      trendingModes: [],
      status: true,
      variations: {
        create: [
          {
            sku: SKU,
            price: 1,
            stock: 100,
            weightUnit: "kg",
            weight: 0,
            dimensionUnit: "cm",
            length: 0,
            width: 0,
            height: 0,
            orderSort: 0,
          },
        ],
      },
    },
  });

  console.log(`✅ Created "Test Product (₹1)" (id ${product.id}, SKU ${SKU}, ₹1, stock 100).`);
  console.log(`   Storefront: http://localhost:3001/products/${SLUG}`);
  console.log(`   Delete it (or set Inactive) in CRM → Products once testing is done.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
