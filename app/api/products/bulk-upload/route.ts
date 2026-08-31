import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { toDirectImageUrl } from "@/lib/images";

/**
 * POST /api/products/bulk-upload — accepts a filled copy of the bulk-template
 * .xlsx (multipart form field "file"), creates the products, and returns a
 * per-row summary { created, failed, errors[] }. Existing products are never
 * modified; rows with problems are skipped and reported.
 */

/** Read a cell as a trimmed string, unwrapping rich-text / formula / hyperlink. */
function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object") {
    const o = v as unknown as {
      text?: unknown;
      result?: unknown;
      hyperlink?: unknown;
    };
    // Prefer the hyperlink target (so an image cell yields the real URL, not the
    // display text) — falls back to text / formula result.
    if (typeof o.hyperlink === "string") return o.hyperlink.trim();
    if (typeof o.text === "string") return o.text.trim();
    if (o.result != null) return String(o.result).trim();
    return "";
  }
  return String(v).trim();
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  const buffer = Buffer.from(await (file as File).arrayBuffer());
  const wb = new ExcelJS.Workbook();
  try {
    // exceljs' Buffer type lags @types/node's generic Buffer — cast to satisfy it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(buffer as any);
  } catch {
    return NextResponse.json(
      { error: "Could not read the file. Please use the provided .xlsx template." },
      { status: 400 },
    );
  }
  const ws = wb.getWorksheet("Products") ?? wb.worksheets[0];
  if (!ws) return NextResponse.json({ error: "No sheet found in the file." }, { status: 400 });

  // Map header name → column index from the first row.
  const colIndex: Record<string, number> = {};
  ws.getRow(1).eachCell((cell, col) => {
    const name = cellText(cell.value);
    if (name) colIndex[name] = col;
  });
  const get = (row: ExcelJS.Row, header: string): string => {
    const idx = colIndex[header];
    return idx ? cellText(row.getCell(idx).value) : "";
  };

  // Preload categories → id, and each category → its (auto-managed) sub-category
  // id. Sub-categories are hidden from the admin; every category has one.
  const cats = await prisma.category.findMany({ select: { id: true, name: true } });
  const catByName = new Map<string, number>();
  for (const c of cats) catByName.set(c.name.toLowerCase(), c.id);

  const subs = await prisma.subCategory.findMany({
    select: { id: true, category: { select: { name: true } } },
    orderBy: { id: "asc" },
  });
  const catToSub = new Map<string, number>();
  for (const s of subs) {
    const cat = (s.category?.name ?? "").toLowerCase();
    if (cat && !catToSub.has(cat)) catToSub.set(cat, s.id);
  }

  const errors: { row: number; message: string }[] = [];
  let created = 0;
  const usedSkus = new Set<string>();

  const rowNumbers: number[] = [];
  ws.eachRow((_row, n) => {
    if (n > 1) rowNumbers.push(n);
  });

  for (const n of rowNumbers) {
    const row = ws.getRow(n);
    const name = get(row, "Product Name");
    const sku = get(row, "SKU");
    const category = get(row, "Category");

    // Skip blank rows entirely.
    if (!name && !sku && !category) continue;

    if (!name || !sku || !category) {
      errors.push({ row: n, message: "Missing a required field (Product Name, SKU, Category)." });
      continue;
    }
    const catKey = category.toLowerCase();
    const catId = catByName.get(catKey);
    if (!catId) {
      errors.push({ row: n, message: `Category "${category}" not found — create it first.` });
      continue;
    }
    // Resolve the category's (auto) sub-category — create one if it has none.
    let subId = catToSub.get(catKey);
    if (!subId) {
      try {
        const createdSub = await prisma.subCategory.create({
          data: { categoryId: catId, name: category, status: true },
        });
        subId = createdSub.id;
        catToSub.set(catKey, subId);
      } catch {
        errors.push({ row: n, message: `Could not resolve a sub-category for "${category}".` });
        continue;
      }
    }
    if (usedSkus.has(sku.toLowerCase())) {
      errors.push({ row: n, message: `Duplicate SKU "${sku}" within the file.` });
      continue;
    }

    const priceStr = get(row, "Price");
    const price = priceStr !== "" ? parseFloat(priceStr) : 0;
    const stockStr = get(row, "Stock");
    const stock = stockStr !== "" ? parseInt(stockStr) : 0;
    const gm = get(row, "Gift Mode").toLowerCase();
    const giftMode = ["both", "corporate", "personal"].includes(gm) ? gm : "both";
    const occasions = get(row, "Occasions").split(",").map((s) => s.trim()).filter(Boolean);
    const images = get(row, "Image URLs")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(toDirectImageUrl); // rewrite Google Drive links to direct image URLs
    const status = get(row, "Status").toLowerCase() === "active";
    const shortDesc = get(row, "Short Description");
    const desc = get(row, "Description");
    const ratingStr = get(row, "Rating");
    const rating = ratingStr !== "" && !Number.isNaN(parseFloat(ratingStr)) ? parseFloat(ratingStr) : null;
    const reviewStr = get(row, "Review Count");
    const reviewCount = reviewStr !== "" && !Number.isNaN(parseInt(reviewStr)) ? parseInt(reviewStr) : null;
    const deliveryTimeline = get(row, "Delivery Timeline") || null;
    const badge = get(row, "Badge") || null;

    try {
      const skuTaken = await prisma.productVariation.findFirst({ where: { sku }, select: { id: true } });
      if (skuTaken) {
        errors.push({ row: n, message: `SKU "${sku}" already exists in the catalogue.` });
        continue;
      }

      // Unique slug.
      const base = slugify(name) || `product-${n}`;
      let urlSlug = base;
      let suffix = 1;
      while (await prisma.product.findFirst({ where: { urlSlug }, select: { id: true } })) {
        urlSlug = `${base}-${suffix++}`;
      }

      await prisma.product.create({
        data: {
          subcategoryId: subId,
          productName: name,
          urlSlug,
          productId: sku,
          images,
          shortDescription: shortDesc || "",
          description: desc || shortDesc || "",
          giftMode,
          occasions,
          status,
          rating,
          reviewCount,
          deliveryTimeline,
          badge,
          variations: {
            create: [{
              sku,
              price: Number.isNaN(price) ? 0 : price,
              stock: Number.isNaN(stock) ? 0 : stock,
              weightUnit: "kg",
              weight: 0,
              dimensionUnit: "cm",
              length: 0,
              width: 0,
              height: 0,
              orderSort: 0,
            }],
          },
        },
      });
      usedSkus.add(sku.toLowerCase());
      created++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create product.";
      errors.push({ row: n, message: msg.slice(0, 160) });
    }
  }

  return NextResponse.json({ created, failed: errors.length, errors });
}
