import React from "react";
import { Link } from "react-router-dom";
import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeoHead } from "@/components/SeoHead";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicErrorBoundary } from "@/components/public/PublicErrorBoundary";
import { PRICING_PLANS } from "@/config/pricingPlans";

function PricingPageContent() {
  return (
    <div className="min-h-screen bg-[#F8F6F1] dark:bg-[#070D1E] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      <SeoHead
        title="Pricing — TAMS Pro Travel Agency Management System"
        description="Simple and transparent pricing for travel agencies. Monthly and yearly subscription plans."
        path="/pricing"
      />

      <PublicHeader currentPath="/pricing" />

      <main className="flex-1 py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-[1200px] mx-auto w-full flex flex-col justify-between">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-12">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-[#C9A961] block mb-2">
            PRICING
          </span>
          <h1 className="font-serif text-3xl sm:text-5xl font-normal text-slate-900 dark:text-slate-100 tracking-tight">
            Choose your plan
          </h1>
        </div>

        {/* 2 Plan Cards Side-by-Side (Equal height, scaled token skin) */}
        <div className="max-w-[820px] mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch my-auto">
          {PRICING_PLANS.map((plan) => {
            const isPopular = plan.popular;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-6 sm:p-8 flex flex-col justify-between bg-white dark:bg-[#0E1B3B] shadow-sm transition-all duration-200 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 ${
                  isPopular
                    ? "border-2 border-[#C9A961] shadow-md shadow-[#C9A961]/5"
                    : "border border-[#E6E2D8] dark:border-[#1A294E] hover:border-[#C9A961] dark:hover:border-[#C9A961]"
                }`}
              >
                {/* Popular Pill */}
                {isPopular && (
                  <div className="absolute -top-3 right-6">
                    <span className="bg-[#C9A961] text-[#0B1530] text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full shadow-sm">
                      Most Popular
                    </span>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {plan.name}
                    </h2>
                    <span className="text-[11px] font-semibold text-[#C9A961] bg-[#C9A961]/10 px-2 py-0.5 rounded">
                      {plan.discountBadge}
                    </span>
                  </div>

                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
                      {plan.priceFormatted}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {plan.period}
                    </span>
                  </div>

                  <div className="mt-1 text-xs text-slate-400 line-through">
                    was {plan.originalPriceFormatted}
                  </div>

                  {/* Bullets with gold check icon */}
                  <ul className="mt-6 space-y-2.5 border-t border-[#E6E2D8] dark:border-[#1A294E] pt-6 text-sm text-slate-700 dark:text-slate-300">
                    {plan.bullets.map((bullet, idx) => (
                      <li key={idx} className="flex items-center gap-2.5">
                        <div className="w-4 h-4 rounded-full bg-[#C9A961]/15 text-[#C9A961] flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 text-[#C9A961]" strokeWidth={2} />
                        </div>
                        <span className="text-xs sm:text-sm">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 pt-4">
                  <Link to={plan.ctaLink} className="block w-full">
                    <Button
                      size="lg"
                      className={`w-full h-11 text-xs sm:text-sm font-semibold justify-center gap-2 transition-all ${
                        isPopular
                          ? "bg-[#0B1530] text-white hover:bg-[#122146] border border-[#C9A961]/40 shadow-sm"
                          : "border border-[#E6E2D8] dark:border-[#1A294E] bg-transparent text-slate-900 dark:text-slate-100 hover:bg-black/5 dark:hover:bg-white/5"
                      }`}
                    >
                      <span>{plan.ctaText}</span>
                      <ArrowRight className="w-4 h-4 text-[#C9A961]" strokeWidth={1.5} />
                    </Button>
                  </Link>
                </div>
              </div>
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
