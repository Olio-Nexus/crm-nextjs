"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Pencil, Image, Check, X, ChevronUp, ChevronDown } from "lucide-react";
import { ImageUpload } from "@/components/shared/ImageUpload";

interface Banner {
  id: number;
  bannerImg: string;
  title: string;
  description: string;
  btnText: string;
  btnLink?: string;
  mode?: string;
  status?: boolean;
  sortOrder?: number;
}

const EMPTY = { bannerImg: "", title: "", description: "", btnText: "", btnLink: "", mode: "both", status: true };

const INPUT = "w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";

/** Display groups; banners are ordered within each group by sortOrder. */
const MODE_GROUPS: { key: string; label: string }[] = [
  { key: "corporate", label: "Corporate Banners" },
  { key: "personal", label: "Personal Banners" },
  { key: "both", label: "Both (Corporate & Personal)" },
];

export default function BannersPage() {
  const [banners,    setBanners]    = useState<Banner[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [editing,    setEditing]    = useState<Banner | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => { load(); }, []);

  // The form renders above the list — scroll it into view when it opens so an
  // edit click on a card lower down doesn't look like nothing happened.
  useEffect(() => {
    if (showForm) formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [showForm]);

  async function load() {
    setLoading(true);
    const res  = await fetch("/api/banners");
    const data = await res.json();
    setBanners(data);
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setShowForm(true);
  }

  function openEdit(b: Banner) {
    setEditing(b);
    setForm({
      bannerImg: b.bannerImg, title: b.title, description: b.description, btnText: b.btnText,
      btnLink: b.btnLink ?? "", mode: b.mode ?? "both", status: b.status ?? true,
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.bannerImg || !form.title || !form.description || !form.btnText) return;
    setSaving(true);
    const url    = editing ? `/api/banners/${editing.id}` : "/api/banners";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setSaving(false);
    if (!res.ok) {
      alert("Couldn't save the banner. Please try again.");
      return;
    }
    setShowForm(false);
    load();
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this banner?")) return;
    setDeleting(id);
    await fetch(`/api/banners/${id}`, { method: "DELETE" });
    setBanners((b) => b.filter((x) => x.id !== id));
    setDeleting(null);
  }

  /** Move a banner up/down within its own mode group and persist the new order. */
  async function move(b: Banner, dir: -1 | 1) {
    const mode = b.mode || "both";
    const group = banners.filter((x) => (x.mode || "both") === mode);
    const idx = group.findIndex((x) => x.id === b.id);
    const j = idx + dir;
    if (j < 0 || j >= group.length) return;
    const arr = [...group];
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    setReordering(true);
    // Reassign a clean 0..n-1 order for the whole group.
    await Promise.all(
      arr.map((x, i) =>
        fetch(`/api/banners/${x.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortOrder: i }),
        }),
      ),
    );
    setReordering(false);
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Home Banners</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {banners.length} banners — use the arrows to set the order within each group
          </p>
        </div>
        <button onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors">
          <Plus size={15} /> Add Banner
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div ref={formRef} className="bg-surface border-2 border-brand-500 rounded-2xl p-6 mb-5 space-y-4 scroll-mt-4">
          <h2 className="font-semibold text-gray-900">{editing ? "Edit Banner" : "New Banner"}</h2>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Banner Image URL *</label>
            <p className="text-xs text-gray-500 mb-1.5">
              Recommended size: <strong>1920 × 800 px</strong> (wide landscape, 12:5). JPG or PNG, under 25&nbsp;MB. Keep key visuals slightly right-of-centre — text sits on the left.
            </p>
            <input value={form.bannerImg} onChange={(e) => setForm({ ...form, bannerImg: e.target.value })}
              className={INPUT} placeholder="https://your-cdn.com/banner.jpg" />
            <div className="mt-2">
              <ImageUpload
                folder="banners"
                onUploaded={(url) => setForm({ ...form, bannerImg: url })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Title *</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={INPUT} placeholder="Premium Cookware" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Button Text *</label>
              <input value={form.btnText} onChange={(e) => setForm({ ...form, btnText: e.target.value })}
                className={INPUT} placeholder="Shop Now" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description *</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2} className={INPUT} placeholder="Discover our premium collection..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Button Link</label>
              <input value={form.btnLink} onChange={(e) => setForm({ ...form, btnLink: e.target.value })}
                className={INPUT} placeholder="/products or /category/hampers" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Show In</label>
              <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} className={INPUT}>
                <option value="both">Both (Corporate &amp; Personal)</option>
                <option value="corporate">Corporate only</option>
                <option value="personal">Personal only</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.status} onChange={(e) => setForm({ ...form, status: e.target.checked })}
              className="w-4 h-4 accent-brand-600" />
            <span className="text-sm text-gray-700">Active (show on storefront)</span>
          </label>
          <div className="flex items-center gap-3 pt-2">
            <button onClick={handleSave} disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50">
              <Check size={14} /> {saving ? "Saving..." : "Save Banner"}
            </button>
            <button onClick={() => setShowForm(false)}
              className="inline-flex items-center gap-2 px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-semibold rounded-xl">
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Banners grouped by mode, ordered by sortOrder */}
      {loading ? (
        <div className="py-16 text-center text-gray-400">Loading...</div>
      ) : banners.length === 0 ? (
        <div className="py-16 text-center bg-surface border border-gray-200 rounded-2xl">
          <Image size={32} className="mx-auto text-gray-200 mb-2" />
          <p className="text-sm text-gray-400">No banners yet — click Add Banner to create one</p>
        </div>
      ) : (
        <div className="space-y-8">
          {MODE_GROUPS.map(({ key, label }) => {
            const group = banners.filter((b) => (b.mode || "both") === key);
            if (group.length === 0) return null;
            return (
              <section key={key}>
                <h2 className="text-sm font-semibold text-gray-700 mb-3">
                  {label} <span className="font-normal text-gray-400">({group.length})</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {group.map((b, i) => (
                    <div key={b.id} className="bg-surface border border-gray-200 rounded-2xl overflow-hidden">
                      {/* Preview */}
                      <div className="relative h-40 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
                        {b.bannerImg ? (
                          <img src={b.bannerImg} alt={b.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <Image size={32} className="text-gray-300" />
                          </div>
                        )}
                        <span className="absolute top-2 left-2 z-10 bg-brand-600 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-md ring-1 ring-white/40">
                          #{i + 1}
                        </span>
                        <div className="absolute inset-0 bg-black/30 flex flex-col justify-end p-4">
                          <p className="text-white font-bold text-lg leading-tight">{b.title}</p>
                          <p className="text-white/80 text-xs mt-0.5 line-clamp-1">{b.description}</p>
                          <span className="mt-2 inline-block bg-surface text-gray-900 text-xs font-semibold px-3 py-1 rounded-lg self-start">
                            {b.btnText}
                          </span>
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => move(b, -1)}
                            disabled={i === 0 || reordering}
                            title="Move up"
                            className="p-1.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-brand-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            onClick={() => move(b, 1)}
                            disabled={i === group.length - 1 || reordering}
                            title="Move down"
                            className="p-1.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-brand-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronDown size={14} />
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => openEdit(b)}
                            className="p-1.5 hover:bg-brand-50 rounded-lg text-gray-400 hover:text-brand-600 transition-colors">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleDelete(b.id)} disabled={deleting === b.id}
                            className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50">
                            <Trash2 size={14} />
                          </button>
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
