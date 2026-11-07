import { Link } from "react-router-dom";
import {
  Calendar,
  Ticket,
  Users,
  Store,
  Scale,
  Wallet,
  Calculator,
  MessageSquare,
  BarChart3,
  Receipt,
  Shield,
  Cloud,
  Database,
  Lock,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeoHead } from "@/components/SeoHead";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicErrorBoundary } from "@/components/public/PublicErrorBoundary";
import { AppMockupPreview } from "@/components/public/AppMockupPreview";
import { HOMEPAGE_CONTENT } from "@/config/marketingContent";

// Icon mapping helper to satisfy single stroke weight and icon safety
const ICONS: Record<string, React.ElementType> = {
  Calendar,
  Ticket,
  Users,
  Store,
  Scale,
  Wallet,
  Calculator,
  MessageSquare,
  BarChart3,
  Receipt,
  Shield,
  Cloud,
  Database,
  Lock,
};

function HomepageContent() {
  const { hero, keyCapabilities, bentoHeader, featureGroups, securityTrust, closingCta } =
    HOMEPAGE_CONTENT;

  return (
    <div className="min-h-screen bg-[#fafaf9] dark:bg-[#070e17] text-foreground font-sans antialiased selection:bg-[#d4af37]/20 selection:text-foreground">
      <SeoHead
        title="TAMS Pro — High-Performance Travel Agency Management System"
        description="The dedicated cloud operating system for modern travel agencies. Unified bookings, B2B partner ledgers, service vouchers, Umrah package costing, and real-time bank accounts."
        path="/"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "TAMS Pro",
            "applicationCategory": "BusinessApplication",
            "operatingSystem": "Web, iOS, Android (PWA)",
            "description":
              "All-in-one travel agency software for bookings, B2B agent ledgers, service vouchers, Umrah costing, and financial reports.",
            "offers": {
              "@type": "Offer",
              "price": "999",
              "priceCurrency": "PKR",
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "TAMS Pro",
            "url": "https://imkaantams.online",
            "logo": "https://imkaantams.online/icons/tams-icon-512.png",
          },
        ]}
      />

      {/* Shared Public Header */}
      <PublicHeader currentPath="/" />

      <main>
        {/* HERO SECTION: Quiet Luxury Design */}
        <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 lg:pt-28 lg:pb-36 overflow-hidden">
          {/* Subtle Ambient Light Gradients (No cheap rainbow effects) */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-[#d4af37]/10 via-[#0b192c]/5 to-transparent rounded-full blur-3xl -z-10 pointer-events-none" />

          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-6">
              {/* Refined Eyebrow Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0b192c]/5 dark:bg-slate-900 border border-[#d4af37]/30 text-xs font-semibold tracking-wide text-foreground">
                <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
                <span className="text-[#0b192c] dark:text-[#d4af37]">{hero.eyebrow}</span>
              </div>

              {/* Large, Confident Headline */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground font-heading leading-[1.12]">
                {hero.title}
              </h1>

              {/* Generous, Elegant Sub-line */}
              <p className="text-base sm:text-lg lg:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto font-normal">
                {hero.subtitle}
              </p>

              {/* Two Primary Action Buttons: Login & Sign Up Free */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
                <Link to="/login" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto h-12 px-8 text-sm font-semibold tracking-tight gap-2 bg-[#0b192c] dark:bg-slate-800 text-white hover:bg-[#122846] dark:hover:bg-slate-700 border border-[#d4af37]/40 shadow-lg shadow-[#0b192c]/10 transition-all duration-200"
                  >
                    <span>{hero.primaryCta.text}</span>
                    <ArrowRight className="h-4 w-4 text-[#d4af37]" />
                  </Button>
                </Link>

                <Link to="/signup" className="w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto h-12 px-8 text-sm font-semibold tracking-tight text-foreground hover:bg-muted/60 transition-all duration-200"
                  >
                    {hero.secondaryCta.text}
                  </Button>
                </Link>
              </div>
            </div>

            {/* REAL PRODUCT VISUAL: HTML/CSS Mockup of Actual App */}
            <div className="mt-14 sm:mt-16 lg:mt-20">
              <AppMockupPreview />
            </div>
          </div>
        </section>

        {/* 4-COLUMN CAPABILITIES STRIP */}
        <section className="border-y border-border/60 bg-muted/20 py-12">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
              {keyCapabilities.map((item, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#d4af37] shrink-0" />
                    <h3 className="text-sm font-bold tracking-tight text-foreground font-heading">
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CORE FEATURES: BENTO-GRID GROUPED ARCHITECTURE */}
        <section className="py-20 sm:py-28 lg:py-32">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
            {/* Section Header */}
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#d4af37]">
                {bentoHeader.badge}
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground font-heading">
                {bentoHeader.title}
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                {bentoHeader.subtitle}
              </p>
            </div>

            {/* Feature Groups (Grouped exactly as requested) */}
            <div className="space-y-16">
              {featureGroups.map((group, groupIdx) => (
                <div key={group.id} className="space-y-6">
                  {/* Group Header Banner */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#d4af37] px-2 py-0.5 rounded bg-[#d4af37]/10 border border-[#d4af37]/20">
                          {group.groupBadge}
                        </span>
                        <h3 className="text-lg sm:text-xl font-bold tracking-tight text-foreground font-heading">
                          {group.groupTitle}
                        </h3>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {group.groupDescription}
                      </p>
                    </div>
                  </div>

                  {/* 2-Card Bento Pair for Group */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {group.features.map((feature) => {
                      const IconComponent = ICONS[feature.iconName] || Calendar;

                      return (
                        <div
                          key={feature.id}
                          className="group relative p-6 sm:p-8 rounded-2xl border border-border/80 bg-card hover:border-[#d4af37]/50 hover:shadow-xl hover:shadow-black/5 transition-all duration-300 ease-out flex flex-col justify-between"
                        >
                          <div className="space-y-4">
                            {/* Icon & Tagline */}
                            <div className="flex items-start justify-between gap-4">
                              <div className="w-12 h-12 rounded-xl bg-[#0b192c] dark:bg-slate-900 border border-[#d4af37]/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300">
                                <IconComponent
                                  className="w-6 h-6 text-[#d4af37]"
                                  strokeWidth={1.5}
                                />
                              </div>
                              <span className="text-[11px] font-medium text-muted-foreground text-right">
                                {feature.tagline}
                              </span>
                            </div>

                            {/* Title & Description */}
                            <div className="space-y-1.5">
                              <h4 className="text-lg font-bold tracking-tight text-foreground font-heading">
                                {feature.title}
                              </h4>
                              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                                {feature.description}
                              </p>
                            </div>

                            {/* Bullet Capabilities */}
                            <ul className="space-y-2 pt-2 border-t border-border/50">
                              {feature.capabilities.map((cap, capIdx) => (
                                <li
                                  key={capIdx}
                                  className="flex items-start gap-2 text-xs text-foreground/80 leading-normal"
                                >
                                  <CheckCircle2
                                    className="w-3.5 h-3.5 text-[#d4af37] shrink-0 mt-0.5"
                                    strokeWidth={1.75}
                                  />
                                  <span>{cap}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Deep-Dive Link to Full Features Page */}
            <div className="text-center pt-8">
              <Link to="/features">
                <Button
                  variant="outline"
                  size="lg"
                  className="gap-2 h-11 px-6 text-xs font-semibold tracking-tight border-border/80 hover:border-[#d4af37]/60"
                >
                  <span>Explore Complete Technical Features</span>
                  <ArrowRight className="w-4 h-4 text-[#d4af37]" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* SECURITY & ARCHITECTURE TRUST SECTION */}
        <section className="border-t border-border/60 bg-muted/20 py-20 sm:py-28">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#d4af37]">
                {securityTrust.badge}
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-heading">
                {securityTrust.title}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {securityTrust.description}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {securityTrust.items.map((sec, secIdx) => {
                const SecIcon = ICONS[sec.iconName] || Shield;
                return (
                  <div
                    key={secIdx}
                    className="p-6 rounded-2xl bg-card border border-border/70 space-y-3"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#0b192c] dark:bg-slate-900 border border-[#d4af37]/30 flex items-center justify-center">
                      <SecIcon className="w-5 h-5 text-[#d4af37]" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-sm font-bold text-foreground font-heading">
                      {sec.title}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {sec.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CLOSING CTA SECTION */}
        <section className="py-20 sm:py-28 bg-[#07111e] text-white relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#d4af37]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="max-w-2xl mx-auto text-center space-y-6">
              <span className="text-xs font-bold uppercase tracking-wider text-[#d4af37]">
                {closingCta.eyebrow}
              </span>

              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight font-heading leading-tight">
                {closingCta.title}
              </h2>

              <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
                {closingCta.subtitle}
              </p>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
                <Link to="/login" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto h-12 px-8 text-sm font-semibold tracking-tight gap-2 bg-[#d4af37] text-[#07111e] hover:bg-[#e2bd4b] font-heading shadow-lg shadow-[#d4af37]/20 transition-all duration-200"
                  >
                    <span>{closingCta.primaryButton.text}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>

                <Link to="/signup" className="w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto h-12 px-8 text-sm font-semibold tracking-tight border-slate-700 text-white hover:bg-slate-800 transition-all duration-200"
                  >
                    {closingCta.secondaryButton.text}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Shared Public Footer */}
      <PublicFooter />
    </div>
  );
}

export default function PublicHomepage() {
  return (
    <PublicErrorBoundary pageName="Homepage">
      <HomepageContent />
    </PublicErrorBoundary>
  );
}
