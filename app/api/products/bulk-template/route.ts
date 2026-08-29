import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/lib/auth";

/**
 * GET /api/products/bulk-template — download the Excel template for bulk product
 * upload. Column order/headers here MUST match the parser in bulk-upload.
 */
export const COLUMNS = [
  "Product Name", // required
  "SKU", // required (unique)
  "Category", // required (must already exist)
  "Price", // number; blank = "Request a Quote"
  "Stock", // number
  "Short Description",
  "Description",
  "Gift Mode", // both | corporate | personal
  "Occasions", // comma-separated
  "Image URLs", // comma-separated
  "Status", // Active | Inactive
];

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Products");
  ws.columns = COLUMNS.map((header) => ({ header, width: Math.max(16, header.length + 4) }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF295A4F" },
  };
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  // One example row to show the expected format.
  ws.addRow([
    "Ceramic Coffee Mug",
    "MUG-001",
    "Drinkware",
    499,
    100,
    "A 350ml ceramic mug.",
    "Microwave-safe ceramic mug, 350ml, matte finish.",
    "both",
    "Birthday, Diwali",
    "https://example.com/mug-1.jpg, https://example.com/mug-2.jpg",
    "Active",
  ]);

  // Notes sheet.
  const notes = wb.addWorksheet("Instructions");
  notes.columns = [{ width: 100 }];
  [
    "How to use this template:",
    "",
    "1. Fill one product per row on the 'Products' sheet (remove the example row).",
    "2. Required columns: Product Name, SKU, Category.",
    "3. Category must already exist in the CRM (create it first if needed).",
    "4. SKU must be unique across all products.",
    "5. Price: a number (e.g. 499). Leave blank for quote-only products.",
    "6. Gift Mode: one of both / corporate / personal (defaults to both).",
    "7. Occasions & Image URLs: separate multiple values with commas.",
    "8. Status: Active or Inactive (defaults to Inactive).",
    "9. Save the file and upload it via Products → Bulk Upload.",
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
