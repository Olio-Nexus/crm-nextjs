"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, User, MapPin, ShoppingBag, RotateCcw,
  Tag, CheckCircle2, XCircle, AlertCircle, Phone,
  Mail, Calendar, Hash, Cake, Heart, Save,
} from "lucide-react";
import { formatINR, formatDate, formatDateTime } from "@/lib/utils";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, OrderStatus } from "@/types";

export default function CustomerDetailPage() {
  const { id }      = useParams();
  const [customer,  setCustomer]  = useState<any>(null);
  const [loading,   setLoading]   = useState(true);
  const [toggling,  setToggling]  = useState(false);
  const [success,   setSuccess]   = useState("");

  // Editable occasion dates (power the reminder emails).
  const [dob,          setDob]          = useState("");
  const [anniversary,  setAnniversary]  = useState("");
  const [savingDates,  setSavingDates]  = useState(false);

  const toInputDate = (d: string | null) =>
    d ? new Date(d).toISOString().split("T")[0] : "";

  useEffect(() => {
    fetch(`/api/customers/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setCustomer(d);
        setDob(toInputDate(d?.dob ?? null));
        setAnniversary(toInputDate(d?.anniversary ?? null));
        setLoading(false);
      });
  }, [id]);

  async function saveDates() {
    setSavingDates(true);
    const res = await fetch(`/api/customers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dob, anniversary }),
    });
    const data = await res.json();
    setSavingDates(false);
    if (res.ok) {
      setCustomer((p: any) => ({ ...p, dob: data.dob, anniversary: data.anniversary }));
      setSuccess("Occasion dates saved");
      setTimeout(() => setSuccess(""), 3000);
    }
  }

  async function toggleStatus() {
    setToggling(true);
    const res  = await fetch(`/api/customers/${id}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status: !customer.status }),
    });
    const data = await res.json();
    setToggling(false);
    if (res.ok) {
      setCustomer((p: any) => ({ ...p, status: data.status }));
      setSuccess(data.status ? "Customer activated" : "Customer deactivated");
      setTimeout(() => setSuccess(""), 3000);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!customer || customer.error) return (
    <div className="text-center py-20 text-gray-400">Customer not found</div>
  );

  const totalSpent = customer.orders.reduce((s: number, o: any) => s + o.grandtotal, 0);

  return (
    <div className="max-w-5xl pb-12 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/customers"
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-surface hover:bg-gray-50 text-gray-400 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold text-gray-900">{customer.name}</h1>
            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
              customer.status ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
            }`}>
              {customer.status ? "Active" : "Inactive"}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Customer since {formatDate(customer.createdAt)}
          </p>
        </div>
        <button
          onClick={toggleStatus}
          disabled={toggling}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 ${
            customer.status
              ? "bg-surface border border-red-200 text-red-600 hover:bg-red-50"
              : "bg-emerald-600 hover:bg-emerald-700 text-white"
          }`}
        >
          {customer.status ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
          {toggling ? "Updating..." : customer.status ? "Deactivate" : "Activate"}
        </button>
      </div>

      {success && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl">
          <CheckCircle2 size={15} /> {success}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Orders",   value: customer._count.orders,                  color: "text-brand-600",   bg: "bg-brand-50"   },
          { label: "Total Spent",    value: formatINR(totalSpent),                   color: "text-emerald-600",bg: "bg-emerald-50"},
          { label: "Returns",        value: customer._count.returnOrders,            color: "text-orange-600", bg: "bg-orange-50" },
        ].map((s) => (
          <div key={s.label} className="bg-surface border border-gray-200 rounded-2xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left — Orders + Returns */}
        <div className="lg:col-span-2 space-y-5">

          {/* Orders */}
          <div className="bg-surface border border-gray-200 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
              <div className="w-7 h-7 bg-brand-50 rounded-lg flex items-center justify-center">
                <ShoppingBag size={13} className="text-brand-600" />
              </div>
              <h2 className="font-semibold text-gray-900 text-sm">
                Order History
                <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md text-xs">
                  {customer.orders.length}
                </span>
              </h2>
            </div>
            {customer.orders.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">No orders yet</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {["Order #", "Date", "Total", "Status", "Payment", ""].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {customer.orders.map((o: any) => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-brand-600 font-semibold">{o.orderNumber}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(o.orderDate)}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{formatINR(o.grandtotal)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ORDER_STATUS_COLORS[o.orderStatus as OrderStatus]}`}>
                          {ORDER_STATUS_LABELS[o.orderStatus as OrderStatus]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                          o.paymentMode === "COD" ? "bg-orange-100 text-orange-700" : "bg-brand-100 text-brand-700"
                        }`}>
                          {o.paymentMode ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/orders/${o.id}`}
                          className="text-xs text-brand-600 hover:underline font-semibold">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Returns */}
          {customer.returnOrders.length > 0 && (
            <div className="bg-surface border border-gray-200 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
                <div className="w-7 h-7 bg-orange-50 rounded-lg flex items-center justify-center">
                  <RotateCcw size={13} className="text-orange-600" />
                </div>
                <h2 className="font-semibold text-gray-900 text-sm">
                  Return Orders
                  <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md text-xs">
                    {customer.returnOrders.length}
                  </span>
                </h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {["Order #", "Requested", "Refund", "Status"].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {customer.returnOrders.map((r: any) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-brand-600 font-semibold">{r.orderNumber}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(r.returnRequestDate)}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-600">
                        {r.refundAmount ? formatINR(r.refundAmount) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          r.status === "APPROVED"  ? "bg-green-100 text-green-800"  :
                          r.status === "REJECTED"  ? "bg-red-100 text-red-800"     :
                          r.status === "COMPLETED" ? "bg-brand-100 text-brand-800"   :
                          "bg-yellow-100 text-yellow-800"
                        }`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Promo codes used */}
          {customer.customerPromocodes.length > 0 && (
            <div className="bg-surface border border-gray-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-purple-50 rounded-lg flex items-center justify-center">
                  <Tag size={13} className="text-purple-600" />
                </div>
                <h2 className="font-semibold text-gray-900 text-sm">Promo Codes Used</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {customer.customerPromocodes.map((cp: any) => (
                  <div key={cp.id} className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-100 rounded-xl">
                    <span className="font-mono text-xs font-bold text-purple-700">
                      {cp.promocode.promocode}
                    </span>
                    <span className="text-xs text-purple-500">
                      {cp.promocode.discountType === 1
                        ? `${cp.promocode.discount}%`
                        : `₹${cp.promocode.discount}`}
                    </span>
                    <span className={`text-xs font-semibold ${
                      cp.status === 2 ? "text-emerald-600" : "text-gray-400"
                    }`}>
                      {cp.status === 2 ? "Used" : "Applied"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right — Profile + Addresses */}
        <div className="space-y-4">

          {/* Profile */}
          <div className="bg-surface border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-brand-50 rounded-lg flex items-center justify-center">
                <User size={13} className="text-brand-600" />
              </div>
              <h2 className="font-semibold text-gray-900 text-sm">Profile</h2>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2.5">
                <Mail size={13} className="text-gray-400 mt-0.5 shrink-0" />
                <span className="text-gray-700 break-all">{customer.email}</span>
              </div>
              {customer.mobileNumber && (
                <div className="flex items-center gap-2.5">
                  <Phone size={13} className="text-gray-400 shrink-0" />
                  <span className="text-gray-700">{customer.mobileNumber}</span>
                </div>
              )}
              {customer.gender && (
                <div className="flex items-center gap-2.5">
                  <User size={13} className="text-gray-400 shrink-0" />
                  <span className="text-gray-700 capitalize">{customer.gender}</span>
                </div>
              )}
              <div className="flex items-center gap-2.5">
                <Hash size={13} className="text-gray-400 shrink-0" />
                <span className="text-gray-500 font-mono text-xs">{customer.uniqueId}</span>
              </div>
            </div>
          </div>

          {/* Occasion dates — power the reminder emails; editable by admin */}
          <div className="bg-surface border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-pink-50 rounded-lg flex items-center justify-center">
                <Calendar size={13} className="text-pink-600" />
              </div>
              <h2 className="font-semibold text-gray-900 text-sm">Occasion Dates</h2>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1">
                  <Cake size={12} className="text-gray-400" /> Birthday
                </span>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </label>
              <label className="block">
                <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1">
                  <Heart size={12} className="text-gray-400" /> Anniversary
                </span>
                <input
                  type="date"
                  value={anniversary}
                  onChange={(e) => setAnniversary(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </label>
              <button
                onClick={saveDates}
                disabled={savingDates}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                <Save size={14} /> {savingDates ? "Saving…" : "Save dates"}
              </button>
              <p className="text-xs text-gray-400">
                A reminder email is sent automatically ~{7} days before each date, every year.
              </p>
            </div>
          </div>

          {/* Addresses */}
          {customer.addresses.length > 0 && (
            <div className="bg-surface border border-gray-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
                  <MapPin size={13} className="text-emerald-600" />
                </div>
                <h2 className="font-semibold text-gray-900 text-sm">
                  Addresses
                  <span className="ml-1.5 px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                    {customer.addresses.length}
                  </span>
                </h2>
              </div>
              <div className="space-y-3">
                {customer.addresses.map((addr: any) => (
                  <div key={addr.id}
                    className={`p-3 rounded-xl border text-xs leading-relaxed ${
                      addr.isDefault
                        ? "border-brand-200 bg-brand-50"
                        : "border-gray-100 bg-gray-50"
                    }`}
                  >
                    {addr.isDefault && (
                      <span className="inline-block mb-1.5 px-2 py-0.5 bg-brand-100 text-brand-700 rounded-md text-xs font-semibold">
                        Default
                      </span>
                    )}
                    <p className="font-semibold text-gray-800">{addr.name}</p>
                    <p className="text-gray-500">{addr.phoneNumber}</p>
                    <p className="text-gray-600 mt-0.5">{addr.streetAddress}</p>
                    {addr.landmarks && <p className="text-gray-500">{addr.landmarks}</p>}
                    <p className="text-gray-600">{addr.city}, {addr.state}</p>
                    <p className="text-gray-500">{addr.country} — <span className="font-mono">{addr.pincode}</span></p>
                    {addr.addressType && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-surface border border-gray-200 text-gray-600 rounded-md capitalize">
                        {addr.addressType}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
