import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * POST /api/customers/import — accepts a filled copy of the customer import
 * .xlsx (multipart form field "file") and upserts customers BY EMAIL. Existing
 * customers are updated (e.g. to add a Birthday/Anniversary for reminders);
 * unknown emails create new customers. Blank cells never wipe existing data.
 * Returns { created, updated, failed, warnings[], errors[] }.
 */

/** Read a cell as a trimmed string, unwrapping rich-text / formula / hyperlink. */
function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().split("T")[0];
  if (typeof v === "object") {
    const o = v as unknown as { text?: unknown; result?: unknown };
    if (typeof o.text === "string") return o.text.trim();
    if (o.result != null) return String(o.result).trim();
    return "";
  }
  return String(v).trim();
}

/** Parse a Birthday/Anniversary cell into a UTC-midnight Date (or null). Accepts a
 *  real Excel date, an Excel serial number, or a YYYY-MM-DD / parseable string. */
function parseOccasionDate(v: ExcelJS.CellValue): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  }
  if (typeof v === "number") {
    // Excel serial date: days since 1899-12-30 (UTC).
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  const s = cellText(v);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  }
  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()),
  );
}

const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

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
  const ws = wb.getWorksheet("Customers") ?? wb.worksheets[0];
  if (!ws) return NextResponse.json({ error: "No sheet found in the file." }, { status: 400 });

  // Map header name → column index from the first row.
  const colIndex: Record<string, number> = {};
  ws.getRow(1).eachCell((cell, col) => {
    const name = cellText(cell.value);
    if (name) colIndex[name] = col;
  });
  const cell = (row: ExcelJS.Row, header: string): ExcelJS.CellValue => {
    const idx = colIndex[header];
    return idx ? row.getCell(idx).value : null;
  };
  const get = (row: ExcelJS.Row, header: string): string => cellText(cell(row, header));

  const errors: { row: number; message: string }[] = [];
  const warnings: { row: number; message: string }[] = [];
  let created = 0;
  let updated = 0;
  const seenEmails = new Set<string>();

  const rowNumbers: number[] = [];
  ws.eachRow((_row, n) => {
    if (n > 1) rowNumbers.push(n);
  });

  for (const n of rowNumbers) {
    const row = ws.getRow(n);
    const name = get(row, "Name");
    const email = get(row, "Email").toLowerCase();

    // Skip fully blank rows.
    if (!name && !email && !get(row, "Mobile")) continue;

    if (!name || !email) {
      errors.push({ row: n, message: "Missing a required field (Name, Email)." });
      continue;
    }
    if (!isEmail(email)) {
      errors.push({ row: n, message: `"${email}" is not a valid email.` });
      continue;
    }
    if (seenEmails.has(email)) {
      errors.push({ row: n, message: `Duplicate email "${email}" within the file.` });
      continue;
    }
    seenEmails.add(email);

    const mobile = get(row, "Mobile").replace(/\s+/g, "") || null;
    const genderRaw = get(row, "Gender");
    const gender = genderRaw ? genderRaw.toLowerCase() : null;
    const company = get(row, "Company") || null;
    const dob = parseOccasionDate(cell(row, "Birthday"));
    const anniversary = parseOccasionDate(cell(row, "Anniversary"));
    const statusRaw = get(row, "Status").toLowerCase();
    const status = statusRaw === "" ? null : statusRaw === "active";

    // Validate provided dates (a non-empty cell that didn't parse is an error).
    if (get(row, "Birthday") && !dob) {
      errors.push({ row: n, message: "Birthday isn't a valid date (use YYYY-MM-DD)." });
      continue;
    }
    if (get(row, "Anniversary") && !anniversary) {
      errors.push({ row: n, message: "Anniversary isn't a valid date (use YYYY-MM-DD)." });
      continue;
    }

    try {
      const existing = await prisma.customer.findUnique({
        where: { email },
        select: { id: true },
      });

      // Mobile is unique — if it already belongs to a DIFFERENT customer, import
      // the row but skip the mobile (and warn), so occasion data still lands.
      let mobileToSet = mobile;
      if (mobile) {
        const clash = await prisma.customer.findFirst({
          where: { mobileNumber: mobile, NOT: { email } },
          select: { id: true },
        });
        if (clash) {
          mobileToSet = null;
          warnings.push({
            row: n,
            message: `Mobile ${mobile} already belongs to another customer — imported without it.`,
          });
        }
      }

      if (existing) {
        // Non-destructive: only overwrite fields the sheet actually provides.
        await prisma.customer.update({
          where: { email },
          data: {
            name,
            ...(mobileToSet ? { mobileNumber: mobileToSet } : {}),
            ...(gender ? { gender } : {}),
            ...(company ? { company } : {}),
            ...(dob ? { dob } : {}),
            ...(anniversary ? { anniversary } : {}),
            ...(status !== null ? { status } : {}),
          },
        });
        updated++;
      } else {
        await prisma.customer.create({
          data: {
            name,
            email,
            mobileNumber: mobileToSet,
            gender,
            company,
            dob,
            anniversary,
            // OTP-only login for storefront customers — an unusable password.
            password: `imported-no-login-${crypto.randomBytes(8).toString("hex")}`,
            uniqueId: crypto.randomUUID(),
            status: status ?? true,
          },
        });
        created++;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to import row.";
      errors.push({ row: n, message: msg.slice(0, 160) });
    }
  }

  return NextResponse.json({
    created,
    updated,
    failed: errors.length,
    warnings,
    errors,
  });
}
