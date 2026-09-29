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

/** Internal payload keys we don't show in the notification email. */
const HIDDEN_LEAD_FIELDS = new Set(["productSlug", "source", "productImage"]);

/** Friendly labels for payload keys (falls back to a title-cased key). */
const LEAD_KEY_LABELS: Record<string, string> = {
  product: "Product",
  company: "Company",
  occasion: "Occasion",
  quantity: "Quantity",
  budget: "Budget",
  deliveryDate: "Delivery date",
  customization: "Customization",
  role: "Role",
  resumeUrl: "Resume",
  catalogue: "Catalogue",
  category: "Category",
  website: "Website",
};
function humanizeLeadKey(k: string): string {
  if (LEAD_KEY_LABELS[k]) return LEAD_KEY_LABELS[k];
  const s = k.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
  return s.charAt(0).toUpperCase() + s.slice(1);
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
      if (HIDDEN_LEAD_FIELDS.has(k)) continue;
      if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
      rows.push([humanizeLeadKey(k), fmtLeadValue(v)]);
    }

    const subject = `New ${input.kind} — Plattera website`;
    const text =
      `A new ${input.kind} was submitted on the Plattera website.\n\n` +
      rows.map(([k, v]) => `${k}: ${v}`).join("\n") +
      `\n\nView the full lead in the CRM → Leads.\n\n— Plattera website`;

    // Brand-themed HTML (Plattera green #295A4F on a warm cream ground).
    const esc = (s: string) => s.replace(/</g, "&lt;");
    const rowsHtml = rows
      .map(([k, v]) => {
        const isProduct = k.toLowerCase() === "product";
        return (
          `<tr>` +
          `<td style="padding:10px 16px 10px 0;color:#7c7568;font-size:12px;text-transform:uppercase;letter-spacing:0.4px;vertical-align:top;white-space:nowrap;border-bottom:1px solid #f0ece2">${esc(k)}</td>` +
          `<td style="padding:10px 0;font-size:14px;border-bottom:1px solid #f0ece2;${isProduct ? "color:#295A4F;font-weight:700" : "color:#1f2937"}">${esc(v)}</td>` +
          `</tr>`
        );
      })
      .join("");
    const html =
      `<div style="margin:0;padding:24px;background:#f4f1ea;font-family:Arial,Helvetica,sans-serif">` +
      `<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e7e2d6">` +
      `<div style="background:#295A4F;padding:22px 28px">` +
      `<div style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px">Plattera</div>` +
      `<div style="color:#bcd3cc;font-size:13px;margin-top:3px">New ${esc(input.kind)}</div>` +
      `</div>` +
      `<div style="padding:24px 28px">` +
      `<p style="margin:0 0 18px;color:#4b5563;font-size:14px;line-height:1.6">A new <strong style="color:#295A4F">${esc(input.kind)}</strong> was submitted on the Plattera website.</p>` +
      `<table style="width:100%;border-collapse:collapse">${rowsHtml}</table>` +
      `</div>` +
      `<div style="padding:16px 28px;background:#faf8f3;border-top:1px solid #efe9dc">` +
      `<p style="margin:0;color:#9a9384;font-size:12px;line-height:1.5">View the full lead in the CRM &rarr; Leads. This is an automated notification from the Plattera website.</p>` +
      `</div>` +
      `</div>` +
      `</div>`;

    await sendMail({ to: leadRecipients(input.channel), subject, text, html });

    // In-app bell notification for the admin.
    await createAdminNotification({
      type: "lead",
      title: `New ${input.kind}`,
      body:
        [input.name, input.email, input.phone].filter(Boolean).join(" · ") || null,
      link: input.channel === "career" ? "/careers" : "/enquiries",
    });
  } catch (e) {
    // Never let a notification failure break the submission.
    console.warn(`[notifyNewLead] failed: ${String(e)}`);
  }
}

/** Create an in-app admin notification (the Header bell). Never throws. */
export async function createAdminNotification(input: {
  type: "order" | "lead";
  title: string;
  body?: string | null;
  link?: string | null;
}): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
      },
    });
  } catch (e) {
    console.warn(`[createAdminNotification] failed: ${String(e)}`);
  }
}

/**
 * Notify the admin of a new paid order — an in-app bell notification plus an
 * email to the sales inbox. Fire-and-forget: never throws, so a hiccup can't
 * affect order finalization.
 */
export async function notifyNewOrder(orderId: number): Promise<void> {
  try {
    const o = await prisma.orderMaster.findUnique({
      where: { id: orderId },
      select: { id: true, orderNumber: true, custName: true, grandtotal: true },
    });
    if (!o) return;
    const amount = `₹${Number(o.grandtotal).toLocaleString("en-IN")}`;

    await createAdminNotification({
      type: "order",
      title: `New order ${o.orderNumber}`,
      body: `${amount}${o.custName ? ` · ${o.custName}` : ""}`,
      link: `/orders/${o.id}`,
    });

    const subject = `New order ${o.orderNumber} — ${amount}`;
    const text =
      `A new order was placed on the Plattera storefront.\n\n` +
      `Order: ${o.orderNumber}\n` +
      `Customer: ${o.custName ?? "-"}\n` +
      `Total: ${amount}\n\n` +
      `View it in the CRM → Orders.`;
    // "order" isn't in LEAD_RECIPIENTS → defaults to the contact inbox (or the
    // LEADS_NOTIFY_TO override), which is the desired sales/ops destination.
    await sendMail({ to: leadRecipients("order"), subject, text });
  } catch (e) {
    console.warn(`[notifyNewOrder] failed: ${String(e)}`);
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
