"use client";

import { signOut } from "next-auth/react";
import { LogOut, Menu } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import NotificationBell from "./NotificationBell";

interface Props {
  user?: { name?: string | null; email?: string | null };
  onMenuClick?: () => void;
}

export default function Header({ user, onMenuClick }: Props) {
  return (
    <header className="h-16 bg-surface border-b border-gray-200 flex items-center px-4 sm:px-6 gap-2 sm:gap-4 shrink-0">
      <button
        onClick={onMenuClick}
        className="p-2 -ml-2 rounded-lg hover:bg-gray-100 text-gray-500 lg:hidden"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>
      <div className="flex-1" />
      <ThemeToggle />
      <NotificationBell />
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-gray-900 leading-none">{user?.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{user?.email}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
          title="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
