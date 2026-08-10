import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { storeJson, handleOptions } from "@/lib/store";

export const OPTIONS = handleOptions;

const schema = z.object({
  type: z.enum(["contact", "newsletter", "quote", "vendor", "brochure"]),
  name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  message: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

/**
 * POST /api/store/enquiries — capture a storefront form submission
 * (contact / newsletter / quote / vendor). Public; no auth.
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return storeJson({ error: "Invalid submission." }, 400);
    }
    const d = parsed.data;

    await prisma.storeEnquiry.create({
      data: {
        type: d.type,
        name: d.name,
        email: d.email,
        phone: d.phone,
        message: d.message,
        payload: d.payload ? (d.payload as object) : undefined,
      },
    });

    return storeJson({ ok: true });
  } catch (error) {
    console.error("POST /api/store/enquiries failed", error);
    return storeJson({ error: "Could not submit. Please try again." }, 500);
  }
}
