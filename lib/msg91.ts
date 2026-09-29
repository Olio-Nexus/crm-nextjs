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
// The OTP variable name in the DLT/MSG91 template. Ours is `{#num#}` → "num".
const OTP_VAR = process.env.MSG91_OTP_VAR || "num";

export const msg91Configured = Boolean(AUTH_KEY && TEMPLATE_ID);

/**
 * Send a 6-digit OTP to a 10-digit Indian mobile via MSG91's Flow API, filling
 * the DLT-approved template's variable (`num`) with our code — so the delivered
 * content exactly matches the approved template (the OTP API produced a content
 * mismatch → DLT error 400). Best-effort: never throws; returns
 * { delivered:false } and logs when not configured or on failure, so the OTP is
 * still recoverable from the server logs during setup.
 */
export async function sendMobileOtp(
  mobile10: string,
  code: string,
): Promise<{ delivered: boolean }> {
  if (!msg91Configured) {
    console.warn(`[msg91] not configured — OTP for ${mobile10} not sent (code: ${code}).`);
    return { delivered: false };
  }

  try {
    const res = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: {
        authkey: AUTH_KEY!,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        template_id: TEMPLATE_ID,
        ...(SENDER_ID ? { sender: SENDER_ID } : {}),
        short_url: "0",
        recipients: [{ mobiles: `91${mobile10}`, [OTP_VAR]: code }],
      }),
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
