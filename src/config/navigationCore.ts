export type SalesSubSectionId =
  | "booking-invoice"
  | "payment-vouchers"
  | "refunds-voids"
  | "expenses";

export type NavIconKey =
  | "shield"
  | "layout-dashboard"
  | "receipt"
  | "users"
  | "bar-chart-3"
  | "message-square"
  | "building-2"
  | "calculator"
  | "bell"
  | "plane"
  | "settings"
  | "mail"
  | "book-open"
  | "file-text"
  | "credit-card"
  | "rotate-ccw";

export interface SalesSubSectionCore {
  id: SalesSubSectionId;
  label: string;
  fullLabel: string;
  href: string;
  iconKey: NavIconKey;
  iconColorClass: string;
}

export interface AppNavItemCore {
  id: string;
  label: string;
  mobileLabel?: string;
  description: string;
  href: string;
  iconKey: NavIconKey;
  colorClass?: string;
  adminOnly?: boolean;
  badgeKey?: "unreadAlerts";
  placements: {
    desktopSidebar: boolean;
    mobileBottomBar: boolean;
    mobileMore: boolean;
  };
  subItems?: readonly SalesSubSectionCore[];
  matchPrefixes: readonly string[];
  matchSearch?: Readonly<Record<string, string>>;
  exact?: boolean;
}

export const SALES_SUB_SECTIONS_CORE: readonly SalesSubSectionCore[] = [
  {
    id: "booking-invoice",
    label: "Invoice",
    fullLabel: "Booking Invoice",
    href: "/app/sales-expenses?tab=booking-invoice",
    iconKey: "file-text",
    iconColorClass: "text-blue-600",
  },
  {
    id: "payment-vouchers",
    label: "Voucher",
    fullLabel: "Payment Vouchers",
    href: "/app/sales-expenses?tab=payment-vouchers",
    iconKey: "credit-card",
    iconColorClass: "text-emerald-600",
  },
  {
    id: "refunds-voids",
    label: "Refund",
    fullLabel: "Refunds / Voids",
    href: "/app/sales-expenses?tab=refunds-voids",
    iconKey: "rotate-ccw",
    iconColorClass: "text-purple-600",
  },
  {
    id: "expenses",
    label: "Expense",
    fullLabel: "Expenses",
    href: "/app/sales-expenses?tab=expenses",
    iconKey: "receipt",
    iconColorClass: "text-amber-600",
  },
] as const;

export function normalizeSalesTab(rawTab: string | null): SalesSubSectionId {
  switch (rawTab) {
    case "booking-invoice":
    case "invoice":
    case "invoices":
      return "booking-invoice";
    case "payment-vouchers":
    case "voucher":
    case "vouchers":
      return "payment-vouchers";
    case "refunds-voids":
    case "refund":
    case "refunds":
      return "refunds-voids";
    case "expenses":
    case "expense":
      return "expenses";
    default:
      return "booking-invoice";
  }
}

