import React from "react";
import { Link } from "react-router-dom";
import {
  Plane,
  ArrowRight,
  CalendarCheck,
  Users,
  Ticket,
  Receipt,
  Landmark,
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
  { id: "b2b-agents", title: "B2B Agents", icon: Users },
  { id: "vouchers", title: "Vouchers", icon: Ticket },
  { id: "ledger", title: "Ledger", icon: Receipt },
  { id: "bank-cash", title: "Bank & Cash", icon: Landmark },
  { id: "quotes", title: "Quotes", icon: FileText },
  { id: "umrah-calc", title: "Umrah Calculator", icon: Calculator },
  { id: "reports", title: "Reports", icon: BarChart3 },
];

function HomepageContent() {
  return (
    <div className="min-h-screen bg-[#F8F6F1] dark:bg-[#070D1E] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      <SeoHead
        title="TAMS Pro — Travel Agency Management System"
        description="Bookings, agents, accounts and vouchers in one place."
        path="/"
      />

      <PublicHeader currentPath="/" />

      <main className="flex-1 flex flex-col justify-between">
        {/* Section A: Hero */}
        <section className="pt-16 pb-12 sm:pt-24 sm:pb-16 px-4 sm:px-6 lg:px-8 text-center max-w-[1200px] mx-auto w-full">
          <div className="w-10 h-10 rounded-xl bg-[#C9A961]/10 dark:bg-[#C9A961]/15 text-[#C9A961] flex items-center justify-center mx-auto mb-6 border border-[#C9A961]/30">
            <Plane className="w-5 h-5 text-[#C9A961]" strokeWidth={1.5} />
          </div>

          <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-normal text-slate-900 dark:text-slate-100 tracking-tight leading-[1.15] max-w-4xl mx-auto">
            Travel Agency Management System
          </h1>

          <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
            Bookings, agents, accounts and vouchers in one place.
          </p>

          <div className="mt-8 flex items-center justify-center gap-3">
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
        </section>

        {/* Section B: 8 Equal Tiles Strip */}
        <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-[1200px] mx-auto w-full text-center">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
            {STRIP_ITEMS.map((item) => (
              <Tile
                key={item.id}
                icon={item.icon}
                title={item.title}
                compact
                to="/features"
              />
            ))}
          </div>

          <div className="mt-6">
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
        <section className="border-t border-[#E6E2D8] dark:border-[#1A294E] py-10 px-4 sm:px-6 lg:px-8 text-center bg-white/40 dark:bg-[#070D1E]/40">
          <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
            <h2 className="font-serif text-xl sm:text-2xl text-slate-900 dark:text-slate-100">
              Ready to get started?
            </h2>

            <div className="flex items-center gap-3">
              <Link to="/login">
                <Button
                  size="sm"
                  className="h-9 px-4 text-xs font-semibold gap-1.5 bg-[#0B1530] text-white hover:bg-[#122146] border border-[#1A294E]"
                >
                  <span>Login</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#C9A961]" strokeWidth={1.5} />
                </Button>
              </Link>

              <Link to="/signup">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-4 text-xs font-semibold border-[#E6E2D8] dark:border-[#1A294E] text-slate-800 dark:text-slate-200"
                >
                  Sign Up Free
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
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
