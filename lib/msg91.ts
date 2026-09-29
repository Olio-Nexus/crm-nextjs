import { OTP_TTL_MINUTES } from "@/lib/customer-auth";

/**
 * SMS delivery via MSG91 (India, DLT-registered). We generate and verify the
 * OTP ourselves (see the mobile request/verify routes) — MSG91 only delivers the
 * SMS via the DLT-approved OTP template. Config from env:
 *   MSG91_AUTH_KEY     — MSG91 auth key (secret)
 *   MSG91_TEMPLATE_ID  — the DLT-approved OTP template's MSG91 id
 *   MSG91_SENDER_ID    — the DLT header/sender (e.g. PLTARA) [optional; bound to template]
 */
const AUTH_KEY = process.env.MSG91_AUTH_KEY;
const TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID;
const SENDER_ID = process.env.MSG91_SENDER_ID;

export const msg91Configured = Boolean(AUTH_KEY && TEMPLATE_ID);

/**
 * Send a 6-digit OTP to a 10-digit Indian mobile via MSG91's OTP API (our own
 * `otp` value fills the template's OTP variable). Best-effort: never throws;
 * returns { delivered:false } and logs when not configured or on failure, so the
 * OTP is still recoverable from the server logs during setup.
 */
export async function sendMobileOtp(
  mobile10: string,
  code: string,
): Promise<{ delivered: boolean }> {
  if (!msg91Configured) {
    console.warn(`[msg91] not configured — OTP for ${mobile10} not sent (code: ${code}).`);
    return { delivered: false };
  }

  const url = new URL("https://control.msg91.com/api/v5/otp");
  url.searchParams.set("template_id", TEMPLATE_ID!);
  url.searchParams.set("mobile", `91${mobile10}`);
  url.searchParams.set("otp", code);
  url.searchParams.set("otp_expiry", String(OTP_TTL_MINUTES));
  if (SENDER_ID) url.searchParams.set("sender", SENDER_ID);

  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { authkey: AUTH_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = (await res.json().catch(() => null)) as { type?: string; message?: string } | null;
    if (!res.ok || data?.type === "error") {
      console.warn(`[msg91] send failed for ${mobile10}: ${res.status} ${JSON.stringify(data)}`);
      return { delivered: false };
    }
    return { delivered: true };
  } catch (e) {
    console.warn(`[msg91] send error for ${mobile10}: ${String(e)}`);
    return { delivered: false };
  }
}
