"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Filter, Inbox, X, Package, Mail, Phone, Calendar } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { TableLoading } from "@/components/shared/Spinner";

interface Enquiry {
  id: number;
  type: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  payload: Record<string, unknown> | null;
  status: string;
  createdAt: string;
}

const TYPE_STYLE: Record<string, string> = {
  contact: "bg-blue-100 text-blue-700",
  newsletter: "bg-purple-100 text-purple-700",
  quote: "bg-brand-100 text-brand-700",
  vendor: "bg-amber-100 text-amber-700",
  brochure: "bg-emerald-100 text-emerald-700",
};

/** Friendly label for a form type. */
const TYPE_LABEL: Record<string, string> = {
  contact: "Contact",
  newsletter: "Newsletter",
  quote: "Request a Quote",
  vendor: "Vendor",
  brochure: "Brochure",
};

// Friendly labels + display order for the payload fields the storefront sends.
const FIELD_LABELS: Record<string, string> = {
  product: "Product",
  company: "Company",
  occasion: "Occasion",
  quantity: "Quantity",
  budget: "Budget",
  deliveryDate: "Delivery date",
  customization: "Customization",
  role: "Role",
  resumeUrl: "Resume",
  message: "Message",
};
const HIDDEN_FIELDS = new Set(["source", "productSlug"]);
const FIELD_ORDER = [
  "product",
  "company",
  "occasion",
  "quantity",
  "budget",
  "deliveryDate",
  "customization",
];

/** "camelCase" / "snake_case" → "Camel Case". */
function humanize(key: string): string {
  const s = key.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtValue(v: unknown): string {
  if (Array.isArray(v)) return v.join(", ");
  if (v && typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** The requested product, if this lead carries one. */
function payloadProduct(payload: Record<string, unknown> | null): string | null {
  const p = payload?.product;
  return typeof p === "string" && p.trim() ? p : null;
}

/** Ordered, humanized [label, value] rows from a lead's payload (for the modal). */
function payloadRows(payload: Record<string, unknown> | null): [string, string][] {
  if (!payload) return [];
  return Object.entries(payload)
    .filter(
      ([k, v]) =>
        !HIDDEN_FIELDS.has(k) &&
        v != null &&
        v !== "" &&
        !(Array.isArray(v) && v.length === 0),
    )
    .sort(([a], [b]) => {
      const ia = FIELD_ORDER.indexOf(a);
      const ib = FIELD_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    })
    .map(([k, v]) => [FIELD_LABELS[k] ?? humanize(k), fmtValue(v)]);
}

/** Short one-liner used in the table's Details column. */
function payloadSummary(payload: Record<string, unknown> | null): string {
  return payloadRows(payload)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");
}

export default function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Enquiry | null>(null);

  // `silent` skips the loading spinner — used by the background auto-refresh so
  // the table updates without flashing.
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: "10" });
    if (search) p.set("search", search);
    if (type) p.set("type", type);
    const res = await fetch(`/api/enquiries?${p}`);
    const data = await res.json();
    setEnquiries(data.enquiries ?? []);
    setTotal(data.total ?? 0);
    setPages(data.totalPages ?? 1);
    setLoading(false);
  }, [page, search, type]);

  useEffect(() => {
    const t = setTimeout(() => load(), 300);
    return () => clearTimeout(t);
  }, [load]);

  // Auto-refresh in the background so new leads appear without a manual reload.
  useEffect(() => {
    const id = setInterval(() => load(true), 25000);
    return () => clearInterval(id);
  }, [load]);

  // Close the detail popup on Escape.
  useEffect(() => {
    if (!selected) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Leads &amp; Enquiries</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {total} submissions from the storefront forms
        </p>
      </div>

      <div className="bg-surface rounded-2xl border border-gray-200 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-gray-100">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search name, email, phone, message..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400" />
            <select
              value={type}
              onChange={(e) => { setType(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">All Types</option>
              <option value="contact">Contact</option>
              <option value="newsletter">Newsletter</option>
              <option value="quote">Quote</option>
              <option value="vendor">Vendor</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Type", "Name", "Email", "Phone", "Details", "Date"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && <TableLoading colSpan={6} />}
              {!loading && enquiries.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <Inbox size={32} className="mx-auto text-gray-200 mb-2" />
                    <p className="text-sm text-gray-400">No enquiries yet</p>
                  </td>
                </tr>
              )}
              {enquiries.map((e) => {
                const product = payloadProduct(e.payload);
                return (
                  <tr
                    key={e.id}
                    onClick={() => setSelected(e)}
                    className="hover:bg-brand-50/40 transition-colors align-top cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${TYPE_STYLE[e.type] ?? "bg-gray-100 text-gray-600"}`}>
                        {TYPE_LABEL[e.type] ?? e.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{e.name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{e.email ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{e.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-md">
                      {product && (
                        <p className="mb-1 inline-flex items-center gap-1.5 rounded-md bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                          <Package size={12} /> {product}
                        </p>
                      )}
                      {e.message && <p className="line-clamp-2">{e.message}</p>}
                      {payloadSummary(e.payload) && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-1">{payloadSummary(e.payload)}</p>
                      )}
                      {!product && !e.message && !payloadSummary(e.payload) && "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{formatDate(e.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm">
            <span className="text-gray-500">Page {page} of {pages} — {total} total</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => p - 1)} disabled={page === 1} className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors">Previous</button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page === pages} className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Detail popup — full, readable view of a single lead. */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-6"
          onClick={() => setSelected(null)}
        >
          <div
            className="relative mt-10 w-full max-w-lg rounded-2xl border border-gray-200 bg-surface shadow-xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <button
              onClick={() => setSelected(null)}
              aria-label="Close"
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="p-6">
              <div className="flex items-center gap-2">
                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${TYPE_STYLE[selected.type] ?? "bg-gray-100 text-gray-600"}`}>
                  {TYPE_LABEL[selected.type] ?? selected.type}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                  <Calendar size={12} /> {formatDate(selected.createdAt)}
                </span>
              </div>

              {payloadProduct(selected.payload) && (
                <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Quote requested for
                  </p>
                  <p className="mt-0.5 flex items-center gap-2 text-base font-semibold text-brand-700">
                    <Package size={16} /> {payloadProduct(selected.payload)}
                  </p>
                </div>
              )}

              <h3 className="mt-5 text-sm font-semibold text-gray-900">
                {selected.name ?? "—"}
              </h3>
              <div className="mt-2 space-y-1.5 text-sm">
                {selected.email && (
                  <a
                    href={`mailto:${selected.email}`}
                    className="flex items-center gap-2 text-gray-600 hover:text-brand-600"
                  >
                    <Mail size={14} className="text-gray-400" /> {selected.email}
                  </a>
                )}
                {selected.phone && (
                  <a
                    href={`tel:${selected.phone}`}
                    className="flex items-center gap-2 text-gray-600 hover:text-brand-600"
                  >
                    <Phone size={14} className="text-gray-400" /> {selected.phone}
                  </a>
                )}
              </div>

              {selected.message && (
                <div className="mt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    Message
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                    {selected.message}
                  </p>
                </div>
              )}

              {payloadRows(selected.payload).filter(([l]) => l !== "Product").length > 0 && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                    Details
                  </p>
                  <dl className="space-y-2">
                    {payloadRows(selected.payload)
                      .filter(([l]) => l !== "Product")
                      .map(([label, value]) => (
                        <div key={label} className="flex gap-3 text-sm">
                          <dt className="w-32 shrink-0 text-gray-500">{label}</dt>
                          <dd className="break-words text-gray-900">{value}</dd>
                        </div>
                      ))}
                  </dl>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
