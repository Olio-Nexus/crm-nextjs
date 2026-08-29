import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/** GET /api/customers/export — download all customers as an .xlsx file. */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      name: true,
      email: true,
      mobileNumber: true,
      gender: true,
      company: true,
      dob: true,
      anniversary: true,
      status: true,
      createdAt: true,
    },
  });

  const fmtDate = (d: Date | null) =>
    d ? new Date(d).toISOString().split("T")[0] : "";

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Customers");
  ws.columns = [
    { header: "Name", key: "name", width: 24 },
    { header: "Email", key: "email", width: 30 },
    { header: "Mobile", key: "mobile", width: 16 },
    { header: "Gender", key: "gender", width: 10 },
    { header: "Company", key: "company", width: 22 },
    { header: "Birthday", key: "dob", width: 14 },
    { header: "Anniversary", key: "anniversary", width: 14 },
    { header: "Status", key: "status", width: 10 },
    { header: "Joined", key: "joined", width: 14 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const c of customers) {
    ws.addRow({
      name: c.name,
      email: c.email,
      mobile: c.mobileNumber ?? "",
      gender: c.gender ?? "",
      company: c.company ?? "",
      dob: fmtDate(c.dob),
      anniversary: fmtDate(c.anniversary),
      status: c.status ? "Active" : "Inactive",
      joined: fmtDate(c.createdAt),
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const fileName = `customers-${new Date().toISOString().split("T")[0]}.xlsx`;
  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
