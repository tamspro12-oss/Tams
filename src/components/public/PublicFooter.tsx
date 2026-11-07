import { Link } from "react-router-dom";
import { Plane, ShieldCheck, Mail, Phone, ExternalLink } from "lucide-react";
import { BRANDING } from "@/lib/brandingConstants";
import { MARKETING_NAVIGATION } from "@/config/marketingContent";

export function PublicFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-border/70 bg-[#07111e] text-slate-200">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
        {/* Main 12-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 pb-12 border-b border-slate-800">
          {/* Brand Info (5 Columns) */}
          <div className="lg:col-span-5 space-y-4">
            <Link
              to="/"
              className="inline-flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] rounded-lg"
              aria-label="TAMS Pro - Return to Homepage"
            >
              <div className="w-9 h-9 rounded-xl bg-[#0b192c] border border-[#d4af37]/40 flex items-center justify-center shadow-md">
                <Plane className="w-4 h-4 text-[#d4af37]" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-white font-heading">
                  TAMS PRO
                </span>
                <span className="px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase text-[#d4af37] bg-[#d4af37]/10 rounded border border-[#d4af37]/20">
                  v3.5
                </span>
              </div>
            </Link>

            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
              The dedicated cloud operating system for modern travel agencies.
              Architected for unified bookings, B2B partner ledgers, automated service vouchers,
              and real-time financial sovereignty.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row gap-3 text-xs text-slate-400">
              <a
                href="mailto:tamspro12@gmail.com"
                className="inline-flex items-center gap-2 hover:text-white transition-colors"
              >
                <Mail className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>tamspro12@gmail.com</span>
              </a>
              <span className="hidden sm:inline text-slate-700">•</span>
              <a
                href="https://wa.me/923190846768"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 hover:text-white transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>+92 319 0846768</span>
              </a>
            </div>
          </div>

          {/* 3 Link Columns Max (7 Columns across 3 sub-columns) */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-8">
            {MARKETING_NAVIGATION.footerColumns.map((col, idx) => (
              <div key={idx} className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-heading">
                  {col.title}
                </h4>
                <ul className="space-y-2.5">
                  {col.links.map((link, linkIdx) => {
                    const isExternal =
                      link.href.startsWith("http") || link.href.startsWith("mailto:");

                    return (
                      <li key={linkIdx}>
                        {isExternal ? (
                          <a
                            href={link.href}
                            target={link.href.startsWith("http") ? "_blank" : undefined}
                            rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                          >
                            <span>{link.label}</span>
                            <ExternalLink className="w-3 h-3 text-slate-500" />
                          </a>
                        ) : (
                          <Link
                            to={link.href}
                            className="text-xs text-slate-400 hover:text-white transition-colors block"
                          >
                            {link.label}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Bar: Copyright and Badges */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#d4af37]" />
            <span>Row-Level Database Isolation • Offline PWA Support • Cloud Backups</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <Link to="/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <span className="text-slate-700">•</span>
            <Link to="/terms" className="hover:text-white transition-colors">
              Terms of Service
            </Link>
            <span className="text-slate-700">•</span>
            <p className="text-slate-500">
              © {currentYear} TAMS Pro. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default PublicFooter;
