import React from "react";
import { Link } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarCheck,
  Stamp,
  Ticket,
  Users,
  Wallet,
  FileText,
  Calculator,
  FileCheck,
  Bell,
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
  { id: "2", title: "Bookings", caption: "Tickets, Umrah and more", icon: CalendarCheck },
  { id: "3", title: "Visas", caption: "Visa applications and tracking", icon: Stamp },
  { id: "4", title: "Vouchers", caption: "Umrah, hotel, ticket", icon: Ticket },
  { id: "5", title: "Parties", caption: "Clients, agents and vendors", icon: Users },
  { id: "6", title: "Expenses", caption: "Linked to accounts", icon: Wallet },
  { id: "7", title: "Queries & Quotes", caption: "Convert to booking", icon: FileText },
  { id: "8", title: "Umrah Calculator", caption: "SAR to PKR costing", icon: Calculator },
  { id: "9", title: "PDF Invoices", caption: "Branded documents", icon: FileCheck },
  { id: "10", title: "Notifications", caption: "Reminders and alerts", icon: Bell },
];

function FeaturesPageContent() {
  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-[#F8F6F1] dark:bg-[#070D1E] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      <SeoHead
        title="Features — TAMS Pro Travel Agency Management System"
        description="Explore core operational modules: bookings, visas, vouchers, parties, expenses, Umrah calculator, and branded invoices."
        path="/features"
      />

      <PublicHeader currentPath="/features" />

      <main className="flex-1 min-h-0 py-6 lg:py-4 xl:py-6 px-4 sm:px-6 lg:px-8 max-w-[1200px] mx-auto w-full flex flex-col justify-between lg:justify-evenly">
        {/* Top Heading */}
        <div className="text-center mb-5 lg:mb-3 xl:mb-4">
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-[clamp(2rem,3.1vw,2.85rem)] font-normal text-slate-900 dark:text-slate-100 tracking-tight">
            Everything your agency needs
          </h1>
        </div>

        {/* 10 Equal Tiles Grid: 5 cols desktop (2x5), 3 tablet, 2 mobile */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-3.5 xl:gap-4">
          {FEATURES_DATA.map((feature) => (
            <Tile
              key={feature.id}
              icon={feature.icon}
              title={feature.title}
              caption={feature.caption}
              noTruncate
              className="!h-[132px] lg:!h-[130px] xl:!h-[148px] !p-4"
            />
          ))}
        </div>

        {/* Centered CTA Row below grid */}
        <div className="mt-6 lg:mt-3 xl:mt-5 text-center flex items-center justify-center gap-3">
          <Link to="/login">
            <Button
              size="lg"
              className="h-10 lg:h-10 xl:h-11 px-6 text-sm font-semibold gap-2 bg-[#0B1530] text-white hover:bg-[#122146] border border-[#1A294E] shadow-sm transition-all"
            >
              <span>Login</span>
              <ArrowRight className="w-4 h-4 text-[#C9A961]" strokeWidth={1.5} />
            </Button>
          </Link>

          <Link to="/signup">
            <Button
              variant="outline"
              size="lg"
              className="h-10 lg:h-10 xl:h-11 px-6 text-sm font-semibold border-[#E6E2D8] dark:border-[#1A294E] text-slate-800 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              Sign Up Free
            </Button>
          </Link>
        </div>
      </main>

      <PublicFooter compact />
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
