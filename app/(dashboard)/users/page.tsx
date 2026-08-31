"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Trash2, UserCog, Shield, SlidersHorizontal, X } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { MANAGEABLE_TABS } from "@/lib/tabs";

interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
  allowedTabs: string[];
  createdAt: string;
}

const ROLE_STYLES: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-800",
  ADMIN:       "bg-brand-100 text-brand-800",
  STAFF:       "bg-gray-100 text-gray-600",
};

export default function UsersPage() {
  const [users,    setUsers]    = useState<AdminUser[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [editing,  setEditing]  = useState<AdminUser | null>(null);
  const [editRole, setEditRole] = useState("STAFF");
  const [editTabs, setEditTabs] = useState<string[]>([]);
  const [saving,   setSaving]   = useState(false);

  async function load() {
    setLoading(true);
    const res  = await fetch("/api/users");
    const data = await res.json();
    setUsers(data);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  function openAccess(u: AdminUser) {
    setEditing(u);
    setEditRole(u.role);
    setEditTabs(u.allowedTabs ?? []);
  }
  function toggleTab(key: string) {
    setEditTabs((t) => (t.includes(key) ? t.filter((x) => x !== key) : [...t, key]));
  }
  async function saveAccess() {
    if (!editing) return;
    setSaving(true);
    const res = await fetch(`/api/users/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: editRole, allowedTabs: editTabs }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers((list) => list.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
      setEditing(null);
    }
    setSaving(false);
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Remove admin user "${name}"?`)) return;
    setDeleting(id);
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    setUsers((u) => u.filter((x) => x.id !== id));
    setDeleting(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Admin Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} team members</p>
        </div>
        <Link href="/users/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors">
          <Plus size={15} /> Add User
        </Link>
      </div>

      {/* Role Legend */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs text-gray-400 font-medium">Roles:</span>
        {Object.entries(ROLE_STYLES).map(([role, cls]) => (
          <span key={role} className={`px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>
            {role.replace("_", " ")}
          </span>
        ))}
      </div>

      <div className="bg-surface border border-gray-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {["User", "Email", "Role", "Joined", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading && <tr><td colSpan={5} className="py-12 text-center text-gray-400">Loading...</td></tr>}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={5} className="py-16 text-center">
                  <UserCog size={28} className="mx-auto text-gray-200 mb-2" />
                  <p className="text-sm text-gray-400">No admin users found</p>
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-brand-600">
                        {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <span className="font-semibold text-gray-900">{u.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${ROLE_STYLES[u.role]}`}>
                    {u.role === "SUPER_ADMIN" && <Shield size={10} />}
                    {u.role.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openAccess(u)} title="Manage tab access"
                      className="p-1.5 hover:bg-brand-50 rounded-lg text-gray-400 hover:text-brand-600 transition-colors">
                      <SlidersHorizontal size={14} />
                    </button>
                    <button onClick={() => handleDelete(u.id, u.name)} disabled={deleting === u.id}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Access editor */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-6"
          onClick={() => setEditing(null)}
        >
          <div
            className="relative mt-10 w-full max-w-lg rounded-2xl border border-gray-200 bg-surface shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setEditing(null)} aria-label="Close"
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-700">
              <X size={18} />
            </button>
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900">Access for {editing.name}</h2>
              <p className="mt-1 text-sm text-gray-500">
                Choose which tabs this user can open. Leave everything unchecked to give <strong>full access</strong>. A Super Admin always sees every tab.
              </p>

              <label className="mt-5 block text-sm font-semibold text-gray-700">Role</label>
              <select value={editRole} onChange={(e) => setEditRole(e.target.value)}
                className="mt-1.5 w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="SUPER_ADMIN">Super Admin — full access</option>
                <option value="ADMIN">Admin</option>
                <option value="STAFF">Staff</option>
              </select>

              <div className={`mt-5 ${editRole === "SUPER_ADMIN" ? "opacity-40 pointer-events-none" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">Tabs this user can access</span>
                  <div className="flex gap-3 text-xs">
                    <button type="button" onClick={() => setEditTabs(MANAGEABLE_TABS.map((t) => t.key))} className="text-brand-600 hover:underline">All</button>
                    <button type="button" onClick={() => setEditTabs([])} className="text-gray-500 hover:underline">None (= full access)</button>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {MANAGEABLE_TABS.map((t) => (
                    <label key={t.key} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 py-1">
                      <input type="checkbox" checked={editTabs.includes(t.key)} onChange={() => toggleTab(t.key)}
                        className="w-4 h-4 accent-brand-600" />
                      <span>{t.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button onClick={() => setEditing(null)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={saveAccess} disabled={saving}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50">
                  {saving ? "Saving…" : "Save access"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
