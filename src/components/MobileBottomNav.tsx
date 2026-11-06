import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Calendar, MessageSquare, Receipt, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/app/dashboard" },
  { icon: Calendar, label: "Bookings", href: "/app/clients" },
  { icon: MessageSquare, label: "Queries", href: "/app/queries" },
  { icon: Receipt, label: "Expenses", href: "/app/expenses" },
];

export function MobileBottomNav() {
  const location = useLocation();
  const { setOpenMobile } = useSidebar();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
      {/* Blur background */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-xl border-t border-border/40" />
      
      <div className="relative flex items-center justify-around px-2 py-1.5">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl min-w-[56px] transition-all duration-200 touch-manipulation select-none",
                "active:scale-95",
                isActive
                  ? "text-accent"
                  : "text-muted-foreground"
              )}
            >
              <div className={cn(
                "flex items-center justify-center w-10 h-8 rounded-xl transition-all duration-200",
                isActive && "bg-accent/12"
              )}>
                <item.icon className={cn("w-5 h-5", isActive && "stroke-[2.5px]")} />
              </div>
              <span className={cn(
                "text-[10px] leading-tight",
                isActive ? "font-bold" : "font-medium"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* More button opens sidebar */}
        <button
          onClick={() => setOpenMobile(true)}
          className={cn(
            "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl min-w-[56px] transition-all duration-200 touch-manipulation select-none",
            "active:scale-95 text-muted-foreground"
          )}
        >
          <div className="flex items-center justify-center w-10 h-8 rounded-xl">
            <MoreHorizontal className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-medium leading-tight">More</span>
        </button>
      </div>
    </nav>
  );
}
