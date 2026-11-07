import React from "react";
import { Link } from "react-router-dom";
import { Plane } from "lucide-react";
import { MARKETING_NAVIGATION } from "@/config/marketingContent";

export const PublicFooter: React.FC = () => {
  return (
    <footer className="w-full border-t border-[#E6E2D8] dark:border-[#1A294E] bg-[#F8F6F1] dark:bg-[#070D1E] text-slate-600 dark:text-slate-400 py-6 transition-colors">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
        {/* Brand */}
        <Link
          to="/"
          className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold tracking-tight hover:opacity-80 transition-opacity"
        >
          <div className="w-6 h-6 rounded-md bg-[#0B1530] flex items-center justify-center">
            <Plane className="w-3.5 h-3.5 text-[#C9A961]" strokeWidth={1.5} />
          </div>
          <span>TAMS PRO</span>
        </Link>

        {/* Links */}
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5" aria-label="Footer Navigation">
          {MARKETING_NAVIGATION.footerLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Copyright */}
        <p className="text-slate-500 dark:text-slate-500">
          © 2026 TAMS Pro.
        </p>
      </div>
    </footer>
  );
};

export default PublicFooter;
