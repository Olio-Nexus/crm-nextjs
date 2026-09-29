import { NextRequest, NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRazorpayCreds, verifyWebhookSignature } from "@/lib/razorpay";
import { finalizePaidOrder } from "@/lib/order-finalize";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * POST /api/razorpay/webhook — Razorpay server-to-server events. The reliable
 * backstop so an order is never lost if the customer's browser closes before
 * the verify callback. Verifies the raw-body HMAC against RAZORPAY_WEBHOOK_SECRET.
 * Not a storefront (CORS) endpoint — Razorpay calls it directly.
 *
 * Configure in the Razorpay dashboard for: payment.captured, payment.failed,
 * refund.processed (and optionally order.paid).
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";

  const creds = await getRazorpayCreds();
  if (!creds?.webhookSecret) {
    console.warn("[razorpay webhook] no webhook secret configured — ignoring event");
    return NextResponse.json({ ok: true, skipped: true });
  }
  if (!signature || !verifyWebhookSignature(creds.webhookSecret, raw, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  try {
    const type = event?.event as string;

    if (type === "payment.captured" || type === "order.paid") {
      const payment = event?.payload?.payment?.entity;
      if (payment?.order_id) {
        await finalizePaidOrder({
          razorpayOrderId: payment.order_id,
          paymentId: payment.id,
        });
      }
    } else if (type === "payment.failed") {
      const payment = event?.payload?.payment?.entity;
      if (payment?.order_id) {
        await prisma.orderMaster.updateMany({
          where: {
            razorpayOrderId: payment.order_id,
            orderStatus: OrderStatus.PAYMENT_PENDING,
          },
          data: { paymentStatus: "Failed" },
        });
      }
    } else if (type === "refund.processed" || type === "refund.created") {
      const refund = event?.payload?.refund?.entity;
      if (refund?.payment_id) {
        await prisma.orderMaster.updateMany({
          where: { razorpayPaymentId: refund.payment_id },
          data: { orderStatus: OrderStatus.REFUNDED, paymentStatus: "Refunded" },
        });
      }
    }
  } catch (e) {
    // Acknowledge anyway so Razorpay doesn't hammer retries over a transient blip.
    console.error("[razorpay webhook] handler error", e);
  }

  return NextResponse.json({ ok: true });
}
