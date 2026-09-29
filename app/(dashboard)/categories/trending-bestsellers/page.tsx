"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Plus, Trash2, TrendingUp, Package } from "lucide-react";

interface Member {
  id: number;
  name: string;
  sku: string;
  image: string | null;
  status: boolean;
  modes: string[];
  category: string | null;
}
interface SearchProduct {
  id: number;
  productName: string;
  productId: string;
}

const MODES = [
  { key: "corporate", label: "Corporate" },
  { key: "personal", label: "Personal" },
];

export default function TrendingBestsellersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchProduct[]>([]);
  const [searching, setSearching] = useState(false);
  // Mode selection for a product being added, keyed by product id.
  const [addModes, setAddModes] = useState<Record<number, string[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/trending");
    const data = await res.json();
    setMembers(data.products ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    if (!search.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearching(true);
    const t = setTimeout(async () => {
      const res = await fetch(`/api/products?search=${encodeURIComponent(search)}&limit=15`);
      const data = await res.json();
      setResults(data.products ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const memberIds = new Set(members.map((m) => m.id));

  async function save(productId: number, modes: string[]) {
    if (modes.length === 0) return removeMember(productId);
    await fetch("/api/trending", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, modes }),
    });
    await load();
  }

  async function removeMember(productId: number) {
    await fetch(`/api/trending?productId=${productId}`, { method: "DELETE" });
    await load();
  }

  // Toggle a mode on an already-assigned member (persists immediately).
  function toggleMemberMode(m: Member, mode: string) {
    const next = m.modes.includes(mode)
      ? m.modes.filter((x) => x !== mode)
      : [...m.modes, mode];
    save(m.id, next);
  }

  const pickAddMode = (pid: number, mode: string) =>
    setAddModes((prev) => {
      const cur = prev[pid] ?? ["corporate", "personal"];
      const next = cur.includes(mode) ? cur.filter((x) => x !== mode) : [...cur, mode];
      return { ...prev, [pid]: next };
    });

  return (
    <div className="max-w-5xl pb-12">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/categories"
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-surface hover:bg-gray-50 text-gray-400"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp size={18} className="text-brand-600" /> Trending &amp; Bestsellers
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Products shown under &ldquo;Trending / Best Sellers&rdquo; on the storefront. Set
            Corporate / Personal per product to control which storefront it appears on.
          </p>
        </div>
      </div>

      {/* Add products */}
      <div className="bg-surface border border-gray-200 rounded-2xl p-5 mb-5">
        <p className="text-sm font-semibold text-gray-900 mb-3">Add a product</p>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products by name or SKU..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        {search.trim() && (
          <div className="mt-3 max-h-72 overflow-y-auto divide-y divide-gray-50 border border-gray-100 rounded-xl">
            {searching && <p className="px-4 py-3 text-sm text-gray-400">Searching…</p>}
            {!searching && results.length === 0 && (
              <p className="px-4 py-3 text-sm text-gray-400">No products found.</p>
            )}
            {results.map((p) => {
              const already = memberIds.has(p.id);
              const modes = addModes[p.id] ?? ["corporate", "personal"];
              return (
                <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.productName}</p>
                    <p className="text-xs text-gray-400">SKU: {p.productId}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!already &&
                      MODES.map((mo) => (
                        <button
                          key={mo.key}
                          type="button"
                          onClick={() => pickAddMode(p.id, mo.key)}
                          className={`px-2 py-1 rounded-md text-xs border transition-colors ${
                            modes.includes(mo.key)
                              ? "border-brand-600 bg-brand-50 text-brand-700 font-medium"
                              : "border-gray-200 text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          {mo.label}
                        </button>
                      ))}
                    <button
                      onClick={() => save(p.id, modes)}
                      disabled={already || modes.length === 0}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        already
                          ? "bg-gray-100 text-gray-400 cursor-default"
                          : modes.length === 0
                            ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                            : "bg-brand-600 text-white hover:bg-brand-700"
                      }`}
                    >
                      {already ? "Added" : <><Plus size={12} /> Add</>}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Members */}
      <div className="bg-surface border border-gray-200 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <Package size={14} className="text-brand-600" />
          <h2 className="font-semibold text-gray-900 text-sm">
            Products in Trending &amp; Bestsellers
            <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md text-xs">
              {members.length}
            </span>
          </h2>
        </div>
        {loading ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400">Loading…</p>
        ) : members.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400">
            No products yet — search above to add some.
          </p>
        ) : (
          <div className="divide-y divide-gray-50">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  {m.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.image} alt="" className="w-9 h-9 rounded-lg object-cover bg-gray-100 shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <Package size={14} className="text-gray-300" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.name}</p>
                    <p className="text-xs text-gray-400">
                      SKU: {m.sku}
                      {m.category ? ` · ${m.category}` : ""}
                      {!m.status ? " · Inactive" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {MODES.map((mo) => (
                    <button
                      key={mo.key}
                      type="button"
                      onClick={() => toggleMemberMode(m, mo.key)}
                      className={`px-2 py-1 rounded-md text-xs border transition-colors ${
                        m.modes.includes(mo.key)
                          ? "border-brand-600 bg-brand-50 text-brand-700 font-medium"
                          : "border-gray-200 text-gray-400 hover:bg-gray-50"
                      }`}
                    >
                      {mo.label}
                    </button>
                  ))}
                  <button
                    onClick={() => removeMember(m.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
