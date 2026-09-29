import { prisma } from "@/lib/prisma";
import type { Promocode } from "@prisma/client";

export interface PromoResult {
  valid: boolean;
  discount: number;
  code?: string;
  message: string;
  /** The matched promo (only when valid) — for persisting on the order. */
  promo?: Promocode;
  /** True when the cap limited a percentage discount. */
  capApplied?: boolean;
}

/**
 * Resolve a coupon against a cart subtotal. Single source of truth used by both
 * the storefront preview (`/promocodes/validate`) and order creation, so the
 * amount charged always matches what the customer was shown.
 *
 * discountType: 1 = percentage (capped by maximumCap when > 0), 2 = fixed.
 */
export async function resolvePromo(
  code: string,
  subtotal: number,
): Promise<PromoResult> {
  const trimmed = String(code ?? "").trim();
  if (!trimmed) {
    return { valid: false, discount: 0, message: "Enter a coupon code." };
  }

  const promo = await prisma.promocode.findFirst({
    where: { promocode: { equals: trimmed, mode: "insensitive" }, status: true },
  });
  if (!promo) {
    return { valid: false, discount: 0, message: "This coupon code isn't valid." };
  }

  const now = new Date();
  const start = new Date(promo.startDate);
  const end = new Date(promo.expiryDate);
  end.setHours(23, 59, 59, 999); // include the whole expiry day
  if (now < start) {
    return { valid: false, discount: 0, message: "This coupon isn't active yet." };
  }
  if (now > end) {
    return { valid: false, discount: 0, message: "This coupon has expired." };
  }

  if (promo.minimumOrderValue && subtotal < promo.minimumOrderValue) {
    return {
      valid: false,
      discount: 0,
      message: `Add ₹${Math.ceil(promo.minimumOrderValue - subtotal)} more to use this coupon (minimum order ₹${promo.minimumOrderValue.toFixed(0)}).`,
    };
  }

  let discount = 0;
  let capApplied = false;
  if (promo.discountType === 1) {
    discount = (subtotal * promo.discount) / 100;
    if (promo.maximumCap && promo.maximumCap > 0 && discount > promo.maximumCap) {
      discount = promo.maximumCap;
      capApplied = true;
    }
  } else {
    discount = promo.discount;
  }
  discount = Math.min(Math.round(discount * 100) / 100, subtotal);

  return {
    valid: true,
    discount,
    code: promo.promocode,
    message: `Coupon applied — you saved ₹${discount.toFixed(0)}.`,
    promo,
    capApplied,
  };
}
