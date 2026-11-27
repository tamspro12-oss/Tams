import React from "react";
import { Link } from "react-router-dom";
import { Plane, Mail } from "lucide-react";
import { CONTACT_CHANNELS, MARKETING_NAVIGATION } from "@/config/marketingContent";

export const PublicFooter: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  return (
    <footer
      className={`w-full border-t border-[var(--accent,#C9A24B)]/25 bg-[var(--hero-from,#0A2A30)] text-[#CFE3E0] safe-area-bottom ${
        compact ? "py-4 lg:py-5" : "py-7"
      }`}
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-3.5 text-xs">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          {/* Brand */}
          <Link
            to="/"
            className="flex items-center gap-2 text-white font-bold tracking-tight hover:opacity-90 hover:transition-opacity hover:duration-200 shrink-0"
          >
            <div className="w-6 h-6 rounded-lg bg-[var(--primary,#0F5C63)] border border-[var(--accent,#C9A24B)]/40 flex items-center justify-center shadow-sm">
              <Plane className="w-3.5 h-3.5 text-[var(--accent,#C9A24B)]" strokeWidth={1.75} />
            </div>
            <span>TAMS PRO</span>
          </Link>

          {/* All Public Links */}
          <nav
            className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:gap-x-5"
            aria-label="Footer Navigation"
          >
            {MARKETING_NAVIGATION.footerLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="text-[#E4F2EF] hover:text-[var(--accent,#C9A24B)] font-medium hover:transition-colors hover:duration-200"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Official Contact Email & Copyright */}
          <div className="flex flex-wrap items-center justify-center gap-3 text-[#CFE3E0] shrink-0">
            <a
              href={CONTACT_CHANNELS.email.href}
              className="inline-flex items-center gap-1.5 text-[var(--accent,#C9A24B)] hover:underline font-medium hover:transition-colors hover:duration-200"
            >
              <Mail className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>{CONTACT_CHANNELS.email.value}</span>
            </a>
            <span aria-hidden="true">·</span>
            <span>© 2026 TAMS Pro</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default PublicFooter;
