import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * GET /api/products/bulk-template — download the Excel template for bulk product
 * upload. Column headers here MUST match the parser in bulk-upload.
 */
export const COLUMNS = [
  "Product Name", // required
  "SKU", // required (unique)
  "Category", // required (dropdown — must already exist)
  "Price", // number; blank = "Request a Quote"
  "Stock", // number
  "Short Description",
  "Description",
  "Gift Mode", // dropdown: both | corporate | personal
  "Occasions", // comma-separated (see 'Valid Occasions' sheet)
  "Image URLs", // comma-separated DIRECT image links
  "Status", // dropdown: Active | Inactive
  "Rating", // 0–5
  "Review Count", // number
  "Delivery Timeline", // free text, e.g. "3–4 days"
  "Badge", // free text, e.g. Bestseller / New / Limited Edition
];

// Occasions the storefront recognises (used for the reference sheet).
const VALID_OCCASIONS = [
  "Welcome / Onboarding Kits", "Employee Appreciation", "Work Anniversary",
  "Women's Day", "New Year", "Diwali", "Birthday", "Anniversary",
  "Wedding & Housewarming", "Raksha Bandhan", "Valentine's Day",
  "Personalised", "Mother's Day", "Father's Day",
];

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Live category names → the Category dropdown list.
  const cats = await prisma.category.findMany({
    where: { status: true },
    select: { name: true },
    orderBy: { name: "asc" },
  });
  const categoryNames = cats.map((c) => c.name);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Products");
  ws.columns = COLUMNS.map((header) => ({ header, width: Math.max(16, header.length + 4) }));
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF295A4F" } };

  // Example row.
  ws.addRow([
    "Ceramic Coffee Mug", "MUG-001", categoryNames[0] ?? "Drinkware", 499, 100,
    "A 350ml ceramic mug.", "Microwave-safe ceramic mug, 350ml, matte finish.",
    "both", "Birthday, Diwali",
    "https://example.com/mug-1.jpg, https://example.com/mug-2.jpg",
    "Active", 4.5, 12, "3–4 days", "Bestseller",
  ]);

  // Dropdowns (data validation) for the restricted columns, rows 2–500.
  const colOf = (h: string) => COLUMNS.indexOf(h) + 1;
  const listValidation = (values: string[]) => ({
    type: "list" as const,
    allowBlank: true,
    formulae: [`"${values.join(",")}"`],
  });
  const dropdowns: [string, string[]][] = [
    ["Category", categoryNames],
    ["Gift Mode", ["both", "corporate", "personal"]],
    ["Status", ["Active", "Inactive"]],
  ];
  for (const [header, values] of dropdowns) {
    if (!values.length) continue;
    const col = colOf(header);
    for (let r = 2; r <= 500; r++) {
      ws.getCell(r, col).dataValidation = listValidation(values);
    }
  }

  // Valid Occasions reference (Occasions is multi-value, so comma-separate these).
  const occ = wb.addWorksheet("Valid Occasions");
  occ.columns = [{ header: "Use these exact occasion names (comma-separate multiple)", width: 60 }];
  occ.getRow(1).font = { bold: true };
  VALID_OCCASIONS.forEach((o) => occ.addRow([o]));

  // Instructions.
  const notes = wb.addWorksheet("Instructions");
  notes.columns = [{ width: 100 }];
  [
    "How to use this template:",
    "",
    "1. Fill one product per row on the 'Products' sheet (remove the example row).",
    "2. Required: Product Name, SKU, Category.",
    "3. Category, Gift Mode and Status are dropdowns — pick from the list.",
    "4. Category must already exist in the CRM.",
    "5. SKU must be unique across all products.",
    "6. Price: a number (e.g. 499). Leave blank for quote-only products.",
    "7. Occasions: comma-separate values from the 'Valid Occasions' sheet.",
    "8. Image URLs: DIRECT links to the image file (ending in .jpg/.png/.webp) that",
    "   open the image itself in a browser. Google Drive / Dropbox 'share' links or",
    "   web-page links will NOT work (they show a page, not the image).",
    "9. Rating (0–5), Review Count (number), Delivery Timeline & Badge are optional.",
    "10. Save and upload via Products → Bulk Upload.",
  ].forEach((line) => notes.addRow([line]));

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="product-upload-template.xlsx"`,
    },
  });
}
