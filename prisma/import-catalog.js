/**
 * One-off catalogue import: replaces the demo catalogue with the client's real
 * products from catalog.json (built by the prep step). Category → SubCategory →
 * Product → ProductVariation.
 *
 * DRY RUN by default (prints counts only). To actually wipe + import:
 *   CONFIRM_WIPE=YES CATALOG=/abs/path/catalog.json DATABASE_URL=<live> node prisma/import-catalog.js
 */
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const slugify = (s) =>
  s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function counts(label) {
  const [categories, subCategories, products, variations, orders] = await Promise.all([
    prisma.category.count(),
    prisma.subCategory.count(),
    prisma.product.count(),
    prisma.productVariation.count(),
    prisma.orderMaster.count().catch(() => -1),
  ]);
  console.log(`[${label}] categories=${categories} subcategories=${subCategories} products=${products} variations=${variations} orders=${orders}`);
}

async function main() {
  const catalogPath = process.env.CATALOG;
  if (!catalogPath) throw new Error("Set CATALOG=/abs/path/catalog.json");
  const { categories, products } = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  console.log(`Loaded catalog.json: ${categories.length} categories, ${products.length} products`);

  await counts("BEFORE");

  if (process.env.CONFIRM_WIPE !== "YES") {
    console.log("\nDRY RUN — set CONFIRM_WIPE=YES to wipe the demo catalogue and import. Nothing written.");
    return;
  }

  // 1) Wipe existing catalogue. Deleting categories cascades to subcategories →
  //    products → variations/carts/wishlists/reviews/order-details.
  console.log("\nWiping existing catalogue…");
  await prisma.category.deleteMany({});
  await counts("AFTER WIPE");

  // 2) Create categories, each with one same-named subcategory products attach to.
  console.log("\nCreating categories…");
  const subByCat = {};
  for (const name of categories) {
    const slug = slugify(name);
    const cat = await prisma.category.create({
      data: {
        name,
        slug,
        status: true,
        isFeatured: false,
        subCategories: {
          create: [{ name, slug: `${slug}-all`, status: true }],
        },
      },
      include: { subCategories: true },
    });
    subByCat[name] = cat.subCategories[0].id;
  }
  console.log(`  created ${Object.keys(subByCat).length} categories (+ subcategories)`);

  // 3) Create products + one variation each.
  console.log("\nCreating products…");
  let n = 0;
  for (const p of products) {
    const subcategoryId = subByCat[p.category];
    if (!subcategoryId) throw new Error(`No subcategory for ${p.category}`);

    // Price → variation. price = struck-through original, specialPrice = shown.
    let price, specialPrice;
    if (p.quoteOnly || p.plattera == null) {
      price = 0; specialPrice = null; // renders as "Request a Quote"
    } else if (p.mrp && p.mrp > p.plattera) {
      price = p.mrp; specialPrice = p.plattera;
    } else {
      price = p.plattera; specialPrice = null;
    }

    await prisma.product.create({
      data: {
        subcategoryId,
        productName: p.name,
        urlSlug: p.slug,
        productId: p.sku,
        shortDescription: p.shortDescription,
        description: p.description,
        status: true,
        giftMode: p.giftMode,
        occasions: p.occasions,
        recipients: p.recipients,
        personalizationEnabled: p.personalizationEnabled,
        personalizationPrice: p.personalizationEnabled ? (p.personalizationPrice ?? 0) : null,
        deliveryTimeline: p.deliveryTimeline,
        variations: {
          create: [{
            sku: p.sku,
            price,
            specialPrice,
            stock: 100,
            weightUnit: "kg",
            weight: 0.5,
            dimensionUnit: "cm",
            length: 10, width: 10, height: 10,
            orderSort: 0,
          }],
        },
      },
    });
    n++;
    if (n % 25 === 0) console.log(`  …${n}/${products.length}`);
  }
  console.log(`  created ${n} products`);

  await counts("AFTER");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
