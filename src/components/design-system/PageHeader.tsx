import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  breadcrumbs,
  actions,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3 border-b border-border/50">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1 select-none">
            {breadcrumbs.map((b, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={idx}>
                  {idx > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/60" />}
                  {b.href && !isLast ? (
                    <Link
                      to={b.href}
                      className="hover:text-foreground transition-colors hover:underline"
                    >
                      {b.label}
                    </Link>
                  ) : (
                    <span className={isLast ? "font-medium text-foreground" : ""}>
                      {b.label}
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </nav>
        )}
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
};

