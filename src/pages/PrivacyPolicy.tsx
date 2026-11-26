import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeoHead } from "@/components/SeoHead";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicErrorBoundary } from "@/components/public/PublicErrorBoundary";
import { useAuth } from "@/hooks/useAuth";
import { CONTACT_CHANNELS } from "@/config/marketingContent";

function PrivacyPolicyContent() {
  const { user } = useAuth();

  return (
    <div className="tams-public-landing min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col">
      <SeoHead
        title="Privacy Policy — TAMS Pro"
        description="How TAMS Pro collects, uses, isolates, and protects your travel agency data."
        path="/privacy"
      />

      <PublicHeader currentPath="/privacy" />

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
            <Shield className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <span className="text-xs font-semibold tracking-widest uppercase text-[#0F5E63] block mb-2">
            PRIVACY &amp; DATA PROTECTION
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#0F172A] tracking-tight">
            Privacy Policy
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-[#64748B]">
            Effective Date: November 2026
          </p>
        </div>

        <div className="tams-card rounded-2xl bg-white p-6 sm:p-9 space-y-6 text-sm text-[#475569] leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-[#0F172A]">1. Introduction</h2>
            <p>
              Welcome to TAMS Pro (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;). This Privacy Policy explains how we collect, store, isolate, and protect information when your travel agency uses TAMS Pro at{" "}
              <a href="https://tamspro.online" className="text-[#0F5E63] font-medium hover:underline">
                https://tamspro.online
              </a>{" "}
              and our installable Progressive Web App (PWA).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-[#0F172A]">2. Information Stored in Your Workspace</h2>
            <p>To operate your agency account, TAMS Pro processes information you enter, including:</p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>Agency account details: agency name, owner/staff names, email addresses, and phone numbers</li>
              <li>Passenger &amp; client records: names, passport numbers, CNICs, phone numbers, and emails</li>
              <li>Operational records: bookings, PNRs, visas, quotations, invoices, vouchers, and supplier details</li>
              <li>Financial ledger entries: PKR receivables, payables, cash/bank accounts, and expenses</li>
              <li>Optional agency Gmail credentials: stored encrypted server-side solely to send your agency&apos;s own emails</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-[#0F172A]">3. How Information Is Used</h2>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>Delivering booking, invoicing, voucher, Umrah costing, and ledger features for your agency</li>
              <li>Sending client emails from your agency&apos;s connected Gmail only when triggered by your team</li>
              <li>Sending essential account verification, password recovery, and service notifications</li>
              <li>Maintaining platform reliability, audit trails, and security</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-[#0F172A]">4. Multi-Agency Isolation &amp; Security</h2>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>All records are encrypted in transit (HTTPS/TLS) and stored in cloud PostgreSQL storage</li>
              <li>Database Row-Level Security (RLS) enforces strict per-agency isolation—no other agency can view or query your records</li>
              <li>Connected agency Gmail App Passwords are encrypted server-side and are never returned to the browser</li>
              <li>Authenticated session controls and role-based permissions protect staff access</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-[#0F172A]">5. Zero Sale or Sharing of Agency Data</h2>
            <p className="font-semibold text-[#0F172A]">
              We do NOT sell, rent, trade, or share your passenger, vendor, or financial records with any third party or other travel agency.
            </p>
            <p>
              Your business records belong exclusively to your agency and are only disclosed if strictly required by applicable Pakistani law.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-[#0F172A]">6. Subscriptions &amp; Data Ownership</h2>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>TAMS Pro offers a Monthly plan (PKR 1,999 / month) and a Yearly plan (PKR 9,999 / year — 50% OFF on the yearly plan)</li>
              <li>You retain 100% ownership of your agency data at all times</li>
              <li>You can export your agency data in JSON, Excel, or PDF formats anytime from Settings</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-[#0F172A]">7. Your Rights &amp; Account Deletion</h2>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>Access, edit, export, or delete records directly inside your workspace</li>
              <li>Disconnect your agency Gmail credentials at any time in Settings &rarr; Email</li>
              <li>Request account deletion or privacy assistance by emailing {CONTACT_CHANNELS.email.value}</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-[#0F172A]">8. Cookies &amp; Local Storage</h2>
            <p>
              TAMS Pro uses essential browser storage solely for secure login sessions, UI preferences, and offline resilience. We do not use third-party advertising trackers.
            </p>
          </section>

          <section className="space-y-2 pt-2 border-t border-slate-200/80">
            <h2 className="text-lg font-bold text-[#0F172A]">9. Contact Us</h2>
            <p>
              For privacy inquiries or data assistance, contact us at{" "}
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

export default function PrivacyPolicy() {
  return (
    <PublicErrorBoundary pageName="Privacy Policy">
      <PrivacyPolicyContent />
    </PublicErrorBoundary>
  );
}
