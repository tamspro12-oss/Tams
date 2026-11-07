// Marketing Copy Configuration for TAMS Pro
// Centralized copy and feature definitions for all public marketing pages.
// Only describes features that actually exist in the verified application code.

export interface NavLink {
  label: string;
  href: string;
}

export interface FeatureItem {
  id: string;
  title: string;
  tagline: string;
  description: string;
  iconName: string; // key matching lucide icon
  capabilities: string[];
  metricsOrHighlight?: string;
}

export interface FeatureGroup {
  id: string;
  groupTitle: string;
  groupBadge: string;
  groupDescription: string;
  features: FeatureItem[];
}

export const MARKETING_NAVIGATION = {
  mainNav: [
    { label: "Home", href: "/" },
    { label: "Features", href: "/features" },
    { label: "Pricing", href: "/pricing" },
    { label: "Contact", href: "/contact" },
  ],
  authNav: {
    login: { label: "Login", href: "/login" },
    signup: { label: "Sign Up Free", href: "/signup" },
  },
  footerColumns: [
    {
      title: "Product",
      links: [
        { label: "Core Features", href: "/features" },
        { label: "Subscription Plans", href: "/pricing" },
        { label: "Umrah Calculator", href: "/features#umrah-calculator" },
        { label: "Financial Ledger", href: "/features#accounts" },
        { label: "B2B Agent Portal", href: "/features#b2b-agents" },
      ],
    },
    {
      title: "Operations & Contact",
      links: [
        { label: "Contact Support", href: "/contact" },
        { label: "Direct WhatsApp", href: "https://wa.me/923190846768" },
        { label: "Email Desk", href: "mailto:tamspro12@gmail.com" },
        { label: "Agency Login", href: "/login" },
        { label: "Agency Sign Up", href: "/signup" },
      ],
    },
    {
      title: "Legal & Governance",
      links: [
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms of Service", href: "/terms" },
        { label: "Data Protection & RLS", href: "/privacy" },
      ],
    },
  ],
};

