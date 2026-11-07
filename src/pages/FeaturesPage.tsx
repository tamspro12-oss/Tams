import { Link } from "react-router-dom";
import {
  Calendar,
  Ticket,
  Users,
  Store,
  Scale,
  Wallet,
  Calculator,
  MessageSquare,
  BarChart3,
  Receipt,
  Shield,
  Cloud,
  Database,
  Lock,
  Mail,
  Smartphone,
  CheckCircle2,
  ArrowRight,
  FileText,
  RotateCcw,
  Sparkles,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeoHead } from "@/components/SeoHead";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicErrorBoundary } from "@/components/public/PublicErrorBoundary";
import { HOMEPAGE_CONTENT } from "@/config/marketingContent";

// Icon mapping helper for single stroke weight
const ICONS: Record<string, React.ElementType> = {
  Calendar,
  Ticket,
  Users,
  Store,
  Scale,
  Wallet,
  Calculator,
  MessageSquare,
  BarChart3,
  Receipt,
  Shield,
  Cloud,
  Database,
  Lock,
  Mail,
  Smartphone,
  FileText,
  RotateCcw,
  Layers,
};

// Deep operational feature categories matching actual application code
const FEATURE_PILLARS = [
  {
    id: "bookings-operations",
    badge: "Operations Core",
    title: "Unified Bookings & Service Vouchers",
    subtitle:
      "A single source of truth for direct passengers, B2B partner groups, and official travel vouchers.",
    features: [
      {
        icon: "Calendar",
        title: "Unified Client Bookings",
        description:
          "Manage direct clients and B2B agent bookings in one high-performance list. Track flight dates, passenger names, passport numbers, PNR details, and outstanding balances without separate data silos.",
        bullets: [
          "Unified list combining retail clients and B2B agent records",
          "Comprehensive booking modal with passenger and service breakdown",
          "Automated payment status tracking (Paid, Partial, Unpaid)",
          "Printable client confirmations and professional PDF invoices",
        ],
      },
      {
        icon: "Ticket",
        title: "Official Service Vouchers",
        description:
          "Generate formal, verifiable vouchers with accurate hotel reservations, room categories, and airline schedules directly from your booking records.",
        bullets: [
          "Umrah package vouchers with Makkah & Madinah hotel details",
          "Hotel vouchers with room occupancy, meal plans & check-in dates",
          "Air ticket vouchers with PNR, baggage allowance & flight routing",
          "Instant high-resolution PDF download for WhatsApp and email dispatch",
        ],
      },
    ],
  },
  {
    id: "b2b-vendors",
    badge: "Partner Network",
    title: "B2B Agent Network & Vendor Payables",
    subtitle:
      "Complete commercial transparency for your agent network and supplier relationships.",
    features: [
      {
        icon: "Users",
        title: "B2B Agent Portal & Ledger",
        description:
          "Empower your distribution network. Every B2B agent receives a dedicated running-balance ledger, statement export, and payment allocation mechanism.",
        bullets: [
          "Dedicated agent profiles with contact directories and credit limits",
          "Real-time party ledger with running balance debit/credit entries",
          "Lump-sum payment allocation across open bookings",
          "Downloadable statement of accounts in PDF and Excel format",
        ],
      },
      {
        icon: "Store",
        title: "Vendor Management & Liabilities",
        description:
          "Maintain absolute control over airline consolidators, hotel vendors, and visa suppliers with automated liability tracking and aging reports.",
        bullets: [
          "Comprehensive supplier directory with contact details",
          "Vendor payable tracking with automatic debit/credit recording",
          "Supplier aging analysis to prevent payment defaults",
          "Direct payout logging linked to selected bank or cash accounts",
        ],
      },
    ],
  },
  {
    id: "financial-accounting",
    badge: "Financial Control",
    title: "Agency Ledger & Liquidity Management",
    subtitle:
      "Double-entry bookkeeping designed specifically for travel agency cash flows.",
    features: [
      {
        icon: "Scale",
        title: "Agency Master Ledger",
        description:
          "Every operational event—booking payment, vendor charge, customer refund, or office expense—is permanently logged in the agency master ledger.",
        bullets: [
          "Real-time running balances with reversal audit trails",
          "Party-wise filtering for direct clients, B2B agents, and vendors",
          "Date preset selectors (Today, This Month, Custom Date Ranges)",
          "Flexible opening balance configuration for clean fiscal setup",
        ],
      },
      {
        icon: "Wallet",
        title: "Bank & Cash Account Manager",
        description:
          "Real-time visibility across all your liquid assets. Monitor commercial bank accounts, physical cash drawers, and internal account transfers.",
        bullets: [
          "Multi-bank account tracking with live balance updates",
          "Cash register & drawer balance monitoring",
          "Direct expense and payout deductions from selected accounts",
          "Reconciliation history and opening balance records",
        ],
      },
      {
        icon: "Receipt",
        title: "Operating Expense Tracking",
        description:
          "Categorize and monitor daily overheads: office rent, staff salaries, marketing, utility bills, and petty cash directly linked to your liquidity.",
        bullets: [
          "Configurable expense categories and payment modes",
          "Automated deduction from chosen bank or cash accounts",
          "Recurring expense logging and monthly overhead summaries",
          "Direct integration into agency Profit & Loss reports",
        ],
      },
      {
        icon: "RotateCcw",
        title: "Customer Refunds & Adjustments",
        description:
          "Manage flight cancellations and hotel refund requests seamlessly with automatic ledger reversals and bank position adjustments.",
        bullets: [
          "Structured refund processing with reason documentation",
          "Automatic party ledger credit/debit adjustments",
          "Bank/cash payout verification and receipt generation",
          "Full audit trail to prevent duplicate refund payouts",
        ],
      },
    ],
  },
  {
    id: "sales-engine",
    badge: "Sales & Inquiries",
    title: "Inquiries, Quotes & Umrah Calculator",
    subtitle:
      "Convert travel queries into confirmed bookings with precision costing tools.",
    features: [
      {
        icon: "Calculator",
        title: "Umrah Package Calculator",
        description:
          "A specialized costing engine for Umrah operators. Calculate hotel nights across Makkah & Madinah, room sharing rates, transport, visas, and flight tickets with live SAR to PKR currency conversion.",
        bullets: [
          "Multi-hotel accommodation rates (Sharing, Quad, Triple, Double)",
          "Visa fees, ground transport (bus/private car), and Ziyarat costing",
          "Live SAR to PKR currency conversion rate configuration",
          "Custom profit margin sliders and instant quotation PDF export",
        ],
      },
      {
        icon: "MessageSquare",
        title: "Queries & Quotation Hub",
        description:
          "Never lose a lead. Track inquiries across phone, email, and walk-in travelers, build itemized travel quotes, and convert accepted quotes into bookings with 1 click.",
        bullets: [
          "Inquiry pipeline with status tags and follow-up reminders",
          "Itemized travel quotations with flight and hotel breakdowns",
          "One-click conversion from accepted quotation to live booking",
          "Comprehensive date-wise query filtering and lead history",
        ],
      },
    ],
  },
  {
    id: "intelligence-security",
    badge: "Infrastructure",
    title: "Business Intelligence, Security & Cloud",
    subtitle:
      "Enterprise reliability, automated alerts, and row-level database isolation.",
    features: [
      {
        icon: "BarChart3",
        title: "Business Reports & Analytics",
        description:
          "Gain immediate insight into agency performance. Analyze revenue trends, profit margins, outstanding receivables, and supplier payables over any date range.",
        bullets: [
          "Net Profit & Loss statements with real-time margin calculation",
          "Gross collection summaries and service-wise breakdown",
          "Party-wise outstanding collection lists for proactive recovery",
          "One-click export to formatted Excel spreadsheets & PDF",
        ],
      },
      {
        icon: "Shield",
        title: "Database Isolation & Security",
        description:
          "Built on Supabase with strict Row-Level Security (RLS). Your agency records, client contact lists, and financial books are completely segregated and private.",
        bullets: [
          "Row-Level Security (RLS) ensuring 100% tenant data isolation",
          "Automated cloud backups preserving records indefinitely",
          "Role-based sub-user permissions to restrict sensitive financial views",
          "No third-party trackers or external advertising scripts",
        ],
      },
      {
        icon: "Cloud",
        title: "Offline-Ready PWA & Cloud Sync",
        description:
          "TAMS Pro is engineered as a modern Progressive Web App. Continue accessing your booking records during internet outages, with seamless auto-sync upon reconnection.",
        bullets: [
          "Progressive Web App (PWA) installable on Windows, Mac, iOS, Android",
          "Local caching for offline record inspection",
          "Automatic background sync when internet connection resumes",
          "Fast loading speeds optimized for low-bandwidth connections",
        ],
      },
      {
        icon: "Mail",
        title: "Email Integration & Direct Dispatches",
        description:
          "Send booking confirmations, PDF invoices, and payment reminders directly to clients and B2B agents with integrated email logging.",
        bullets: [
          "Direct SMTP configuration for agency branded emails",
          "Automated PDF attachment for invoices and service vouchers",
          "Email dispatch history log to track sent communications",
          "Pre-configured reminder message templates for flights and payments",
        ],
      },
    ],
  },
];

