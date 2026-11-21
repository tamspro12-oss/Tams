import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { MoreHorizontal, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MobileInstallButton } from "@/components/MobileInstallButton";
import { versionManager } from "@/lib/versionManager";
import { forceRefresh } from "@/lib/forceRefresh";
import { useUnifiedAlerts } from "@/hooks/useUnifiedAlerts";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  SALES_SUB_SECTIONS,
  getMobileBottomBarItems,
  getMobileMoreItems,
  isMoreMenuRouteActive,
  isNavItemActive,
  normalizeSalesTab,
} from "@/config/navigation";

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const { unreadCount: unreadAlertsCount } = useUnifiedAlerts();
  const { isAdmin } = useIsAdmin();

  const bottomBarItems = getMobileBottomBarItems();
  const moreItems = getMobileMoreItems({ isAdmin });
  const isMoreActive = isMoreMenuRouteActive(
    location.pathname,
    location.search,
    isAdmin
  );
  const activeSalesTab = location.pathname.startsWith("/app/sales-expenses")
    ? normalizeSalesTab(new URLSearchParams(location.search).get("tab"))
    : null;

  const handleMoreItemClick = (href: string) => {
    setSheetOpen(false);
    navigate(href);
  };

  const handleCheckUpdate = async () => {
    if (checkingUpdate) return;
    setCheckingUpdate(true);
    try {
      const res = await versionManager.checkVersionAPI({ manual: true });
      if (res.hasUpdate) {
        toast.info(`Updating to v${res.latestVersion}...`, {
          description: "Reloading latest version. Your saved data stays safe.",
        });
        setSheetOpen(false);
        try {
          await forceRefresh();
        } catch {
          window.location.reload();
        }
        return;
      }

      if (res.checkFailed) {
        toast.error("Could not check for updates. Please check your internet connection.");
      } else {
        toast.success(`You're on the latest version (v${res.currentVersion})`);
      }
    } finally {
      setCheckingUpdate(false);
    }
  };

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
        {/* Blur background */}
        <div className="absolute inset-0 bg-background/90 backdrop-blur-xl border-t border-border/50" />

        <div className="relative flex items-center justify-around px-1 sm:px-2 py-1.5 gap-0.5">
          {bottomBarItems.map((item) => {
            const isActive = isNavItemActive(item, location.pathname, location.search);
            const displayLabel = item.mobileLabel || item.label;
            return (
              <Link
                key={item.id}
                to={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 px-1 sm:px-3 py-1.5 rounded-xl flex-1 min-w-0 min-h-[48px] transition-all duration-200 touch-manipulation select-none",
                  "active:scale-95",
                  isActive ? "text-accent" : "text-muted-foreground"
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-9 sm:w-10 h-7 sm:h-8 rounded-xl transition-all duration-200",
                    isActive && "bg-accent/12"
                  )}
                >
                  <item.icon className={cn("w-5 h-5", isActive && "stroke-[2.5px]")} />
                </div>
                <span className={cn("text-[10px] leading-tight truncate max-w-full", isActive ? "font-bold" : "font-medium")}>
                  {displayLabel}
                </span>
              </Link>
            );
          })}

          {/* More button */}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 px-1 sm:px-3 py-1.5 rounded-xl flex-1 min-w-0 min-h-[48px] transition-all duration-200 touch-manipulation select-none relative",
              "active:scale-95",
              isMoreActive ? "text-accent" : "text-muted-foreground"
            )}
          >
            <div
              className={cn(
                "flex items-center justify-center w-9 sm:w-10 h-7 sm:h-8 rounded-xl relative transition-all duration-200",
                isMoreActive && "bg-accent/12"
              )}
            >
              <MoreHorizontal className={cn("w-5 h-5", isMoreActive && "stroke-[2.5px]")} />
              {unreadAlertsCount > 0 && (
                <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-amber-500" />
              )}
            </div>
            <span className={cn("text-[10px] leading-tight truncate max-w-full", isMoreActive ? "font-bold" : "font-medium")}>
              More
            </span>
          </button>
        </div>
      </nav>

      {/* Mobile "More" Drawer Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85dvh] overflow-y-auto p-4 safe-area-bottom">
          <SheetHeader className="text-left pb-3 border-b pr-10">
            <SheetTitle className="text-base font-bold flex items-center justify-between">
              <span>All Modules & Features</span>
            </SheetTitle>
          </SheetHeader>

          <MobileInstallButton
            variant="drawer-card"
            className="pt-3"
            onActionStart={() => setSheetOpen(false)}
          />

          {/* Sales & Expenses quick sub-sections (Invoice, Voucher, Refund, Expense) */}
          <div className="pt-3 space-y-1.5">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Sales &amp; Expenses
              </span>
              <button
                type="button"
                onClick={() => handleMoreItemClick("/app/sales-expenses")}
                className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
              >
                Open Hub →
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {SALES_SUB_SECTIONS.map((sub) => {
                const isSubActive = activeSalesTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => handleMoreItemClick(sub.href)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl border bg-card hover:bg-muted/40 transition-colors min-h-[54px] touch-manipulation cursor-pointer",
                      isSubActive && "border-accent bg-accent/10"
                    )}
                  >
                    <sub.icon className={cn("w-4 h-4", sub.iconColorClass)} />
                    <span className="text-[11px] font-semibold text-foreground leading-tight">
                      {sub.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-3">
            {moreItems.map((item) => {
              const isActive = isNavItemActive(item, location.pathname, location.search);
              const displayLabel = item.mobileLabel || item.label;
              const badge =
                item.badgeKey === "unreadAlerts" && unreadAlertsCount > 0
                  ? unreadAlertsCount
                  : null;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleMoreItemClick(item.href)}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl border bg-card hover:bg-muted/40 transition-colors text-left cursor-pointer",
                    isActive && "border-accent bg-accent/5"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", item.colorClass)}>
                      <item.icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-xs text-foreground truncate">{displayLabel}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{item.description}</p>
                    </div>
                  </div>

                  {badge != null && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-white shrink-0">
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">
                App Version <span className="font-mono">v{versionManager.getCurrentVersion()}</span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                Safe updates preserve all saved data
              </p>
            </div>
            <button
              type="button"
              disabled={checkingUpdate}
              onClick={() => void handleCheckUpdate()}
              className="min-h-[44px] px-3 rounded-xl border bg-muted/40 hover:bg-muted/70 disabled:opacity-60 text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", checkingUpdate && "animate-spin")} />
              <span>{checkingUpdate ? "Checking..." : "Check Update"}</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
