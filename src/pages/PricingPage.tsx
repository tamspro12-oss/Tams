import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeoHead } from "@/components/SeoHead";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicErrorBoundary } from "@/components/public/PublicErrorBoundary";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { PRODUCTION_APP_ORIGIN } from "@/lib/authRedirect";

function PricingPageContent() {
  const { pricing } = useSiteSettings();

  const pricingJsonLd = useMemo(
    () => [
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "TAMS Pro",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        areaServed: "PK",
        url: `${PRODUCTION_APP_ORIGIN}/pricing`,
        offers: [
          {
            "@type": "Offer",
            name: "Monthly Plan",
            price: "1999",
            priceCurrency: "PKR",
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: "1999",
              priceCurrency: "PKR",
              unitText: "MONTH",
            },
            url: `${PRODUCTION_APP_ORIGIN}/pricing`,
          },
          {
            "@type": "Offer",
            name: "Yearly Plan (50% OFF)",
            price: "9999",
            priceCurrency: "PKR",
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: "9999",
              priceCurrency: "PKR",
              unitText: "YEAR",
            },
            url: `${PRODUCTION_APP_ORIGIN}/pricing`,
          },
        ],
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
            name: "Pricing",
            item: `${PRODUCTION_APP_ORIGIN}/pricing`,
          },
        ],
      },
    ],
    []
  );

  return (
    <div className="public-site tams-public-landing min-h-screen bg-[var(--bg,#F8F5EE)] text-[var(--ink,#0B1F2A)] flex flex-col">
      <SeoHead
        title="Pricing — TAMS Pro Travel Agency Management System"
        description="Simple and transparent TAMS Pro pricing for travel agencies in Pakistan: PKR 1,999/month, or PKR 9,999/year with 50% off on the yearly plan. Try 14 days free."
        path="/pricing"
        jsonLd={pricingJsonLd}
      />

      <PublicHeader currentPath="/pricing" />

      <main className="flex-1 py-4 sm:py-5 lg:py-6 px-4 sm:px-6 lg:px-8 max-w-[1120px] mx-auto w-full flex flex-col justify-center">
        {/* Compact Header */}
        <div className="text-center mb-4 sm:mb-5">
          <span className="text-[11px] font-semibold tracking-widest uppercase text-[var(--primary,#0F5C63)] block mb-1">
            {pricing.eyebrow}
          </span>
          <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-bold text-[var(--ink,#0B1F2A)] tracking-tight leading-tight">
            {pricing.heading}
          </h1>
        </div>

        {/* 2 Plan Cards Side-by-Side (1366x768 & 1440x900 single-screen fit) */}
        <div className="tams-pricing-grid tams-pricing-gap max-w-[920px] mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 items-stretch pt-2">
          {pricing.plans.map((plan) => {
            const isPopular = Boolean(plan.popular);
            const showDiscount = plan.id !== "monthly" && Boolean(plan.discountBadge?.trim());
            const showStrikethrough =
              plan.id !== "monthly" && Boolean(plan.originalPriceFormatted?.trim());

            return (
              <div
                key={plan.id}
                className={`tams-pricing-card relative rounded-2xl p-5 flex flex-col justify-between bg-[var(--card,#FFFFFF)] ${
                  isPopular
                    ? "tams-card-featured mt-2 md:mt-0"
                    : "tams-card tams-card-interactive"
                }`}
              >
                {/* Floating Gold MOST POPULAR Pill on top border */}
                {isPopular && (
                  <div className="absolute -top-3 right-5">
                    <span className="bg-[var(--accent,#C9A24B)] text-[var(--ink,#0B1F2A)] text-[10px] font-bold tracking-wider uppercase px-3 py-0.5 rounded-full shadow-sm border border-[var(--accent,#C9A24B)]">
                      Most Popular
                    </span>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-[var(--ink,#0B1F2A)] tracking-tight">
                      {plan.name}
                    </h2>
                    {showDiscount && (
                      <span className="bg-[var(--tint,#E4F2EF)] text-[var(--primary,#0F5C63)] border border-[var(--primary,#0F5C63)]/30 text-[11px] font-semibold px-2.5 py-0.5 rounded-full shrink-0">
                        {plan.discountBadge}
                      </span>
                    )}
                  </div>

                  <div className="mt-2.5 flex items-baseline flex-wrap gap-x-2 gap-y-0.5">
                    <span className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--ink,#0B1F2A)] tabular-nums">
                      {plan.priceFormatted}
                    </span>
                    <span className="text-xs sm:text-sm font-medium text-[var(--body,#4A5A63)]">
                      {plan.period}
                    </span>
                    {showStrikethrough && (
                      <span className="text-xs font-medium text-[var(--body,#4A5A63)] line-through tabular-nums">
                        was {plan.originalPriceFormatted}
                      </span>
                    )}
                  </div>

                  {/* Condensed 2-column feature list with checkmarks in --primary */}
                  <ul className="mt-3.5 pt-3.5 border-t border-[var(--border,#E5E0D3)] grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2 text-[var(--body,#4A5A63)]">
                    {plan.bullets.map((bullet, idx) => (
                      <li key={idx} className="flex items-start gap-2 min-w-0">
                        <div className="w-4 h-4 mt-0.5 rounded-full bg-[var(--tint,#E4F2EF)] border border-[var(--primary,#0F5C63)]/30 text-[var(--primary,#0F5C63)] flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 text-[var(--primary,#0F5C63)]" strokeWidth={2.5} />
                        </div>
                        <span className="text-[12.5px] leading-snug text-[var(--body,#4A5A63)] break-words">
                          {bullet}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 pt-3 border-t border-[var(--border,#E5E0D3)]">
                  <Link to={plan.ctaLink} className="block w-full">
                    <Button
                      size="default"
                      className={`group w-full h-11 md:h-10 rounded-xl text-sm font-semibold justify-center gap-2 ${
                        isPopular
                          ? "tams-btn-primary bg-[var(--primary,#0F5C63)] text-white hover:bg-[var(--primary-hover,#0B4A50)] shadow-sm"
                          : "tams-btn-secondary bg-[var(--card,#FFFFFF)] border border-[var(--border,#E5E0D3)] text-[var(--ink,#0B1F2A)]"
                      }`}
                    >
                      <span>{plan.ctaText}</span>
                      <ArrowRight
                        className={`w-4 h-4 group-hover:translate-x-1 group-hover:transition-transform group-hover:duration-200 ${
                          isPopular ? "text-[#E4F2EF]" : "text-[var(--primary,#0F5C63)]"
                        }`}
                        strokeWidth={1.75}
                      />
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <PublicFooter compact />
    </div>
  );
}

export default function PricingPage() {
  return (
    <PublicErrorBoundary pageName="Pricing">
      <PricingPageContent />
    </PublicErrorBoundary>
  );
}
