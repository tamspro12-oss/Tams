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
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-[#F8F6F1] dark:bg-[#070D1E] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      <SeoHead
        title="TAMS Pro — Travel Agency Management System"
        description="Bookings, visas, accounts and vouchers, everything in one place."
        path="/"
      />

      <PublicHeader currentPath="/" />

      <main className="flex-1 min-h-0 flex flex-col justify-between">
        {/* Section A: Hero */}
        <section className="flex-1 flex flex-col justify-center py-6 lg:py-3 xl:py-6 px-4 sm:px-6 lg:px-8 text-center max-w-[1200px] mx-auto w-full">
          <div className="w-9 h-9 rounded-xl bg-[#C9A961]/10 dark:bg-[#C9A961]/15 text-[#C9A961] flex items-center justify-center mx-auto mb-3 lg:mb-3 xl:mb-4 border border-[#C9A961]/30">
            <Plane className="w-4 h-4 text-[#C9A961]" strokeWidth={1.5} />
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl lg:text-[clamp(2rem,3.3vw,3.4rem)] lg:whitespace-nowrap font-normal text-slate-900 dark:text-slate-100 tracking-tight leading-[1.15] max-w-6xl mx-auto">
            Travel Agency Management System
          </h1>

          <p className="mt-2.5 lg:mt-2 xl:mt-3 text-sm sm:text-base lg:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Bookings, visas, accounts and vouchers, everything in one place.
          </p>

          <div className="mt-5 lg:mt-4 xl:mt-6 flex items-center justify-center gap-3">
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
        </section>

        {/* Section B: 7 Equal Tiles Strip */}
        <section className="py-4 lg:py-2.5 xl:py-5 px-4 sm:px-6 lg:px-8 max-w-[1200px] mx-auto w-full text-center">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 lg:gap-3.5">
            {STRIP_ITEMS.map((item) => (
              <Tile
                key={item.id}
                icon={item.icon}
                title={item.title}
                compact
                noTruncate
                to="/features"
                className="!h-[104px] sm:!h-[110px] xl:!h-[126px] !p-3.5 xl:!p-4"
              />
            ))}
          </div>

          <div className="mt-3 lg:mt-3 xl:mt-4">
            <Link
              to="/features"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-[#C9A961] dark:hover:text-[#C9A961] transition-colors"
            >
              <span>View all features</span>
              <ArrowRight className="w-4 h-4 text-[#C9A961]" strokeWidth={1.5} />
            </Link>
          </div>
        </section>

        {/* Section C: Final CTA Thin Band */}
        <section className="border-t border-[#E6E2D8] dark:border-[#1A294E] py-4 lg:py-3 xl:py-4 px-4 sm:px-6 lg:px-8 text-center bg-white/40 dark:bg-[#070D1E]/40">
          <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5">
            <h2 className="font-serif text-lg sm:text-xl text-slate-900 dark:text-slate-100">
              Ready to get started?
            </h2>

            <div className="flex items-center gap-3">
              <Link to="/login">
                <Button
                  size="sm"
                  className="h-8 px-4 text-xs font-semibold gap-1.5 bg-[#0B1530] text-white hover:bg-[#122146] border border-[#1A294E]"
                >
                  <span>Login</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#C9A961]" strokeWidth={1.5} />
                </Button>
              </Link>

              <Link to="/signup">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-4 text-xs font-semibold border-[#E6E2D8] dark:border-[#1A294E] text-slate-800 dark:text-slate-200"
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
