import React from "react";
import { Link } from "react-router-dom";
import { Mail, MessageCircle, Phone, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeoHead } from "@/components/SeoHead";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicErrorBoundary } from "@/components/public/PublicErrorBoundary";
import { Tile } from "@/components/public/Tile";
import { CONTACT_CHANNELS } from "@/config/marketingContent";

function ContactPageContent() {
  return (
    <div className="min-h-screen bg-[#F8F6F1] dark:bg-[#070D1E] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      <SeoHead
        title="Contact — TAMS Pro Travel Agency Management System"
        description="Get in touch with TAMS Pro support, sales, and account onboarding."
        path="/contact"
      />

      <PublicHeader currentPath="/contact" />

      <main className="flex-1 py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-[1200px] mx-auto w-full flex flex-col justify-between">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-12">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-[#C9A961] block mb-2">
            CONTACT
          </span>
          <h1 className="font-serif text-3xl sm:text-5xl font-normal text-slate-900 dark:text-slate-100 tracking-tight">
            Get in touch
          </h1>
        </div>

        <div className="max-w-[820px] mx-auto w-full my-auto space-y-4">
          {/* Row of 3 equal Tile boxes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Tile
              icon={Mail}
              title={CONTACT_CHANNELS.email.label}
              caption={CONTACT_CHANNELS.email.value}
              href={CONTACT_CHANNELS.email.href}
            />
            <Tile
              icon={MessageCircle}
              title={CONTACT_CHANNELS.whatsapp.label}
              caption={CONTACT_CHANNELS.whatsapp.value}
              href={CONTACT_CHANNELS.whatsapp.href}
            />
            <Tile
              icon={Phone}
              title={CONTACT_CHANNELS.phone.label}
              caption={CONTACT_CHANNELS.phone.value}
              href={CONTACT_CHANNELS.phone.href}
            />
          </div>

          {/* Under it: One wide tile in the same skin */}
          <div className="rounded-2xl p-6 sm:p-7 border border-[#E6E2D8] dark:border-[#1A294E] bg-white dark:bg-[#0E1B3B] shadow-sm hover:border-[#C9A961] dark:hover:border-[#C9A961] transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100">
                Request account access
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                Create your agency account to get started immediately.
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 font-normal">
                Replies within 24 hours.
              </p>
            </div>

            <Link to="/signup" className="shrink-0">
              <Button
                size="lg"
                className="w-full sm:w-auto h-11 px-6 text-xs sm:text-sm font-semibold gap-2 bg-[#0B1530] text-white hover:bg-[#122146] border border-[#1A294E] shadow-sm"
              >
                <span>Sign Up Free</span>
                <ArrowRight className="w-4 h-4 text-[#C9A961]" strokeWidth={1.5} />
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-8 text-center" />
      </main>

      <PublicFooter />
    </div>
  );
}

export default function ContactPage() {
  return (
    <PublicErrorBoundary pageName="Contact">
      <ContactPageContent />
    </PublicErrorBoundary>
  );
}
