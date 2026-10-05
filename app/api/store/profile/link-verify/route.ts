import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { storeJson, handleOptions } from "@/lib/store";
import {
  getCustomerFromRequest,
  compareCode,
  shapeCustomer,
  normalizeEmail,
  normalizeMobile,
  mobileOtpKey,
  OTP_MAX_ATTEMPTS,
} from "@/lib/customer-auth";

export const OPTIONS = handleOptions;

/**
 * POST /api/store/profile/link-verify   body: { type, value, code }
 * Verifies the OTP sent to the new identifier and attaches it to the signed-in
 * customer's account (email or mobileNumber). Existing records are not merged —
 * an identifier already used by another account is rejected.
 */
export async function POST(req: NextRequest) {
  try {
    const customer = await getCustomerFromRequest(req);
    if (!customer) return storeJson({ error: "Please sign in." }, 401);

    const body = await req.json().catch(() => ({}));
    const type = body?.type === "mobile" ? "mobile" : body?.type === "email" ? "email" : null;
    const code = String(body?.code ?? "");
    if (!type || !/^\d{6}$/.test(code)) {
      return storeJson({ error: "Enter the 6-digit code." }, 400);
    }

    const value =
      type === "email" ? normalizeEmail(String(body?.value ?? "")) : normalizeMobile(String(body?.value ?? ""));
    if (!value) return storeJson({ error: "Invalid value." }, 400);
    const key = type === "email" ? value : mobileOtpKey(value);

    const otp = await prisma.emailOtp.findFirst({
      where: { email: key, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!otp) {
      return storeJson({ error: "That code is invalid or has expired. Please request a new one." }, 400);
    }
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      await prisma.emailOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
      return storeJson({ error: "Too many attempts. Please request a new code." }, 429);
    }
    const matches = await compareCode(code, otp.codeHash);
    if (!matches) {
      await prisma.emailOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      return storeJson({ error: "The verification code is incorrect. Please try again." }, 400);
    }
    await prisma.emailOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });

    // Re-check for a collision (race safety) before attaching.
    const taken = await prisma.customer.findFirst({
      where:
        type === "email"
          ? { email: value, NOT: { id: customer.id } }
          : { mobileNumber: value, NOT: { id: customer.id } },
      select: { id: true },
    });
    if (taken) {
      return storeJson(
        { error: `This ${type === "email" ? "email" : "mobile number"} is already linked to another account.` },
        409,
      );
    }

    const updated = await prisma.customer.update({
      where: { id: customer.id },
      data: type === "email" ? { email: value } : { mobileNumber: value },
    });

    return storeJson({ ok: true, customer: shapeCustomer(updated) });
  } catch (error) {
    console.error("POST /api/store/profile/link-verify failed", error);
    return storeJson({ error: "Could not verify the code. Please try again." }, 500);
  }
}
