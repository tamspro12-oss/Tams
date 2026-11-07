import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Plane, Menu, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MARKETING_NAVIGATION } from "@/config/marketingContent";

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
    <header className="sticky top-0 z-50 w-full h-16 bg-[#F8F6F1]/90 dark:bg-[#070D1E]/90 backdrop-blur-md border-b border-[#E6E2D8] dark:border-[#1A294E] transition-colors">
      <div className="max-w-[1200px] mx-auto h-full flex items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Plane logo mark + TAMS PRO */}
        <Link
          to="/"
          className="flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A961] rounded-lg"
          aria-label="TAMS Pro Home"
        >
          <div className="w-9 h-9 rounded-xl bg-[#0B1530] border border-[#C9A961]/40 flex items-center justify-center shadow-sm">
            <Plane className="w-4 h-4 text-[#C9A961]" strokeWidth={1.5} />
          </div>
          <span className="font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-slate-100 font-sans">
            TAMS PRO
          </span>
        </Link>

        {/* Center: Desktop Navigation Links (active underlined in gold) */}
        <nav className="hidden md:flex items-center gap-8 text-sm" aria-label="Main Navigation">
          {navLinks.map((link) => {
            const isActive =
              link.href === "/"
                ? activePath === "/"
                : activePath.startsWith(link.href);

            return (
              <Link
                key={link.href}
                to={link.href}
                className={`relative py-1 text-sm transition-colors ${
                  isActive
                    ? "text-slate-900 dark:text-white font-semibold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium"
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#C9A961] rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right: Sign Up Free (ghost) + Login (navy solid) */}
        <div className="hidden sm:flex items-center gap-3">
          <Link to="/signup">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-3.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              Sign Up Free
            </Button>
          </Link>

          <Link to="/login">
            <Button
              size="sm"
              className="h-9 px-4 text-xs font-semibold gap-1.5 bg-[#0B1530] text-white hover:bg-[#122146] border border-[#1A294E] shadow-sm transition-all"
            >
              <span>Login</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#C9A961]" strokeWidth={1.5} />
            </Button>
          </Link>
        </div>

        {/* Mobile: Hamburger toggle */}
        <div className="flex md:hidden items-center gap-2">
          <Link to="/login" className="sm:hidden">
            <Button
              size="sm"
              className="h-8 px-3 text-xs font-medium bg-[#0B1530] text-white hover:bg-[#122146]"
            >
              Login
            </Button>
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#C9A961]"
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" strokeWidth={1.5} />
            ) : (
              <Menu className="w-5 h-5" strokeWidth={1.5} />
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-x-0 top-16 bottom-0 bg-[#F8F6F1] dark:bg-[#070D1E] border-t border-[#E6E2D8] dark:border-[#1A294E] z-50 flex flex-col justify-between px-6 py-6"
          role="dialog"
          aria-modal="true"
        >
          <div className="space-y-1">
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
                  className={`flex items-center justify-between px-4 py-3 rounded-xl text-base transition-colors ${
                    isActive
                      ? "bg-black/5 dark:bg-white/5 text-slate-900 dark:text-white font-semibold border-l-2 border-[#C9A961]"
                      : "text-slate-600 dark:text-slate-300 font-medium"
                  }`}
                >
                  <span>{link.label}</span>
                  {isActive && <span className="text-xs text-[#C9A961] font-medium">•</span>}
                </Link>
              );
            })}
          </div>

          <div className="pt-6 border-t border-[#E6E2D8] dark:border-[#1A294E] space-y-3 pb-8">
            <Link
              to="/signup"
              onClick={() => setMobileMenuOpen(false)}
              className="block w-full"
            >
              <Button
                variant="outline"
                className="w-full h-11 text-sm font-semibold justify-center border-[#E6E2D8] dark:border-[#1A294E] text-slate-800 dark:text-slate-200"
              >
                Sign Up Free
              </Button>
            </Link>

            <Link
              to="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="block w-full"
            >
              <Button
                className="w-full h-11 text-sm font-semibold justify-center gap-2 bg-[#0B1530] text-white hover:bg-[#122146]"
              >
                <span>Login</span>
                <ArrowRight className="h-4 w-4 text-[#C9A961]" strokeWidth={1.5} />
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

export default PublicHeader;
