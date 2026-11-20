import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Plane, Menu, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MARKETING_NAVIGATION } from "@/config/marketingContent";
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
    <header className="sticky top-0 z-50 w-full h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/70 transition-colors">
      <div className="max-w-[1200px] mx-auto h-full flex items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Plane logo mark + TAMS PRO */}
        <Link
          to="/"
          className="flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded-xl group"
          aria-label="TAMS Pro Home"
        >
          <div className="w-9 h-9 rounded-xl bg-[#0F5E63] border border-teal-700/20 flex items-center justify-center shadow-sm group-hover:bg-[#0B4A4E] transition-colors">
            <Plane className="w-4 h-4 text-white" strokeWidth={1.75} />
          </div>
          <span className="font-bold text-base sm:text-[17px] tracking-tight text-[#0F172A]">
            TAMS PRO
          </span>
        </Link>

        {/* Center: Desktop Navigation Links with hover and active pill/underline */}
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
                className={`relative px-3.5 py-1.5 rounded-xl text-sm transition-all duration-150 ${
                  isActive
                    ? "text-[#0F172A] font-semibold bg-slate-100/80"
                    : "text-[#475569] hover:text-[#0F172A] hover:bg-slate-100/50 font-medium"
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute bottom-0.5 left-3.5 right-3.5 h-[2px] bg-[#0F5E63] rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right: Login (ghost/secondary) + Sign Up Free (solid Deep Teal) */}
        <div className="hidden sm:flex items-center gap-2.5">
          <Link to="/login">
            <Button
              variant="ghost"
              size="sm"
              className="tams-btn-secondary h-9 px-4 rounded-xl text-xs font-semibold text-[#0F172A] hover:bg-[#F1F5F9] transition-all"
            >
              <span>Login</span>
            </Button>
          </Link>

          <Link to="/signup">
            <Button
              size="sm"
              className="tams-btn-primary h-9 px-4 rounded-xl text-xs font-semibold gap-1.5 bg-[#0F5E63] text-white hover:bg-[#0B4A4E] shadow-sm hover:shadow-md transition-all group"
            >
              <span>Sign Up Free</span>
              <ArrowRight className="h-3.5 w-3.5 text-teal-100 transition-transform duration-150 group-hover:translate-x-0.5" strokeWidth={1.75} />
            </Button>
          </Link>
        </div>

        {/* Mobile: Hamburger toggle */}
        <div className="flex md:hidden items-center gap-2">
          <Link to="/login" className="sm:hidden">
            <Button
              size="sm"
              className="tams-btn-primary h-8 px-3.5 rounded-xl text-xs font-semibold bg-[#0F5E63] text-white hover:bg-[#0B4A4E]"
            >
              Login
            </Button>
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl text-[#0F172A] hover:bg-[#F1F5F9] focus:outline-none focus:ring-2 focus:ring-teal-600 transition-colors"
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

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-x-0 top-16 bottom-0 bg-[#F8FAFC]/95 backdrop-blur-lg border-t border-slate-200/80 z-50 flex flex-col justify-between px-6 py-6"
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
                  className={`flex items-center justify-between px-4 py-3 rounded-xl text-base transition-colors ${
                    isActive
                      ? "bg-teal-50/80 text-[#0F172A] font-semibold border border-teal-200/60"
                      : "text-[#475569] hover:text-[#0F172A] hover:bg-slate-100/70 font-medium"
                  }`}
                >
                  <span>{link.label}</span>
                  {isActive && <span className="text-xs text-[#0F5E63] font-bold">•</span>}
                </Link>
              );
            })}
          </div>

          <div className="pt-6 border-t border-slate-200/80 space-y-3 pb-8">
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
                className="tams-btn-primary w-full h-11 rounded-xl text-sm font-semibold justify-center gap-2 bg-[#0F5E63] text-white hover:bg-[#0B4A4E]"
              >
                <span>Sign Up Free</span>
                <ArrowRight className="h-4 w-4 text-teal-100" strokeWidth={1.75} />
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

export default PublicHeader;
