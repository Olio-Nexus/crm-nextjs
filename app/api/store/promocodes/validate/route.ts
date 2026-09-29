import { NextRequest } from "next/server";
import { storeJson, handleOptions } from "@/lib/store";
import { resolvePromo } from "@/lib/promo";

export const OPTIONS = handleOptions;

/**
 * POST /api/store/promocodes/validate   body: { code, subtotal }
 * Validates a coupon and returns the discount for the given cart subtotal.
 * Uses the same resolver as order creation, so the preview never diverges from
 * what's actually charged. (Usage-limit / product-scoping enforced at checkout.)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { valid, discount, code, message } = await resolvePromo(
      String(body?.code ?? ""),
      Number(body?.subtotal ?? 0),
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
