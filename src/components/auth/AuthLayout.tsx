import React from "react";
import { Link } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";
import { Plane, ArrowLeft, Shield, Receipt, Zap } from "lucide-react";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  type: "login" | "signup";
  children: React.ReactNode;
  seoTitle: string;
  seoDescription: string;
  seoPath: string;
}

export function AuthLayout({
  title,
  subtitle,
  type,
  children,
  seoTitle,
  seoDescription,
  seoPath,
}: AuthLayoutProps) {
  const badgeText =
    type === "signup"
      ? "14-Day Free Access • Instant Setup"
      : "Secure Login";

  return (
    <div className="h-dvh w-full overflow-hidden bg-background flex flex-col lg:flex-row select-none">
      <SeoHead title={seoTitle} description={seoDescription} path={seoPath} />
      <h1 className="sr-only">{title} - TAMS Pro</h1>

      {/* ========================================================================= */}
      {/* DESKTOP LEFT PANEL (>= 1024px): Brand Side (~45%)                         */}
      {/* ========================================================================= */}
      <aside className="hidden lg:flex lg:w-[45%] xl:w-[44%] flex-col justify-between p-8 xl:p-12 text-white relative overflow-hidden bg-gradient-to-br from-[#0F2847] via-[#0A1E35] to-[#040D18] shrink-0 border-r border-border/20">
        {/* Soft background glows / subtle pattern */}
        <div
          className="absolute -top-32 -left-32 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        {/* Top-Left: Logo & Brand */}
        <div className="flex items-center gap-3 z-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-950/50">
            <Plane className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-white font-heading">
              TAMS PRO
            </span>
            <span className="block text-[11px] text-blue-200/70 font-medium tracking-wide">
              TRAVEL AGENCY MANAGEMENT
            </span>
          </div>
        </div>

        {/* Center: Headline & 3 Compact Benefit Lines */}
        <div className="space-y-6 z-10 my-auto py-4 max-w-sm">
          <div className="space-y-2">
            <h2 className="text-2xl xl:text-3xl font-bold tracking-tight text-white leading-tight">
              Run your travel agency from one place
            </h2>
            <p className="text-xs xl:text-sm text-blue-100/75 leading-relaxed">
              Automate passenger bookings, B2B partner ledgers, and fast client quotations in one unified workspace.
            </p>
          </div>

          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-400/25 flex items-center justify-center text-blue-300 shrink-0">
                <Plane className="w-4 h-4" />
              </div>
              <span className="text-xs xl:text-sm text-blue-50 font-medium">
                Umrah and ticket bookings
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/25 flex items-center justify-center text-emerald-300 shrink-0">
                <Receipt className="w-4 h-4" />
              </div>
              <span className="text-xs xl:text-sm text-blue-50 font-medium">
                Ledgers and accounts
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/25 flex items-center justify-center text-amber-300 shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <span className="text-xs xl:text-sm text-blue-50 font-medium">
                Quotes in seconds
              </span>
            </div>
          </div>
        </div>

        {/* Bottom: Small Security / Free Access text */}
        <div className="text-xs text-blue-200/70 flex items-center gap-2 z-10 pt-4 border-t border-white/10">
          <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{badgeText}</span>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MOBILE HEADER STRIP (< 1024px): Slim Gradient Strip (~105px)               */}
      {/* ========================================================================= */}
      <header className="lg:hidden w-full h-[96px] sm:h-[110px] bg-gradient-to-br from-[#0F2847] via-[#0A1E35] to-[#040D18] px-4 pt-3 pb-5 flex flex-col justify-between shrink-0 relative overflow-hidden">
        <div className="flex items-center justify-between w-full z-10">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-white/80 hover:text-white transition-colors"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-[11px] font-medium">Home</span>
          </Link>
          <div className="text-[10px] text-emerald-300/90 font-semibold flex items-center gap-1">
            <Shield className="w-3 h-3 text-emerald-400" />
            <span>{type === "signup" ? "14-Day Free Access" : "Secure Login"}</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 z-10 -mt-1">
          <div className="w-6 h-6 rounded-lg bg-blue-500 flex items-center justify-center shadow-xs">
            <Plane className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-base font-bold text-white tracking-wide font-heading">
            TAMS PRO
          </span>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* RIGHT PANEL (Desktop & Mobile): Form Card Vertically Centered (~55%)      */}
      {/* ========================================================================= */}
      <main className="w-full lg:w-[55%] xl:w-[56%] flex-1 flex flex-col justify-start lg:justify-center items-center px-4 py-2 sm:px-6 lg:p-8 xl:p-10 overflow-y-auto lg:overflow-hidden bg-slate-50/70 dark:bg-slate-950/70 -mt-3 sm:-mt-4 lg:mt-0 z-10">
        {/* Desktop "Back to Home" Link */}
        <div className="hidden lg:block w-full max-w-xl mb-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium group"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to Home
          </Link>
        </div>

        {/* The Main Wide Card (max-w-xl) */}
        <div className="w-full max-w-md lg:max-w-xl bg-card rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-border/80 px-4 py-3 sm:p-5 lg:p-7 xl:p-8 flex flex-col justify-center">
          {/* Header text */}
          <div className="space-y-0.5 mb-2.5 sm:mb-3.5">
            <h2 className="text-[20px] sm:text-[24px] font-semibold tracking-tight text-foreground leading-tight">
              {title}
            </h2>
            <p className="text-xs text-muted-foreground">
              {subtitle}
            </p>
          </div>

          {/* Form Content */}
          {children}
        </div>

        {/* Footer info (Desktop only) */}
        <div className="hidden lg:block mt-3 text-center">
          <p className="text-[11px] text-muted-foreground/75 font-medium">
            TAMS Pro • Built for Travel & Umrah Agency Professionals
          </p>
        </div>
      </main>
    </div>
  );
}
