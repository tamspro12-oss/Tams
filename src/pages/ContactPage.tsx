import React from "react";
import { Link } from "react-router-dom";
import { Mail, MessageCircle, Phone, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeoHead } from "@/components/SeoHead";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicErrorBoundary } from "@/components/public/PublicErrorBoundary";
import { PublicReveal } from "@/components/public/PublicReveal";
import { Tile } from "@/components/public/Tile";
import { CONTACT_CHANNELS } from "@/config/marketingContent";

function ContactPageContent() {
  return (
    <div className="tams-public-landing min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col">
      <SeoHead
        title="Contact — TAMS Pro Travel Agency Management System"
        description="Get in touch with TAMS Pro support, sales, and account onboarding."
        path="/contact"
      />

      <PublicHeader currentPath="/contact" />

      <main className="flex-1 py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-[1200px] mx-auto w-full flex flex-col justify-between">
        {/* Header */}
        <PublicReveal className="text-center mb-10 sm:mb-12">
          <span className="text-xs font-semibold tracking-widest uppercase text-[#0F5E63] block mb-2.5">
            CONTACT
          </span>
          <h1 className="text-3xl sm:text-5xl font-bold text-[#0F172A] tracking-tight">
            Get <span className="tams-headline-gradient">in touch</span>
          </h1>
        </PublicReveal>

        <div className="tams-contact-surface max-w-[880px] mx-auto w-full my-auto rounded-3xl p-4 sm:p-6 space-y-5">
          {/* Row of 3 equal Tile boxes */}
          <div className="tams-contact-grid tams-grid-gap grid grid-cols-1 sm:grid-cols-3 gap-4">
            <PublicReveal delay={0}>
              <Tile
                icon={Mail}
                iconVariant="soft"
                className="tams-contact-card"
                title={CONTACT_CHANNELS.email.label}
                caption={CONTACT_CHANNELS.email.value}
                href={CONTACT_CHANNELS.email.href}
              />
            </PublicReveal>
            <PublicReveal delay={70}>
              <Tile
                icon={MessageCircle}
                iconVariant="soft"
                className="tams-contact-card"
                title={CONTACT_CHANNELS.whatsapp.label}
                caption={CONTACT_CHANNELS.whatsapp.value}
                href={CONTACT_CHANNELS.whatsapp.href}
              />
            </PublicReveal>
            <PublicReveal delay={140}>
              <Tile
                icon={Phone}
                iconVariant="soft"
                className="tams-contact-card"
                title={CONTACT_CHANNELS.phone.label}
                caption={CONTACT_CHANNELS.phone.value}
                href={CONTACT_CHANNELS.phone.href}
              />
            </PublicReveal>
          </div>

          {/* Under it: Full-width rounded-2xl horizontal banner */}
          <PublicReveal delay={140}>
            <div className="tams-card tams-banner-card rounded-2xl p-6 sm:p-8 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#0F172A] tracking-tight">
                  Request account access
                </h2>
                <p className="text-xs sm:text-sm text-[#475569] mt-1">
                  Create your agency account to get started immediately.
                </p>
                <p className="text-xs text-[#64748B] mt-1.5 font-normal">
                  Replies within 24 hours.
                </p>
              </div>

              <Link to="/signup" className="shrink-0">
                <Button
                  size="lg"
                  className="tams-btn-primary group w-full sm:w-auto h-11 px-6 rounded-xl text-xs sm:text-sm font-semibold gap-2 bg-[#0F5E63] text-white hover:bg-[#0B4A4E] shadow-sm hover:shadow-md transition-all"
                >
                  <span>Sign Up Free</span>
                  <ArrowRight className="w-4 h-4 text-teal-100 transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={1.75} />
                </Button>
              </Link>
            </div>
          </PublicReveal>
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
