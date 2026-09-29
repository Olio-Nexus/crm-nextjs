import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { storeJson, handleOptions } from "@/lib/store";
import {
  compareCode,
  findOrCreateCustomerByMobile,
  generateSessionToken,
  normalizeMobile,
  mobileOtpKey,
  shapeCustomer,
  OTP_MAX_ATTEMPTS,
} from "@/lib/customer-auth";

export const OPTIONS = handleOptions;

const schema = z.object({
  mobile: z.string().min(8),
  code: z.string().regex(/^\d{6}$/, "The code must be 6 digits."),
});

/**
 * POST /api/store/auth/verify-mobile-otp   body: { mobile, code }
 * Verifies the SMS code, creates the customer on first sign-in, and returns a
 * session token (same shape as email verify-otp).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    const mobile = parsed.success ? normalizeMobile(parsed.data.mobile) : null;
    if (!parsed.success || !mobile) {
      return storeJson({ error: "Enter the 6-digit code sent to your mobile." }, 400);
    }
    const key = mobileOtpKey(mobile);

    const otp = await prisma.emailOtp.findFirst({
      where: { email: key, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!otp) {
      return storeJson(
        { error: "That code is invalid or has expired. Please request a new one." },
        400,
      );
    }

    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      await prisma.emailOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
      return storeJson({ error: "Too many attempts. Please request a new code." }, 429);
    }

    const matches = await compareCode(parsed.data.code, otp.codeHash);
    if (!matches) {
      await prisma.emailOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      return storeJson({ error: "The verification code is incorrect. Please try again." }, 400);
    }

    await prisma.emailOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });

    const { customer, isNew } = await findOrCreateCustomerByMobile(mobile);
    const token = generateSessionToken();
    await prisma.customer.update({ where: { id: customer.id }, data: { token } });

    return storeJson({ token, isNew, customer: shapeCustomer(customer) });
  } catch (error) {
    console.error("POST /api/store/auth/verify-mobile-otp failed", error);
    return storeJson({ error: "Could not verify the code. Please try again." }, 500);
  }
}
