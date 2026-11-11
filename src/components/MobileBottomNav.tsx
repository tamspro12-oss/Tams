import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar,
  MessageSquare,
  Wallet,
  MoreHorizontal,
  Bell,
  Calculator,
  Ticket,
  Users,
  Plane,
  BarChart3,
  Settings,
  Mail,
  BookOpen,
  Shield,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useReminders } from "@/hooks/useReminders";
import { useIsAdmin } from "@/hooks/useIsAdmin";

const navItems = [
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    href: "/app/dashboard",
    matches: (p: string) => p === "/app/dashboard",
  },
  {
    icon: Calendar,
    label: "Sales & Exp",
    href: "/app/sales-expenses",
    matches: (p: string) =>
      p.startsWith("/app/sales-expenses") ||
      p.startsWith("/app/bookings") ||
      p.startsWith("/app/vouchers") ||
      p.startsWith("/app/expenses") ||
      p.startsWith("/app/refunds"),
  },
  {
    icon: Users,
    label: "Parties",
    href: "/app/clients-vendors",
    matches: (p: string) =>
      p.startsWith("/app/clients-vendors") ||
      p.startsWith("/app/clients") ||
      p.startsWith("/app/vendors") ||
      p.startsWith("/app/b2b-agents"),
  },
  {
    icon: BarChart3,
    label: "Reports",
    href: "/app/reports",
    matches: (p: string) =>
      p.startsWith("/app/reports") ||
      p.startsWith("/app/accounts"),
  },
];

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { pendingRemindersCount } = useReminders();
  const { isAdmin } = useIsAdmin();

  const handleMoreItemClick = (href: string) => {
    setSheetOpen(false);
    navigate(href);
  };

  const moreItems = [
    ...(isAdmin ? [{
      icon: Shield,
      label: "Admin Panel",
      desc: "User management & system controls",
      href: "/app/admin",
      badge: null,
      color: "text-red-500 bg-red-50 dark:bg-red-950/40",
    }] : []),
    {
      icon: Bell,
      label: "Notifications & Alerts",
      desc: "Live departures & reminders",
      href: "/app/notifications",
      badge: pendingRemindersCount > 0 ? pendingRemindersCount : null,
      color: "text-amber-500 bg-amber-50 dark:bg-amber-950/40",
    },
    {
      icon: Calculator,
      label: "Umrah Calculator",
      desc: "Instant per-person packages",
      href: "/app/umrah-calculator",
      badge: null,
      color: "text-blue-500 bg-blue-50 dark:bg-blue-950/40",
    },
    {
      icon: Ticket,
      label: "Vouchers Hub",
      desc: "Umrah, Hotel & Flight vouchers",
      href: "/app/bookings?tab=vouchers",
      badge: null,
      color: "text-purple-500 bg-purple-50 dark:bg-purple-950/40",
    },
    {
      icon: Users,
      label: "B2B Agents",
      desc: "Agent network & ledgers",
      href: "/app/bookings?tab=b2b-agents",
      badge: null,
      color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40",
    },
    {
      icon: Plane,
      label: "Vendors & Airlines",
      desc: "Payable statements & ledgers",
      href: "/app/bookings?tab=vendors",
      badge: null,
      color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40",
    },
    {
      icon: BarChart3,
      label: "Financial Reports",
      desc: "P&L, sales & aging reports",
      href: "/app/accounts?tab=reports",
      badge: null,
      color: "text-teal-500 bg-teal-50 dark:bg-teal-950/40",
    },
    {
      icon: Settings,
      label: "Settings",
      desc: "Account, branding & templates",
      href: "/app/settings",
      badge: null,
      color: "text-slate-600 bg-slate-100 dark:bg-slate-800",
    },
    {
      icon: Mail,
      label: "Email Integration",
      desc: "Configuration, logs & cleanup",
      href: "/app/settings?tab=email-integration",
      badge: null,
      color: "text-cyan-500 bg-cyan-50 dark:bg-cyan-950/40",
    },
    {
      icon: BookOpen,
      label: "User Manual",
      desc: "Complete documentation & guides",
      href: "/app/settings?tab=manual",
      badge: null,
      color: "text-rose-500 bg-rose-50 dark:bg-rose-950/40",
    },
  ];

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
        {/* Blur background */}
        <div className="absolute inset-0 bg-background/90 backdrop-blur-xl border-t border-border/50" />

        <div className="relative flex items-center justify-around px-2 py-1.5">
          {navItems.map((item) => {
            const isActive = item.matches(location.pathname);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl min-w-[56px] transition-all duration-200 touch-manipulation select-none",
                  "active:scale-95",
                  isActive ? "text-accent" : "text-muted-foreground"
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-10 h-8 rounded-xl transition-all duration-200",
                    isActive && "bg-accent/12"
                  )}
                >
                  <item.icon className={cn("w-5 h-5", isActive && "stroke-[2.5px]")} />
                </div>
                <span className={cn("text-[10px] leading-tight", isActive ? "font-bold" : "font-medium")}>
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* More button */}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl min-w-[56px] transition-all duration-200 touch-manipulation select-none relative",
              "active:scale-95 text-muted-foreground"
            )}
          >
            <div className="flex items-center justify-center w-10 h-8 rounded-xl relative">
              <MoreHorizontal className="w-5 h-5" />
              {pendingRemindersCount > 0 && (
                <span className="absolute 1 top-0 right-0 w-2 h-2 rounded-full bg-amber-500" />
              )}
            </div>
            <span className="text-[10px] font-medium leading-tight">More</span>
          </button>
        </div>
      </nav>

      {/* Mobile "More" Drawer Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85dvh] overflow-y-auto p-4 safe-area-bottom">
          <SheetHeader className="text-left pb-3 border-b">
            <SheetTitle className="text-base font-bold flex items-center justify-between">
              <span>All Modules & Features</span>
            </SheetTitle>
          </SheetHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3">
            {moreItems.map((item) => (
              <button
                key={item.label}
                onClick={() => handleMoreItemClick(item.href)}
                className="flex items-center justify-between p-3 rounded-xl border bg-card hover:bg-muted/40 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", item.color)}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-xs text-foreground truncate">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{item.desc}</p>
                  </div>
                </div>

                {item.badge != null && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-white shrink-0">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
