/**
 * The CRM tabs that can be granted per user (Admin Users → Access). Keys are the
 * page hrefs, matched against the sidebar. Order mirrors the sidebar.
 */
export const MANAGEABLE_TABS: { key: string; label: string }[] = [
  { key: "/dashboard", label: "Dashboard" },
  { key: "/products", label: "Products" },
  { key: "/categories", label: "Categories" },
  { key: "/customers", label: "Customers" },
  { key: "/reviews", label: "Reviews" },
  { key: "/enquiries", label: "Leads" },
  { key: "/careers", label: "Careers" },
  { key: "/banners", label: "Home Banners" },
  { key: "/testimonials", label: "Testimonials" },
  { key: "/blogs", label: "Blogs" },
  { key: "/reports", label: "Reports" },
  { key: "/users", label: "Admin Users" },
  { key: "/settings", label: "Settings" },
  { key: "/settings/notifications", label: "Notifications" },
];

/**
 * Can this user see a given tab href?
 *  - SUPER_ADMIN sees everything.
 *  - An empty allow-list means "all tabs" (default, so nobody is locked out).
 *  - Otherwise, only the tabs explicitly granted.
 */
export function canAccessTab(
  href: string,
  role: string | undefined,
  allowedTabs: string[] | undefined,
): boolean {
  if (role === "SUPER_ADMIN") return true;
  if (!allowedTabs || allowedTabs.length === 0) return true;
  return allowedTabs.includes(href);
}
