"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Package, MapPin, CreditCard, User, Sparkles, Printer,
  ChevronRight, AlertCircle, CheckCircle2, Truck,
  XCircle, RefreshCw, Clock, ChevronDown,
} from "lucide-react";
import { formatINR, formatDateTime } from "@/lib/utils";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, OrderStatus } from "@/types";

// ── Status config ──────────────────────────────────────────

const STATUS_ICONS: Record<string, any> = {
  PAYMENT_PENDING: Clock,
  PLACED:          CheckCircle2,
  PROCESSING:      RefreshCw,
  SHIPPED:         Truck,
  DELIVERED:       CheckCircle2,
  COMPLETED:       CheckCircle2,
  CANCELLED:       XCircle,
  REFUNDED:        RefreshCw,
};

const STATUS_TIMELINE = [
  "PAYMENT_PENDING", "PLACED", "PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED",
] as const;

const NEXT_STATUSES: Record<string, {
  value: string; label: string;
  cls: string; icon: any;
}[]> = {
  PAYMENT_PENDING: [
    { value: "PLACED",    label: "Confirm Order",   icon: CheckCircle2, cls: "bg-brand-600 hover:bg-brand-700 text-white" },
    { value: "CANCELLED", label: "Cancel Order",    icon: XCircle,      cls: "bg-surface border border-red-200 text-red-600 hover:bg-red-50" },
  ],
  PLACED: [
    { value: "PROCESSING", label: "Start Processing", icon: RefreshCw,    cls: "bg-amber-500 hover:bg-amber-600 text-white" },
    { value: "CANCELLED",  label: "Cancel Order",     icon: XCircle,      cls: "bg-surface border border-red-200 text-red-600 hover:bg-red-50" },
  ],
  PROCESSING: [
    { value: "SHIPPED",   label: "Mark as Shipped",   icon: Truck,        cls: "bg-emerald-600 hover:bg-emerald-700 text-white" },
    { value: "CANCELLED", label: "Cancel Order",      icon: XCircle,      cls: "bg-surface border border-red-200 text-red-600 hover:bg-red-50" },
  ],
  SHIPPED: [
    { value: "DELIVERED", label: "Mark as Delivered", icon: CheckCircle2, cls: "bg-emerald-600 hover:bg-emerald-700 text-white" },
  ],
  DELIVERED: [
    { value: "COMPLETED", label: "Mark as Completed", icon: CheckCircle2, cls: "bg-brand-600 hover:bg-brand-700 text-white" },
    { value: "REFUNDED",  label: "Refund Order",      icon: RefreshCw,    cls: "bg-purple-600 hover:bg-purple-700 text-white" },
  ],
  COMPLETED: [
    { value: "REFUNDED",  label: "Refund Order",      icon: RefreshCw,    cls: "bg-purple-600 hover:bg-purple-700 text-white" },
  ],
  CANCELLED: [],
  REFUNDED:  [],
};

// ── Component ──────────────────────────────────────────────

