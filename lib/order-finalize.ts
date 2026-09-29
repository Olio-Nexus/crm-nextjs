import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendOrderConfirmation } from "@/lib/order-email";
import { notifyNewOrder } from "@/lib/notifications";

/**
 * Finalize a paid order: PAYMENT_PENDING → PLACED, record the payment, decrement
 * stock, clear the customer's cart, and email a confirmation. Idempotent — if
 * the order is already past PAYMENT_PENDING it's a no-op, so the checkout-callback
 * verify and the Razorpay webhook can both call this without double-applying.
 */
export async function finalizePaidOrder(args: {
  razorpayOrderId: string;
  paymentId: string;
  signature?: string;
  /** When set, scope the lookup to this customer (verify callback). */
  customerId?: number;
}): Promise<{ found: boolean; orderNumber?: string }> {
  const order = await prisma.orderMaster.findFirst({
    where: args.customerId
      ? { razorpayOrderId: args.razorpayOrderId, customerId: args.customerId }
      : { razorpayOrderId: args.razorpayOrderId },
    include: { orderDetails: true },
  });
  if (!order) return { found: false };

  // Already finalized elsewhere — succeed without re-applying stock/cart.
  if (order.orderStatus !== OrderStatus.PAYMENT_PENDING) {
    return { found: true, orderNumber: order.orderNumber };
  }

  await prisma.$transaction([
    prisma.orderMaster.update({
      where: { id: order.id },
      data: {
        orderStatus: OrderStatus.PLACED,
        paymentStatus: "Paid",
        razorpayPaymentId: args.paymentId,
        razorpaySignature: args.signature ?? undefined,
        paymentMethod: "Razorpay",
      },
    }),
    prisma.orderDetail.updateMany({
      where: { orderMasterId: order.id },
      data: { orderStatus: OrderStatus.PLACED },
    }),
    ...order.orderDetails.map((d) =>
      prisma.productVariation.update({
        where: { id: d.variationId },
        data: { stock: { decrement: d.quantity } },
      }),
    ),
    ...(order.customerId
      ? [prisma.cart.deleteMany({ where: { customerId: order.customerId } })]
      : []),
  ]);

  sendOrderConfirmation(order.id).catch((e) =>
    console.error("[order-email] send failed", e),
  );
  // Admin alert: in-app bell notification + sales-inbox email.
  notifyNewOrder(order.id).catch((e) =>
    console.error("[notifyNewOrder] failed", e),
  );
  return { found: true, orderNumber: order.orderNumber };
}
