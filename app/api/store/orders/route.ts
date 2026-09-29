import { NextRequest } from "next/server";
import { OrderStatus, PaymentMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { storeJson, handleOptions } from "@/lib/store";
import { getCustomerFromRequest } from "@/lib/customer-auth";
import { resolvePromo } from "@/lib/promo";
import { getRazorpayCreds, createRazorpayOrder } from "@/lib/razorpay";
import { generateOrderNumber } from "@/lib/utils";
import {
  GST_RATE,
  round2,
  embeddedGst,
  shapeStoreOrder,
  storeOrderInclude,
} from "@/lib/store-order";

export const OPTIONS = handleOptions;

interface ShipmentAddress {
  name: string;
  phone: string;
  street: string;
  landmarks?: string;
  city: string;
  state: string;
  pincode: string;
}
interface ShipmentInput {
  address: ShipmentAddress;
  items: Array<{ cartItemId: number; quantity: number }>;
}

/**
 * GET /api/store/orders — the signed-in customer's placed orders (newest first).
 */
export async function GET(req: NextRequest) {
  const customer = await getCustomerFromRequest(req);
  if (!customer) return storeJson({ error: "Please sign in." }, 401);

  const orders = await prisma.orderMaster.findMany({
    where: { customerId: customer.id, orderStatus: { not: OrderStatus.PAYMENT_PENDING } },
    orderBy: { createdAt: "desc" },
    include: storeOrderInclude,
  });
  return storeJson({ orders: orders.map(shapeStoreOrder) });
}

/**
 * POST /api/store/orders — create an order from the cart + open a Razorpay order.
 *
 * Single address:  { addressId, promocode? }
 * Multi-address:    { shipments: [{ address, items: [{variationId, quantity}] }], promocode? }
 *
 * Totals are computed SERVER-SIDE from the cart (GST-inclusive, free delivery),
 * so the charged amount equals what the storefront shows. Multi-address splits a
 * cart item's quantity across manually-entered addresses (validated to sum to
 * the cart), storing each split's ship-to on its OrderDetail. Saved PAYMENT_PENDING
 * until the payment signature is verified (see /orders/verify).
 */
export async function POST(req: NextRequest) {
  try {
    const customer = await getCustomerFromRequest(req);
    if (!customer) return storeJson({ error: "Please sign in to place an order." }, 401);

    const body = await req.json().catch(() => ({}));
    const promocode = body?.promocode ? String(body.promocode).trim() : "";
    const shipments: ShipmentInput[] | undefined = Array.isArray(body?.shipments)
      ? body.shipments
      : undefined;
    const multi = !!shipments && shipments.length > 0;

    const cartRows = await prisma.cart.findMany({
      where: { customerId: customer.id },
      include: { product: true, variation: true },
    });
    if (cartRows.length === 0) return storeJson({ error: "Your cart is empty." }, 400);

    const cartById = new Map<number, (typeof cartRows)[number]>();
    for (const r of cartRows) cartById.set(r.id, r);

    const lineOf = (
      row: (typeof cartRows)[number],
      quantity: number,
      delivery: (ShipmentAddress & { shipIndex: number }) | null,
    ) => {
      const v = row.variation;
      const base = Number(v.specialPrice ?? v.price);
      const perso = (row.personalization as { fee?: number } | null) ?? null;
      const fee = perso?.fee != null ? Number(perso.fee) : 0;
      const unitInclusive = round2(base + fee);
      return {
        row,
        v,
        quantity,
        unitInclusive,
        lineTotal: round2(unitInclusive * quantity),
        delivery,
      };
    };

    // Resolve the OrderMaster (billing/primary) address + the per-line splits.
    let masterAddress: {
      name: string;
      phone: string;
      street: string;
      landmarks?: string | null;
      city: string;
      state: string;
      pincode: string;
      country: string;
      addressType?: string | null;
    };
    let lines: ReturnType<typeof lineOf>[] = [];

    if (multi) {
      const assigned = new Map<number, number>();
      shipments!.forEach((ship, si) => {
        const a = ship.address ?? ({} as ShipmentAddress);
        if (!a.name || !a.phone || !a.street || !a.city || !a.state || !a.pincode) {
          throw new StoreError("Each delivery address needs a name, phone, street, city, state and pincode.");
        }
        for (const it of ship.items ?? []) {
          const qty = Number(it.quantity);
          if (!qty || qty < 1) continue;
          const row = cartById.get(Number(it.cartItemId));
          if (!row) throw new StoreError("An item in the delivery split isn't in your cart.");
          lines.push(lineOf(row, qty, { ...a, shipIndex: si }));
          assigned.set(row.id, (assigned.get(row.id) ?? 0) + qty);
        }
      });
      // Every cart line's quantity must be fully assigned across addresses.
      for (const row of cartRows) {
        if ((assigned.get(row.id) ?? 0) !== row.quantity) {
          throw new StoreError(
            `Assign all ${row.quantity} of "${row.product.productName}" across your delivery addresses.`,
          );
        }
      }
      const first = shipments![0].address;
      masterAddress = {
        name: first.name,
        phone: first.phone,
        street: first.street,
        landmarks: first.landmarks ?? null,
        city: first.city,
        state: first.state,
        pincode: first.pincode,
        country: "India",
        addressType: null,
      };
    } else {
      const addressId = Number(body?.addressId);
      if (!addressId) return storeJson({ error: "Please choose a delivery address." }, 400);
      const address = await prisma.customerAddress.findFirst({
        where: { id: addressId, customerId: customer.id },
      });
      if (!address) return storeJson({ error: "Delivery address not found." }, 400);
      lines = cartRows.map((row) => lineOf(row, row.quantity, null));
      masterAddress = {
        name: address.name,
        phone: address.phoneNumber,
        street: address.streetAddress,
        landmarks: address.landmarks,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        country: address.country || "India",
        addressType: address.addressType,
      };
    }

    // Stock check — total assigned quantity per variation must be in stock.
    const perVar = new Map<number, number>();
    for (const l of lines) perVar.set(l.v.id, (perVar.get(l.v.id) ?? 0) + l.quantity);
    for (const [vid, qty] of perVar) {
      const row = cartRows.find((r) => r.variationId === vid);
      if (row && (row.variation.stock ?? 0) < qty) {
        return storeJson(
          { error: `"${row.product.productName}" doesn't have enough stock.` },
          409,
        );
      }
    }

    const itemTotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));

    let discount = 0;
    let promoResult = null as Awaited<ReturnType<typeof resolvePromo>> | null;
    if (promocode) {
      promoResult = await resolvePromo(promocode, itemTotal);
      if (!promoResult.valid) return storeJson({ error: promoResult.message }, 400);
      discount = Math.round(promoResult.discount);
    }

    const deliveryFee = 0;
    const grandtotal = round2(Math.max(0, itemTotal - discount));
    const amountPaise = Math.round(grandtotal * 100);
    if (amountPaise < 100) {
      return storeJson({ error: "Order total is too low to process a payment." }, 400);
    }

    const creds = await getRazorpayCreds();
    if (!creds) return storeJson({ error: "Online payments are not configured yet." }, 503);

    const orderNumber = generateOrderNumber();
    const rzpOrder = await createRazorpayOrder(creds, {
      amountPaise,
      receipt: orderNumber,
      notes: { orderNumber, customerId: String(customer.id) },
    });

    const order = await prisma.orderMaster.create({
      data: {
        custName: masterAddress.name || customer.name,
        custEmail: customer.email,
        custNumber: masterAddress.phone || customer.mobileNumber || "",
        customerId: customer.id,
        streetAddress: masterAddress.street,
        landmarks: masterAddress.landmarks,
        city: masterAddress.city,
        state: masterAddress.state,
        country: masterAddress.country,
        pincode: masterAddress.pincode,
        addressType: masterAddress.addressType,
        orderNumber,
        orderDate: new Date(),
        itemTotal,
        deliveryFee,
        gstCharges: embeddedGst(grandtotal),
        grandtotal,
        razorpayTransactionAmount: grandtotal,
        promocode: promoResult?.valid ? promoResult.code : null,
        promocodeId: promoResult?.promo?.id ?? null,
        discount: discount || null,
        discountType: promoResult?.promo?.discountType ?? null,
        isPromocodeMaxCapApplied: promoResult?.capApplied ?? false,
        orderStatus: OrderStatus.PAYMENT_PENDING,
        razorpayOrderId: rzpOrder.id,
        paymentMode: PaymentMode.RAZORPAY,
        paymentStatus: "Pending",
        orderDetails: {
          create: lines.map((l, i) => ({
            productId: l.row.productId,
            variationId: l.row.variationId,
            productName: l.row.product.productName,
            sku: l.v.sku,
            attributes: { personalization: (l.row.personalization as object) ?? null },
            quantity: l.quantity,
            subOrderNumber: l.delivery
              ? `SUB-${orderNumber}-S${l.delivery.shipIndex + 1}-${i + 1}`
              : `SUB-${orderNumber}-${i + 1}`,
            // Per-line ship-to (multi-address); null → OrderMaster address.
            deliveryName: l.delivery?.name ?? null,
            deliveryPhone: l.delivery?.phone ?? null,
            deliveryStreet: l.delivery?.street ?? null,
            deliveryLandmarks: l.delivery?.landmarks ?? null,
            deliveryCity: l.delivery?.city ?? null,
            deliveryState: l.delivery?.state ?? null,
            deliveryPincode: l.delivery?.pincode ?? null,
            unitPrice: round2(l.unitInclusive / (1 + GST_RATE)),
            priceWithGst: l.unitInclusive,
            total: l.lineTotal,
            deliveryFee: 0,
            gstCharges: embeddedGst(l.lineTotal),
            orderStatus: OrderStatus.PAYMENT_PENDING,
            weight: l.v.weight,
            weightUnit: l.v.weightUnit,
            length: l.v.length,
            width: l.v.width,
            height: l.v.height,
            dimensionUnit: l.v.dimensionUnit,
          })),
        },
      },
    });

    return storeJson({
      orderId: order.id,
      orderNumber,
      razorpayOrderId: rzpOrder.id,
      amount: amountPaise,
      currency: "INR",
      keyId: creds.keyId,
      prefill: {
        name: masterAddress.name || customer.name,
        email: customer.email,
        contact: masterAddress.phone || customer.mobileNumber || "",
      },
    });
  } catch (error) {
    if (error instanceof StoreError) return storeJson({ error: error.message }, 400);
    console.error("POST /api/store/orders failed", error);
    return storeJson({ error: "Could not start checkout. Please try again." }, 500);
  }
}

/** A validation error whose message is safe to show the customer. */
class StoreError extends Error {}
