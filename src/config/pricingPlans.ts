// Pricing Plans Configuration for TAMS Pro
// Edit plan prices, features, and discount badges here in one central location.

export interface PricingPlan {
  id: "monthly" | "yearly";
  name: string;
  badge?: string;
  popular?: boolean;
  price: number;
  originalPrice: number;
  currency: string;
  period: string;
  billingFrequency: string;
  savingsLabel?: string;
  description: string;
  ctaText: string;
  ctaLink: string;
  features: string[];
  highlightFeatures?: string[];
}

export const PRICING_CONSTANTS = {
  currencyCode: "PKR",
  currencySymbol: "PKR ",
  monthly: {
    price: 999,
    originalPrice: 1999,
  },
  yearly: {
    price: 9999,
    originalPrice: 19999,
  },
} as const;

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "monthly",
    name: "Monthly",
    price: PRICING_CONSTANTS.monthly.price,
    originalPrice: PRICING_CONSTANTS.monthly.originalPrice,
    currency: PRICING_CONSTANTS.currencyCode,
    period: "/ month",
    billingFrequency: "Billed monthly",
    savingsLabel: "50% OFF",
    description: "Full operational access for boutique agencies seeking flexible month-to-month management.",
    ctaText: "Get Started",
    ctaLink: "/signup",
    features: [
      "Client Bookings & PNR Tracking",
      "Unified B2B Agent & Direct Client List",
      "Umrah, Hotel & Flight Vouchers (PDF)",
      "B2B Agent Portal & Party Ledgers",
      "Agency Master Ledger & Account Statements",
      "Bank & Cash Account Manager",
      "Queries & Quotations with 1-Click Conversion",
      "Umrah Package Cost Calculator",
      "Operating Expense Tracking",
      "Standard Business & P&L Reports",
      "Automated Travel & Payment Notifications",
      "Cloud Backup & Offline Caching",
      "Up to 2 Sub-User Team Accounts",
    ],
  },
  {
    id: "yearly",
    name: "Yearly",
    popular: true,
    badge: "Most Popular",
    price: PRICING_CONSTANTS.yearly.price,
    originalPrice: PRICING_CONSTANTS.yearly.originalPrice,
    currency: PRICING_CONSTANTS.currencyCode,
    period: "/ year",
    billingFrequency: "Billed annually (includes 2 months free)",
    savingsLabel: "Save 50% + 2 Months Free",
    description: "The complete enterprise solution for established travel agencies scaling their operations.",
    ctaText: "Get Started",
    ctaLink: "/signup",
    features: [
      "Everything included in Monthly",
      "Unlimited Client Bookings & Passenger Records",
      "Full B2B Agent Network Management",
      "Vendor Payables & Aging Balance Sheets",
      "Automated Payment-to-Ledger Reconciliation",
      "Multi-Currency Umrah Calculator (SAR / PKR)",
      "Advanced Date-Wise Financial & P&L Analytics",
      "Custom Agency Branding on Invoices & Vouchers",
      "Direct Email Integration with Client History",
      "High-Priority Data Synchronization & Support",
      "Role-Based Sub-User Permissions & Audit Trail",
      "Complete Data Export (Excel & JSON)",
    ],
    highlightFeatures: [
      "2 Months Free Included",
      "Full Agency Ledger & Statements",
      "Direct Priority Onboarding",
    ],
  },
];

export const PRICING_FAQS = [
  {
    question: "How do I activate my agency account?",
    answer:
      "TAMS Pro utilizes secure administrative onboarding. When you sign up or contact us, our team provisions your dedicated agency instance with isolated database security and row-level protection.",
  },
  {
    question: "How does the offline-ready feature work?",
    answer:
      "TAMS Pro is built as a modern Progressive Web App (PWA). If your internet connection drops, you can continue viewing records and preparing data. When your connection resumes, changes automatically synchronize with the cloud.",
  },
  {
    question: "Can I assign permissions to my staff members?",
    answer:
      "Yes. The settings module allows you to create sub-user logins with granular role controls, ensuring staff only access the specific hubs (such as Bookings or Queries) they are authorized to manage.",
  },
  {
    question: "Are my agency finances and client records private?",
    answer:
      "Completely. Each travel agency operates in a strictly isolated environment with Supabase Row-Level Security (RLS). No other agency or third-party can see your bookings, financials, or margins.",
  },
  {
    question: "Can I export my financial statements and reports?",
    answer:
      "Yes. You can generate professional PDF vouchers and invoices on demand, export comprehensive financial statements and P&L reports, and download full data backups at any time.",
  },
  {
    question: "What happens if our subscription period ends?",
    answer:
      "Your agency data remains securely stored and preserved in the cloud. Upon renewing your monthly or annual subscription, your entire workspace resumes seamlessly with zero data loss.",
  },
];
