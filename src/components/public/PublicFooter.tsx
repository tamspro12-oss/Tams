import React from "react";
import { Link } from "react-router-dom";
import { Plane } from "lucide-react";
import { MARKETING_NAVIGATION } from "@/config/marketingContent";

export const PublicFooter: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  return (
    <footer
      className={`w-full border-t border-slate-200/80 bg-white/60 backdrop-blur-sm text-[#475569] safe-area-bottom ${
        compact ? "py-3.5 lg:py-4" : "py-6"
      } transition-colors`}
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
        {/* Brand */}
        <Link
          to="/"
          className="flex items-center gap-2 text-[#0F172A] font-bold tracking-tight hover:opacity-80 transition-opacity"
        >
          <div className="w-6 h-6 rounded-lg bg-[#0F5E63] flex items-center justify-center shadow-sm">
            <Plane className="w-3.5 h-3.5 text-white" strokeWidth={1.75} />
          </div>
          <span>TAMS PRO</span>
        </Link>

        {/* Links */}
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 md:gap-x-6 md:gap-y-2" aria-label="Footer Navigation">
          {MARKETING_NAVIGATION.footerLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="text-[#475569] hover:text-[#0F172A] font-medium transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Copyright */}
        <p className="text-[#64748B]">
          © 2026 TAMS Pro.
        </p>
      </div>
    </footer>
  );
};

export default PublicFooter;
