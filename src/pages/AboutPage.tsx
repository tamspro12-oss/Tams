import React from "react";
import { Link } from "react-router-dom";
import {
  Plane,
  ShieldCheck,
  Calculator,
  FileCheck,
  Receipt,
  Users,
  Lock,
  Mail,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeoHead } from "@/components/SeoHead";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicErrorBoundary } from "@/components/public/PublicErrorBoundary";
import { CONTACT_CHANNELS } from "@/config/marketingContent";

const PILLARS = [
  {
    icon: Receipt,
    title: "Built for PKR Agency Accounting",
    description:
      "Every ticket, visa, and Umrah booking connects client receivables, supplier payables, payment vouchers, and Cash/Bank accounts in real time.",
  },
  {
    icon: Calculator,
    title: "Integrated Umrah Costing & Vouchers",
    description:
      "Price Makkah and Madinah packages across Sharing, Quint, Quad, Triple, and Double rooms with SAR-to-PKR conversion and issue branded vouchers.",
  },
  {
    icon: FileCheck,
    title: "Branded Agency Documents",
    description:
      "Generate sequential PDF quotations, booking confirmations, invoices, and payment receipts carrying your agency's own logo, colors, and contact details.",
  },
  {
    icon: ShieldCheck,
    title: "Strict Per-Agency Data Isolation",
    description:
      "Your passengers, sub-agents, vendors, bank balances, and email credentials stay isolated to your workspace using database Row-Level Security (RLS).",
  },
  {
    icon: Users,
    title: "Owner & Staff Role Controls",
    description:
      "Invite counter staff with role-based permissions while keeping master settings, financial audit logs, and sensitive actions under owner control.",
  },
  {
    icon: Lock,
    title: "Agency-Owned Communication",
    description:
      "Connect your agency's own Gmail App Password in Settings so invoices, vouchers, quotations, and confirmations go out directly under your agency name.",
  },
];

