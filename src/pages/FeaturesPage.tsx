import React from "react";
import { Link } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarCheck,
  Users,
  Building2,
  Ticket,
  Receipt,
  Landmark,
  Wallet,
  FileText,
  Calculator,
  FileCheck,
  Bell,
  BarChart3,
  ShieldCheck,
  Cloud,
  Lock,
  ArrowRight,
  LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeoHead } from "@/components/SeoHead";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicErrorBoundary } from "@/components/public/PublicErrorBoundary";
import { Tile } from "@/components/public/Tile";

interface FeatureDef {
  id: string;
  title: string;
  caption: string;
  icon: LucideIcon;
}

const FEATURES_DATA: FeatureDef[] = [
  { id: "1", title: "Dashboard", caption: "Business overview", icon: LayoutDashboard },
  { id: "2", title: "Client Bookings", caption: "Direct and B2B together", icon: CalendarCheck },
  { id: "3", title: "B2B Agents", caption: "Ledger per agent", icon: Users },
  { id: "4", title: "Vendors", caption: "Payables tracking", icon: Building2 },
  { id: "5", title: "Vouchers", caption: "Umrah, hotel, ticket", icon: Ticket },
  { id: "6", title: "Agency Ledger", caption: "Every transaction logged", icon: Receipt },
  { id: "7", title: "Bank & Cash", caption: "Banks and cash drawer", icon: Landmark },
  { id: "8", title: "Expenses", caption: "Linked to accounts", icon: Wallet },
  { id: "9", title: "Queries & Quotes", caption: "Convert to booking", icon: FileText },
  { id: "10", title: "Umrah Calculator", caption: "SAR to PKR costing", icon: Calculator },
  { id: "11", title: "PDF Invoices", caption: "Branded documents", icon: FileCheck },
  { id: "12", title: "Notifications", caption: "Reminders and alerts", icon: Bell },
  { id: "13", title: "Reports", caption: "Business insights", icon: BarChart3 },
  { id: "14", title: "Sub-user Roles", caption: "Staff permissions", icon: ShieldCheck },
  { id: "15", title: "Offline + Cloud", caption: "Sync and backup", icon: Cloud },
  { id: "16", title: "Data Isolation", caption: "Private per agency", icon: Lock },
];

function FeaturesPageContent() {
  return (
    <div className="min-h-screen bg-[#F8F6F1] dark:bg-[#070D1E] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      <SeoHead
        title="Features — TAMS Pro Travel Agency Management System"
        description="Explore core operational modules: bookings, ledgers, vouchers, Umrah calculator, and accounting."
        path="/features"
      />

      <PublicHeader currentPath="/features" />

      <main className="flex-1 py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-[1200px] mx-auto w-full flex flex-col justify-between">
        {/* Top Header */}
        <div className="text-center mb-10 sm:mb-12">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-[#C9A961] block mb-2">
            FEATURES
          </span>
          <h1 className="font-serif text-3xl sm:text-5xl font-normal text-slate-900 dark:text-slate-100 tracking-tight">
            Everything your agency needs
          </h1>
        </div>

        {/* 16 Equal Tiles Grid: 4 cols desktop, 3 tablet, 2 mobile */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {FEATURES_DATA.map((feature) => (
            <Tile
              key={feature.id}
              icon={feature.icon}
              title={feature.title}
              caption={feature.caption}
            />
          ))}
        </div>

        {/* Centered CTA Row below grid */}
        <div className="mt-12 text-center flex items-center justify-center gap-3">
          <Link to="/login">
            <Button
              size="lg"
              className="h-11 px-6 text-sm font-semibold gap-2 bg-[#0B1530] text-white hover:bg-[#122146] border border-[#1A294E] shadow-sm transition-all"
            >
              <span>Login</span>
              <ArrowRight className="w-4 h-4 text-[#C9A961]" strokeWidth={1.5} />
            </Button>
          </Link>

          <Link to="/signup">
            <Button
              variant="outline"
              size="lg"
              className="h-11 px-6 text-sm font-semibold border-[#E6E2D8] dark:border-[#1A294E] text-slate-800 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              Sign Up Free
            </Button>
          </Link>
        </div>
      </main>

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
