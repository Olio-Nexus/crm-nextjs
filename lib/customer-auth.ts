import crypto from "crypto";
import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Storefront customer auth (email + OTP).
 *
 * Sessions are opaque random tokens stored on `Customer.token` and sent back as
 * `Authorization: Bearer <token>`. This reuses a field the schema already has,
 * keeps sessions revocable (clear the column), and avoids a JWT dependency.
 *
 * Note this is entirely separate from the admin NextAuth login in lib/auth.ts —
 * customers are the `Customer` table, admins are the `User` table.
 */
export const OTP_TTL_MINUTES = 10;
export const OTP_RESEND_SECONDS = 30;
export const OTP_MAX_ATTEMPTS = 5;

/** Cryptographically random 6-digit code. */
export function generateOtp(): string {
  return String(crypto.randomInt(100_000, 1_000_000));
}

export function hashCode(code: string) {
  return bcrypt.hash(code, 10);
}

export function compareCode(code: string, hash: string) {
  return bcrypt.compare(code, hash);
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** "jane.doe23@gmail.com" → "Jane" */
export function nameFromEmail(email: string): string {
  const local = email.split("@")[0].replace(/[._-].*$/, "").replace(/\d+/g, "");
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : "There";
}

/** Resolve the signed-in customer from the Authorization header. */
export async function getCustomerFromRequest(req: NextRequest) {
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) return null;
  return prisma.customer.findFirst({ where: { token } });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function shapeCustomer(c: any) {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    mobileNumber: c.mobileNumber ?? null,
    photo: c.photo ?? null,
  };
}

/**
 * Find the customer for a verified email, or create one. OTP sign-in has no
 * password, but the column is required — so we store an unusable random hash.
 */
export async function findOrCreateCustomer(email: string) {
  const existing = await prisma.customer.findUnique({ where: { email } });
  if (existing) return { customer: existing, isNew: false };

  const customer = await prisma.customer.create({
    data: {
      name: nameFromEmail(email),
      email,
      // No password login for storefront customers — store an unusable hash.
      password: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10),
      uniqueId: crypto.randomUUID(),
      status: true,
    },
  });
  return { customer, isNew: true };
}

/** Normalize an Indian mobile to 10 digits (strips +91 / 91 / spaces). Null if invalid. */
export function normalizeMobile(input: string): string | null {
  const digits = String(input ?? "").replace(/\D/g, "");
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  return /^[6-9]\d{9}$/.test(ten) ? ten : null;
}

/** OTP-store key for a mobile number — reuses the emailOtp table (no "@", so it
 *  never collides with a real email). */
export function mobileOtpKey(mobile10: string): string {
  return `mobile:${mobile10}`;
}

/** Find the customer for a verified mobile, or create one. Mobile-only signups
 *  get a placeholder unique email (the email column is required + unique). */
export async function findOrCreateCustomerByMobile(mobile10: string) {
  const existing = await prisma.customer.findUnique({ where: { mobileNumber: mobile10 } });
  if (existing) return { customer: existing, isNew: false };

  const customer = await prisma.customer.create({
    data: {
      name: `Customer ${mobile10.slice(-4)}`,
      mobileNumber: mobile10,
      email: `m${mobile10}@mobile.plattera.in`,
      password: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10),
      uniqueId: crypto.randomUUID(),
      status: true,
    },
  });
  return { customer, isNew: true };
}
