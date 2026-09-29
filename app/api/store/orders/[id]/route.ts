import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { storeJson, handleOptions } from "@/lib/store";
import { getCustomerFromRequest } from "@/lib/customer-auth";
import { shapeStoreOrder, storeOrderInclude } from "@/lib/store-order";

export const OPTIONS = handleOptions;

/** GET /api/store/orders/[id] — one of the signed-in customer's orders. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const customer = await getCustomerFromRequest(req);
  if (!customer) return storeJson({ error: "Please sign in." }, 401);

  const { id } = await params;
  const orderId = Number(id);
  if (!orderId) return storeJson({ error: "Invalid order." }, 400);

  const order = await prisma.orderMaster.findFirst({
    where: { id: orderId, customerId: customer.id },
    include: storeOrderInclude,
  });
  if (!order) return storeJson({ error: "Order not found." }, 404);

  return storeJson({ order: shapeStoreOrder(order) });
}
