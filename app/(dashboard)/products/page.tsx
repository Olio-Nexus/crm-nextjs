"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Search, Package, Upload, Download } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { TableLoading } from "@/components/shared/Spinner";

interface Product {
  id: number;
  productName: string;
  productId: string;
  status: boolean;
  isFeatured: boolean;
  isNew: boolean;
  isBestSeller: boolean;
  createdAt: string;
  subcategory: { name: string; category: { name: string } };
  _count: { variations: number };
  variations: { price: number; specialPrice: number | null; stock: number }[];
}

interface PaginatedResponse {
  products: Product[];
  total: number;
  totalPages: number;
  page: number;
}

export default function ProductsPage() {
  const router = useRouter();
  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    created: number;
    failed: number;
    errors: { row: number; message: string }[];
  } | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "10" });
    if (search) params.set("search", search);
    const res = await fetch(`/api/products?${params}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    const t = setTimeout(fetchProducts, 300);
    return () => clearTimeout(t);
  }, [fetchProducts]);

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    fetchProducts();
    setDeleting(null);
  }

  async function handleBulkUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/products/bulk-upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        setUploadResult({ created: 0, failed: 0, errors: [{ row: 0, message: json.error ?? "Upload failed." }] });
      } else {
        setUploadResult(json);
        fetchProducts();
      }
    } catch {
      setUploadResult({ created: 0, failed: 0, errors: [{ row: 0, message: "Upload failed." }] });
    } finally {
      setUploading(false);
    }
  }

  const products = data?.products ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.total ?? 0} total products</p>
        </div>
        <div className="flex items-center gap-2">
          {/* File download from an API route — a plain <a> is correct here. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/api/products/bulk-template"
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors"
          >
            <Download size={16} /> Template
          </a>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <Upload size={16} /> {uploading ? "Uploading…" : "Bulk Upload"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            onChange={handleBulkUpload}
            className="hidden"
          />
          <Link href="/products/new"
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus size={16} /> New Product
          </Link>
        </div>
      </div>

      {uploadResult && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-surface p-4 text-sm">
          <div className="flex items-center justify-between">
            <p className="font-medium text-gray-900">
              Bulk upload:{" "}
              <span className="text-brand-700">{uploadResult.created} created</span>
              {uploadResult.failed > 0 && (
                <span className="text-red-600">, {uploadResult.failed} skipped</span>
              )}
            </p>
            <button
              onClick={() => setUploadResult(null)}
              className="text-gray-400 hover:text-gray-700"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
          {uploadResult.errors.length > 0 && (
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-gray-600">
              {uploadResult.errors.map((er, i) => (
                <li key={i}>
                  {er.row > 0 ? `Row ${er.row}: ` : ""}
                  {er.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="bg-surface rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="relative max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search products..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading && <TableLoading colSpan={6} />}
            {!loading && products.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center">
                  <Package size={32} className="mx-auto text-gray-200 mb-2" />
                  <p className="text-gray-400 text-sm">No products found</p>
                </td>
              </tr>
            )}
            {products.map((p) => {
              const minPrice = p.variations.length
                ? Math.min(...p.variations.map((v) => Number(v.specialPrice ?? v.price)))
                : null;
              const totalStock = p.variations.reduce((sum, v) => sum + v.stock, 0);
              return (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/products/${p.id}/edit`)}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{p.productName}</div>
                    <div className="text-xs text-gray-400">ID: {p.productId} · {p._count.variations} variation{p._count.variations !== 1 ? "s" : ""}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <div className="text-xs text-gray-400">{p.subcategory.category.name}</div>
                    <div>{p.subcategory.name}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {minPrice !== null ? formatINR(minPrice) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${totalStock > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {totalStock} in stock
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${p.status ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}`}>
                      {p.status ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div
                      className="flex items-center gap-2 justify-end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link href={`/products/${p.id}/edit`} className="p-1.5 hover:bg-brand-50 rounded-lg text-gray-400 hover:text-brand-600 transition-colors">
                        <Pencil size={14} />
                      </Link>
                      <button onClick={() => handleDelete(p.id, p.productName)} disabled={deleting === p.id}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm">
            <span className="text-gray-500">
              Showing {(page - 1) * 10 + 1}–{Math.min(page * 10, data.total)} of {data.total}
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => p - 1)} disabled={page === 1}
                className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors">
                Previous
              </button>
              <span className="px-3 py-1.5 text-gray-700">{page} / {data.totalPages}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={page === data.totalPages}
                className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
