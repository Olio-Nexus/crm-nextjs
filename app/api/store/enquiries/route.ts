import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { storeJson, handleOptions } from "@/lib/store";
import { notifyNewLead } from "@/lib/notifications";

export const OPTIONS = handleOptions;

/** Human labels for the notification email subject. */
const KIND_LABEL: Record<string, string> = {
  contact: "Contact enquiry",
  newsletter: "Newsletter signup",
  quote: "Request a Quote",
  vendor: "Vendor enquiry",
  brochure: "Brochure download",
};

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

    // Notify the sales/ops inbox (never blocks the submission if mail fails).
    await notifyNewLead({
      kind: KIND_LABEL[d.type] ?? "Website enquiry",
      name: d.name,
      email: d.email,
      phone: d.phone,
      message: d.message,
      fields: d.payload ?? null,
    });

    return storeJson({ ok: true });
  } catch (error) {
    console.error("POST /api/store/enquiries failed", error);
    return storeJson({ error: "Could not submit. Please try again." }, 500);
  }
}
