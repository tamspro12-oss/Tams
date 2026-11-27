import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Plane, Menu, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MARKETING_NAVIGATION } from "@/config/marketingContent";
import { MobileInstallButton } from "@/components/MobileInstallButton";
import "./public-landing.css";

interface PublicHeaderProps {
  currentPath?: string;
}

export const PublicHeader: React.FC<PublicHeaderProps> = ({ currentPath }) => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const activePath = currentPath || location.pathname;

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Prevent background scrolling when mobile menu is active
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const navLinks = MARKETING_NAVIGATION.mainNav;

  return (
    <header className="sticky top-0 z-50 w-full pt-[env(safe-area-inset-top,0px)] md:pt-0 h-[calc(4rem+env(safe-area-inset-top,0px))] md:h-16 bg-white/85 backdrop-blur-md border-b border-[var(--border,#E5E0D3)]">
      <div className="max-w-[1200px] mx-auto h-full flex items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Plane logo mark + TAMS PRO */}
        <Link
          to="/"
          className="flex items-center gap-2.5 min-h-[44px] md:min-h-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5C63] rounded-xl group"
          aria-label="TAMS Pro Home"
        >
          <div className="w-9 h-9 rounded-xl bg-[var(--primary,#0F5C63)] border border-[var(--primary,#0F5C63)]/20 flex items-center justify-center shadow-sm group-hover:bg-[var(--primary-hover,#0B4A50)] hover:transition-colors hover:duration-200">
            <Plane className="w-4 h-4 text-white" strokeWidth={1.75} />
          </div>
          <span className="font-bold text-base sm:text-[17px] tracking-tight text-[var(--ink,#0B1F2A)]">
            TAMS PRO
          </span>
        </Link>

        {/* Center: Desktop Navigation Links with hover and active gold underline */}
        <nav className="hidden md:flex items-center gap-1.5 text-sm" aria-label="Main Navigation">
          {navLinks.map((link) => {
            const isActive =
              link.href === "/"
                ? activePath === "/"
                : activePath.startsWith(link.href);

            return (
              <Link
                key={link.href}
                to={link.href}
                className={`relative px-3.5 py-1.5 rounded-xl text-sm ${
                  isActive
                    ? "text-[var(--ink,#0B1F2A)] font-semibold bg-[var(--tint,#E4F2EF)]/70"
                    : "text-[var(--body,#4A5A63)] hover:text-[var(--ink,#0B1F2A)] hover:bg-[var(--tint,#E4F2EF)]/50 hover:transition-colors hover:duration-200 font-medium"
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute bottom-0.5 left-3.5 right-3.5 h-[2px] bg-[var(--accent,#C9A24B)] rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right: Login (ghost/secondary) + Sign Up Free (solid --primary) */}
        <div className="hidden sm:flex items-center gap-2.5">
          <Link to="/login">
            <Button
              variant="ghost"
              size="sm"
              className="tams-btn-secondary h-9 px-4 rounded-xl text-xs font-semibold text-[var(--ink,#0B1F2A)]"
            >
              <span>Login</span>
            </Button>
          </Link>

          <Link to="/signup">
            <Button
              size="sm"
              className="tams-btn-primary h-9 px-4 rounded-xl text-xs font-semibold gap-1.5 bg-[var(--primary,#0F5C63)] text-white hover:bg-[var(--primary-hover,#0B4A50)] shadow-sm group"
            >
              <span>Sign Up Free</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#E4F2EF] group-hover:translate-x-0.5 group-hover:transition-transform group-hover:duration-200" strokeWidth={1.75} />
            </Button>
          </Link>
        </div>

        {/* Mobile: Install + Login + Hamburger toggle */}
        <div className="flex md:hidden items-center gap-1.5 min-[375px]:gap-2">
          <MobileInstallButton variant="public-header" />

          <Link to="/login" className="sm:hidden">
            <Button
              size="sm"
              className="tams-btn-primary h-11 md:h-8 px-3 min-[375px]:px-4 rounded-xl text-xs font-semibold bg-[var(--primary,#0F5C63)] text-white hover:bg-[var(--primary-hover,#0B4A50)]"
            >
              Login
            </Button>
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded-xl text-[var(--ink,#0B1F2A)] hover:bg-[var(--tint,#E4F2EF)] focus:outline-none focus:ring-2 focus:ring-[#0F5C63] hover:transition-colors hover:duration-200"
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" strokeWidth={1.75} />
            ) : (
              <Menu className="w-5 h-5" strokeWidth={1.75} />
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer: same translucent white with blur & gold active accent */}
      {mobileMenuOpen && (
        <div
          data-mobile-nav=""
          className="md:hidden fixed inset-x-0 top-[calc(4rem+env(safe-area-inset-top,0px))] bottom-0 h-[calc(100dvh-4rem-env(safe-area-inset-top,0px))] overflow-y-auto bg-white/95 backdrop-blur-lg border-t border-[var(--border,#E5E0D3)] z-50 flex flex-col justify-between px-6 py-6"
          role="dialog"
          aria-modal="true"
        >
          <div className="space-y-1.5">
            {navLinks.map((link) => {
              const isActive =
                link.href === "/"
                  ? activePath === "/"
                  : activePath.startsWith(link.href);

              return (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl text-base ${
                    isActive
                      ? "bg-[var(--tint,#E4F2EF)] text-[var(--ink,#0B1F2A)] font-semibold border-b-2 border-[var(--accent,#C9A24B)]"
                      : "text-[var(--body,#4A5A63)] hover:text-[var(--ink,#0B1F2A)] hover:bg-[var(--tint,#E4F2EF)]/60 hover:transition-colors hover:duration-200 font-medium"
                  }`}
                >
                  <span>{link.label}</span>
                  {isActive && <span className="text-xs text-[var(--accent,#C9A24B)] font-bold">•</span>}
                </Link>
              );
            })}
          </div>

          <div className="pt-6 border-t border-[var(--border,#E5E0D3)] space-y-3 pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
            <MobileInstallButton
              variant="drawer-card"
              onActionStart={() => setMobileMenuOpen(false)}
            />

            <Link
              to="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="block w-full"
            >
              <Button
                variant="outline"
                className="tams-btn-secondary w-full h-11 rounded-xl text-sm font-semibold justify-center"
              >
                <span>Login</span>
              </Button>
            </Link>

            <Link
              to="/signup"
              onClick={() => setMobileMenuOpen(false)}
              className="block w-full"
            >
              <Button
                className="tams-btn-primary w-full h-11 rounded-xl text-sm font-semibold justify-center gap-2 bg-[var(--primary,#0F5C63)] text-white hover:bg-[var(--primary-hover,#0B4A50)]"
              >
                <span>Sign Up Free</span>
                <ArrowRight className="h-4 w-4 text-[#E4F2EF]" strokeWidth={1.75} />
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

export default PublicHeader;
