import { NextRequest } from "next/server";
import { storeJson, handleOptions } from "@/lib/store";
import { resolvePromo, type PromoContext } from "@/lib/promo";
import { getCustomerFromRequest } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";

export const OPTIONS = handleOptions;

/**
 * POST /api/store/promocodes/validate   body: { code, subtotal }
 * Validates a coupon and returns the discount for the given cart subtotal.
 * Uses the same resolver as order creation, so the preview never diverges from
 * what's actually charged. When the customer is signed in we pass their cart +
 * id so product/category scope and first-order rules are enforced in the preview.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // Cart/customer context for scope + first-order enforcement (best-effort).
    let ctx: PromoContext | undefined;
    const customer = await getCustomerFromRequest(req);
    if (customer) {
      const cart = await prisma.cart.findMany({
        where: { customerId: customer.id },
        select: { productId: true, product: { select: { subcategoryId: true } } },
      });
      ctx = {
        customerId: customer.id,
        productIds: cart.map((c) => c.productId),
        subcategoryIds: [...new Set(cart.map((c) => c.product?.subcategoryId).filter(Boolean) as number[])],
      };
    }

    const { valid, discount, code, message } = await resolvePromo(
      String(body?.code ?? ""),
      Number(body?.subtotal ?? 0),
      ctx,
    );
    return storeJson({ valid, discount, code, message });
  } catch (error) {
    console.error("POST /api/store/promocodes/validate failed", error);
    return storeJson(
      { valid: false, discount: 0, message: "Could not apply the coupon. Please try again." },
      500,
    );
  }
}
