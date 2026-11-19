import React from "react";
import { Link } from "react-router-dom";
import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeoHead } from "@/components/SeoHead";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicErrorBoundary } from "@/components/public/PublicErrorBoundary";
import { PublicReveal } from "@/components/public/PublicReveal";
import { PRICING_PLANS } from "@/config/pricingPlans";

function PricingPageContent() {
  return (
    <div className="tams-public-landing min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col">
      <SeoHead
        title="Pricing — TAMS Pro Travel Agency Management System"
        description="Simple and transparent pricing for travel agencies. Monthly and yearly subscription plans."
        path="/pricing"
      />

      <PublicHeader currentPath="/pricing" />

      <main className="flex-1 py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-[1200px] mx-auto w-full flex flex-col justify-between">
        {/* Header */}
        <PublicReveal className="text-center mb-10 sm:mb-12">
          <span className="text-xs font-semibold tracking-widest uppercase text-[#0F5E63] block mb-2.5">
            PRICING
          </span>
          <h1 className="text-3xl sm:text-5xl font-bold text-[#0F172A] tracking-tight">
            Choose <span className="tams-headline-gradient">your plan</span>
          </h1>
        </PublicReveal>

        {/* 2 Plan Cards Side-by-Side */}
        <div className="tams-pricing-grid tams-pricing-gap max-w-[840px] mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch my-auto">
          {PRICING_PLANS.map((plan, idx) => {
            const isPopular = plan.popular;

            return (
              <PublicReveal key={plan.id} delay={idx * 80} className="h-full">
                <div
                  className={`tams-pricing-card relative h-full rounded-2xl p-8 flex flex-col justify-between bg-white transition-all duration-200 ${
                    isPopular
                      ? "tams-card-featured"
                      : "tams-card tams-card-interactive"
                  }`}
                >
                  {/* Floating Popular Pill on top border */}
                  {isPopular && (
                    <div className="absolute -top-3.5 right-6">
                      <span className="tams-badge-gold text-[10px] font-bold tracking-wider uppercase px-3 py-1 rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-lg font-bold text-[#0F172A] tracking-tight">
                        {plan.name}
                      </h2>
                      <span className="tams-discount-pill text-xs font-semibold px-2.5 py-0.5 rounded-full">
                        {plan.discountBadge}
                      </span>
                    </div>

                    <div className="mt-5 flex items-baseline gap-2">
                      <span className="text-3xl sm:text-4xl font-bold tracking-tight text-[#0F172A] tabular-nums">
                        {plan.priceFormatted}
                      </span>
                      <span className="text-sm font-medium text-[#64748B]">
                        {plan.period}
                      </span>
                    </div>

                    <div className="mt-1.5 text-xs font-medium text-[#64748B] line-through tabular-nums">
                      was {plan.originalPriceFormatted}
                    </div>

                    {/* Bullets with circular teal-tinted check icons */}
                    <ul className="mt-6 space-y-3 border-t border-slate-200/80 pt-6 text-sm text-[#475569]">
                      {plan.bullets.map((bullet, bIdx) => (
                        <li key={bIdx} className="flex items-center gap-3">
                          <div className="w-5 h-5 rounded-full bg-teal-50 border border-teal-200/60 text-teal-700 flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3 text-teal-700" strokeWidth={2.25} />
                          </div>
                          <span className="text-sm text-[#475569]">{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-8 pt-4">
                    <Link to={plan.ctaLink} className="block w-full">
                      <Button
                        size="lg"
                        className={`group w-full h-11 rounded-xl text-sm font-semibold justify-center gap-2 transition-all ${
                          isPopular
                            ? "tams-btn-primary bg-[#0F5E63] text-white hover:bg-[#0B4A4E] shadow-sm hover:shadow-md"
                            : "tams-btn-secondary bg-white border border-[#CBD5E1] text-[#0F172A] hover:bg-[#F1F5F9]"
                        }`}
                      >
                        <span>{plan.ctaText}</span>
                        <ArrowRight
                          className={`w-4 h-4 transition-transform duration-200 group-hover:translate-x-1 ${
                            isPopular ? "text-teal-100" : "text-[#0F5E63]"
                          }`}
                          strokeWidth={1.75}
                        />
                      </Button>
                    </Link>
                  </div>
                </div>
              </PublicReveal>
            );
          })}
        </div>

        <div className="mt-8 text-center" />
      </main>

      <PublicFooter />
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
