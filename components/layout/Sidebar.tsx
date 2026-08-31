"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { canAccessTab } from "@/lib/tabs";
import {
  LayoutDashboard, Package, Users,
  BarChart2, Image, Settings,
  X, UserCog, Layers,
  FileText, Bell, MessageSquare, Inbox, Briefcase, Quote,
  // Icons for tabs hidden until later (payment/order + Product Tags):
  // ShoppingBag, RotateCcw, Shield, RefreshCcw, CreditCard, Tag
} from "lucide-react";

const navGroups = [
  {
    label: null,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  // Order Management — hidden until checkout/Razorpay is live. Pages & APIs are
  // kept; uncomment this group (and its icons above) to restore the tabs.
  // {
  //   label: "Order Management",
  //   items: [
  //     { href: "/orders", label: "Current Orders", icon: ShoppingBag },
  //     { href: "/orders/past", label: "Past Orders", icon: FileText },
  //     { href: "/returns", label: "Returns", icon: RotateCcw },
  //     { href: "/returns/refunds", label: "Refunds", icon: RefreshCcw },
  //     { href: "/warranties", label: "Warranty Claims", icon: Shield },
  //   ],
  // },
  {
    label: "Catalog",
    items: [
      { href: "/products", label: "Products", icon: Package },
      { href: "/categories", label: "Categories", icon: Layers },
      // Sub Categories — hidden: they're auto-managed (one per category). Page &
      // API kept; uncomment to manage them manually again.
      // { href: "/categories/sub", label: "Sub Categories", icon: Layers },
    ],
  },
  {
    label: "Customers",
    items: [
      { href: "/customers", label: "Customers", icon: Users },
      { href: "/reviews", label: "Reviews", icon: MessageSquare },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/enquiries", label: "Leads", icon: Inbox },
      { href: "/careers", label: "Careers", icon: Briefcase },
      // Promo Codes — hidden until checkout/Razorpay is live (kept for later).
      // { href: "/promocodes", label: "Promo Codes", icon: Tag },
      { href: "/banners", label: "Home Banners", icon: Image },
      { href: "/testimonials", label: "Testimonials", icon: Quote },
      { href: "/blogs", label: "Blogs", icon: FileText },
    ],
  },
  {
    label: "Reports & Config",
    items: [
      { href: "/reports",                  label: "Reports",           icon: BarChart2  },
      { href: "/users",                    label: "Admin Users",       icon: UserCog    },
      { href: "/settings",                 label: "Settings",          icon: Settings   },
      // Tax Rules — out of scope (hidden from nav; page/API kept for later).
      // { href: "/settings/taxes",           label: "Tax Rules",         icon: Layers     },
      // Payment Providers — hidden until Razorpay is configured (kept for later).
      // { href: "/settings/payments",        label: "Payment Providers", icon: CreditCard },
      { href: "/settings/notifications",   label: "Notifications",     icon: Bell       },
      // Product Tags — hidden for now (not surfaced on the storefront; kept for later).
      // { href: "/products/tags",            label: "Product Tags",      icon: Tag        },
    ],
  },
];

export default function Sidebar({
  mobileOpen = false,
  onClose,
  role,
  allowedTabs,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
  role?: string;
  allowedTabs?: string[];
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-surface border-r border-gray-200 transition-transform duration-200",
          // Static on desktop; slide-in drawer on mobile.
          "lg:static lg:z-auto lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-4 border-b border-gray-200 shrink-0">
          <span className="font-semibold text-gray-900 text-lg truncate">CRM Admin</span>
          <button
            onClick={onClose}
            className="ml-auto p-1 rounded-lg hover:bg-gray-100 text-gray-400 lg:hidden"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
          {navGroups.map((group, gi) => {
            const items = group.items.filter((item) =>
              canAccessTab(item.href, role, allowedTabs),
            );
            if (items.length === 0) return null;
            return (
            <div key={gi} className="mb-2">
              {group.label && (
                <p className="px-2 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {group.label}
                </p>
              )}
              {items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors",
                      active
                        ? "bg-brand-50 text-brand-700 font-medium"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    )}
                  >
                    <Icon size={16} className="shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
