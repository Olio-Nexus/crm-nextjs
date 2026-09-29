import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { shapeStoreOrder, storeOrderInclude } from "@/lib/store-order";

const esc = (s: unknown) => String(s ?? "").replace(/</g, "&lt;");
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/**
 * Email the customer a branded order confirmation. Best-effort — the caller
 * runs it fire-and-forget so a mail hiccup never fails the paid order.
 */
export async function sendOrderConfirmation(orderId: number): Promise<void> {
  const o = await prisma.orderMaster.findUnique({
    where: { id: orderId },
    include: storeOrderInclude,
  });
  if (!o || !o.custEmail) return;
  const order = shapeStoreOrder(o);

  const itemsText = order.items
    .map((i) => `  • ${i.name} × ${i.quantity} — ${inr(i.lineTotal)}`)
    .join("\n");
  const text =
    `Hi ${order.address.name || "there"},\n\n` +
    `Thank you — your Plattera order ${order.orderNumber} is confirmed.\n\n` +
    `${itemsText}\n\n` +
    (order.discount ? `Discount: -${inr(order.discount)}\n` : "") +
    `Total paid: ${inr(order.grandtotal)}\n\n` +
    `Deliver to: ${order.address.line}\n\n` +
    `We'll email you again when it ships.\n\n— Plattera Gifts`;

  const rowsHtml = order.items
    .map(
      (i) =>
        `<tr>` +
        `<td style="padding:10px 0;font-size:14px;color:#1f2937;border-bottom:1px solid #f0ece2">${esc(i.name)} <span style="color:#7c7568">× ${i.quantity}</span></td>` +
        `<td style="padding:10px 0;font-size:14px;color:#1f2937;text-align:right;border-bottom:1px solid #f0ece2">${inr(i.lineTotal)}</td>` +
        `</tr>`,
    )
    .join("");

  const html =
    `<div style="margin:0;padding:24px;background:#f4f1ea;font-family:Arial,Helvetica,sans-serif">` +
    `<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e7e2d6">` +
    `<div style="background:#295A4F;padding:22px 28px">` +
    `<div style="color:#fff;font-size:20px;font-weight:700;letter-spacing:0.5px">Plattera</div>` +
    `<div style="color:#bcd3cc;font-size:13px;margin-top:3px">Order confirmed</div>` +
    `</div>` +
    `<div style="padding:24px 28px">` +
    `<p style="margin:0 0 16px;color:#4b5563;font-size:14px;line-height:1.6">Hi ${esc(order.address.name || "there")}, thank you! Your order <strong style="color:#295A4F">${esc(order.orderNumber)}</strong> is confirmed and being prepared.</p>` +
    `<table style="width:100%;border-collapse:collapse">${rowsHtml}` +
    (order.discount
      ? `<tr><td style="padding:8px 0;font-size:13px;color:#7c7568">Discount</td><td style="padding:8px 0;font-size:13px;color:#7c7568;text-align:right">-${inr(order.discount)}</td></tr>`
      : "") +
    `<tr><td style="padding:12px 0 0;font-size:15px;font-weight:700;color:#295A4F">Total paid</td><td style="padding:12px 0 0;font-size:15px;font-weight:700;color:#295A4F;text-align:right">${inr(order.grandtotal)}</td></tr>` +
    `</table>` +
    `<p style="margin:18px 0 0;color:#6b7280;font-size:13px;line-height:1.5"><strong>Deliver to:</strong><br>${esc(order.address.name)} · ${esc(order.address.phone)}<br>${esc(order.address.line)}</p>` +
    `</div>` +
    `<div style="padding:16px 28px;background:#faf8f3;border-top:1px solid #efe9dc">` +
    `<p style="margin:0;color:#9a9384;font-size:12px;line-height:1.5">We'll email you again when your order ships. This is an automated message from Plattera.</p>` +
    `</div>` +
    `</div></div>`;

  await sendMail({
    to: o.custEmail,
    subject: `Order confirmed — ${order.orderNumber}`,
    text,
    html,
  });
}
