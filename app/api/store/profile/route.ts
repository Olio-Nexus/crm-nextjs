import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { storeJson, handleOptions } from "@/lib/store";
import { getCustomerFromRequest } from "@/lib/customer-auth";

export const OPTIONS = handleOptions;

/** Date → "YYYY-MM-DD" (or null). */
function isoDate(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

async function shapeProfile(customerId: number) {
  const c = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!c) return null;
  const address = await prisma.customerAddress.findFirst({
    where: { customerId, isDefault: true },
  });
  return {
    name: c.name,
    email: c.email,
    mobileNumber: c.mobileNumber ?? "",
    company: c.company ?? "",
    gender: c.gender ?? "",
    dob: isoDate(c.dob),
    anniversary: isoDate(c.anniversary),
    photo: c.photo ?? null,
    address: address
      ? {
          streetAddress: address.streetAddress,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
        }
      : null,
  };
}

/** GET /api/store/profile — the signed-in customer's profile. */
export async function GET(req: NextRequest) {
  const customer = await getCustomerFromRequest(req);
  if (!customer) return storeJson({ error: "Not signed in" }, 401);
  return storeJson({ profile: await shapeProfile(customer.id) });
}

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullish();

const schema = z.object({
  name: z.string().min(1).optional(),
  company: z.string().optional(),
  gender: z.string().optional(),
  dob: dateStr,
  anniversary: dateStr,
  address: z
    .object({
      streetAddress: z.string().min(1),
      city: z.string().min(1),
      state: z.string().min(1),
      pincode: z.string().min(1),
    })
    .optional(),
});

/** PATCH /api/store/profile — update customer fields + the default address. */
export async function PATCH(req: NextRequest) {
  try {
    const customer = await getCustomerFromRequest(req);
    if (!customer) return storeJson({ error: "Not signed in" }, 401);

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return storeJson({ error: "Invalid profile." }, 400);
    const d = parsed.data;

    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        ...(d.name != null ? { name: d.name } : {}),
        // Phone (mobileNumber) is set only via the verified link flow, not here.
        ...(d.company != null ? { company: d.company } : {}),
        ...(d.gender != null ? { gender: d.gender } : {}),
        ...(d.dob !== undefined ? { dob: d.dob ? new Date(d.dob) : null } : {}),
        ...(d.anniversary !== undefined
          ? { anniversary: d.anniversary ? new Date(d.anniversary) : null }
          : {}),
      },
    });

    // Keep the default address in sync with the profile address block.
    if (d.address) {
      const existing = await prisma.customerAddress.findFirst({
        where: { customerId: customer.id, isDefault: true },
      });
      const base = {
        name: d.name ?? customer.name,
        phoneNumber: customer.mobileNumber ?? "",
        streetAddress: d.address.streetAddress,
        city: d.address.city,
        state: d.address.state,
        country: "India",
        pincode: d.address.pincode,
      };
      if (existing) {
        await prisma.customerAddress.update({
          where: { id: existing.id },
          data: base,
        });
      } else {
        await prisma.customerAddress.create({
          data: { customerId: customer.id, isDefault: true, ...base },
        });
      }
    }

    return storeJson({ profile: await shapeProfile(customer.id) });
  } catch (error) {
    console.error("PATCH /api/store/profile failed", error);
    return storeJson({ error: "Could not save your profile." }, 500);
  }
}
