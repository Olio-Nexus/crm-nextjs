"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Pencil, Check, X, Star, ChevronUp, ChevronDown, Quote } from "lucide-react";
import { ImageUpload } from "@/components/shared/ImageUpload";

interface Testimonial {
  id: number;
  name: string;
  role?: string;
  quote: string;
  rating: number;
  avatar?: string;
  mode?: string;
  status?: boolean;
  sortOrder?: number;
}

const EMPTY = { name: "", role: "", quote: "", rating: 5, avatar: "", mode: "both", status: true };
const INPUT = "w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";

const MODE_GROUPS: { key: string; label: string }[] = [
  { key: "corporate", label: "Corporate" },
  { key: "personal", label: "Personal" },
  { key: "both", label: "Both (Corporate & Personal)" },
];

export default function TestimonialsPage() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => { load(); }, []);
  useEffect(() => { if (showForm) formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [showForm]);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/testimonials");
    setItems(await res.json());
    setLoading(false);
  }

  function openCreate() { setEditing(null); setForm(EMPTY); setShowForm(true); }
  function openEdit(t: Testimonial) {
    setEditing(t);
    setForm({ name: t.name, role: t.role ?? "", quote: t.quote, rating: t.rating ?? 5, avatar: t.avatar ?? "", mode: t.mode ?? "both", status: t.status ?? true });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name || !form.quote) return;
    setSaving(true);
    const url = editing ? `/api/testimonials/${editing.id}` : "/api/testimonials";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setSaving(false);
    if (!res.ok) { alert("Couldn't save the testimonial. Please try again."); return; }
    setShowForm(false);
    load();
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this testimonial?")) return;
    await fetch(`/api/testimonials/${id}`, { method: "DELETE" });
    setItems((x) => x.filter((t) => t.id !== id));
  }

  async function move(t: Testimonial, dir: -1 | 1) {
    const mode = t.mode || "both";
    const group = items.filter((x) => (x.mode || "both") === mode);
    const idx = group.findIndex((x) => x.id === t.id);
    const j = idx + dir;
    if (j < 0 || j >= group.length) return;
    const arr = [...group];
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    setReordering(true);
    await Promise.all(arr.map((x, i) => fetch(`/api/testimonials/${x.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: i }) })));
    setReordering(false);
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Client Testimonials</h1>
          <p className="text-sm text-gray-500 mt-0.5">{items.length} testimonials — shown in the storefront testimonials carousel</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors">
          <Plus size={15} /> Add Testimonial
        </button>
      </div>

      {showForm && (
        <div ref={formRef} className="bg-surface border-2 border-brand-500 rounded-2xl p-6 mb-5 space-y-4 scroll-mt-4">
          <h2 className="font-semibold text-gray-900">{editing ? "Edit Testimonial" : "New Testimonial"}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={INPUT} placeholder="Priya Sharma" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Role / Company</label>
              <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={INPUT} placeholder="HR Manager, JP Morgan" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Testimonial *</label>
            <textarea value={form.quote} onChange={(e) => setForm({ ...form, quote: e.target.value })} rows={3} className={INPUT} placeholder="Plattera made our Diwali gifting effortless..." />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Rating</label>
              <select value={form.rating} onChange={(e) => setForm({ ...form, rating: parseInt(e.target.value) })} className={INPUT}>
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n > 1 ? "s" : ""}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Show In</label>
              <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} className={INPUT}>
                <option value="both">Both</option>
                <option value="corporate">Corporate only</option>
                <option value="personal">Personal only</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Photo (optional)</label>
              <div className="flex items-center gap-2">
                {form.avatar && <img src={form.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />}
                <ImageUpload folder="testimonials" label={form.avatar ? "Change" : "Upload"} onUploaded={(url) => setForm({ ...form, avatar: url })} />
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.status} onChange={(e) => setForm({ ...form, status: e.target.checked })} className="w-4 h-4 accent-brand-600" />
            <span className="text-sm text-gray-700">Active (show on storefront)</span>
          </label>
          <div className="flex items-center gap-3 pt-2">
            <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50">
              <Check size={14} /> {saving ? "Saving..." : "Save Testimonial"}
            </button>
            <button onClick={() => setShowForm(false)} className="inline-flex items-center gap-2 px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-semibold rounded-xl">
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-gray-400">Loading...</div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center bg-surface border border-gray-200 rounded-2xl">
          <Quote size={32} className="mx-auto text-gray-200 mb-2" />
          <p className="text-sm text-gray-400">No testimonials yet — click Add Testimonial to create one</p>
        </div>
      ) : (
        <div className="space-y-8">
          {MODE_GROUPS.map(({ key, label }) => {
            const group = items.filter((t) => (t.mode || "both") === key);
            if (group.length === 0) return null;
            return (
              <section key={key}>
                <h2 className="text-sm font-semibold text-gray-700 mb-3">{label} <span className="font-normal text-gray-400">({group.length})</span></h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {group.map((t, i) => (
                    <div key={t.id} className="bg-surface border border-gray-200 rounded-2xl p-4">
                      <div className="flex items-start gap-3">
                        {t.avatar ? (
                          <img src={t.avatar} alt={t.name} className="h-11 w-11 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="h-11 w-11 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center font-semibold shrink-0">{t.name.charAt(0)}</div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                          {t.role && <p className="text-xs text-gray-500">{t.role}</p>}
                          <div className="flex gap-0.5 mt-1">
                            {Array.from({ length: 5 }).map((_, s) => (
                              <Star key={s} size={12} className={s < t.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"} />
                            ))}
                          </div>
                        </div>
                        {!t.status && <span className="text-[10px] font-semibold uppercase text-gray-400 shrink-0">Hidden</span>}
                      </div>
                      <p className="mt-3 text-sm text-gray-600 line-clamp-3">&ldquo;{t.quote}&rdquo;</p>
                      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => move(t, -1)} disabled={i === 0 || reordering} title="Move up" className="p-1.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-brand-600 disabled:opacity-30"><ChevronUp size={14} /></button>
                          <button onClick={() => move(t, 1)} disabled={i === group.length - 1 || reordering} title="Move down" className="p-1.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-brand-600 disabled:opacity-30"><ChevronDown size={14} /></button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => openEdit(t)} className="p-1.5 hover:bg-brand-50 rounded-lg text-gray-400 hover:text-brand-600"><Pencil size={14} /></button>
                          <button onClick={() => handleDelete(t.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
