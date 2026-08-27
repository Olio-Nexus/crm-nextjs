import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";

/** Replace {{var}} placeholders with values (missing → empty string). */
export function renderTemplate(
  text: string,
  vars: Record<string, string>,
): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

const LEAD_DAYS = Number(process.env.OCCASION_REMINDER_LEAD_DAYS ?? 7);

function shopUrl(): string {
  const o = process.env.STORE_ORIGIN;
  return o && o !== "*" ? o : "https://plattera.in";
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

// Notification recipients per form, as specified by the client. A form can
// notify several people (the whole set is emailed together).
const CONTACT = "contact@plattera.in";
const APURVA = "apurva.deshpande@plattera.in";
const ASHWIN = "ashwin.singh@plattera.in";
const TEAM = "team@plattera.in";

/** Which addresses each website form ("channel") notifies. */
const LEAD_RECIPIENTS: Record<string, string[]> = {
  quote: [APURVA, ASHWIN, CONTACT], // Request a Quote / sales enquiry
  vendor: [TEAM, CONTACT], // Vendor form
  career: [APURVA], // Careers form
  contact: [CONTACT], // general contact form
  brochure: [CONTACT], // catalogue/brochure download
  newsletter: [CONTACT], // newsletter signup
};
const DEFAULT_RECIPIENTS = [CONTACT];

/**
 * Resolve the recipients for a form. LEADS_NOTIFY_TO (comma-separated) overrides
 * everything — handy for routing all mail to one inbox while testing/staging.
 */
export function leadRecipients(channel: string): string[] {
  const override = process.env.LEADS_NOTIFY_TO;
  if (override) {
    return override.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return LEAD_RECIPIENTS[channel] ?? DEFAULT_RECIPIENTS;
}

/** Render one payload value for the notification email (arrays/objects too). */
function fmtLeadValue(v: unknown): string {
  if (Array.isArray(v)) return v.map(fmtLeadValue).join(", ");
  if (v && typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => `${k}: ${fmtLeadValue(val)}`)
      .join(" · ");
  }
  return String(v);
}

/**
 * Email the sales/ops inbox when a storefront form is submitted. Fire-and-forget:
 * it never throws, so an email hiccup can't fail the visitor's submission.
 * Include `fields` for anything beyond the common ones (e.g. requested products,
 * job role, resume link) — they're listed in the body verbatim.
 */
export async function notifyNewLead(input: {
  /** Routing key: "quote" | "vendor" | "career" | "contact" | "brochure"… */
  channel: string;
  /** Human label for the form, e.g. "Request a Quote", "Vendor enquiry". */
  kind: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  message?: string | null;
  fields?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    const rows: [string, string][] = [];
    if (input.name) rows.push(["Name", input.name]);
    if (input.email) rows.push(["Email", input.email]);
    if (input.phone) rows.push(["Phone", input.phone]);
    if (input.message) rows.push(["Message", input.message]);
    for (const [k, v] of Object.entries(input.fields ?? {})) {
      if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
      rows.push([k, fmtLeadValue(v)]);
    }

    const subject = `New ${input.kind} — Plattera website`;
    const text =
      `A new ${input.kind} was submitted on the Plattera website.\n\n` +
      rows.map(([k, v]) => `${k}: ${v}`).join("\n") +
      `\n\nView the full lead in the CRM → Leads.\n\n— Plattera website`;
    const html =
      `<div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.6">` +
      `<h2 style="margin:0 0 12px">New ${input.kind}</h2>` +
      `<p style="margin:0 0 16px;color:#4b5563">Submitted on the Plattera website.</p>` +
      `<table style="border-collapse:collapse;font-size:14px">` +
      rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;vertical-align:top;white-space:nowrap"><strong>${k}</strong></td>` +
            `<td style="padding:4px 0;color:#111827">${String(v).replace(/</g, "&lt;")}</td></tr>`,
        )
        .join("") +
      `</table>` +
      `<p style="margin:20px 0 0;color:#6b7280;font-size:13px">View the full lead in the CRM → Leads.</p>` +
      `</div>`;

    await sendMail({ to: leadRecipients(input.channel), subject, text, html });
  } catch (e) {
    // Never let a notification failure break the submission.
    console.warn(`[notifyNewLead] failed: ${String(e)}`);
  }
}

/**
 * Send birthday/anniversary reminders for occasions LEAD_DAYS away.
 * Renders the OCCASION_REMINDER template, emails each customer, records a
 * notification_logs row, and dedups so a re-run the same day never
 * double-sends. Emails only actually go out once SMTP is configured; until
 * then sendMail logs and we record status "logged".
 */
