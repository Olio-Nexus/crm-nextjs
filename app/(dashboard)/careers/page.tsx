"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Briefcase, FileText, X, Mail, Phone, Calendar } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { TableLoading } from "@/components/shared/Spinner";

interface Application {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string | null;
  resumeUrl: string | null;
  message: string | null;
  status: string;
  createdAt: string;
}

export default function CareersPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Application | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: "10" });
    if (search) p.set("search", search);
    const res = await fetch(`/api/careers?${p}`);
    const data = await res.json();
    setApps(data.applications ?? []);
    setTotal(data.total ?? 0);
    setPages(data.totalPages ?? 1);
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    const t = setTimeout(() => load(), 300);
    return () => clearTimeout(t);
  }, [load]);

  // Auto-refresh so new applications appear without a manual reload.
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
        <h1 className="text-xl font-semibold text-gray-900">Careers</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {total} job application{total === 1 ? "" : "s"} received from the website
        </p>
      </div>

      <div className="bg-surface rounded-2xl border border-gray-200 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-gray-100">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search name, email, phone, role..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Name", "Email", "Phone", "Role", "Message", "Resume", "Date"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && <TableLoading colSpan={7} />}
              {!loading && apps.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <Briefcase size={32} className="mx-auto text-gray-200 mb-2" />
                    <p className="text-sm text-gray-400">No applications yet</p>
                  </td>
                </tr>
              )}
              {apps.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => setSelected(a)}
                  className="hover:bg-brand-50/40 transition-colors align-top cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{a.name}</td>
                  <td className="px-4 py-3 text-gray-500">{a.email}</td>
                  <td className="px-4 py-3 text-gray-500">{a.phone}</td>
                  <td className="px-4 py-3 text-gray-600">{a.role ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-md">{a.message ?? "—"}</td>
                  <td className="px-4 py-3">
                    {a.resumeUrl ? (
                      <a
                        href={a.resumeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-brand-600 hover:underline"
                      >
                        <FileText size={14} /> View
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{formatDate(a.createdAt)}</td>
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

      {/* Detail popup — full view of a single application. */}
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
                <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                  Job Application
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                  <Calendar size={12} /> {formatDate(selected.createdAt)}
                </span>
              </div>

              {selected.role && (
                <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Applied for
                  </p>
                  <p className="mt-0.5 flex items-center gap-2 text-base font-semibold text-brand-700">
                    <Briefcase size={16} /> {selected.role}
                  </p>
                </div>
              )}

              <h3 className="mt-5 text-sm font-semibold text-gray-900">
                {selected.name}
              </h3>
              <div className="mt-2 space-y-1.5 text-sm">
                <a
                  href={`mailto:${selected.email}`}
                  className="flex items-center gap-2 text-gray-600 hover:text-brand-600"
                >
                  <Mail size={14} className="text-gray-400" /> {selected.email}
                </a>
                <a
                  href={`tel:${selected.phone}`}
                  className="flex items-center gap-2 text-gray-600 hover:text-brand-600"
                >
                  <Phone size={14} className="text-gray-400" /> {selected.phone}
                </a>
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

              {selected.resumeUrl && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <a
                    href={selected.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
                  >
                    <FileText size={16} /> View resume
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
