import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/lib/auth";

/**
 * GET /api/customers/import-template — download the Excel template for the
 * customer bulk import (used to load occasion data for reminder emails).
 * Column headers here MUST match the parser in ../import/route.ts.
 */
export const COLUMNS = [
  "Name", // required
  "Email", // required (unique key — matches an existing customer or creates one)
  "Mobile", // optional
  "Gender", // optional dropdown: Male | Female | Other
  "Company", // optional
  "Birthday", // optional, YYYY-MM-DD (powers birthday reminders)
  "Anniversary", // optional, YYYY-MM-DD (powers anniversary reminders)
  "Status", // dropdown: Active | Inactive
];

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Customers");
  ws.columns = COLUMNS.map((header) => ({ header, width: Math.max(16, header.length + 6) }));
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF295A4F" } };

  // Example row.
  ws.addRow([
    "Ravi Sharma",
    "ravi.sharma@example.com",
    "9876543210",
    "Male",
    "Acme Corp",
    "1990-04-15",
    "2018-11-30",
    "Active",
  ]);

  // Dropdowns (data validation) for the restricted columns, rows 2–1000.
  const colOf = (h: string) => COLUMNS.indexOf(h) + 1;
  const listValidation = (values: string[]) => ({
    type: "list" as const,
    allowBlank: true,
    formulae: [`"${values.join(",")}"`],
  });
  const dropdowns: [string, string[]][] = [
    ["Gender", ["Male", "Female", "Other"]],
    ["Status", ["Active", "Inactive"]],
  ];
  for (const [header, values] of dropdowns) {
    const col = colOf(header);
    for (let r = 2; r <= 1000; r++) {
      ws.getCell(r, col).dataValidation = listValidation(values);
    }
  }

  // Force the two date columns to render as text so YYYY-MM-DD is preserved
  // exactly as typed (no locale re-formatting by Excel).
  for (const header of ["Birthday", "Anniversary"]) {
    const col = colOf(header);
    for (let r = 2; r <= 1000; r++) ws.getCell(r, col).numFmt = "@";
  }

  // Instructions.
  const notes = wb.addWorksheet("Instructions");
  notes.columns = [{ width: 100 }];
  [
    "How to use this template:",
    "",
    "1. Fill one customer per row on the 'Customers' sheet (remove the example row).",
    "2. Required: Name and Email.",
    "3. Email is the key: if a customer with that email already exists, their row is",
    "   UPDATED (e.g. to add a Birthday/Anniversary); otherwise a new customer is created.",
    "4. Birthday & Anniversary: use the format YYYY-MM-DD (e.g. 1990-04-15). These",
    "   power the automated occasion-reminder emails. Leave blank if unknown.",
    "5. Gender and Status are dropdowns — pick from the list.",
    "6. Mobile must be unique; if it already belongs to another customer, the row is",
    "   still imported but the mobile is skipped (reported in the summary).",
    "7. Save and upload via Customers → Import from Excel.",
  ].forEach((line) => notes.addRow([line]));

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="customer-import-template.xlsx"`,
    },
  });
}
