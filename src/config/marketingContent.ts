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

// 7 Equal Items for Homepage Strip
export const HOME_STRIP_ITEMS = [
  { id: "bookings", title: "Bookings", iconName: "CalendarCheck" },
  { id: "invoicing", title: "Invoicing", iconName: "FileCheck" },
  { id: "vouchers", title: "Vouchers", iconName: "Ticket" },
  { id: "ledger", title: "Ledger", iconName: "Receipt" },
  { id: "umrah-calc", title: "Umrah Calculator", iconName: "Calculator" },
  { id: "quotations", title: "Quotations", iconName: "FileText" },
  { id: "reports", title: "Reports", iconName: "BarChart3" },
] as const;

// 10 Real Features for Features Page (2x5 Desktop Grid)
export const FEATURES_LIST = [
  { id: "1", title: "Dashboard", caption: "Business overview", iconName: "LayoutDashboard" },
  { id: "2", title: "Bookings", caption: "Tickets, Umrah and more", iconName: "CalendarCheck" },
  { id: "3", title: "Visas", caption: "Visa applications and tracking", iconName: "Stamp" },
  { id: "4", title: "Vouchers", caption: "Umrah, hotel, ticket", iconName: "Ticket" },
  { id: "5", title: "Parties", caption: "Clients, agents and vendors", iconName: "Users" },
  { id: "6", title: "Expenses", caption: "Linked to accounts", iconName: "Wallet" },
  { id: "7", title: "Queries & Quotes", caption: "Convert to booking", iconName: "FileText" },
  { id: "8", title: "Umrah Calculator", caption: "SAR to PKR costing", iconName: "Calculator" },
  { id: "9", title: "PDF Invoices", caption: "Branded documents", iconName: "FileCheck" },
  { id: "10", title: "Notifications", caption: "Reminders and alerts", iconName: "Bell" },
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
