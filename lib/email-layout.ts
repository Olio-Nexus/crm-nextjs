/**
 * Shared branded shell for all customer-facing emails: the Plattera logo in the
 * header and a "Contact us" link (→ storefront contact page) in the footer, so
 * every email looks consistent and professional. `inner` is the email body HTML.
 *
 * The logo is served from the storefront's public folder (absolute URL, required
 * for email clients). `preheader` is the hidden inbox preview text.
 */
const LOGO_URL = "https://www.plattera.in/plattera-logo.png";
const CONTACT_URL = "https://www.plattera.in/contact";
const SITE_URL = "https://www.plattera.in";
const BRAND = "#295A4F";

export function wrapEmail(inner: string, preheader?: string): string {
  return `${
    preheader
      ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${preheader}</div>`
      : ""
  }
<div style="margin:0;padding:24px 16px;background:#f4f1ea;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e7e2d6">
    <!-- Header: logo on white -->
    <div style="padding:28px 28px 20px;text-align:center;border-bottom:1px solid #f0ece2">
      <img src="${LOGO_URL}" alt="Plattera" height="60" style="display:block;margin:0 auto;height:60px;width:auto;border:0;outline:none;text-decoration:none" />
    </div>
    <!-- Body -->
    <div style="padding:26px 28px;color:#333333">${inner}</div>
    <!-- Footer: contact + company -->
    <div style="padding:20px 28px;background:#faf8f3;border-top:1px solid #efe9dc;text-align:center">
      <p style="margin:0 0 10px;font-size:13px;color:#4b5563">
        Need help? <a href="${CONTACT_URL}" style="color:${BRAND};font-weight:700;text-decoration:none">Contact us</a>
      </p>
      <p style="margin:0;font-size:12px;color:#9a9384;line-height:1.6">
        Plattera Gifts &middot; Carnival Hub Work Space, Malad East, Mumbai 400097, India<br />
        <a href="${SITE_URL}" style="color:#9a9384;text-decoration:underline">plattera.in</a>
      </p>
    </div>
  </div>
</div>`;
}
