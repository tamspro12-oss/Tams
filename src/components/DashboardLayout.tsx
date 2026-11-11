import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { sessionManager } from "@/lib/sessionManager";
import { toast } from "sonner";
import { AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAgency } from "@/hooks/useAgency";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { SessionTimer } from "@/components/SessionTimer";
import { SyncIndicator } from "@/components/SyncIndicator";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { PageTransition } from "@/components/PageTransition";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LayoutDashboard,
  Calendar,
  Receipt,
  BarChart3,
  Settings,
  Plane,
  Calculator,
  MessageSquare,
  Menu,
  Mail,
  Shield,
  BookOpen,
  Users,
  Wallet,
  RotateCcw,
  Scale,
  LogOut,
  FileText,
  Ticket,
  Bell,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";


import { useReminders } from "@/hooks/useReminders";
import { useUnifiedAlerts } from "@/hooks/useUnifiedAlerts";

interface DashboardLayoutProps {
  children: ReactNode;
}

function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: agency, isLoading: agencyLoading } = useAgency();
  const { isMobile, openMobile, setOpenMobile } = useSidebar();
  const { isAdmin } = useIsAdmin();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const { unreadCount: unreadAlertsCount } = useUnifiedAlerts();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      sessionManager.endSession();
      await supabase.auth.signOut({ scope: 'local' });
      toast.success("Logged out successfully");
      navigate("/login");
    } catch (error) {
      toast.error("Failed to logout");
    } finally {
      setIsLoggingOut(false);
      setShowLogoutDialog(false);
    }
  };

  const handleLogoutClick = () => {
    // Close sidebar first on mobile, then show dialog
    if (isMobile && openMobile) {
      setOpenMobile(false);
      // Small delay to let sidebar close before showing dialog
      setTimeout(() => setShowLogoutDialog(true), 300);
    } else {
      setShowLogoutDialog(true);
    }
  };

  // Exactly Final Menu from Part D
  const navigation = [
    ...(isAdmin ? [{ name: "Admin Panel", href: "/app/admin", icon: Shield, badge: null }] : []),
    { name: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard, badge: null },
    { name: "Sales & Expenses", href: "/app/sales-expenses", icon: Receipt, badge: null },
    { name: "Clients & Vendors", href: "/app/clients-vendors", icon: Users, badge: null },
    { name: "Reports", href: "/app/reports", icon: BarChart3, badge: null },
    { name: "Queries & Quotes", href: "/app/leads-quotes", icon: MessageSquare, badge: null },
    { name: "Umrah Calculator", href: "/app/umrah-calculator", icon: Calculator, badge: null },
    { name: "Notifications", href: "/app/notifications", icon: Bell, badge: unreadAlertsCount > 0 ? unreadAlertsCount : null },
    { name: "Settings", href: "/app/settings", icon: Settings, badge: null },
  ];

  const isNavActive = (href: string) => {
    const p = location.pathname;
    if (href === "/app/dashboard") return p === "/app/dashboard";
    if (href === "/app/sales-expenses") return p.startsWith("/app/sales-expenses") || p.startsWith("/app/bookings") || p.startsWith("/app/vouchers") || p.startsWith("/app/expenses") || p.startsWith("/app/refunds");
    if (href === "/app/clients-vendors") return p.startsWith("/app/clients-vendors") || p.startsWith("/app/clients") || p.startsWith("/app/b2b-agents") || p.startsWith("/app/vendors");
    if (href === "/app/reports") return p.startsWith("/app/reports") || p.startsWith("/app/accounts");
    if (href === "/app/leads-quotes") return p.startsWith("/app/leads-quotes") || p.startsWith("/app/queries") || p.startsWith("/app/quotations");
    if (href === "/app/umrah-calculator") return p.startsWith("/app/umrah-calculator");
    if (href === "/app/notifications") return p.startsWith("/app/notifications") || p.startsWith("/app/reminders");
    if (href === "/app/settings") return p.startsWith("/app/settings") || p.startsWith("/app/email-history") || p.startsWith("/app/user-manual");
    if (href === "/app/admin") return p.startsWith("/app/admin");
    return p === href;
  };

  const handleNavClick = () => {
    if (isMobile && openMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar
      collapsible="offcanvas"
      className="border-r border-sidebar-border"
    >
      <SidebarContent className="bg-sidebar h-full flex flex-col">
        {/* Logo Header */}
        <div className="h-16 md:h-[68px] flex items-center gap-3 px-5 md:px-6 border-b border-sidebar-border/60 flex-shrink-0">
          <div className="w-9 h-9 md:w-10 md:h-10 bg-gradient-to-br from-accent to-accent/80 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-accent/20">
            <Plane className="w-5 h-5 md:w-5 md:h-5 text-accent-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            {agencyLoading ? (
              <Skeleton className="h-4 w-28 my-1" />
            ) : (
              <>
                <span className="block font-bold text-sidebar-foreground text-sm md:text-base truncate tracking-tight">
                  {agency?.name || "Your Agency"}
                </span>
                {!agency?.name && (
                  <Link
                    to="/app/settings"
                    onClick={handleNavClick}
                    className="text-[10px] text-amber-500 hover:text-amber-600 dark:text-amber-400 hover:underline block truncate font-medium"
                  >
                    Set name in Settings →
                  </Link>
                )}
              </>
            )}
            {agency?.name && (
              <p className="text-[11px] text-sidebar-foreground/50 font-medium hidden md:block tracking-wide uppercase">
                Agency Manager
              </p>
            )}
          </div>
        </div>

        {/* Navigation Menu */}
        <SidebarGroup className="flex-1 px-3 py-4 overflow-y-auto">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {navigation.map((item) => {
                const isActive = isNavActive(item.href);
                return (
                  <SidebarMenuItem key={item.name}>
                    <Link
                      to={item.href}
                      onClick={handleNavClick}
                      className={cn(
                        "group relative flex items-center justify-between px-3 py-2.5 md:py-3 rounded-xl text-[13px] font-medium w-full touch-manipulation select-none overflow-hidden",
                        "transition-all duration-200 ease-out",
                        "active:scale-[0.97]",
                        "min-h-[44px]",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-primary font-semibold"
                          : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      )}
                    >
                      {/* Active indicator - teal left border */}
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 bg-accent rounded-r-full" />
                      )}
                      
                      <div className="flex items-center gap-3 min-w-0">
                        <item.icon 
                          className={cn(
                            "w-[18px] h-[18px] flex-shrink-0 transition-colors duration-200",
                            isActive ? "text-accent" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70"
                          )} 
                        />
                        
                        <span className="text-[13px] leading-tight truncate">
                          {item.name}
                        </span>
                      </div>

                      {item.badge != null && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-white shrink-0">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Logout Button */}
        <div className="px-3 pt-1">
          <button
            onClick={handleLogoutClick}
            className={cn(
              "group relative flex items-center gap-3 px-3 py-2.5 md:py-3 rounded-xl text-[13px] font-medium w-full touch-manipulation select-none overflow-hidden",
              "transition-all duration-200 ease-out",
              "active:scale-[0.97]",
              "min-h-[44px]",
              "text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
            )}
          >
            <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
            <span className="text-[13px]">Logout</span>
          </button>
        </div>

        {/* Logout Confirmation Dialog - rendered outside sidebar */}
        <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
          <AlertDialogContent className="z-[100]">
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to log out? Any unsaved changes will be lost.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isLoggingOut ? "Logging out..." : "Logout"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border/40 flex-shrink-0">
          <div className="text-[11px] text-sidebar-foreground/40">
            {agencyLoading ? (
              <Skeleton className="h-3.5 w-24 my-0.5" />
            ) : (
              <p className="font-semibold text-sidebar-foreground/60 text-xs truncate">
                {agency?.name || 'Your Agency'}
              </p>
            )}
            <p className="font-medium mt-0.5">Developed by TAMS Pro</p>
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data: agency, isLoading: agencyLoading } = useAgency();
  const location = useLocation();
  useDocumentTitle();

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="h-[100dvh] md:min-h-screen flex w-full bg-background overflow-hidden">
        <AppSidebar />

        {/* Main Content */}
        <main className="flex-1 flex flex-col h-full overflow-hidden w-full">
          {/* Header */}
          <header className="border-b border-border/60 bg-background/95 backdrop-blur-xl px-4 md:px-6 lg:px-8 flex items-center justify-between gap-2 z-40 shrink-0 pt-[env(safe-area-inset-top,0px)] h-[calc(3rem+env(safe-area-inset-top,0px))] md:h-16 md:pt-0">
            
            {/* === MOBILE HEADER LAYOUT === */}
            <div className="md:hidden flex-1" />
            
            <div className="md:hidden flex items-center gap-1.5 flex-shrink-0">
              <OfflineIndicator />
              <NotificationBell />
              <ThemeToggle />
            </div>

            {/* === DESKTOP HEADER LAYOUT === */}
            <div className="hidden md:flex items-center gap-3 min-w-0 flex-1">
              <SessionTimer />
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                  <Plane className="w-4 h-4 text-primary-foreground" />
                </div>
                {agencyLoading ? (
                  <Skeleton className="h-4 w-28" />
                ) : (
                  <span className="font-semibold text-sm text-foreground truncate">{agency?.name || 'Your Agency'}</span>
                )}
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2.5 flex-shrink-0">
              <NotificationBell />
              <OfflineIndicator />
              <ThemeToggle />
              <SyncIndicator />
              <SidebarTrigger className="h-9 w-9 hover:bg-accent/10 active:bg-accent/10 rounded-xl inline-flex items-center justify-center transition-all duration-200 active:scale-95 touch-manipulation flex-shrink-0 border border-border/40">
                <Menu className="h-4.5 w-4.5" />
              </SidebarTrigger>
            </div>
          </header>
          
          {/* Content Area - Only this container scrolls */}
          <div className="flex-1 overflow-y-auto overscroll-y-contain">
            <div className="p-2 sm:p-2 md:p-4 lg:p-6 pb-24 md:pb-6 w-full">
              {children}
            </div>
          </div>

          {/* Mobile Bottom Navigation */}
          <MobileBottomNav />
        </main>
      </div>
    </SidebarProvider>
  );
}
