"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Search, TrendingUp, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { TableLoading } from "@/components/shared/Spinner";

interface Category {
  id: number;
  name: string;
  slug: string;
  status: boolean;
  isFeatured: boolean;
  hsnCode: string | null;
  gst: number | null;
  createdAt: string;
  _count: { subCategories: number };
}

export default function CategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => { fetchCategories(); }, []);

  async function fetchCategories() {
    setLoading(true);
    const res = await fetch("/api/categories");
    const data = await res.json();
    setCategories(data);
    setLoading(false);
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete "${name}"? This will also delete all subcategories and products under it.`)) return;
    setDeleting(id);
    await fetch(`/api/categories/${id}`, { method: "DELETE" });
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setDeleting(null);
  }

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Categories</h1>
          <p className="text-sm text-gray-500 mt-0.5">{categories.length} total categories</p>
        </div>
        <Link
          href="/categories/new"
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          New Category
        </Link>
      </div>

      {/* Trending & Bestsellers — a merchandising category managed by product
          assignment (with a Corporate/Personal flag), not a normal category. */}
      <Link
        href="/categories/trending-bestsellers"
        className="flex items-center justify-between gap-3 mb-5 p-4 rounded-2xl border border-brand-200 bg-brand-50/60 hover:bg-brand-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center">
            <TrendingUp size={16} className="text-brand-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Trending &amp; Bestsellers</p>
            <p className="text-xs text-gray-500">
              Curate the storefront&rsquo;s &ldquo;Trending / Best Sellers&rdquo; — add products &amp; set Corporate / Personal.
            </p>
          </div>
        </div>
        <ChevronRight size={18} className="text-brand-500" />
      </Link>

      {/* Search */}
      <div className="bg-surface rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="relative max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Table */}
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">HSN / GST</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Subcategories</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Featured</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading && <TableLoading colSpan={7} />}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} className="py-12 text-center text-gray-400">No categories found</td></tr>
            )}
            {filtered.map((cat) => (
              <tr key={cat.id} onClick={() => router.push(`/categories/${cat.id}/edit`)} className="hover:bg-gray-50 transition-colors cursor-pointer">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{cat.name}</div>
                  <div className="text-xs text-gray-400">{cat.slug}</div>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {cat.hsnCode ? (
                    <span>{cat.hsnCode} <span className="text-gray-400">/ {cat.gst}%</span></span>
                  ) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-700">
                    {cat._count.subCategories} subcategories
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cat.isFeatured ? "bg-purple-100 text-purple-800" : "bg-gray-100 text-gray-500"}`}>
                    {cat.isFeatured ? "Yes" : "No"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cat.status ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}`}>
                    {cat.status ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{formatDate(cat.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                    <Link href={`/categories/${cat.id}/edit`} className="p-1.5 hover:bg-brand-50 rounded-lg text-gray-400 hover:text-brand-600 transition-colors">
                      <Pencil size={14} />
                    </Link>
                    <button
                      onClick={() => handleDelete(cat.id, cat.name)}
                      disabled={deleting === cat.id}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
