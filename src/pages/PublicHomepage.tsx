import React from "react";
import { Link } from "react-router-dom";
import {
  Plane,
  ArrowRight,
  CalendarCheck,
  FileCheck,
  Ticket,
  Receipt,
  FileText,
  Calculator,
  BarChart3,
  LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeoHead } from "@/components/SeoHead";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicErrorBoundary } from "@/components/public/PublicErrorBoundary";
import { Tile } from "@/components/public/Tile";

interface StripItem {
  id: string;
  title: string;
  icon: LucideIcon;
}

const STRIP_ITEMS: StripItem[] = [
  { id: "bookings", title: "Bookings", icon: CalendarCheck },
  { id: "invoicing", title: "Invoicing", icon: FileCheck },
  { id: "vouchers", title: "Vouchers", icon: Ticket },
  { id: "ledger", title: "Ledger", icon: Receipt },
  { id: "umrah-calc", title: "Umrah Calculator", icon: Calculator },
  { id: "quotations", title: "Quotations", icon: FileText },
  { id: "reports", title: "Reports", icon: BarChart3 },
];

function HomepageContent() {
  return (
    <div className="tams-public-landing min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col">
      <SeoHead
        title="TAMS Pro — Travel Agency Management System"
        description="Bookings, visas, accounts and vouchers, everything in one place."
        path="/"
      />

      <PublicHeader currentPath="/" />

      <main className="flex-1 flex flex-col justify-between max-w-[1200px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-14 lg:py-16 gap-10 sm:gap-12">
        {/* Section A: Hero */}
        <section className="flex flex-col items-center justify-center text-center max-w-4xl mx-auto w-full pt-2 sm:pt-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center mx-auto mb-6 shadow-xs">
            <Plane className="w-5 h-5 text-teal-700" strokeWidth={1.75} />
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-[52px] font-bold text-[#0F172A] tracking-tight leading-[1.12] max-w-4xl mx-auto">
            Travel Agency Management System
          </h1>

          <p className="mt-4 sm:mt-5 text-base sm:text-lg lg:text-xl text-[#475569] max-w-2xl mx-auto leading-relaxed font-normal">
            Bookings, visas, accounts and vouchers, everything in one place.
          </p>

          <div className="mt-7 sm:mt-8 flex flex-wrap items-center justify-center gap-3.5 w-full sm:w-auto">
            <Link to="/login" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="tams-btn-primary w-full sm:w-auto h-11 px-6 rounded-xl text-sm font-semibold gap-2 bg-[#0F5E63] text-white hover:bg-[#0B4A4E] shadow-sm hover:shadow-md transition-all group"
              >
                <span>Login</span>
                <ArrowRight className="w-4 h-4 text-teal-100 transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={1.75} />
              </Button>
            </Link>

            <Link to="/signup" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="tams-btn-secondary w-full sm:w-auto h-11 px-6 rounded-xl text-sm font-semibold bg-white border border-[#CBD5E1] text-[#0F172A] hover:bg-[#F1F5F9] transition-all"
              >
                Sign Up Free
              </Button>
            </Link>
          </div>
        </section>

        {/* Section B: 7 Equal Tiles Strip */}
        <section className="w-full text-center">
          <div className="tams-home-strip-grid tams-grid-gap grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3.5 lg:gap-4">
            {STRIP_ITEMS.map((item) => (
              <Tile
                key={item.id}
                icon={item.icon}
                title={item.title}
                compact
                noTruncate
                to="/features"
                className="h-[118px] sm:h-[124px] lg:h-[132px] p-4"
              />
            ))}
          </div>

          <div className="mt-6">
            <Link
              to="/features"
              className="inline-flex items-center gap-1.5 min-h-[44px] md:min-h-0 text-sm font-semibold text-[#0F5E63] hover:text-[#0B4A4E] transition-colors group"
            >
              <span>View all features</span>
              <ArrowRight className="w-4 h-4 text-[#0F5E63] transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={1.75} />
            </Link>
          </div>
        </section>

        {/* Section C: Final CTA Clean Rounded-2xl Banner */}
        <section className="w-full">
          <div className="tams-banner-card rounded-2xl bg-white border border-slate-200/80 shadow-sm px-6 py-6 sm:px-8 sm:py-7 flex flex-col sm:flex-row items-center justify-between gap-4">
            <h2 className="text-lg sm:text-xl font-semibold text-[#0F172A] tracking-tight">
              Ready to get started?
            </h2>

            <div className="flex flex-wrap items-center justify-center gap-3 w-full sm:w-auto">
              <Link to="/login" className="w-full sm:w-auto">
                <Button
                  size="sm"
                  className="tams-btn-primary w-full sm:w-auto h-11 md:h-10 px-5 rounded-xl text-xs sm:text-sm font-semibold gap-1.5 bg-[#0F5E63] text-white hover:bg-[#0B4A4E] shadow-sm hover:shadow-md transition-all group"
                >
                  <span>Login</span>
                  <ArrowRight className="w-3.5 h-3.5 text-teal-100 transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={1.75} />
                </Button>
              </Link>

              <Link to="/signup" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="tams-btn-secondary w-full sm:w-auto h-11 md:h-10 px-5 rounded-xl text-xs sm:text-sm font-semibold bg-white border border-[#CBD5E1] text-[#0F172A] hover:bg-[#F1F5F9] transition-all"
                >
                  Sign Up Free
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter compact />
    </div>
  );
}

export default function PublicHomepage() {
  return (
    <PublicErrorBoundary pageName="Home">
      <HomepageContent />
    </PublicErrorBoundary>
  );
}
