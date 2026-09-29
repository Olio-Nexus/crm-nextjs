import { NextRequest } from "next/server";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { storeJson, handleOptions } from "@/lib/store";
import { getCustomerFromRequest } from "@/lib/customer-auth";
import { getRazorpayCreds, verifyPaymentSignature } from "@/lib/razorpay";
import { finalizePaidOrder } from "@/lib/order-finalize";

export const OPTIONS = handleOptions;

/**
 * POST /api/store/orders/verify
 * body: { razorpayOrderId, razorpayPaymentId, razorpaySignature }
 *
 * Verifies the Razorpay checkout signature server-side, then marks the order
 * paid (via the shared, idempotent finalizer). A webhook or double callback
 * won't double-apply stock/cart changes.
 */
export async function POST(req: NextRequest) {
  try {
    const customer = await getCustomerFromRequest(req);
    if (!customer) return storeJson({ error: "Please sign in." }, 401);

    const body = await req.json().catch(() => ({}));
    const razorpayOrderId = String(body?.razorpayOrderId ?? "");
    const razorpayPaymentId = String(body?.razorpayPaymentId ?? "");
    const razorpaySignature = String(body?.razorpaySignature ?? "");
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return storeJson({ error: "Missing payment details." }, 400);
    }

    // The order must belong to this customer and exist.
    const order = await prisma.orderMaster.findFirst({
      where: { razorpayOrderId, customerId: customer.id },
      select: { id: true, orderNumber: true, orderStatus: true },
    });
    if (!order) return storeJson({ error: "Order not found." }, 404);
    if (order.orderStatus !== OrderStatus.PAYMENT_PENDING) {
      return storeJson({ ok: true, orderNumber: order.orderNumber }); // already paid
    }

    const creds = await getRazorpayCreds();
    if (!creds) return storeJson({ error: "Payments are not configured." }, 503);

    const valid = verifyPaymentSignature(creds.keySecret, {
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    });
    if (!valid) return storeJson({ error: "Payment could not be verified." }, 400);

    const result = await finalizePaidOrder({
      razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
      customerId: customer.id,
    });
    if (!result.found) return storeJson({ error: "Order not found." }, 404);

    return storeJson({ ok: true, orderNumber: result.orderNumber });
  } catch (error) {
    console.error("POST /api/store/orders/verify failed", error);
    return storeJson({ error: "Could not confirm the payment. Please try again." }, 500);
  }
}