export default function OrderDetailPage() {
  const { id }   = useParams();
  const [order,        setOrder]        = useState<any>(null);
  const [loading,      setLoading]      = useState(true);
  const [updating,     setUpdating]     = useState(false);
  const [showCancel,   setShowCancel]   = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [error,        setError]        = useState("");
  const [success,      setSuccess]      = useState("");

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then((r) => r.json())
      .then((d) => { setOrder(d); setLoading(false); });
  }, [id]);

  async function updateStatus(newStatus: string) {
    if (newStatus === "CANCELLED") { setShowCancel(true); return; }
    await doUpdate(newStatus, "");
  }

  async function doUpdate(newStatus: string, reason: string) {
    setUpdating(true); setError(""); setSuccess("");
    const res  = await fetch(`/api/orders/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus, cancellationReason: reason }),
    });
    const data = await res.json();
    setUpdating(false);
    if (!res.ok) { setError(data.error ?? "Failed to update status"); return; }
    setOrder((p: any) => ({ ...p, orderStatus: newStatus }));
    setSuccess(`Status updated to ${ORDER_STATUS_LABELS[newStatus as OrderStatus]}`);
    setShowCancel(false); setCancelReason("");
    setTimeout(() => setSuccess(""), 4000);
  }

  // ── Loading ──
  if (loading) return (
    <div className="flex flex-col items-center justify-center h-72 gap-3">
      <div className="w-9 h-9 border-[3px] border-brand-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-400">Loading order details...</p>
    </div>
  );

  if (!order || order.error) return (
    <div className="flex flex-col items-center justify-center h-72 gap-3">
      <p className="text-gray-500 font-medium">Order not found</p>
      <Link href="/orders" className="text-sm text-brand-600 hover:underline">← Back to orders</Link>
    </div>
  );

  const nextActions  = NEXT_STATUSES[order.orderStatus] ?? [];
  const timelineIdx  = STATUS_TIMELINE.indexOf(order.orderStatus as any);
  const isCancelled  = order.orderStatus === "CANCELLED";
  const isRefunded   = order.orderStatus === "REFUNDED";
  const StatusIcon   = STATUS_ICONS[order.orderStatus];

  // Multi-address orders carry a per-line ship-to. Collect the DISTINCT recipient
  // addresses so the Delivery Address panel can list all of them (not just the
  // primary one on the OrderMaster).
  const shipTos = (order.orderDetails ?? [])
    .filter((d: any) => d.deliveryName)
    .map((d: any) => ({
      name: d.deliveryName as string,
      phone: (d.deliveryPhone as string) || "",
      line: [d.deliveryStreet, d.deliveryLandmarks, d.deliveryCity, d.deliveryState, d.deliveryPincode]
        .filter(Boolean)
        .join(", "),
    }));
  const uniqueShipTos = Array.from(
    new Map(shipTos.map((s: any) => [`${s.name}|${s.line}`, s])).values(),
  ) as { name: string; phone: string; line: string }[];
  const isMultiAddress = uniqueShipTos.length > 0;

  return (
    <div className="max-w-6xl space-y-5 pb-12">

      {/* ════ HEADER ════ */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link href="/orders"
            className="mt-1 p-2 rounded-xl hover:bg-surface hover:shadow-sm border border-transparent hover:border-gray-200 text-gray-400 transition-all">
            <ArrowLeft size={17} />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold text-gray-900">
                Order <span className="text-brand-600 font-mono">#{order.orderNumber}</span>
              </h1>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${ORDER_STATUS_COLORS[order.orderStatus as OrderStatus]}`}>
                {StatusIcon && <StatusIcon size={11} />}
                {ORDER_STATUS_LABELS[order.orderStatus as OrderStatus]}
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-1">
              Placed on {formatDateTime(order.orderDate)}
            </p>
          </div>
        </div>
        <Link
          href={`/orders/${order.id}/invoice`}
          target="_blank"
          className="mt-1 inline-flex shrink-0 items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-surface"
        >
          <Printer size={15} /> Invoice
        </Link>
      </div>

      {/* ════ ALERTS ════ */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* ════ STATUS ACTION BAR ════ */}
      {nextActions.length > 0 && (
        <div className="bg-surface border border-gray-200 rounded-2xl p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Update Order Status
          </p>
          <div className="flex flex-wrap gap-2.5">
            {nextActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.value}
                  onClick={() => updateStatus(action.value)}
                  disabled={updating}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 ${action.cls}`}
                >
                  {updating
                    ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    : <Icon size={15} />
                  }
                  {action.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ════ ORDER PROGRESS TIMELINE ════ */}
      {!isCancelled && !isRefunded && (
        <div className="bg-surface border border-gray-200 rounded-2xl p-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-6">
            Order Progress
          </p>
          <div className="flex items-start">
            {STATUS_TIMELINE.map((s, i) => {
              const done    = i <= timelineIdx;
              const current = i === timelineIdx;
              const Icon    = STATUS_ICONS[s];
              const isLast  = i === STATUS_TIMELINE.length - 1;
              return (
                <div key={s} className={`flex items-center ${isLast ? "" : "flex-1"}`}>
                  {/* Step */}
                  <div className="flex flex-col items-center gap-2 min-w-[60px]">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 ${
                      current ? "bg-brand-600 text-white ring-4 ring-brand-100"
                      : done   ? "bg-emerald-500 text-white"
                      : "bg-gray-100 text-gray-300"
                    }`}>
                      <Icon size={16} />
                    </div>
                    <span className={`text-xs font-medium text-center leading-tight ${
                      current ? "text-brand-600"
                      : done   ? "text-emerald-600"
                      : "text-gray-300"
                    }`}>
                      {ORDER_STATUS_LABELS[s as OrderStatus]}
                    </span>
                  </div>
                  {/* Connector */}
                  {!isLast && (
                    <div className={`h-0.5 flex-1 mx-2 mb-7 rounded-full ${
                      i < timelineIdx ? "bg-emerald-400" : "bg-gray-200"
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ════ CANCELLATION BANNER ════ */}
      {isCancelled && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-3">
          <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
            <XCircle size={18} className="text-red-600" />
          </div>
          <div>
            <p className="font-semibold text-red-800 text-sm">Order Cancelled</p>
            {order.cancellationReason && (
              <p className="text-sm text-red-600 mt-0.5">{order.cancellationReason}</p>
            )}
            {order.cancelledDate && (
              <p className="text-xs text-red-400 mt-1">Cancelled on {formatDateTime(order.cancelledDate)}</p>
            )}
          </div>
        </div>
      )}

      {/* ════ MAIN CONTENT GRID ════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── LEFT COLUMN ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Order Items */}
          <div className="bg-surface border border-gray-200 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2.5 px-6 py-4 border-b border-gray-100">
              <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center">
                <Package size={14} className="text-gray-500" />
              </div>
              <h2 className="font-semibold text-gray-900 text-sm">
                Order Items
                <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md text-xs font-medium">
                  {order.orderDetails.length}
                </span>
              </h2>
            </div>

            <div className="divide-y divide-gray-50">
              {order.orderDetails.map((item: any) => (
                <div key={item.id} className="flex items-start gap-4 px-6 py-5">
                  {/* Product thumb */}
                  <div className="w-14 h-14 bg-gradient-to-br from-gray-100 to-gray-50 border border-gray-200 rounded-xl flex items-center justify-center shrink-0">
                    <Package size={20} className="text-gray-300" />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{item.productName}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                      <span className="text-xs text-gray-400 font-mono">SKU: {item.sku}</span>
                      <span className="text-gray-200">·</span>
                      <span className="text-xs text-gray-400">Sub# {item.subOrderNumber}</span>
                    </div>

                    {item.deliveryName && (
                      <p className="mt-1.5 flex items-start gap-1 text-xs text-gray-500">
                        <MapPin size={12} className="mt-0.5 shrink-0 text-gray-400" />
                        <span>
                          Ship to{" "}
                          <span className="font-medium text-gray-700">{item.deliveryName}</span>
                          {item.deliveryPhone ? ` · ${item.deliveryPhone}` : ""} —{" "}
                          {[item.deliveryStreet, item.deliveryCity, item.deliveryState, item.deliveryPincode]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </p>
                    )}

                    {/* Personalisation the customer selected on the storefront —
                        the order-processing team needs the exact text/font/image. */}
                    {item.attributes?.personalization &&
                      (item.attributes.personalization.text ||
                        item.attributes.personalization.font ||
                        item.attributes.personalization.image) && (
                        <div className="mt-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2">
                          <p className="flex items-center gap-1 text-xs font-semibold text-brand-700">
                            <Sparkles size={12} /> Personalisation
                          </p>
                          <div className="mt-1 space-y-0.5 text-xs text-gray-600">
                            {item.attributes.personalization.text && (
                              <p>
                                Text:{" "}
                                <span className="font-medium text-gray-900">
                                  &ldquo;{item.attributes.personalization.text}&rdquo;
                                </span>
                              </p>
                            )}
                            {item.attributes.personalization.font && (
                              <p>
                                Font:{" "}
                                <span className="font-medium text-gray-900">
                                  {item.attributes.personalization.font}
                                </span>
                              </p>
                            )}
                            {item.attributes.personalization.image && (
                              <p>
                                <a
                                  href={item.attributes.personalization.image}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-brand-600 hover:underline"
                                >
                                  View uploaded image
                                </a>
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    <div className="flex flex-wrap items-center gap-3 mt-2.5">
                      <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-lg">
                        <span className="text-xs text-gray-500">Qty</span>
                        <span className="text-xs font-bold text-gray-800">{item.quantity}</span>
                      </div>
                      <span className="text-xs text-gray-400">×</span>
                      <span className="text-xs font-medium text-gray-600">{formatINR(item.unitPrice)}</span>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${ORDER_STATUS_COLORS[item.orderStatus as OrderStatus]}`}>
                        {ORDER_STATUS_LABELS[item.orderStatus as OrderStatus]}
                      </span>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="text-right shrink-0">
                    <p className="font-bold text-gray-900">{formatINR(item.total)}</p>
                    {item.gstCharges > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">+GST {formatINR(item.gstCharges)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Price Breakdown */}
          <div className="bg-surface border border-gray-200 rounded-2xl p-6">
            <h2 className="font-semibold text-gray-900 text-sm mb-5">Price Breakdown</h2>
            <div className="space-y-3">
              {[
                { label: "Item Total",   value: order.itemTotal,   show: true },
                { label: "Delivery Fee", value: order.deliveryFee, show: order.deliveryFee != null },
                { label: "GST",          value: order.gstCharges,  show: order.gstCharges > 0 },
                { label: "CGST",         value: order.cgst,        show: !!order.cgst },
                { label: "SGST",         value: order.sgst,        show: !!order.sgst },
                { label: "IGST",         value: order.igst,        show: !!order.igst },
              ].filter((r) => r.show).map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">{label}</span>
                  <span className="text-gray-700 font-medium">{formatINR(value)}</span>
                </div>
              ))}

              {order.discount > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-emerald-600">
                    Discount {order.promocode ? `(${order.promocode})` : ""}
                  </span>
                  <span className="text-emerald-600 font-semibold">
                    − {formatINR(order.discount)}
                  </span>
                </div>
              )}

              <div className="border-t-2 border-gray-100 pt-4 mt-2 flex justify-between items-center">
                <span className="font-bold text-gray-900 text-base">Grand Total</span>
                <span className="font-bold text-gray-900 text-xl">{formatINR(order.grandtotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="space-y-4">

          {/* Customer */}
          <div className="bg-surface border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 bg-brand-50 rounded-xl flex items-center justify-center">
                <User size={15} className="text-brand-600" />
              </div>
              <h2 className="font-semibold text-gray-900 text-sm">Customer</h2>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-gray-900">{order.custName}</p>
              <div className="space-y-1">
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-gray-300 rounded-full" />
                  {order.custEmail}
                </p>
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-gray-300 rounded-full" />
                  {order.custNumber}
                </p>
              </div>
              {order.customer && (
                <Link href={`/customers/${order.customer.id}`}
                  className="inline-flex items-center gap-1 text-brand-600 text-xs font-semibold mt-2 hover:underline">
                  View full profile <ChevronRight size={12} />
                </Link>
              )}
            </div>
          </div>

          {/* Delivery Address */}
          <div className="bg-surface border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center">
                <MapPin size={15} className="text-emerald-600" />
              </div>
              <h2 className="font-semibold text-gray-900 text-sm">
                {isMultiAddress ? "Delivery Addresses" : "Delivery Address"}
              </h2>
              {isMultiAddress && (
                <span className="ml-auto px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-xs font-medium">
                  {uniqueShipTos.length} destinations
                </span>
              )}
            </div>

            {isMultiAddress ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-400">
                  This order ships to multiple addresses — see each item for what goes where.
                </p>
                {uniqueShipTos.map((s, i) => (
                  <div
                    key={`${s.name}-${i}`}
                    className="rounded-xl border border-gray-200 p-3 text-sm text-gray-600 leading-relaxed"
                  >
                    <p className="font-semibold text-gray-800">
                      {s.name}
                      {s.phone && <span className="ml-2 text-xs font-normal text-gray-400">{s.phone}</span>}
                    </p>
                    <p>{s.line}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1 text-sm text-gray-600 leading-relaxed">
                <p className="font-semibold text-gray-800">{order.streetAddress}</p>
                {order.landmarks && <p className="text-gray-400 text-xs">{order.landmarks}</p>}
                <p>{order.city}, {order.state}</p>
                <p className="text-gray-500">{order.country}</p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-xs font-mono">
                    {order.pincode}
                  </span>
                  {order.addressType && (
                    <span className="px-2 py-0.5 bg-brand-50 text-brand-600 rounded-md text-xs capitalize font-medium">
                      {order.addressType}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Payment */}
          <div className="bg-surface border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 bg-purple-50 rounded-xl flex items-center justify-center">
                <CreditCard size={15} className="text-purple-600" />
              </div>
              <h2 className="font-semibold text-gray-900 text-sm">Payment</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Mode</span>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                  order.paymentMode === "COD"
                    ? "bg-orange-100 text-orange-700"
                    : "bg-brand-100 text-brand-700"
                }`}>
                  {order.paymentMode ?? "—"}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Status</span>
                <span className={`text-xs font-bold ${
                  order.paymentStatus === "Paid"
                    ? "text-emerald-600"
                    : "text-red-500"
                }`}>
                  {order.paymentStatus ?? "—"}
                </span>
              </div>

              {order.razorpayOrderId && (
                <div className="pt-2 border-t border-gray-100 space-y-1">
                  <p className="text-xs text-gray-400">Razorpay Order ID</p>
                  <p className="font-mono text-xs text-gray-600 break-all bg-gray-50 px-2 py-1.5 rounded-lg">
                    {order.razorpayOrderId}
                  </p>
                </div>
              )}
              {order.razorpayPaymentId && (
                <div className="space-y-1">
                  <p className="text-xs text-gray-400">Payment ID</p>
                  <p className="font-mono text-xs text-gray-600 break-all bg-gray-50 px-2 py-1.5 rounded-lg">
                    {order.razorpayPaymentId}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ════ CANCEL MODAL ════ */}
      {showCancel && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-100">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 bg-red-100 rounded-2xl flex items-center justify-center shrink-0">
                <XCircle size={22} className="text-red-600" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">Cancel this order?</h2>
                <p className="text-xs text-gray-500 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>

            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Cancellation Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              placeholder="e.g. Customer requested cancellation"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent mb-5 resize-none"
            />

            <div className="flex gap-3">
              <button onClick={() => { setShowCancel(false); setCancelReason(""); }}
                className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                Go Back
              </button>
              <button
                onClick={() => doUpdate("CANCELLED", cancelReason)}
                disabled={updating || !cancelReason.trim()}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {updating && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                Yes, Cancel Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
