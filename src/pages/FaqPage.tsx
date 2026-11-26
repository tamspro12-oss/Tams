import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { HelpCircle, Mail, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SeoHead } from "@/components/SeoHead";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicErrorBoundary } from "@/components/public/PublicErrorBoundary";
import { CONTACT_CHANNELS } from "@/config/marketingContent";

interface FaqEntry {
  id: string;
  question: string;
  answer: string;
}

const FAQ_ENTRIES: FaqEntry[] = [
  {
    id: "what-is-tams",
    question: "What does TAMS Pro include for a travel agency?",
    answer:
      "TAMS Pro brings airline ticket, Umrah, hotel, and visa bookings together with automated PKR client and vendor ledgers, Cash & Bank accounts, travel queries, branded PDF quotations, booking confirmations, invoices, vouchers, an integrated Umrah Cost Calculator, deadline reminders, and financial reports.",
  },
  {
    id: "pricing-plans",
    question: "How much does TAMS Pro cost?",
    answer:
      "TAMS Pro offers two plans in Pakistani Rupees: the Monthly plan is PKR 1,999 / month (standard monthly rate with no discount), and the Yearly plan is PKR 9,999 / year (was PKR 19,999 — 50% OFF exclusively on the yearly plan). New accounts start with a 14-day free trial.",
  },
  {
    id: "monthly-vs-yearly",
    question: "Is the 50% discount available on the monthly plan?",
    answer:
      "No. The Monthly plan is billed at the regular price of PKR 1,999 / month with no discount. The 50% OFF discount applies only to the Yearly plan (PKR 9,999 / year, down from PKR 19,999).",
  },
  {
    id: "data-privacy",
    question: "Can other agencies or third parties see my clients or vendor rates?",
    answer:
      "Never. Every agency account in TAMS Pro is protected by strict PostgreSQL Row-Level Security (RLS). Your clients, passengers, sub-agents, vendor payables, templates, and financial balances are completely private to your agency.",
  },
  {
    id: "umrah-calculator",
    question: "How do I calculate Umrah packages inside TAMS Pro?",
    answer:
      "Open Umrah Calculator from the left sidebar inside your workspace, enter the current SAR-to-PKR exchange rate, add your Makkah and Madinah hotels, nights, and room-sharing mode (Sharing, Quint, Quad, Triple, or Double), enter visa, transport, ziyarat, and airfare costs plus your target margin, and export a PDF breakdown or convert directly into a client quotation.",
  },
  {
    id: "agency-gmail",
    question: "How does sending invoices and vouchers by email work?",
    answer:
      "Each agency connects its own Gmail address and 16-character Google App Password under Settings → Email. Your App Password is encrypted server-side and never exposed to the browser. When you click 'Send by email' on an invoice, voucher, quotation, or booking confirmation, the PDF is sent directly from your agency's own Gmail with your agency name.",
  },
  {
    id: "devices-pwa",
    question: "Does TAMS Pro work on mobile phones as well as office computers?",
    answer:
      "Yes. TAMS Pro runs in modern browsers on Windows, Mac, Android, and iPhone/iPad, and can also be installed to your desktop or phone home screen as a Progressive Web App (PWA) from the Install page.",
  },
  {
    id: "sub-users",
    question: "Can my counter staff have separate logins?",
    answer:
      "Yes. Agency owners can create sub-user accounts with controlled permissions so staff can manage daily queries, quotations, and bookings while sensitive owner settings and audit histories remain protected.",
  },
  {
    id: "cancel-export",
    question: "Can I cancel anytime and export my agency data?",
    answer:
      "Yes. There are no long-term lock-in contracts. You can export your agency records from Settings → Storage & Backup at any time, and cancel your subscription before the next renewal date.",
  },
  {
    id: "support",
    question: "How can I reach TAMS Pro support?",
    answer:
      "You can email us anytime at tamspro12@gmail.com or reach out via WhatsApp and phone on our Contact page for onboarding and technical assistance.",
  },
];

function FaqPageContent() {
  const faqJsonLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ_ENTRIES.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    }),
    []
  );

  return (
    <div className="tams-public-landing min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col">
      <SeoHead
        title="FAQ — TAMS Pro Travel Agency Management System"
        description="Frequently asked questions about TAMS Pro pricing, data security, Umrah Calculator, agency Gmail setup, and subscriptions."
        path="/faq"
        jsonLd={faqJsonLd}
      />

      <PublicHeader currentPath="/faq" />

      <main className="flex-1 py-10 sm:py-14 px-4 sm:px-6 lg:px-8 max-w-[920px] mx-auto w-full space-y-8 sm:space-y-10">
        <div className="text-center max-w-2xl mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 text-[#0F5E63] flex items-center justify-center mx-auto mb-4 shadow-xs">
            <HelpCircle className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <span className="text-xs font-semibold tracking-widest uppercase text-[#0F5E63] block mb-2">
            FREQUENTLY ASKED QUESTIONS
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#0F172A] tracking-tight">
            Clear answers for travel agencies
          </h1>
          <p className="mt-3 text-sm sm:text-base text-[#475569]">
            Everything you need to know about plans, security, accounting, and setup on TAMS Pro.
          </p>
        </div>

        <div className="tams-card rounded-2xl bg-white p-5 sm:p-8">
          <Accordion type="single" collapsible className="w-full divide-y divide-slate-200/80">
            {FAQ_ENTRIES.map((item) => (
              <AccordionItem key={item.id} value={item.id} className="border-none">
                <AccordionTrigger className="py-4 text-left text-sm sm:text-base font-semibold text-[#0F172A] hover:text-[#0F5E63] hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="pb-4 text-xs sm:text-sm text-[#475569] leading-relaxed">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <div className="tams-card tams-banner-card rounded-2xl bg-white p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#0F172A]">
              Still have a question?
            </h2>
            <p className="text-xs sm:text-sm text-[#475569] mt-1 flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-[#0F5E63] shrink-0" />
              <span>Write to us at</span>
              <a
                href={CONTACT_CHANNELS.email.href}
                className="font-semibold text-[#0F5E63] hover:underline"
              >
                {CONTACT_CHANNELS.email.value}
              </a>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link to="/pricing">
              <Button
                variant="outline"
                className="tams-btn-secondary h-10 px-4 rounded-xl text-xs sm:text-sm font-semibold"
              >
                View Pricing
              </Button>
            </Link>
            <Link to="/signup">
              <Button className="tams-btn-primary h-10 px-5 rounded-xl text-xs sm:text-sm font-semibold gap-1.5 bg-[#0F5E63] text-white hover:bg-[#0B4A4E]">
                <span>Start Free Trial</span>
                <ArrowRight className="w-4 h-4 text-teal-100" strokeWidth={1.75} />
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

export default function FaqPage() {
  return (
    <PublicErrorBoundary pageName="FAQ">
      <FaqPageContent />
    </PublicErrorBoundary>
  );
}

