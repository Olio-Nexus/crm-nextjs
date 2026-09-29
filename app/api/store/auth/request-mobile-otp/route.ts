import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { storeJson, handleOptions } from "@/lib/store";
import { sendMobileOtp } from "@/lib/msg91";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import {
  generateOtp,
  hashCode,
  normalizeMobile,
  mobileOtpKey,
  OTP_TTL_MINUTES,
  OTP_RESEND_SECONDS,
} from "@/lib/customer-auth";

export const OPTIONS = handleOptions;

const schema = z.object({ mobile: z.string().min(8) });

/**
 * POST /api/store/auth/request-mobile-otp   body: { mobile }
 * Sends a 6-digit login code by SMS (MSG91). Mirrors the email flow — we
 * generate + verify the OTP ourselves; MSG91 only delivers the SMS.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    const mobile = parsed.success ? normalizeMobile(parsed.data.mobile) : null;
    if (!mobile) {
      return storeJson({ error: "Please enter a valid 10-digit mobile number." }, 400);
    }
    const key = mobileOtpKey(mobile);

    const tooMany =
      !rateLimit(`otp-ip:${clientIp(req)}`, 10, 10 * 60 * 1000) ||
      !rateLimit(`otp-mobile:${mobile}`, 5, 60 * 60 * 1000);
    if (tooMany) {
      return storeJson(
        { error: "Too many code requests. Please try again in a few minutes." },
        429,
      );
    }

    const recent = await prisma.emailOtp.findFirst({
      where: {
        email: key,
        consumedAt: null,
        createdAt: { gt: new Date(Date.now() - OTP_RESEND_SECONDS * 1000) },
      },
      orderBy: { createdAt: "desc" },
    });
    if (recent) {
      return storeJson(
        { error: `Please wait ${OTP_RESEND_SECONDS}s before requesting another code.` },
        429,
      );
    }

    await prisma.emailOtp.updateMany({
      where: { email: key, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const code = generateOtp();
    await prisma.emailOtp.create({
      data: {
        email: key,
        codeHash: await hashCode(code),
        expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
      },
    });

    const { delivered } = await sendMobileOtp(mobile, code);

    return storeJson({ ok: true, expiresInMinutes: OTP_TTL_MINUTES, delivered });
  } catch (error) {
    console.error("POST /api/store/auth/request-mobile-otp failed", error);
    return storeJson({ error: "Could not send the code. Please try again." }, 500);
  }
}
