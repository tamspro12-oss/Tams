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
import { PublicReveal } from "@/components/public/PublicReveal";
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
    <div className="tams-public-landing min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col">
      <SeoHead
        title="Features — TAMS Pro Travel Agency Management System"
        description="Explore core operational modules: bookings, visas, vouchers, parties, expenses, Umrah calculator, and branded invoices."
        path="/features"
      />

      <PublicHeader currentPath="/features" />

      <main className="flex-1 py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-[1200px] mx-auto w-full flex flex-col justify-between gap-10">
        {/* Top Heading */}
        <PublicReveal className="text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0F172A] tracking-tight">
            Everything your{" "}
            <span className="tams-headline-gradient">agency needs</span>
          </h1>
        </PublicReveal>

        {/* 10 Equal Tiles Grid: grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 */}
        <div className="tams-features-grid tams-grid-gap grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {FEATURES_DATA.map((feature, idx) => (
            <PublicReveal key={feature.id} delay={idx * 65}>
              <Tile
                icon={feature.icon}
                title={feature.title}
                caption={feature.caption}
                noTruncate
                className="h-[144px] sm:h-[152px] p-5"
              />
            </PublicReveal>
          ))}
        </div>

        {/* Centered CTA Row below grid */}
        <PublicReveal delay={160} className="pt-2 text-center flex flex-wrap items-center justify-center gap-3.5">
          <Link to="/login">
            <Button
              size="lg"
              className="tams-btn-primary h-11 px-6 rounded-xl text-sm font-semibold gap-2 bg-[#0F5E63] text-white hover:bg-[#0B4A4E] shadow-sm hover:shadow-md transition-all group"
            >
              <span>Login</span>
              <ArrowRight className="w-4 h-4 text-teal-100 transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={1.75} />
            </Button>
          </Link>

          <Link to="/signup">
            <Button
              variant="outline"
              size="lg"
              className="tams-btn-secondary h-11 px-6 rounded-xl text-sm font-semibold bg-white border border-[#CBD5E1] text-[#0F172A] hover:bg-[#F1F5F9] transition-all"
            >
              Sign Up Free
            </Button>
          </Link>
        </PublicReveal>
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
