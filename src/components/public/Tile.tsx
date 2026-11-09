import React from "react";
import { Link } from "react-router-dom";
import { LucideIcon } from "lucide-react";

export interface TileProps {
  icon: LucideIcon;
  title: string;
  caption?: string;
  to?: string;
  href?: string;
  className?: string;
  compact?: boolean;
}

export const Tile: React.FC<TileProps> = ({
  icon: Icon,
  title,
  caption,
  to,
  href,
  className = "",
  compact = false,
}) => {
  const content = (
    <div
      className={`group relative flex flex-col justify-between h-[132px] sm:h-[148px] rounded-2xl p-5 border border-[#E6E2D8] dark:border-[#1A294E] bg-white dark:bg-[#0E1B3B] shadow-sm hover:shadow-md hover:border-[#C9A961] dark:hover:border-[#C9A961] transition-all duration-200 motion-reduce:transition-none hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 text-left overflow-hidden ${className}`}
    >
      <div className="w-11 h-11 rounded-xl bg-[#C9A961]/10 dark:bg-[#C9A961]/15 text-[#C9A961] flex items-center justify-center shrink-0 transition-colors group-hover:bg-[#C9A961]/20">
        <Icon className="w-[22px] h-[22px]" strokeWidth={1.5} />
      </div>

      <div className="mt-auto">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 tracking-tight leading-snug truncate">
          {title}
        </h3>
        {!compact && caption && (
          <p className="text-[13px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5 font-normal">
            {caption}
          </p>
        )}
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A961] rounded-2xl">
        {content}
      </Link>
    );
  }

  if (href) {
    const isExternal = href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:");
    return (
      <a
        href={href}
        target={isExternal && href.startsWith("http") ? "_blank" : undefined}
        rel={isExternal && href.startsWith("http") ? "noopener noreferrer" : undefined}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A961] rounded-2xl"
      >
        {content}
      </a>
    );
  }

  return content;
};

