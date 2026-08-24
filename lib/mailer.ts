import nodemailer from "nodemailer";

/**
 * Email delivery. Two transports, chosen at runtime:
 *
 * 1. Resend HTTP API (preferred) — set RESEND_API_KEY. Sends over HTTPS (443),
 *    which works from hosts like Render that block outbound SMTP ports.
 * 2. SMTP via nodemailer — set SMTP_* — for hosts that allow SMTP.
 *
 * The "from" address comes from SMTP_FROM (a verified sender on the chosen
 * provider). If neither transport is configured, sendMail logs to the console
 * so the OTP flow is testable without credentials — never rely on that in prod.
 */
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

/** Verified sender used by both transports (e.g. "Plattera <no-reply@plattera.in>"). */
const MAIL_FROM = SMTP_FROM ?? SMTP_USER ?? "Plattera <onboarding@resend.dev>";

/** Replies are routed to a no-reply address — the client doesn't want customers
 *  replying to system emails. Override with MAIL_REPLY_TO if needed. */
const MAIL_REPLY_TO = process.env.MAIL_REPLY_TO ?? "no-reply@plattera.in";

export const resendConfigured = Boolean(RESEND_API_KEY);
export const smtpConfigured = Boolean(
  SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS,
);

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      // 465 = implicit TLS; 587 = STARTTLS.
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      // Fail fast instead of hanging ~2min if the host is unreachable.
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    })
  : null;

/**
 * Health check for the active transport. For Resend it lists the account's
 * verified domains (so you can see if the sending domain is verified); for SMTP
 * it runs a connection + auth check. Returns raw error details for diagnosis.
 */
export async function verifySmtp() {
  if (RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
      });
      const body: any = await res.json().catch(() => ({}));
      return {
        ok: res.ok,
        transport: "resend",
        from: MAIL_FROM,
        status: res.status,
        domains: Array.isArray(body?.data)
          ? body.data.map((d: any) => `${d.name}:${d.status}`)
          : undefined,
        error: res.ok ? undefined : body?.message ?? "Resend check failed",
      };
    } catch (e: any) {
      return { ok: false, transport: "resend", error: e?.message ?? String(e) };
    }
  }
  if (!transporter) return { ok: false, reason: "Email not configured" };
  try {
    await transporter.verify();
    return { ok: true, transport: "smtp", host: SMTP_HOST, port: SMTP_PORT, user: SMTP_USER };
  } catch (e: any) {
    return {
      ok: false,
      transport: "smtp",
      host: SMTP_HOST,
      port: SMTP_PORT,
      user: SMTP_USER,
      error: e?.message ?? String(e),
      code: e?.code,
      command: e?.command,
      response: e?.response,
    };
  }
}

interface MailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Send via the Resend HTTP API (works where SMTP ports are blocked). */
async function sendViaResend({ to, subject, text, html }: MailInput) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: MAIL_FROM, to: [to], reply_to: MAIL_REPLY_TO, subject, text, html: html ?? undefined }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${detail.slice(0, 400)}`);
  }
  return { delivered: true as const };
}

export async function sendMail({ to, subject, text, html }: MailInput) {
  if (RESEND_API_KEY) {
    try {
      return await sendViaResend({ to, subject, text, html });
    } catch (e) {
      // Degrade gracefully instead of failing the request — e.g. Resend test
      // mode only allows the account owner's address until a domain is verified.
      // Log so the code is still recoverable; the caller sees delivered:false.
      console.warn(
        `[mailer] Resend send failed (${String(e)}); not delivered.\n  to: ${to}\n  subject: ${subject}\n  ${text}`,
      );
      return { delivered: false as const };
    }
  }

  if (!transporter) {
    // Dev / not-yet-configured fallback.
    console.warn(
      `[mailer] Email not configured — not sent.\n  to: ${to}\n  subject: ${subject}\n  ${text}`,
    );
    return { delivered: false as const };
  }

  await transporter.sendMail({
    from: MAIL_FROM,
    replyTo: MAIL_REPLY_TO,
    to,
    subject,
    text,
    html: html ?? undefined,
  });
  return { delivered: true as const };
}

/** Branded OTP email. A clear from/subject, a real footer with the company's
 *  name and postal address, and a balanced text+HTML body all help keep the
 *  message out of spam (thin, code-only emails look phishy to filters). */
export function otpEmail(code: string) {
  return {
    subject: `${code} is your Plattera verification code`,
    text:
      `Hi,\n\n` +
      `Your Plattera verification code is ${code}.\n` +
      `Enter it on the sign-in screen to continue. This code expires in 10 minutes.\n\n` +
      `If you didn't request this, you can safely ignore this email — no action is needed.\n\n` +
      `This is an automated message, please do not reply.\n\n` +
      `— Plattera Gifts\n` +
      `Carnival Hub Work Space, Malad East, Mumbai 400097, India\n` +
      `https://plattera.in`,
    html: `
      <div style="display:none;max-height:0;overflow:hidden;opacity:0">Your Plattera verification code is ${code}. It expires in 10 minutes.</div>
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#333">
        <p style="font-size:18px;font-weight:700;color:#295A4F;margin:0 0 20px">Plattera</p>
        <h2 style="color:#295A4F;font-size:18px;margin:0 0 8px">Verify your email</h2>
        <p style="color:#555;margin:0 0 20px">Use this one-time code to sign in to your Plattera account.</p>
        <div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#295A4F;background:#f4efe8;padding:16px;text-align:center;border-radius:8px">
          ${code}
        </div>
        <p style="color:#777;font-size:13px;margin:20px 0 0">
          This code expires in 10 minutes. If you didn't request it, you can safely ignore this email — no action is needed.
        </p>
        <p style="color:#999;font-size:12px;margin:12px 0 0">
          This is an automated message, please do not reply.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0 12px" />
        <p style="color:#999;font-size:12px;line-height:1.5;margin:0">
          Plattera Gifts &middot; Carnival Hub Work Space, Malad East, Mumbai 400097, India<br />
          <a href="https://plattera.in" style="color:#295A4F;text-decoration:none">plattera.in</a>
        </p>
      </div>
    `,
  };
}
