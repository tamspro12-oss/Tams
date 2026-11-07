// Marketing Configuration for TAMS Pro
// Pure factual content verified against real application capabilities.

export interface NavLink {
  label: string;
  href: string;
}

export const MARKETING_NAVIGATION = {
  mainNav: [
    { label: "Home", href: "/" },
    { label: "Features", href: "/features" },
    { label: "Pricing", href: "/pricing" },
    { label: "Contact", href: "/contact" },
  ] as NavLink[],
  authNav: {
    login: { label: "Login", href: "/login" },
    signup: { label: "Sign Up Free", href: "/signup" },
  },
  footerLinks: [
    { label: "Features", href: "/features" },
    { label: "Pricing", href: "/pricing" },
    { label: "Contact", href: "/contact" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
  ] as NavLink[],
};

// 8 Equal Items for Homepage Section B Strip
export const HOME_STRIP_ITEMS = [
  { id: "bookings", title: "Bookings", iconName: "CalendarCheck" },
  { id: "b2b-agents", title: "B2B Agents", iconName: "Users" },
  { id: "vouchers", title: "Vouchers", iconName: "Ticket" },
  { id: "ledger", title: "Ledger", iconName: "Receipt" },
  { id: "bank-cash", title: "Bank & Cash", iconName: "Landmark" },
  { id: "quotes", title: "Quotes", iconName: "FileText" },
  { id: "umrah-calc", title: "Umrah Calculator", iconName: "Calculator" },
  { id: "reports", title: "Reports", iconName: "BarChart3" },
] as const;

// 16 Real Features for Features Page (Exact Copy)
export const FEATURES_LIST = [
  { id: "1", title: "Dashboard", caption: "Business overview", iconName: "LayoutDashboard" },
  { id: "2", title: "Client Bookings", caption: "Direct and B2B together", iconName: "CalendarCheck" },
  { id: "3", title: "B2B Agents", caption: "Ledger per agent", iconName: "Users" },
  { id: "4", title: "Vendors", caption: "Payables tracking", iconName: "Building2" },
  { id: "5", title: "Vouchers", caption: "Umrah, hotel, ticket", iconName: "Ticket" },
  { id: "6", title: "Agency Ledger", caption: "Every transaction logged", iconName: "Receipt" },
  { id: "7", title: "Bank & Cash", caption: "Banks and cash drawer", iconName: "Landmark" },
  { id: "8", title: "Expenses", caption: "Linked to accounts", iconName: "Wallet" },
  { id: "9", title: "Queries & Quotes", caption: "Convert to booking", iconName: "FileText" },
  { id: "10", title: "Umrah Calculator", caption: "SAR to PKR costing", iconName: "Calculator" },
  { id: "11", title: "PDF Invoices", caption: "Branded documents", iconName: "FileCheck" },
  { id: "12", title: "Notifications", caption: "Reminders and alerts", iconName: "Bell" },
  { id: "13", title: "Reports", caption: "Business insights", iconName: "BarChart3" },
  { id: "14", title: "Sub-user Roles", caption: "Staff permissions", iconName: "ShieldCheck" },
  { id: "15", title: "Offline + Cloud", caption: "Sync and backup", iconName: "Cloud" },
  { id: "16", title: "Data Isolation", caption: "Private per agency", iconName: "Lock" },
] as const;

export const CONTACT_CHANNELS = {
  email: {
    label: "Email",
    value: "tamspro12@gmail.com",
    href: "mailto:tamspro12@gmail.com",
  },
  whatsapp: {
    label: "WhatsApp",
    value: "Chat now",
    href: "https://wa.me/923190846768",
  },
  phone: {
    label: "Phone",
    value: "+92 319 0846768",
    href: "tel:+923190846768",
  },
};
