"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Briefcase, FileText } from "lucide-react";
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

  const load = useCallback(async () => {
    setLoading(true);
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
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

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
                <tr key={a.id} className="hover:bg-gray-50 transition-colors align-top">
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
    </div>
  );
}
