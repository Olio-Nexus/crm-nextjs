import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const customer = await prisma.customer.findUnique({
      where: { id: parseInt(id) },
      select: {
        id:           true,
        name:         true,
        email:        true,
        mobileNumber: true,
        gender:       true,
        dob:          true,
        anniversary:  true,
        company:      true,
        photo:        true,
        status:       true,
        uniqueId:     true,
        createdAt:    true,
        updatedAt:    true,
        addresses: {
          orderBy: { isDefault: "desc" },
        },
        orders: {
          orderBy: { orderDate: "desc" },
          select: {
            id:          true,
            orderNumber: true,
            orderDate:   true,
            grandtotal:  true,
            orderStatus: true,
            paymentMode: true,
          },
        },
        returnOrders: {
          orderBy: { createdAt: "desc" },
          select: {
            id:               true,
            orderNumber:      true,
            status:           true,
            refundAmount:     true,
            returnRequestDate:true,
          },
        },
        customerPromocodes: {
          select: {
            id:       true,
            status:   true,
            promocode:{ select: { id: true, promocode: true, discount: true, discountType: true } },
          },
        },
        _count: {
          select: { orders: true, wishlists: true, returnOrders: true },
        },
      },
    });

    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    // Serialize decimals
    return NextResponse.json({
      ...customer,
      orders: customer.orders.map((o) => ({
        ...o,
        grandtotal: Number(o.grandtotal),
      })),
      returnOrders: customer.returnOrders.map((r) => ({
        ...r,
        refundAmount: r.refundAmount ? Number(r.refundAmount) : null,
      })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch customer" }, { status: 500 });
  }
}

/**
 * Update a customer. Toggles status, and lets an admin set the occasion dates
 * (Birthday / Anniversary) that power the reminder emails. A field is only
 * changed when present in the body; "" clears a date, "YYYY-MM-DD" sets it
 * (stored at UTC midnight so the reminder query's month/day match is stable).
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    const parseDate = (v: unknown): Date | null | undefined => {
      if (v === undefined) return undefined; // not provided → leave unchanged
      if (v === null || v === "") return null; // explicitly cleared
      const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return undefined; // ignore unparseable input rather than error out
      return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    };

    const data: {
      status?: boolean;
      dob?: Date | null;
      anniversary?: Date | null;
    } = {};
    if (typeof body.status === "boolean") data.status = body.status;
    const dob = parseDate(body.dob);
    if (dob !== undefined) data.dob = dob;
    const anniversary = parseDate(body.anniversary);
    if (anniversary !== undefined) data.anniversary = anniversary;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const updated = await prisma.customer.update({
      where: { id: parseInt(id) },
      data,
      select: { id: true, status: true, dob: true, anniversary: true },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 });
  }
}
