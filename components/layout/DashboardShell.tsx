"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

/**
 * Client shell holding the mobile-drawer state so the Header's hamburger can
 * open the Sidebar. Desktop keeps the sidebar static; mobile slides it in.
 */
export default function DashboardShell({
  user,
  role,
  allowedTabs,
  children,
}: {
  user?: { name?: string | null; email?: string | null };
  role?: string;
  allowedTabs?: string[];
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        role={role}
        allowedTabs={allowedTabs}
      />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Header user={user} onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
