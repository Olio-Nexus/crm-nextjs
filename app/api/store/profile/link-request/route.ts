import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { storeJson, handleOptions } from "@/lib/store";
import {
  getCustomerFromRequest,
  generateOtp,
  hashCode,
  normalizeEmail,
  normalizeMobile,
  mobileOtpKey,
  OTP_TTL_MINUTES,
  OTP_RESEND_SECONDS,
} from "@/lib/customer-auth";
import { sendMail, otpEmail } from "@/lib/mailer";
import { sendMobileOtp } from "@/lib/msg91";

export const OPTIONS = handleOptions;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * POST /api/store/profile/link-request   body: { type: "email"|"mobile", value }
 * Sends an OTP to the identifier the signed-in customer wants to add to their
 * account, so ownership can be verified before it's linked. Rejects an
 * identifier already in use by another account (we never merge accounts here).
 */
export async function POST(req: NextRequest) {
  try {
    const customer = await getCustomerFromRequest(req);
    if (!customer) return storeJson({ error: "Please sign in." }, 401);

    const body = await req.json().catch(() => ({}));
    const type = body?.type === "mobile" ? "mobile" : body?.type === "email" ? "email" : null;
    if (!type) return storeJson({ error: "Invalid request." }, 400);

    // Resolve + validate the new identifier, its OTP-store key, and the sender.
    let key: string;
    let send: () => Promise<{ delivered: boolean }>;

    if (type === "email") {
      const email = normalizeEmail(String(body?.value ?? ""));
      if (!EMAIL_RE.test(email)) return storeJson({ error: "Enter a valid email address." }, 400);
      if (customer.email === email) return storeJson({ error: "That's already your email." }, 400);
      const taken = await prisma.customer.findFirst({
        where: { email, NOT: { id: customer.id } },
        select: { id: true },
      });
      if (taken) return storeJson({ error: "This email is already linked to another account." }, 409);
      key = email;
      const code = genAndStore;
      send = async () => {
        const c = await code(key);
        return sendMail({ to: email, ...otpEmail(c) });
      };
    } else {
      const mobile = normalizeMobile(String(body?.value ?? ""));
      if (!mobile) return storeJson({ error: "Enter a valid 10-digit mobile number." }, 400);
      if (customer.mobileNumber === mobile) return storeJson({ error: "That's already your mobile number." }, 400);
      const taken = await prisma.customer.findFirst({
        where: { mobileNumber: mobile, NOT: { id: customer.id } },
        select: { id: true },
      });
      if (taken) return storeJson({ error: "This mobile number is already linked to another account." }, 409);
      key = mobileOtpKey(mobile);
      const code = genAndStore;
      send = async () => {
        const c = await code(key);
        return sendMobileOtp(mobile, c);
      };
    }

    // Resend cooldown.
    const recent = await prisma.emailOtp.findFirst({
      where: { email: key, consumedAt: null, createdAt: { gt: new Date(Date.now() - OTP_RESEND_SECONDS * 1000) } },
      orderBy: { createdAt: "desc" },
    });
    if (recent) {
      return storeJson({ error: `Please wait ${OTP_RESEND_SECONDS}s before requesting another code.` }, 429);
    }

    const { delivered } = await send();
    return storeJson({ ok: true, delivered });
  } catch (error) {
    console.error("POST /api/store/profile/link-request failed", error);
    return storeJson({ error: "Could not send the code. Please try again." }, 500);
  }
}

/** Invalidate outstanding codes for this key, issue a fresh one, return the code. */
async function genAndStore(key: string): Promise<string> {
  await prisma.emailOtp.updateMany({ where: { email: key, consumedAt: null }, data: { consumedAt: new Date() } });
  const code = generateOtp();
  await prisma.emailOtp.create({
    data: { email: key, codeHash: await hashCode(code), expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000) },
  });
  return code;
}
