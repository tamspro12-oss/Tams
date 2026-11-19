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
  noTruncate?: boolean;
  iconVariant?: "gradient" | "soft";
}

export const Tile: React.FC<TileProps> = ({
  icon: Icon,
  title,
  caption,
  to,
  href,
  className = "",
  compact = false,
  noTruncate = false,
  iconVariant = "gradient",
}) => {
  const iconShape = compact ? "w-10 h-10 rounded-xl" : "w-11 h-11 rounded-xl";
  const iconSurface =
    iconVariant === "soft" ? "tams-icon-tile-soft" : "tams-icon-tile-gradient";
  const iconBoxClasses = `${iconShape} ${iconSurface} flex items-center justify-center shrink-0 transition-all duration-200`;

  const iconClasses = compact ? "w-[18px] h-[18px]" : "w-5 h-5";

  const content = (
    <div
      className={`tams-card tams-card-interactive group relative flex flex-col justify-between h-[136px] sm:h-[148px] rounded-2xl p-5 bg-white hover:-translate-y-1 transition-all duration-200 motion-reduce:transition-none motion-reduce:hover:translate-y-0 text-left overflow-hidden ${className}`}
    >
      <div className={iconBoxClasses}>
        <Icon className={iconClasses} strokeWidth={1.75} />
      </div>

      <div className="mt-auto pt-3">
        <h3
          className={
            noTruncate
              ? compact
                ? "text-[13.5px] xl:text-sm font-semibold text-[#0F172A] tracking-tight leading-snug whitespace-normal"
                : "text-[15px] font-semibold text-[#0F172A] tracking-tight leading-snug whitespace-normal"
              : "text-[15px] sm:text-base font-semibold text-[#0F172A] tracking-tight leading-snug truncate"
          }
        >
          {title}
        </h3>
        {!compact && caption && (
          <p
            className={
              noTruncate
                ? "text-[12.5px] text-[#64748B] leading-snug mt-1 font-normal"
                : "text-[13px] text-[#64748B] line-clamp-1 mt-1 font-normal"
            }
          >
            {caption}
          </p>
        )}
      </div>
    </div>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded-2xl"
      >
        {content}
      </Link>
    );
  }

  if (href) {
    const isExternal =
      href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:");
    return (
      <a
        href={href}
        target={isExternal && href.startsWith("http") ? "_blank" : undefined}
        rel={isExternal && href.startsWith("http") ? "noopener noreferrer" : undefined}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded-2xl"
      >
        {content}
      </a>
    );
  }

  return content;
};