function AboutPageContent() {
  return (
    <div className="public-site tams-public-landing min-h-screen bg-[var(--bg,#F8F5EE)] text-[var(--ink,#0B1F2A)] flex flex-col">
      <SeoHead
        title="About — TAMS Pro Travel Agency Management System"
        description="Learn about TAMS Pro, cloud travel agency management software built for ticketing, Umrah, and visa agencies in Pakistan."
        path="/about"
      />

      <PublicHeader currentPath="/about" />

      <main className="flex-1 py-10 sm:py-14 px-4 sm:px-6 lg:px-8 max-w-[1120px] mx-auto w-full space-y-10 sm:space-y-12">
        {/* Hero */}
        <section className="text-center max-w-3xl mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-[var(--tint,#E4F2EF)] border border-[var(--border,#E5E0D3)] text-[var(--primary,#0F5C63)] flex items-center justify-center mx-auto mb-5 shadow-xs">
            <Plane className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <span className="text-xs font-semibold tracking-widest uppercase text-[var(--primary,#0F5C63)] block mb-2">
            ABOUT TAMS PRO
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-bold text-[var(--ink,#0B1F2A)] tracking-tight leading-tight">
            Practical cloud software built for Pakistani travel agencies
          </h1>
          <p className="mt-4 text-sm sm:text-base lg:text-lg text-[var(--body,#4A5A63)] leading-relaxed">
            TAMS Pro replaces scattered paper registers, carbon receipt books, and fragile spreadsheets with one unified workspace for airline ticketing, Umrah packages, visa tracking, quotations, branded PDFs, and PKR ledgers.
          </p>
        </section>

        {/* Core Pillars */}
        <section aria-labelledby="about-pillars-heading">
          <h2 id="about-pillars-heading" className="sr-only">
            How TAMS Pro Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {PILLARS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="tams-card group rounded-2xl bg-[var(--card,#FFFFFF)] p-6 flex flex-col gap-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-[var(--tint,#E4F2EF)] border border-[var(--border,#E5E0D3)] text-[var(--primary,#0F5C63)] flex items-center justify-center group-hover:border-[var(--accent,#C9A24B)] group-hover:transition-colors group-hover:duration-200">
                    <Icon className="w-5 h-5" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-base font-bold text-[var(--ink,#0B1F2A)] tracking-tight">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[var(--body,#4A5A63)] leading-relaxed">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Transparent Pricing & Data Ownership Note */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="tams-card rounded-2xl bg-[var(--card,#FFFFFF)] p-6 sm:p-7 space-y-3">
            <span className="text-[11px] font-semibold tracking-widest uppercase text-[var(--primary,#0F5C63)] block">
              YOUR DATA, YOUR AGENCY
            </span>
            <h2 className="text-xl font-bold text-[var(--ink,#0B1F2A)] tracking-tight">
              Complete ownership and privacy
            </h2>
            <p className="text-xs sm:text-sm text-[var(--body,#4A5A63)] leading-relaxed">
              We never sell, rent, or share your passenger lists, vendor rates, or financial records. Every agency workspace is strictly isolated in the database, and you can export your records at any time from Settings.
            </p>
            <div className="pt-1 flex flex-wrap gap-4 text-xs font-semibold text-[var(--primary,#0F5C63)]">
              <Link to="/privacy" className="hover:underline hover:text-[var(--primary-hover,#0B4A50)] hover:transition-colors hover:duration-200">
                Read Privacy Policy &rarr;
              </Link>
              <Link to="/terms" className="hover:underline hover:text-[var(--primary-hover,#0B4A50)] hover:transition-colors hover:duration-200">
                Read Terms &amp; Conditions &rarr;
              </Link>
            </div>
          </div>

          <div className="tams-card rounded-2xl bg-[var(--card,#FFFFFF)] p-6 sm:p-7 space-y-3">
            <span className="text-[11px] font-semibold tracking-widest uppercase text-[var(--primary,#0F5C63)] block">
              SIMPLE PKR PLANS
            </span>
            <h2 className="text-xl font-bold text-[var(--ink,#0B1F2A)] tracking-tight">
              Predictable pricing with zero per-booking fees
            </h2>
            <p className="text-xs sm:text-sm text-[var(--body,#4A5A63)] leading-relaxed">
              Start with a 14-day free trial to test every module with your desk workflow. Continue on the Monthly plan at <strong>PKR 1,999 / month</strong>, or choose the Yearly plan at <strong>PKR 9,999 / year</strong> (was PKR 19,999 — <strong>50% OFF</strong> exclusively on the yearly plan).
            </p>
            <div className="pt-1 flex flex-wrap gap-4 text-xs font-semibold text-[var(--primary,#0F5C63)]">
              <Link to="/pricing" className="hover:underline hover:text-[var(--primary-hover,#0B4A50)] hover:transition-colors hover:duration-200">
                Compare Plans &rarr;
              </Link>
              <Link to="/refund-policy" className="hover:underline hover:text-[var(--primary-hover,#0B4A50)] hover:transition-colors hover:duration-200">
                Refund &amp; Cancellation Policy &rarr;
              </Link>
            </div>
          </div>
        </section>

        {/* Contact & CTA Banner */}
        <section className="tams-card tams-banner-card rounded-2xl bg-[var(--card,#FFFFFF)] p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <h2 className="text-lg sm:text-xl font-bold text-[var(--ink,#0B1F2A)] tracking-tight">
              Have questions before setting up your agency?
            </h2>
            <p className="text-xs sm:text-sm text-[var(--body,#4A5A63)] flex flex-wrap items-center gap-1.5">
              <Mail className="w-4 h-4 text-[var(--primary,#0F5C63)] shrink-0" />
              <span>Email our team directly at</span>
              <a
                href={CONTACT_CHANNELS.email.href}
                className="font-semibold text-[var(--primary,#0F5C63)] hover:underline"
              >
                {CONTACT_CHANNELS.email.value}
              </a>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link to="/contact">
              <Button
                variant="outline"
                className="tams-btn-secondary h-10 px-5 rounded-xl text-xs sm:text-sm font-semibold"
              >
                Contact Support
              </Button>
            </Link>
            <Link to="/signup">
              <Button className="tams-btn-primary h-10 px-5 rounded-xl text-xs sm:text-sm font-semibold gap-1.5 bg-[var(--primary,#0F5C63)] text-white hover:bg-[var(--primary-hover,#0B4A50)]">
                <span>Sign Up Free</span>
                <ArrowRight className="w-4 h-4 text-[#E4F2EF]" strokeWidth={1.75} />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

export default function AboutPage() {
  return (
    <PublicErrorBoundary pageName="About">
      <AboutPageContent />
    </PublicErrorBoundary>
  );
}