export const APP_NAVIGATION_CORE: readonly AppNavItemCore[] = [
  {
    id: "admin",
    label: "Admin Panel",
    description: "User management & system controls",
    href: "/app/admin",
    iconKey: "shield",
    colorClass: "text-red-500 bg-red-50 dark:bg-red-950/40",
    adminOnly: true,
    placements: { desktopSidebar: true, mobileBottomBar: false, mobileMore: true },
    matchPrefixes: ["/app/admin"],
  },
  {
    id: "dashboard",
    label: "Dashboard",
    mobileLabel: "Dashboard",
    description: "Overview, KPIs & quick actions",
    href: "/app/dashboard",
    iconKey: "layout-dashboard",
    placements: { desktopSidebar: true, mobileBottomBar: true, mobileMore: false },
    matchPrefixes: ["/app/dashboard"],
    exact: true,
  },
  {
    id: "sales-expenses",
    label: "Sales & Expenses",
    mobileLabel: "Sales & Exp",
    description: "Invoice, Voucher, Refund & Expense",
    href: "/app/sales-expenses",
    iconKey: "receipt",
    placements: { desktopSidebar: true, mobileBottomBar: true, mobileMore: false },
    subItems: SALES_SUB_SECTIONS_CORE,
    matchPrefixes: ["/app/sales-expenses"],
  },
  {
    id: "clients-vendors",
    label: "Clients & Vendors",
    mobileLabel: "Parties",
    description: "Clients, vendors & agency banks",
    href: "/app/clients-vendors",
    iconKey: "users",
    placements: { desktopSidebar: true, mobileBottomBar: true, mobileMore: false },
    matchPrefixes: ["/app/clients-vendors"],
  },
  {
    id: "reports",
    label: "Reports",
    mobileLabel: "Reports",
    description: "Day book, statements & profit reports",
    href: "/app/reports",
    iconKey: "bar-chart-3",
    placements: { desktopSidebar: true, mobileBottomBar: true, mobileMore: false },
    matchPrefixes: ["/app/reports"],
  },
  {
    id: "leads-quotes",
    label: "Queries & Quotes",
    description: "Client inquiries & price quotations",
    href: "/app/leads-quotes",
    iconKey: "message-square",
    colorClass: "text-sky-500 bg-sky-50 dark:bg-sky-950/40",
    placements: { desktopSidebar: true, mobileBottomBar: false, mobileMore: true },
    matchPrefixes: ["/app/leads-quotes"],
  },
  {
    id: "b2b-agents",
    label: "B2B Agents",
    description: "Agent network, bookings & ledgers",
    href: "/app/b2b-agents",
    iconKey: "building-2",
    colorClass: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40",
    placements: { desktopSidebar: true, mobileBottomBar: false, mobileMore: true },
    matchPrefixes: ["/app/b2b-agents"],
  },
  {
    id: "umrah-calculator",
    label: "Umrah Calculator",
    description: "Instant per-person packages",
    href: "/app/umrah-calculator",
    iconKey: "calculator",
    colorClass: "text-blue-500 bg-blue-50 dark:bg-blue-950/40",
    placements: { desktopSidebar: true, mobileBottomBar: false, mobileMore: true },
    matchPrefixes: ["/app/umrah-calculator"],
  },
  {
    id: "notifications",
    label: "Notifications",
    mobileLabel: "Notifications & Alerts",
    description: "Live departures & reminders",
    href: "/app/notifications",
    iconKey: "bell",
    badgeKey: "unreadAlerts",
    colorClass: "text-amber-500 bg-amber-50 dark:bg-amber-950/40",
    placements: { desktopSidebar: true, mobileBottomBar: false, mobileMore: true },
    matchPrefixes: ["/app/notifications"],
  },
  {
    id: "vendors-airlines",
    label: "Vendors & Airlines",
    description: "Parties section — vendors & payables",
    href: "/app/clients-vendors?tab=parties&type=vendor",
    iconKey: "plane",
    colorClass: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40",
    placements: { desktopSidebar: false, mobileBottomBar: false, mobileMore: true },
    matchPrefixes: ["/app/clients-vendors"],
    matchSearch: { type: "vendor" },
  },
  {
    id: "financial-reports",
    label: "Financial Reports",
    description: "P&L, accounts summary & dues",
    href: "/app/reports?tab=financial-reports",
    iconKey: "bar-chart-3",
    colorClass: "text-teal-500 bg-teal-50 dark:bg-teal-950/40",
    placements: { desktopSidebar: false, mobileBottomBar: false, mobileMore: true },
    matchPrefixes: ["/app/reports"],
    matchSearch: { tab: "financial-reports" },
  },
  {
    id: "settings",
    label: "Settings",
    description: "Account, branding & templates",
    href: "/app/settings",
    iconKey: "settings",
    colorClass: "text-slate-600 bg-slate-100 dark:bg-slate-800",
    placements: { desktopSidebar: true, mobileBottomBar: false, mobileMore: true },
    matchPrefixes: ["/app/settings"],
  },
  {
    id: "email-integration",
    label: "Email Integration",
    description: "Configuration, logs & cleanup",
    href: "/app/settings?tab=email-integration",
    iconKey: "mail",
    colorClass: "text-cyan-500 bg-cyan-50 dark:bg-cyan-950/40",
    placements: { desktopSidebar: false, mobileBottomBar: false, mobileMore: true },
    matchPrefixes: ["/app/settings"],
    matchSearch: { tab: "email-integration" },
  },
  {
    id: "user-manual",
    label: "User Manual",
    description: "Complete documentation & guides",
    href: "/app/settings?tab=manual",
    iconKey: "book-open",
    colorClass: "text-rose-500 bg-rose-50 dark:bg-rose-950/40",
    placements: { desktopSidebar: false, mobileBottomBar: false, mobileMore: true },
    matchPrefixes: ["/app/settings"],
    matchSearch: { tab: "manual" },
  },
] as const;

export function getDesktopSidebarItemsCore(options: { isAdmin: boolean }): AppNavItemCore[] {
  return APP_NAVIGATION_CORE.filter(
    (item) => item.placements.desktopSidebar && (!item.adminOnly || options.isAdmin)
  );
}

export function getMobileBottomBarItemsCore(): AppNavItemCore[] {
  return APP_NAVIGATION_CORE.filter((item) => item.placements.mobileBottomBar);
}

export function getMobileMoreItemsCore(options: { isAdmin: boolean }): AppNavItemCore[] {
  return APP_NAVIGATION_CORE.filter(
    (item) => item.placements.mobileMore && (!item.adminOnly || options.isAdmin)
  );
}

export function isNavItemActive(
  item: Pick<AppNavItemCore, "exact" | "href" | "matchPrefixes" | "matchSearch">,
  pathname: string,
  search?: string
): boolean {
  const pathMatched = item.exact
    ? pathname === item.href
    : item.matchPrefixes.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
      );

  if (!pathMatched) return false;

  if (item.matchSearch) {
    const params = new URLSearchParams(search ?? "");
    return Object.entries(item.matchSearch).every(([key, val]) => params.get(key) === val);
  }

  return true;
}

export function isMoreMenuRouteActive(
  pathname: string,
  search: string,
  isAdmin: boolean
): boolean {
  const bottomBarItems = getMobileBottomBarItemsCore();
  if (bottomBarItems.some((item) => isNavItemActive(item, pathname, search))) {
    return false;
  }
  const moreItems = getMobileMoreItemsCore({ isAdmin });
  return moreItems.some((item) => isNavItemActive(item, pathname, search));
}

