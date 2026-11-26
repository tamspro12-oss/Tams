import React from "react";
import { Link } from "react-router-dom";
import { RotateCcw, Mail, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeoHead } from "@/components/SeoHead";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicErrorBoundary } from "@/components/public/PublicErrorBoundary";
import { CONTACT_CHANNELS } from "@/config/marketingContent";

function RefundPolicyContent() {
  return (
    <div className="tams-public-landing min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col">
      <SeoHead
        title="Refund & Cancellation Policy — TAMS Pro"
        description="Review TAMS Pro's subscription cancellation, free trial, and refund rules for travel agencies."
        path="/refund-policy"
      />

      <PublicHeader currentPath="/refund-policy" />

      <main className="flex-1 py-10 sm:py-14 px-4 sm:px-6 lg:px-8 max-w-[920px] mx-auto w-full space-y-8">
        <div className="text-center max-w-2xl mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 text-[#0F5E63] flex items-center justify-center mx-auto mb-4 shadow-xs">
            <RotateCcw className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <span className="text-xs font-semibold tracking-widest uppercase text-[#0F5E63] block mb-2">
            LEGAL &amp; BILLING
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#0F172A] tracking-tight">
            Refund &amp; Cancellation Policy
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-[#64748B]">
            Effective Date: November 2026
          </p>
        </div>

        <div className="tams-card rounded-2xl bg-white p-6 sm:p-9 space-y-6 text-sm text-[#475569] leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-[#0F172A]">1. 14-Day Free Trial Before Payment</h2>
            <p>
              Every new TAMS Pro agency account includes a 14-day free trial with access to core features so your team can evaluate bookings, PKR ledgers, quotations, vouchers, and the Umrah Calculator before making any subscription payment. No charge is made during the free trial.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-[#0F172A]">2. Subscription Plans &amp; Pricing</h2>
            <ul className="list-disc list-inside space-y-1.5 ml-1">
              <li>
                <strong>Monthly Plan:</strong> PKR 1,999 / month (standard monthly billing; no discount applies to the monthly plan).
              </li>
              <li>
                <strong>Yearly Plan:</strong> PKR 9,999 / year (was PKR 19,999 — 50% OFF promotional rate applicable exclusively to the yearly plan).
              </li>
              <li>
                Changes to public plan pricing apply prospectively and never alter amounts already paid for active billing periods.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-[#0F172A]">3. Cancellation Policy</h2>
            <ul className="list-disc list-inside space-y-1.5 ml-1">
              <li>
                You may cancel your TAMS Pro subscription at any time with zero cancellation penalties or long-term lock-in contracts.
              </li>
              <li>
                To cancel a renewal, email us at{" "}
                <a
                  href={CONTACT_CHANNELS.email.href}
                  className="font-semibold text-[#0F5E63] hover:underline"
                >
                  {CONTACT_CHANNELS.email.value}
                </a>{" "}
                before your current billing cycle expires.
              </li>
              <li>
                After cancellation, your agency workspace remains accessible until the end of the paid period, and you can export all of your agency records in JSON/PDF/Excel formats from Settings.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-[#0F172A]">4. Refund Eligibility</h2>
            <ul className="list-disc list-inside space-y-1.5 ml-1">
              <li>
                Because TAMS Pro provides a full 14-day free trial prior to purchase, completed subscription payments for activated Monthly or Yearly periods are generally non-refundable once the license term has been activated on your account.
              </li>
              <li>
                <strong>Exceptions (Full or Pro-Rata Refund):</strong> We issue prompt refunds in the event of a duplicate payment, accidental overcharge, or verified billing error, or if a paid license could not be activated on our side within 48 hours of payment confirmation.
              </li>
              <li>
                Approved refund requests are processed back to your original Pakistani bank account or payment channel within 5 to 7 business days.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-[#0F172A]">5. Data Export &amp; Account Deletion</h2>
            <p>
              Your agency retains full ownership of its client, vendor, booking, and accounting data. Before cancelling or deleting your account from Settings, we recommend downloading a full backup from <strong>Settings &rarr; Storage &amp; Backup</strong>. Permanent account deletion removes your agency's stored data irreversibly.
            </p>
          </section>

          <section className="space-y-2 pt-2 border-t border-slate-200/80">
            <h2 className="text-lg font-bold text-[#0F172A]">6. Billing Support &amp; Contact</h2>
            <p>
              For any billing question, cancellation request, or duplicate-payment review, contact our team with your registered agency email and payment reference at{" "}
              <a
                href={CONTACT_CHANNELS.email.href}
                className="font-semibold text-[#0F5E63] hover:underline"
              >
                {CONTACT_CHANNELS.email.value}
              </a>
              .
            </p>
          </section>
        </div>

        <div className="tams-card tams-banner-card rounded-2xl bg-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm text-[#475569]">
            <Mail className="w-4 h-4 text-[#0F5E63] shrink-0" />
            <span>
              Questions about plans or billing? Email{" "}
              <a
                href={CONTACT_CHANNELS.email.href}
                className="font-semibold text-[#0F5E63] hover:underline"
              >
                {CONTACT_CHANNELS.email.value}
              </a>
            </span>
          </div>
          <Link to="/pricing">
            <Button className="tams-btn-primary h-10 px-5 rounded-xl text-xs sm:text-sm font-semibold gap-1.5 bg-[#0F5E63] text-white hover:bg-[#0B4A4E]">
              <span>View Plans</span>
              <ArrowRight className="w-4 h-4 text-teal-100" strokeWidth={1.75} />
            </Button>
          </Link>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

export default function RefundPolicyPage() {
  return (
    <PublicErrorBoundary pageName="Refund Policy">
      <RefundPolicyContent />
    </PublicErrorBoundary>
  );
}

