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
import { PRODUCTION_APP_ORIGIN } from "@/lib/authRedirect";

function ContactPageContent() {
  const contactJsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ContactPage",
      name: "Contact TAMS Pro",
      url: `${PRODUCTION_APP_ORIGIN}/contact`,
      mainEntity: {
        "@type": "Organization",
        name: "TAMS Pro",
        url: PRODUCTION_APP_ORIGIN,
        email: CONTACT_CHANNELS.email.value,
        telephone: "+92-319-0846768",
        areaServed: "PK",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: `${PRODUCTION_APP_ORIGIN}/`,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Contact",
          item: `${PRODUCTION_APP_ORIGIN}/contact`,
        },
      ],
    },
  ];

  return (
    <div className="public-site tams-public-landing min-h-screen bg-[var(--bg,#F8F5EE)] text-[var(--ink,#0B1F2A)] flex flex-col">
      <SeoHead
        title="Contact — TAMS Pro Travel Agency Management System"
        description="Contact TAMS Pro support, sales, and onboarding via email (tamspro12@gmail.com), WhatsApp, or phone (+92 319 0846768) for travel agency software in Pakistan."
        path="/contact"
        jsonLd={contactJsonLd}
      />

      <PublicHeader currentPath="/contact" />

      <main className="flex-1 py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-[1200px] mx-auto w-full flex flex-col justify-between">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-12">
          <span className="text-xs font-semibold tracking-widest uppercase text-[var(--primary,#0F5C63)] block mb-2.5">
            CONTACT
          </span>
          <h1 className="text-3xl sm:text-5xl font-bold text-[var(--ink,#0B1F2A)] tracking-tight">
            Get in touch
          </h1>
        </div>

        <div className="max-w-[840px] mx-auto w-full my-auto space-y-5">
          {/* Row of 3 equal Tile boxes */}
          <div className="tams-contact-grid tams-grid-gap grid grid-cols-1 md:grid-cols-3 gap-4">
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

          {/* Under it: Full-width rounded-2xl horizontal banner */}
          <div className="tams-card tams-banner-card rounded-2xl p-6 sm:p-8 bg-[var(--card,#FFFFFF)] flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--ink,#0B1F2A)] tracking-tight">
                Request account access
              </h2>
              <p className="text-xs sm:text-sm text-[var(--body,#4A5A63)] mt-1">
                Create your agency account to get started immediately.
              </p>
              <p className="text-xs text-[var(--body,#4A5A63)] mt-1.5 font-normal">
                Replies within 24 hours.
              </p>
            </div>

            <Link to="/signup" className="w-full md:w-auto shrink-0">
              <Button
                size="lg"
                className="tams-btn-primary group w-full md:w-auto h-11 px-6 rounded-xl text-xs sm:text-sm font-semibold gap-2 bg-[var(--primary,#0F5C63)] text-white hover:bg-[var(--primary-hover,#0B4A50)] shadow-sm"
              >
                <span>Sign Up Free</span>
                <ArrowRight className="w-4 h-4 text-[#E4F2EF] group-hover:translate-x-0.5 group-hover:transition-transform group-hover:duration-200" strokeWidth={1.75} />
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
