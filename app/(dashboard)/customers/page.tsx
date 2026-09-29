"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Eye, Users, Filter, Download, Upload, FileDown, X } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { TableLoading } from "@/components/shared/Spinner";

interface Customer {
  id: number;
  name: string;
  email: string;
  mobileNumber: string | null;
  gender: string | null;
  status: boolean;
  createdAt: string;
  _count: { orders: number; wishlists: number };
}

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total,     setTotal]     = useState(0);
  const [pages,     setPages]     = useState(1);
  const [page,      setPage]      = useState(1);
  const [search,    setSearch]    = useState("");
  const [status,    setStatus]    = useState("");
  const [loading,   setLoading]   = useState(true);

  const fileInput = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    created: number;
    updated: number;
    failed: number;
    warnings?: { row: number; message: string }[];
    errors?: { row: number; message: string }[];
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: "10" });
    if (search) p.set("search", search);
    if (status) p.set("status", status);
    const res  = await fetch(`/api/customers?${p}`);
    const data = await res.json();
    setCustomers(data.customers ?? []);
    setTotal(data.total         ?? 0);
    setPages(data.totalPages    ?? 1);
    setLoading(false);
  }, [page, search, status]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  async function handleImport(file: File) {
    setImporting(true);
    setImportResult(null);
    setImportError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/customers/import", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error ?? "Import failed. Please use the provided template.");
      } else {
        setImportResult(data);
        await load(); // refresh the list with the imported customers
      }
    } catch {
      setImportError("Import failed. Please try again.");
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = ""; // allow re-selecting the same file
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} registered customers</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Download the import template */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/api/customers/import-template"
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
          >
            <FileDown size={16} /> Template
          </a>
          {/* Import filled template */}
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImport(f);
            }}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 border border-brand-600 text-brand-700 hover:bg-brand-50 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <Upload size={16} /> {importing ? "Importing…" : "Import from Excel"}
          </button>
          {/* File download from an API route — a plain <a> is correct here. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/api/customers/export"
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Download size={16} /> Export to Excel
          </a>
        </div>
      </div>

      {/* Import result / error banner */}
      {importError && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <span>{importError}</span>
          <button onClick={() => setImportError(null)} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}
      {importResult && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-surface p-4 text-sm">
          <div className="flex items-start justify-between">
            <p className="font-semibold text-gray-900">
              Import complete —{" "}
              <span className="text-green-700">{importResult.created} created</span>,{" "}
              <span className="text-brand-700">{importResult.updated} updated</span>
              {importResult.failed > 0 && (
                <>, <span className="text-red-700">{importResult.failed} failed</span></>
              )}
            </p>
            <button onClick={() => setImportResult(null)} aria-label="Dismiss">
              <X size={16} className="text-gray-400" />
            </button>
          </div>
          {!!importResult.warnings?.length && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-amber-700">
              {importResult.warnings.map((w, i) => (
                <li key={i}>Row {w.row}: {w.message}</li>
              ))}
            </ul>
          )}
          {!!importResult.errors?.length && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-red-600">
              {importResult.errors.map((er, i) => (
                <li key={i}>Row {er.row}: {er.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="bg-surface rounded-2xl border border-gray-200 overflow-hidden">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-gray-100">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search name, email, phone..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400" />
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">All Customers</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {["Customer", "Email", "Phone", "Gender", "Orders", "Status", "Joined", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading && <TableLoading colSpan={8} />}
            {!loading && customers.length === 0 && (
              <tr>
                <td colSpan={8} className="py-16 text-center">
                  <Users size={32} className="mx-auto text-gray-200 mb-2" />
                  <p className="text-sm text-gray-400">No customers found</p>
                </td>
              </tr>
            )}
            {customers.map((c) => (
              <tr key={c.id} onClick={() => router.push(`/customers/${c.id}`)} className="hover:bg-gray-50 transition-colors cursor-pointer">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-brand-600">
                        {c.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <span className="font-semibold text-gray-900 text-sm">{c.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500 text-sm">{c.email}</td>
                <td className="px-4 py-3 text-gray-500 text-sm">{c.mobileNumber ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500 text-sm capitalize">{c.gender ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-50 text-brand-700 rounded-lg text-xs font-semibold">
                    {c._count.orders} orders
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                    c.status ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
                  }`}>
                    {c.status ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(c.createdAt)}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/customers/${c.id}`} onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                  >
                    <Eye size={12} /> View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {pages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm">
            <span className="text-gray-500">
              Page {page} of {pages} — {total} customers
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
                className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors text-sm"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page === pages}
                className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors text-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