export async function sendOccasionReminders() {
  const template = await prisma.notificationTemplate.findUnique({
    where: { event: "OCCASION_REMINDER" },
  });
  if (!template || template.isActive === false) {
    return {
      ok: false,
      reason: "OCCASION_REMINDER template missing or inactive",
    };
  }

  const target = new Date();
  target.setUTCDate(target.getUTCDate() + LEAD_DAYS);
  const month = target.getUTCMonth() + 1;
  const day = target.getUTCDate();

  const rows = await prisma.$queryRaw<
    Array<{
      id: number;
      name: string;
      email: string;
      dob: Date | null;
      anniversary: Date | null;
    }>
  >`
    SELECT id, name, email, dob, anniversary FROM customers
    WHERE status = true AND email IS NOT NULL AND (
      (dob IS NOT NULL AND EXTRACT(MONTH FROM dob) = ${month} AND EXTRACT(DAY FROM dob) = ${day})
      OR (anniversary IS NOT NULL AND EXTRACT(MONTH FROM anniversary) = ${month} AND EXTRACT(DAY FROM anniversary) = ${day})
    )`;

  const occasions: Array<{ email: string; name: string; type: string }> = [];
  for (const c of rows) {
    if (c.dob && c.dob.getUTCMonth() + 1 === month && c.dob.getUTCDate() === day)
      occasions.push({ email: c.email, name: c.name, type: "Birthday" });
    if (
      c.anniversary &&
      c.anniversary.getUTCMonth() + 1 === month &&
      c.anniversary.getUTCDate() === day
    )
      occasions.push({ email: c.email, name: c.name, type: "Anniversary" });
  }

  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const o of occasions) {
    const already = await prisma.notificationLog.findFirst({
      where: {
        event: "OCCASION_REMINDER",
        recipient: o.email,
        createdAt: { gte: startOfToday },
      },
    });
    if (already) {
      skipped++;
      continue;
    }

    const vars = {
      customerName: o.name,
      occasionType: o.type,
      daysUntil: String(LEAD_DAYS),
      occasionDate: fmtDate(target),
      shopUrl: shopUrl(),
    };
    const subject = renderTemplate(template.subject, vars);
    const text = renderTemplate(template.emailBody, vars);

    try {
      const { delivered } = await sendMail({ to: o.email, subject, text });
      await prisma.notificationLog.create({
        data: {
          event: "OCCASION_REMINDER",
          recipient: o.email,
          channel: "email",
          status: delivered ? "sent" : "logged",
        },
      });
      sent++;
    } catch (e) {
      await prisma.notificationLog.create({
        data: {
          event: "OCCASION_REMINDER",
          recipient: o.email,
          channel: "email",
          status: "failed",
          error: String(e).slice(0, 250),
        },
      });
      failed++;
    }
  }

  return {
    ok: true,
    occasionDate: fmtDate(target),
    leadDays: LEAD_DAYS,
    matched: occasions.length,
    sent,
    skipped,
    failed,
  };
}

const CART_ABANDON_HOURS = Number(process.env.CART_ABANDONMENT_HOURS ?? 4);
const CART_COOLDOWN_DAYS = Number(process.env.CART_ABANDONMENT_COOLDOWN_DAYS ?? 7);
const CART_MAX_AGE_DAYS = 14; // don't chase carts idle longer than this

/**
 * Email customers whose cart has been idle for CART_ABANDON_HOURS (but not
 * older than CART_MAX_AGE_DAYS). Dedups per customer within a cooldown window
 * so they aren't nagged repeatedly. Only signed-in customers (guests have no
 * email). Delivery is live once SMTP is configured; until then status "logged".
 */
export async function sendCartAbandonmentReminders() {
  const template = await prisma.notificationTemplate.findUnique({
    where: { event: "CART_ABANDONMENT" },
  });
  if (!template || template.isActive === false) {
    return {
      ok: false,
      reason: "CART_ABANDONMENT template missing or inactive",
    };
  }

  const now = Date.now();
  const idleBefore = new Date(now - CART_ABANDON_HOURS * 3_600_000);
  const notOlderThan = new Date(now - CART_MAX_AGE_DAYS * 86_400_000);

  const rows = await prisma.$queryRaw<
    Array<{ id: number; name: string; email: string; item_count: number }>
  >`
    SELECT c.id, c.name, c.email, COUNT(*)::int AS item_count
    FROM carts ct JOIN customers c ON c.id = ct."customerId"
    WHERE ct."customerId" IS NOT NULL AND c.email IS NOT NULL AND c.status = true
    GROUP BY c.id, c.name, c.email
    HAVING MAX(ct."updatedAt") < ${idleBefore} AND MAX(ct."updatedAt") > ${notOlderThan}
  `;

  const cooldownStart = new Date(now - CART_COOLDOWN_DAYS * 86_400_000);
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const r of rows) {
    const already = await prisma.notificationLog.findFirst({
      where: {
        event: "CART_ABANDONMENT",
        recipient: r.email,
        createdAt: { gte: cooldownStart },
      },
    });
    if (already) {
      skipped++;
      continue;
    }

    const vars = {
      customerName: r.name,
      itemCount: String(r.item_count),
      shopUrl: shopUrl(),
    };
    const subject = renderTemplate(template.subject, vars);
    const text = renderTemplate(template.emailBody, vars);

    try {
      const { delivered } = await sendMail({ to: r.email, subject, text });
      await prisma.notificationLog.create({
        data: {
          event: "CART_ABANDONMENT",
          recipient: r.email,
          channel: "email",
          status: delivered ? "sent" : "logged",
        },
      });
      sent++;
    } catch (e) {
      await prisma.notificationLog.create({
        data: {
          event: "CART_ABANDONMENT",
          recipient: r.email,
          channel: "email",
          status: "failed",
          error: String(e).slice(0, 250),
        },
      });
      failed++;
    }
  }

  return {
    ok: true,
    idleHours: CART_ABANDON_HOURS,
    matched: rows.length,
    sent,
    skipped,
    failed,
  };
}