function FeaturesPageContent() {
  const { closingCta } = HOMEPAGE_CONTENT;

  return (
    <div className="min-h-screen bg-[#fafaf9] dark:bg-[#070e17] text-foreground font-sans antialiased selection:bg-[#d4af37]/20 selection:text-foreground">
      <SeoHead
        title="Features — TAMS Pro Travel Agency Management System"
        description="Explore the comprehensive feature architecture of TAMS Pro: Unified Client Bookings, B2B Agent Portal, Agency Master Ledger, Service Vouchers, Umrah Calculator, and Offline Sync."
        path="/features"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "TAMS Pro Features",
          "applicationCategory": "BusinessApplication",
          "operatingSystem": "Web, iOS, Android (PWA)",
          "description":
            "Detailed operational capabilities of TAMS Pro for travel agencies and Umrah operators.",
        }}
      />

      {/* Shared Public Header */}
      <PublicHeader currentPath="/features" />

      <main>
        {/* HERO SECTION */}
        <section className="relative pt-12 pb-16 sm:pt-20 sm:pb-24 lg:pt-24 lg:pb-28 overflow-hidden border-b border-border/60">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-[#d4af37]/10 via-[#0b192c]/5 to-transparent rounded-full blur-3xl -z-10 pointer-events-none" />

          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0b192c]/5 dark:bg-slate-900 border border-[#d4af37]/30 text-xs font-semibold tracking-wide text-foreground">
              <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
              <span className="text-[#0b192c] dark:text-[#d4af37]">
                Complete Architectural Feature Guide
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground font-heading leading-tight max-w-4xl mx-auto">
              Engineered for Absolute Precision in Travel Operations
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto font-normal">
              Every tool, table, and calculator in TAMS Pro exists to solve real operational
              bottlenecks in travel agency management. No superfluous modules, no generic compromises.
            </p>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <Link to="/signup">
                <Button
                  size="lg"
                  className="h-11 px-7 text-xs font-semibold tracking-tight gap-2 bg-[#0b192c] dark:bg-slate-800 text-white hover:bg-[#122846] border border-[#d4af37]/40 shadow-sm"
                >
                  <span>Start Free Account</span>
                  <ArrowRight className="h-4 w-4 text-[#d4af37]" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-11 px-7 text-xs font-semibold tracking-tight text-foreground"
                >
                  View Subscription Plans
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* DETAILED FEATURE PILLARS */}
        <section className="py-16 sm:py-24 lg:py-32">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 space-y-24">
            {FEATURE_PILLARS.map((pillar) => (
              <div key={pillar.id} className="space-y-10">
                {/* Pillar Header */}
                <div className="max-w-3xl space-y-2 border-b border-border/70 pb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#d4af37]">
                    {pillar.badge}
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-heading">
                    {pillar.title}
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {pillar.subtitle}
                  </p>
                </div>

                {/* Pillar Feature Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                  {pillar.features.map((feat, featIdx) => {
                    const IconComp = ICONS[feat.icon] || Calendar;

                    return (
                      <div
                        key={featIdx}
                        className="p-6 sm:p-8 rounded-2xl border border-border/80 bg-card hover:border-[#d4af37]/40 hover:shadow-lg transition-all duration-300 flex flex-col justify-between space-y-6"
                      >
                        <div className="space-y-4">
                          <div className="w-12 h-12 rounded-xl bg-[#0b192c] dark:bg-slate-900 border border-[#d4af37]/30 flex items-center justify-center shrink-0">
                            <IconComp className="w-6 h-6 text-[#d4af37]" strokeWidth={1.5} />
                          </div>

                          <div className="space-y-1.5">
                            <h3 className="text-lg font-bold tracking-tight text-foreground font-heading">
                              {feat.title}
                            </h3>
                            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                              {feat.description}
                            </p>
                          </div>
                        </div>

                        {/* Capabilities Bullets */}
                        <div className="pt-4 border-t border-border/50 space-y-2.5">
                          {feat.bullets.map((b, bIdx) => (
                            <div key={bIdx} className="flex items-start gap-2.5 text-xs text-foreground/80">
                              <CheckCircle2
                                className="w-3.5 h-3.5 text-[#d4af37] shrink-0 mt-0.5"
                                strokeWidth={1.75}
                              />
                              <span className="leading-snug">{b}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CLOSING CTA */}
        <section className="py-20 sm:py-28 bg-[#07111e] text-white relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#d4af37]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-6">
            <span className="text-xs font-bold uppercase tracking-wider text-[#d4af37]">
              {closingCta.eyebrow}
            </span>

            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight font-heading leading-tight max-w-2xl mx-auto">
              {closingCta.title}
            </h2>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl mx-auto">
              {closingCta.subtitle}
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <Link to="/login" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full sm:w-auto h-12 px-8 text-sm font-semibold tracking-tight gap-2 bg-[#d4af37] text-[#07111e] hover:bg-[#e2bd4b] font-heading shadow-lg shadow-[#d4af37]/20"
                >
                  <span>{closingCta.primaryButton.text}</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>

              <Link to="/signup" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto h-12 px-8 text-sm font-semibold tracking-tight border-slate-700 text-white hover:bg-slate-800"
                >
                  {closingCta.secondaryButton.text}
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Shared Public Footer */}
      <PublicFooter />
    </div>
  );
}

export default function FeaturesPage() {
  return (
    <PublicErrorBoundary pageName="Features">
      <FeaturesPageContent />
    </PublicErrorBoundary>
  );
}
