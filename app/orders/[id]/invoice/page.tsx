/* eslint-disable @typescript-eslint/no-explicit-any */
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatINR, formatDate } from "@/lib/utils";
import { InvoiceActions } from "./InvoiceActions";

const num = (v: unknown) => (v == null ? 0 : Number(v));

/** Simple receipt-style invoice for an order (print → Save as PDF). Admin only. */
export default async function OrderInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const order = await prisma.orderMaster.findUnique({
    where: { id: Number(id) },
    include: { orderDetails: true },
  });
  if (!order) notFound();

  const address = [
    order.streetAddress,
    order.landmarks,
    order.city,
    order.state,
    order.pincode,
  ]
    .filter(Boolean)
    .join(", ");

  // Multi-address orders carry a per-line ship-to — list every DISTINCT recipient.
  const shipTos = order.orderDetails
    .filter((d) => (d as any).deliveryName)
    .map((d) => ({
      name: (d as any).deliveryName as string,
      phone: ((d as any).deliveryPhone as string) || "",
      line: [
        (d as any).deliveryStreet,
        (d as any).deliveryLandmarks,
        (d as any).deliveryCity,
        (d as any).deliveryState,
        (d as any).deliveryPincode,
      ]
        .filter(Boolean)
        .join(", "),
    }));
  const uniqueShipTos = Array.from(
    new Map(shipTos.map((s) => [`${s.name}|${s.line}`, s])).values(),
  );
  const isMultiAddress = uniqueShipTos.length > 0;

  return (
    <main
      id="invoice-doc"
      className="min-h-screen bg-gray-50 px-4 py-8 print:bg-white print:p-0"
    >
      {/* Force light-mode colours so the receipt reads the same in dark mode
          (the CRM's .dark theme flips the gray tokens, which would otherwise
          make dark text near-white on the white card). */}
      <style
        dangerouslySetInnerHTML={{
          __html:
            "#invoice-doc{--color-gray-50:#f9fafb;--color-gray-100:#f3f4f6;--color-gray-200:#e5e7eb;--color-gray-300:#d1d5db;--color-gray-400:#9ca3af;--color-gray-500:#6b7280;--color-gray-600:#4b5563;--color-gray-700:#374151;--color-gray-800:#1f2937;--color-gray-900:#111827;color-scheme:light}#invoice-doc,#invoice-doc *{color-scheme:light}@media print{.no-print{display:none!important}body{background:#fff!important}}",
        }}
      />
      <div className="mx-auto max-w-[720px]">
        <InvoiceActions backHref={`/orders/${order.id}`} />

        <div className="rounded-2xl border border-gray-200 bg-white p-8 print:rounded-none print:border-0 print:p-6">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-gray-200 pb-5">
            <div>
              <p className="text-2xl font-bold text-[#295A4F]">Plattera</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                Plattera Gifts
                <br />
                Carnival Hub Work Space, Malad East
                <br />
                Mumbai 400097, India · plattera.in
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold text-gray-900">INVOICE</p>
              <p className="mt-1 text-sm text-gray-600">{order.orderNumber}</p>
              <p className="text-xs text-gray-500">{formatDate(order.orderDate)}</p>
            </div>
          </div>

          {/* Bill-to + payment */}
          <div className="mt-5 grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                {isMultiAddress ? "Billed to" : "Billed / ship to"}
              </p>
              <p className="mt-1 font-medium text-gray-900">{order.custName}</p>
              <p className="text-gray-600">{order.custNumber}</p>
              {order.custEmail && <p className="text-gray-600">{order.custEmail}</p>}
              {!isMultiAddress && <p className="mt-1 text-gray-600">{address}</p>}

              {isMultiAddress && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Ships to {uniqueShipTos.length} addresses
                  </p>
                  <div className="mt-1 space-y-2">
                    {uniqueShipTos.map((s, i) => (
                      <div key={`${s.name}-${i}`} className="text-gray-600">
                        <span className="font-medium text-gray-900">{s.name}</span>
                        {s.phone && <span className="text-gray-500"> · {s.phone}</span>}
                        <br />
                        {s.line}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Payment
              </p>
              <p className="mt-1 text-gray-900">{order.paymentMode ?? "—"}</p>
              <p className="text-gray-600">{order.paymentStatus ?? "—"}</p>
              {order.razorpayPaymentId && (
                <p className="font-mono text-xs text-gray-400">
                  {order.razorpayPaymentId}
                </p>
              )}
            </div>
          </div>

          {/* Items */}
          <table className="mt-6 w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="py-2">Item</th>
                <th className="py-2 text-center">Qty</th>
                <th className="py-2 text-right">Unit</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.orderDetails.map((d) => {
                const perso = (d.attributes as any)?.personalization;
                const hasPerso = perso && (perso.text || perso.font || perso.image);
                return (
                  <tr key={d.id} className="border-b border-gray-100 align-top">
                    <td className="py-2.5">
                      <p className="font-medium text-gray-900">{d.productName}</p>
                      <p className="text-xs text-gray-400">SKU: {d.sku}</p>
                      {hasPerso && (
                        <p className="text-xs text-gray-500">
                          Personalisation:{" "}
                          {[perso.text && `"${perso.text}"`, perso.font]
                            .filter(Boolean)
                            .join(" · ")}
                          {perso.image ? " · design uploaded" : ""}
                        </p>
                      )}
                      {(d as any).deliveryName && (
                        <p className="text-xs text-gray-500">
                          Ship to: {(d as any).deliveryName} —{" "}
                          {[
                            (d as any).deliveryStreet,
                            (d as any).deliveryCity,
                            (d as any).deliveryState,
                            (d as any).deliveryPincode,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 text-center">{d.quantity}</td>
                    <td className="py-2.5 text-right">{formatINR(num(d.priceWithGst))}</td>
                    <td className="py-2.5 text-right font-medium">
                      {formatINR(num(d.total))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Totals */}
          <div className="ml-auto mt-4 w-full max-w-[280px] text-sm">
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Item total</span>
              <span className="text-gray-900">{formatINR(num(order.itemTotal))}</span>
            </div>
            {order.discount ? (
              <div className="flex justify-between py-1">
                <span className="text-gray-500">Discount</span>
                <span className="text-gray-900">- {formatINR(num(order.discount))}</span>
              </div>
            ) : null}
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Delivery</span>
              <span className="text-gray-900">
                {num(order.deliveryFee) ? formatINR(num(order.deliveryFee)) : "Free"}
              </span>
            </div>
            <div className="mt-1 flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-gray-900">
              <span>Total paid</span>
              <span>{formatINR(num(order.grandtotal))}</span>
            </div>
            <p className="mt-1 text-right text-xs text-gray-400">
              Prices inclusive of GST
            </p>
          </div>

          <p className="mt-8 border-t border-gray-200 pt-4 text-center text-xs text-gray-400">
            Thank you for shopping with Plattera. This is a computer-generated receipt.
          </p>
        </div>
      </div>
    </main>
  );
}
