import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Razorpay integration (server-side only — the Key Secret must never reach the
 * browser). We talk to Razorpay's REST API with fetch + verify signatures with
 * Node crypto, so there's no SDK dependency.
 *
 * Credentials come from env first (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET /
 * RAZORPAY_WEBHOOK_SECRET); if unset, we fall back to the RAZORPAY
 * PaymentProvider row's `config` JSON (managed in CRM → Settings → Payments).
 */
export interface RazorpayCreds {
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
}

/** Read Razorpay credentials (env wins; DB PaymentProvider config as fallback). */
export async function getRazorpayCreds(): Promise<RazorpayCreds | null> {
  const envId = process.env.RAZORPAY_KEY_ID?.trim();
  const envSecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  const envWebhook = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (envId && envSecret) {
    return { keyId: envId, keySecret: envSecret, webhookSecret: envWebhook };
  }

  // Fallback: the RAZORPAY PaymentProvider's config JSON.
  try {
    const provider = await prisma.paymentProvider.findFirst({
      where: { name: { equals: "RAZORPAY", mode: "insensitive" } },
    });
    const cfg = (provider?.config ?? {}) as Record<string, unknown>;
    const keyId = String(cfg.keyId ?? cfg.key_id ?? "").trim();
    const keySecret = String(cfg.keySecret ?? cfg.key_secret ?? "").trim();
    const webhookSecret = String(
      cfg.webhookSecret ?? cfg.webhook_secret ?? "",
    ).trim();
    if (keyId && keySecret) {
      return { keyId, keySecret, webhookSecret: webhookSecret || undefined };
    }
  } catch (e) {
    console.error("[razorpay] reading PaymentProvider config failed", e);
  }
  return null;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  receipt?: string;
}

/**
 * Create a Razorpay order. `amountPaise` is the charge in the smallest currency
 * unit (paise for INR). Throws on any non-2xx so the caller returns a 5xx.
 */
export async function createRazorpayOrder(
  creds: RazorpayCreds,
  args: { amountPaise: number; receipt: string; notes?: Record<string, string> },
): Promise<RazorpayOrder> {
  const auth = Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString(
    "base64",
  );
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: args.amountPaise,
      currency: "INR",
      receipt: args.receipt,
      notes: args.notes,
      payment_capture: 1, // auto-capture on success
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data as { error?: { description?: string } })?.error?.description ??
      `Razorpay order create failed (${res.status})`;
    throw new Error(msg);
  }
  return data as RazorpayOrder;
}

/**
 * Verify the checkout callback signature: HMAC-SHA256(order_id|payment_id) with
 * the Key Secret must equal the razorpay_signature. Timing-safe compare.
 */
export function verifyPaymentSignature(
  keySecret: string,
  args: { orderId: string; paymentId: string; signature: string },
): boolean {
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${args.orderId}|${args.paymentId}`)
    .digest("hex");
  return safeEqual(expected, args.signature);
}

/**
 * Verify a Razorpay webhook: HMAC-SHA256(rawBody) with the Webhook Secret must
 * equal the X-Razorpay-Signature header. `rawBody` must be the exact bytes.
 */
export function verifyWebhookSignature(
  webhookSecret: string,
  rawBody: string,
  signature: string,
): boolean {
  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");
  return safeEqual(expected, signature);
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
