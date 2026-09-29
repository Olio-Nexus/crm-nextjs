/* eslint-disable @typescript-eslint/no-explicit-any */

/** Flat GST rate baked into the (GST-inclusive) storefront prices. */
export const GST_RATE = 0.18;

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** GST embedded inside a GST-inclusive amount. */
export function embeddedGst(inclusiveAmount: number): number {
  return round2(inclusiveAmount - inclusiveAmount / (1 + GST_RATE));
}

function parseImages(images: unknown): string[] {
  if (Array.isArray(images)) return images.filter((x): x is string => typeof x === "string");
  if (typeof images === "string") {
    try {
      const p = JSON.parse(images);
      return Array.isArray(p) ? p.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Prisma include to fetch an order shaped for the storefront account pages. */
export const storeOrderInclude = {
  orderDetails: { include: { product: true, variation: true } },
};

/** Map an OrderMaster (+details, +product/variation) to the storefront DTO. */
export function shapeStoreOrder(o: any) {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.orderStatus as string, // PAYMENT_PENDING | PLACED | ...
    paymentStatus: o.paymentStatus ?? null,
    paymentMode: o.paymentMode ?? null,
    date: (o.orderDate instanceof Date ? o.orderDate : new Date(o.orderDate)).toISOString(),
    itemTotal: Number(o.itemTotal),
    discount: o.discount != null ? Number(o.discount) : 0,
    deliveryFee: o.deliveryFee != null ? Number(o.deliveryFee) : 0,
    grandtotal: Number(o.grandtotal),
    items: (o.orderDetails ?? []).map((d: any) => ({
      productId: d.product?.urlSlug ?? String(d.productId),
      name: d.productName,
      image: d.variation?.variationImage || parseImages(d.product?.images)[0] || "",
      sku: d.sku,
      quantity: d.quantity,
      price: Number(d.priceWithGst), // unit price (GST-inclusive)
      lineTotal: Number(d.total),
      personalization:
        d.attributes && typeof d.attributes === "object"
          ? (d.attributes as any).personalization ?? null
          : null,
      // Per-line ship-to for multi-address orders (null on single-address).
      delivery: d.deliveryName
        ? {
            name: d.deliveryName,
            phone: d.deliveryPhone,
            line: [
              d.deliveryStreet,
              d.deliveryLandmarks,
              d.deliveryCity,
              d.deliveryState,
              d.deliveryPincode,
            ]
              .filter(Boolean)
              .join(", "),
          }
        : null,
    })),
    address: {
      name: o.custName,
      phone: o.custNumber,
      line: [o.streetAddress, o.landmarks, o.city, o.state, o.pincode]
        .filter(Boolean)
        .join(", "),
      city: o.city,
      state: o.state,
      pincode: o.pincode,
    },
  };
}
