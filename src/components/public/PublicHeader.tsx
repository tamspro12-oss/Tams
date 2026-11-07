import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Plane, Menu, X, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MARKETING_NAVIGATION } from "@/config/marketingContent";

interface PublicHeaderProps {
  currentPath?: string;
}

export function PublicHeader({ currentPath }: PublicHeaderProps) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const activePath = currentPath || location.pathname;

  // Handle scroll detection for refined border/shadow dynamics
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 12) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ease-out border-b ${
        isScrolled
          ? "bg-background/90 backdrop-blur-md border-border/70 shadow-sm shadow-black/5"
          : "bg-background/80 backdrop-blur-sm border-border/40"
      }`}
    >
      <div className="max-w-[1200px] mx-auto flex h-16 sm:h-20 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo & Name */}
        <Link
          to="/"
          className="group flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg transition-transform duration-200 active:scale-[0.98]"
          aria-label="TAMS Pro - Return to Homepage"
        >
          {/* Logo Mark: Plane Icon with Quiet Luxury styling and subtle gold accent halo */}
          <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#0b192c] dark:bg-[#0f172a] border border-[#d4af37]/30 flex items-center justify-center shadow-md shadow-[#0b192c]/20 group-hover:border-[#d4af37]/60 transition-colors duration-300">
            <Plane className="w-5 h-5 sm:w-5 sm:h-5 text-[#d4af37] transition-transform duration-300 group-hover:rotate-6" />
            <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-[#d4af37]/10 to-transparent pointer-events-none" />
          </div>

          <div className="flex flex-col text-left">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base sm:text-lg tracking-tight text-foreground font-heading">
                TAMS PRO
              </span>
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase text-[#d4af37] bg-[#d4af37]/10 rounded border border-[#d4af37]/20">
                SaaS
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground/90 font-medium tracking-tight hidden sm:block">
              Travel Agency Management System
            </p>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav
          className="hidden md:flex items-center gap-1 lg:gap-2 text-sm font-medium"
          aria-label="Main Navigation"
        >
          {navLinks.map((link) => {
            const isActive =
              link.href === "/"
                ? activePath === "/"
                : activePath.startsWith(link.href);

            return (
              <Link
                key={link.href}
                to={link.href}
                className={`relative px-3.5 py-2 rounded-lg transition-all duration-200 text-sm tracking-tight ${
                  isActive
                    ? "text-foreground font-semibold bg-muted/60"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute bottom-1 left-3.5 right-3.5 h-[2px] bg-[#d4af37] rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Action Buttons: Sign Up & Login */}
        <div className="hidden sm:flex items-center gap-2.5">
          <Link to="/signup">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-4 text-xs font-semibold tracking-tight text-foreground/90 hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              Sign Up Free
            </Button>
          </Link>

          <Link to="/login">
            <Button
              size="sm"
              className="h-9 px-4 text-xs font-semibold tracking-tight gap-1.5 bg-[#0b192c] dark:bg-[#1e293b] text-white hover:bg-[#122846] dark:hover:bg-[#283952] border border-[#d4af37]/30 shadow-sm transition-all duration-200"
            >
              <span>Login</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#d4af37]" />
            </Button>
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex md:hidden items-center gap-2">
          <Link to="/login" className="sm:hidden">
            <Button
              size="sm"
              className="h-8 px-2.5 text-xs font-medium bg-[#0b192c] text-white"
            >
              Login
            </Button>
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-foreground hover:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5 text-foreground" />
            ) : (
              <Menu className="w-5 h-5 text-foreground" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-x-0 top-16 sm:top-20 bottom-0 bg-background/95 backdrop-blur-xl border-t border-border z-50 flex flex-col justify-between px-6 py-6 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="space-y-6">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-3">
                Navigation
              </p>
              <div className="space-y-1 pt-1">
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
                      className={`flex items-center justify-between px-4 py-3 rounded-xl text-base font-medium transition-colors ${
                        isActive
                          ? "bg-muted text-foreground font-semibold border-l-4 border-[#d4af37]"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                      }`}
                    >
                      <span>{link.label}</span>
                      {isActive && (
                        <span className="text-xs font-semibold text-[#d4af37]">Active</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-border/60">
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                <ShieldCheck className="w-4 h-4 text-[#d4af37]" />
                <span>Enterprise Isolation & SSL Encryption</span>
              </div>
            </div>
          </div>

          {/* Mobile Bottom CTA Buttons */}
          <div className="pt-6 border-t border-border/80 space-y-3 pb-8">
            <Link
              to="/signup"
              onClick={() => setMobileMenuOpen(false)}
              className="block w-full"
            >
              <Button
                variant="outline"
                size="lg"
                className="w-full h-11 text-sm font-semibold justify-center"
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
                size="lg"
                className="w-full h-11 text-sm font-semibold justify-center gap-2 bg-[#0b192c] text-white"
              >
                <span>Login to Portal</span>
                <ArrowRight className="h-4 w-4 text-[#d4af37]" />
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

export default PublicHeader;
