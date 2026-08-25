"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Filter, Star, MessageSquare, Eye, EyeOff, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { TableLoading } from "@/components/shared/Spinner";

interface Review {
  id: number;
  rating: number;
  title: string | null;
  body: string;
  status: string;
  customerName: string | null;
  createdAt: string;
  product: { productName: string; urlSlug: string } | null;
  customer: { name: string; email: string } | null;
}

const INPUT = "w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";
const EMPTY = { productSlug: "", customerName: "", rating: 5, title: "", body: "", status: "approved" };

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={13} className={n <= rating ? "fill-amber-400 text-amber-400" : "text-gray-300"} />
      ))}
    </span>
  );
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Review | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const formRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: "10" });
    if (status) p.set("status", status);
    const res = await fetch(`/api/reviews?${p}`);
    const data = await res.json();
    setReviews(data.reviews ?? []);
    setTotal(data.total ?? 0);
    setPages(data.totalPages ?? 1);
    setLoading(false);
  }, [page, status]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);
  useEffect(() => { if (showForm) formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [showForm]);

  const setReviewStatus = async (id: number, next: "approved" | "hidden") => {
    await fetch(`/api/reviews/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
    load();
  };

  function openCreate() { setEditing(null); setForm(EMPTY); setShowForm(true); }
  function openEdit(r: Review) {
    setEditing(r);
    setForm({ productSlug: r.product?.urlSlug ?? "", customerName: r.customerName ?? r.customer?.name ?? "", rating: r.rating, title: r.title ?? "", body: r.body, status: r.status });
    setShowForm(true);
  }

  async function handleSave() {
    if (!editing && !form.productSlug) { alert("Enter the product URL slug or SKU."); return; }
    if (!form.body.trim()) { alert("Enter the review text."); return; }
    setSaving(true);
    const url = editing ? `/api/reviews/${editing.id}` : "/api/reviews";
    const method = editing ? "PUT" : "POST";
    const payload = editing
      ? { rating: form.rating, title: form.title, body: form.body, customerName: form.customerName, status: form.status }
      : form;
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || "Couldn't save the review."); return; }
    setShowForm(false);
    load();
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this review permanently?")) return;
    await fetch(`/api/reviews/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Reviews</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} product reviews — approved reviews show on the storefront</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors">
          <Plus size={15} /> Add Review
        </button>
      </div>

      {showForm && (
        <div ref={formRef} className="bg-surface border-2 border-brand-500 rounded-2xl p-6 mb-5 space-y-4 scroll-mt-4">
          <h2 className="font-semibold text-gray-900">{editing ? "Edit Review" : "New Review"}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Product (URL slug or SKU) {editing ? "" : "*"}</label>
              <input value={form.productSlug} onChange={(e) => setForm({ ...form, productSlug: e.target.value })} disabled={!!editing}
                className={`${INPUT} ${editing ? "bg-gray-50 text-gray-400" : ""}`} placeholder="stirrer-mug or PLT-0034" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Customer Name</label>
              <input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} className={INPUT} placeholder="Priya Sharma" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Rating</label>
              <select value={form.rating} onChange={(e) => setForm({ ...form, rating: parseInt(e.target.value) })} className={INPUT}>
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n > 1 ? "s" : ""}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={INPUT}>
                <option value="approved">Approved (shown)</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Title (optional)</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={INPUT} placeholder="Loved it!" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Review *</label>
            <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={3} className={INPUT} placeholder="Great quality and beautifully packed..." />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50">
              <Check size={14} /> {saving ? "Saving..." : "Save Review"}
            </button>
            <button onClick={() => setShowForm(false)} className="inline-flex items-center gap-2 px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-semibold rounded-xl">
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-surface rounded-2xl border border-gray-200 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400" />
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="">All Reviews</option>
              <option value="approved">Approved</option>
              <option value="hidden">Hidden</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Product", "Customer", "Rating", "Review", "Status", "Date", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && <TableLoading colSpan={7} />}
              {!loading && reviews.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <MessageSquare size={32} className="mx-auto text-gray-200 mb-2" />
                    <p className="text-sm text-gray-400">No reviews yet — customers can review a product once their order is delivered, or add one here</p>
                  </td>
                </tr>
              )}
              {reviews.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors align-top">
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-[160px]">{r.product?.productName ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">
                    <div>{r.customerName ?? r.customer?.name ?? "—"}</div>
                    {r.customer?.email && <div className="text-xs text-gray-400">{r.customer.email}</div>}
                  </td>
                  <td className="px-4 py-3"><Stars rating={r.rating} /></td>
                  <td className="px-4 py-3 text-gray-600 max-w-md">
                    {r.title && <p className="font-medium text-gray-800">{r.title}</p>}
                    <p>{r.body}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${r.status === "approved" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{formatDate(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {r.status === "approved" ? (
                        <button onClick={() => setReviewStatus(r.id, "hidden")} title="Hide" className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"><EyeOff size={14} /></button>
                      ) : (
                        <button onClick={() => setReviewStatus(r.id, "approved")} title="Approve" className="p-1.5 hover:bg-brand-50 rounded-lg text-brand-600"><Eye size={14} /></button>
                      )}
                      <button onClick={() => openEdit(r)} title="Edit" className="p-1.5 hover:bg-brand-50 rounded-lg text-gray-400 hover:text-brand-600"><Pencil size={14} /></button>
                      <button onClick={() => handleDelete(r.id)} title="Delete" className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
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
    </div>
  );
}
