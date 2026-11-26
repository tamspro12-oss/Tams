import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeoHead } from "@/components/SeoHead";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicErrorBoundary } from "@/components/public/PublicErrorBoundary";
import { useAuth } from "@/hooks/useAuth";
import { CONTACT_CHANNELS } from "@/config/marketingContent";

function TermsOfServiceContent() {
  const { user } = useAuth();

  return (
    <div className="tams-public-landing min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col">
      <SeoHead
        title="Terms & Conditions — TAMS Pro"
        description="Terms and conditions governing use of TAMS Pro travel agency management software."
        path="/terms"
      />

      <PublicHeader currentPath="/terms" />

      <main className="flex-1 py-10 sm:py-14 px-4 sm:px-6 lg:px-8 max-w-[920px] mx-auto w-full space-y-8">
        {user && (
          <div>
            <Link to="/app/settings">
              <Button
                variant="outline"
                size="sm"
                className="tams-btn-secondary h-9 px-4 rounded-xl text-xs font-semibold gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Settings</span>
              </Button>
            </Link>
          </div>
        )}

        <div className="text-center max-w-2xl mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 text-[#0F5E63] flex items-center justify-center mx-auto mb-4 shadow-xs">
            <Scale className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <span className="text-xs font-semibold tracking-widest uppercase text-[#0F5E63] block mb-2">
            PLATFORM TERMS
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#0F172A] tracking-tight">
            Terms &amp; Conditions
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-[#64748B]">
            Effective Date: November 2026
          </p>
        </div>

        <div className="tams-card rounded-2xl bg-white p-6 sm:p-9 space-y-6 text-sm text-[#475569] leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-[#0F172A]">1. Acceptance of Terms</h2>
            <p>
              By creating an account or using TAMS Pro, you agree to these Terms &amp; Conditions on behalf of your travel agency. TAMS Pro provides cloud-based travel agency management software for booking, invoicing, voucher, and PKR accounting operations.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-[#0F172A]">2. Plans, Free Trial &amp; Subscriptions</h2>
            <ul className="list-disc list-inside space-y-1.5 ml-1">
              <li>New agency accounts receive a 14-day free trial to evaluate platform capabilities</li>
              <li>
                Paid subscriptions are available on the <strong>Monthly Plan (PKR 1,999 / month)</strong> with no monthly discount, or the <strong>Yearly Plan (PKR 9,999 / year, was PKR 19,999 — 50% OFF exclusively on the yearly plan)</strong>
              </li>
              <li>
                Cancellation and refund eligibility are governed by our{" "}
                <Link to="/refund-policy" className="font-semibold text-[#0F5E63] hover:underline">
                  Refund &amp; Cancellation Policy
                </Link>
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-[#0F172A]">3. Agency Data Ownership &amp; Isolation</h2>
            <ul className="list-disc list-inside space-y-1.5 ml-1">
              <li>All client, booking, vendor, and ledger records entered by your team remain your property</li>
              <li>Data is strictly isolated per agency via Row-Level Security (RLS)</li>
              <li>You are encouraged to export periodic backups using Settings &rarr; Storage &amp; Backup</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-[#0F172A]">4. Acceptable Use &amp; Agency Responsibilities</h2>
            <ul className="list-disc list-inside space-y-1.5 ml-1">
              <li>Maintain accurate booking, passenger, and financial entries and safeguard login passwords</li>
              <li>Ensure sub-user permissions match each staff member&apos;s authorized role</li>
              <li>Use connected agency Gmail accounts only for legitimate client travel documents and notices, never unsolicited spam</li>
              <li>Comply with all applicable travel, regulatory, and tax laws in Pakistan</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-[#0F172A]">5. Service Availability &amp; Updates</h2>
            <p>
              We work continuously to maintain reliable 24/7 cloud access and ship non-disruptive improvements. Scheduled maintenance or third-party infrastructure interruptions may occasionally affect availability.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-[#0F172A]">6. Intellectual Property</h2>
            <p>
              The TAMS Pro software, interface, brand assets, and published guides belong to TAMS Pro. Your agency&apos;s uploaded logo, templates, and operational records remain yours.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-[#0F172A]">7. Limitation of Liability</h2>
            <p>
              Your agency is responsible for verifying ticket fares, visa rules, hotel dates, and financial entries before issuing travel documents to passengers. To the maximum extent permitted by law, TAMS Pro&apos;s total aggregate liability is limited to the subscription fees paid by your agency for the active billing period.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-[#0F172A]">8. Governing Law</h2>
            <p>
              These Terms &amp; Conditions are governed by the laws of Pakistan, and any disputes shall be subject to the jurisdiction of the courts of Pakistan.
            </p>
          </section>

          <section className="space-y-2 pt-2 border-t border-slate-200/80">
            <h2 className="text-lg font-bold text-[#0F172A]">9. Contact</h2>
            <p>
              For legal or account inquiries, email{" "}
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
      </main>

      <PublicFooter />
    </div>
  );
}

export default function TermsOfService() {
  return (
    <PublicErrorBoundary pageName="Terms & Conditions">
      <TermsOfServiceContent />
    </PublicErrorBoundary>
  );
}