export const HOMEPAGE_CONTENT = {
  badge: "Quiet Luxury in Travel Operations",
  hero: {
    eyebrow: "The Dedicated Operating System for Travel Agencies",
    title: "Precision Management for World-Class Travel Agencies",
    subtitle:
      "Unify direct clients, B2B agent ledgers, service vouchers, Umrah package costing, and real-time bank accounts in one high-performance platform.",
    primaryCta: { text: "Login", href: "/login" },
    secondaryCta: { text: "Sign Up Free", href: "/signup" },
    mockupSummary: {
      agencyName: "Al-Harmain Premier Travel",
      activeBookings: "142 Active",
      monthlyGross: "PKR 18.4M",
      ledgerStatus: "100% Reconciled",
    },
  },
  keyCapabilities: [
    {
      title: "Unified Booking Architecture",
      description: "Direct clients and B2B agency partners managed in one synchronized operational stream.",
    },
    {
      title: "Real-Time Ledger Accounting",
      description: "Automatic double-entry ledger linking every booking payment directly to bank & cash positions.",
    },
    {
      title: "Automated Service Vouchers",
      description: "One-click generation of branded Umrah, hotel accommodation, and flight ticket vouchers.",
    },
    {
      title: "Offline-Ready Cloud Sync",
      description: "Uninterrupted work during internet fluctuations with instantaneous cloud backup when reconnected.",
    },
  ],
  bentoHeader: {
    badge: "Core Architecture",
    title: "Engineered for Serious Travel Enterprises",
    subtitle:
      "Every module is built to reflect real agency workflow realities: no clutter, no generic compromises.",
  },
  featureGroups: [
    {
      id: "bookings-vouchers",
      groupTitle: "Bookings and Vouchers",
      groupBadge: "Core Operations",
      groupDescription:
        "Manage passenger itineraries, PNR records, and professional service vouchers with zero duplicate entries.",
      features: [
        {
          id: "client-bookings",
          title: "Unified Client Bookings",
          tagline: "Direct clients and B2B agents in one view",
          description:
            "A consolidated master table for both individual clients and B2B agent records with full passenger lifecycle, PNR tracking, payment statuses, and instant PDF documents.",
          iconName: "Calendar",
          capabilities: [
            "Unified direct client & B2B agent lists",
            "PNR tracking, issue dates, and flight schedules",
            "Full booking detail view with passenger breakdown",
            "Printable client confirmations & PDF invoices",
          ],
        },
        {
          id: "service-vouchers",
          title: "Service Vouchers",
          tagline: "Umrah packages, hotel rooms & tickets",
          description:
            "Generate formal, verifiable vouchers for Umrah packages, hotel accommodations, and air tickets complete with room types, meal plans, and check-in dates.",
          iconName: "Ticket",
          capabilities: [
            "Umrah package vouchers with Makkah/Madinah hotels",
            "Hotel vouchers with room category & confirmation numbers",
            "Air ticket vouchers with airline and routing details",
            "Branded PDF generation ready to dispatch to travelers",
          ],
        },
      ],
    },
    {
      id: "b2b-vendors",
      groupTitle: "B2B Agents and Vendors",
      groupBadge: "Partner Network",
      groupDescription:
        "Foster reliable commercial partnerships with transparent per-agent ledgers and meticulous vendor payables.",
      features: [
        {
          id: "b2b-portal",
          title: "B2B Agent Portal",
          tagline: "Per-agent ledgers and transparent statements",
          description:
            "Manage your entire agent distribution network. Track sub-agent commission, maintain individual credit ledgers, record lump-sum payments, and issue itemized statements.",
          iconName: "Users",
          capabilities: [
            "Dedicated B2B agent accounts & contact directories",
            "Per-agent running balance ledger and statement generation",
            "Lump-sum payment allocation across open bookings",
            "Real-time receivable tracking and agent balance alerts",
          ],
        },
        {
          id: "vendor-management",
          title: "Vendor Management",
          tagline: "Track supplier liabilities and payment aging",
          description:
            "Centralize suppliers, airlines, visa providers, and hotel aggregators. Monitor outstanding payables, payment histories, and vendor account balances.",
          iconName: "Store",
          capabilities: [
            "Complete supplier directory with contact details",
            "Vendor balance tracking with debit/credit entries",
            "Aging reports and pending payables monitoring",
            "Direct payment recording linked to bank accounts",
          ],
        },
      ],
    },
    {
      id: "accounts-ledgers",
      groupTitle: "Accounts and Ledgers",
      groupBadge: "Financial Control",
      groupDescription:
        "Financial integrity without external accounting complexity: cash positions, bank balances, and ledgers in perfect sync.",
      features: [
        {
          id: "agency-ledger",
          title: "Agency Master Ledger",
          tagline: "Automatic reconciliation of all transactions",
          description:
            "Every payment received, vendor payout, customer refund, or operating expense is permanently logged in the agency ledger with date-wise running balances.",
          iconName: "Scale",
          capabilities: [
            "Automated double-entry transaction records",
            "Real-time running balances with reversal audit trails",
            "Party-level filtering for clients, agents, and vendors",
            "Opening balance configuration for accurate transitions",
          ],
        },
        {
          id: "bank-cash",
          title: "Bank & Cash Manager",
          tagline: "Real-time liquidity across all accounts",
          description:
            "Monitor cash-in-hand and multiple commercial bank accounts simultaneously. Record deposits, withdrawals, internal transfers, and customer refunds.",
          iconName: "Wallet",
          capabilities: [
            "Multi-bank account tracking with live balance feeds",
            "Cash drawer / register balance management",
            "Direct expense & payment linking to selected accounts",
            "Opening balance setup and reconciliation history",
          ],
        },
      ],
    },
    {
      id: "quotes-umrah",
      groupTitle: "Quotes and Umrah Calculator",
      groupBadge: "Sales Engine",
      groupDescription:
        "Transform customer queries into confirmed bookings with accurate package cost calculations in minutes.",
      features: [
        {
          id: "umrah-calculator",
          title: "Umrah Package Calculator",
          tagline: "Multi-currency cost builder with real-time margins",
          description:
            "A specialized calculator designed for Umrah operators: calculate hotel nights (sharing, quad, triple, double), transport, visa fees, airfare, and live SAR to PKR conversions.",
          iconName: "Calculator",
          capabilities: [
            "Makkah & Madinah hotel pricing across room occupancy",
            "Visa, insurance, transport, and Ziyarat fee builders",
            "Real-time SAR to PKR currency conversion rate setting",
            "Configurable agency profit margins and instant PDF export",
          ],
        },
        {
          id: "queries-quotes",
          title: "Queries & Quotes Hub",
          tagline: "Convert travel inquiries into confirmed bookings",
          description:
            "Capture customer inquiries across phone, email, and walk-ins. Build professional travel quotations with itemized itineraries and convert them into bookings with 1 click.",
          iconName: "MessageSquare",
          capabilities: [
            "Inquiry pipeline with status tags and follow-up reminders",
            "Itemized quotation builder for flights, hotels, and visas",
            "One-click conversion from accepted quote to live booking",
            "Date-wise filtering and client communication history",
          ],
        },
      ],
    },
    {
      id: "reports-expenses",
      groupTitle: "Reports and Expenses",
      groupBadge: "Business Intelligence",
      groupDescription:
        "Clear financial visibility to safeguard profitability, control operating costs, and satisfy audit requirements.",
      features: [
        {
          id: "business-reports",
          title: "Business Reports",
          tagline: "Profit & Loss, collections, and balance sheets",
          description:
            "Gain immediate visibility into agency performance. Analyze gross revenues, net profit margins, outstanding client receivables, and supplier liabilities over any custom date range.",
          iconName: "BarChart3",
          capabilities: [
            "Net Profit & Loss statements with date range selector",
            "Revenue and booking volume breakdown by service type",
            "Party-wise outstanding collection and receivables report",
            "One-click export to formatted Excel spreadsheets & PDF",
          ],
        },
        {
          id: "expense-tracking",
          title: "Operating Expense Tracking",
          tagline: "Categorized overheads and vendor payouts",
          description:
            "Track daily agency operational expenses such as office rent, utility bills, marketing, staff salaries, and petty cash directly linked to your cash and bank balances.",
          iconName: "Receipt",
          capabilities: [
            "Customizable expense categories and payment modes",
            "Direct deduction from selected bank or cash registers",
            "Recurring overhead monitoring and expense summaries",
            "Full integration with agency ledger and monthly P&L",
          ],
        },
      ],
    },
  ],
  securityTrust: {
    badge: "Enterprise Security",
    title: "Total Data Isolation. Cloud Backup & Offline Freedom.",
    description:
      "Your agency data represents your competitive advantage. TAMS Pro is built from the ground up with strict confidentiality, role boundaries, and cloud resilience.",
    items: [
      {
        title: "Row-Level Security (RLS)",
        description: "Your agency database is completely segregated at the database level. No cross-tenant access is physically possible.",
        iconName: "Shield",
      },
      {
        title: "Offline-First Caching",
        description: "Continue accessing bookings and passenger records even if local internet service experiences outages.",
        iconName: "Cloud",
      },
      {
        title: "Automated Cloud Backups",
        description: "Continuous database backups ensure your agency history, ledgers, and documents are preserved indefinitely.",
        iconName: "Database",
      },
      {
        title: "Granular Sub-User Permissions",
        description: "Define staff accounts with role-based restrictions. Control who can view ledger totals, modify bookings, or export data.",
        iconName: "Lock",
      },
    ],
  },
  closingCta: {
    eyebrow: "Begin Your Agency Transformation",
    title: "Ready to Experience Quiet Luxury in Travel Agency Operations?",
    subtitle:
      "Join premier travel agencies managing bookings, B2B networks, and agency accounts with precision.",
    primaryButton: { text: "Login to Portal", href: "/login" },
    secondaryButton: { text: "Sign Up Free", href: "/signup" },
  },
};

export const CONTACT_PAGE_CONTENT = {
  eyebrow: "Personalized Support",
  title: "Connect with the TAMS Pro Team",
  subtitle:
    "Whether you require new agency onboarding, enterprise configuration, or technical assistance, our travel management specialists are here to assist.",
  channels: [
    {
      type: "email",
      title: "Direct Email Desk",
      value: "tamspro12@gmail.com",
      link: "mailto:tamspro12@gmail.com",
      description: "Official agency inquiries, licensing questions, and account assistance.",
      badge: "Typical response < 24 hrs",
      iconName: "Mail",
    },
    {
      type: "whatsapp",
      title: "WhatsApp Direct Desk",
      value: "+92 319 0846768",
      link: "https://wa.me/923190846768",
      description: "Direct instant messaging for onboarding support and urgent operational assistance.",
      badge: "Active Business Hours",
      iconName: "Phone",
    },
  ],
  onboardingNotice: {
    title: "Admin-Controlled Secure Onboarding",
    description:
      "To ensure data privacy and pristine database isolation, every new agency workspace undergoes verified administrator provisioning. Once registered, our technical desk immediately configures your company profile, base currency, and admin credentials.",
  },
};
