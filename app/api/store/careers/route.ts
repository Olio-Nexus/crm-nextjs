import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { storeJson, handleOptions } from "@/lib/store";
import { notifyNewLead } from "@/lib/notifications";

export const OPTIONS = handleOptions;

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(6),
  role: z.string().optional(),
  resumeUrl: z.string().url().optional(),
  message: z.string().optional(),
});

/**
 * POST /api/store/careers — a job application from the storefront Careers page.
 * Public (no auth); the resume is uploaded separately to R2 and its URL passed
 * here. Stored in career_applications, viewable in the CRM Careers tab.
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return storeJson({ error: "Please fill in the required fields." }, 400);
    }
    const d = parsed.data;

    await prisma.careerApplication.create({
      data: {
        name: d.name,
        email: d.email,
        phone: d.phone,
        role: d.role,
        resumeUrl: d.resumeUrl,
        message: d.message,
      },
    });

    // Notify the sales/ops inbox (never blocks the submission if mail fails).
    await notifyNewLead({
      kind: "Career application",
      name: d.name,
      email: d.email,
      phone: d.phone,
      message: d.message,
      fields: {
        ...(d.role ? { Role: d.role } : {}),
        ...(d.resumeUrl ? { Resume: d.resumeUrl } : {}),
      },
    });

    return storeJson({ ok: true });
  } catch (error) {
    console.error("POST /api/store/careers failed", error);
    return storeJson({ error: "Could not submit your application. Please try again." }, 500);
  }
}
