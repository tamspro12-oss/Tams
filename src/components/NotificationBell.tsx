import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  CheckCircle2,
  Plane,
  Sparkles,
  Receipt,
  Calendar,
  ExternalLink,
  ArrowRight,
  Clock,
  AlertCircle,
  Check,
} from "lucide-react";
import { useUnifiedAlerts, type PortalAlertItem } from "@/hooks/useUnifiedAlerts";
import { CopyValue } from "@/components/ui/CopyValue";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { activeAlerts = [], unreadCount = 0, markAsRead, markAllAsRead, markAsDone } = useUnifiedAlerts();

  // Latest 5 alerts
  const latestAlerts = activeAlerts.slice(0, 5);

  const getPriorityBadge = (priority: PortalAlertItem["priority"]) => {
    switch (priority) {
      case "overdue":
        return <Badge className="bg-red-500 hover:bg-red-600 text-white text-[9px] px-1.5 py-0 h-4">OVERDUE</Badge>;
      case "due_today":
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[9px] px-1.5 py-0 h-4">DUE TODAY</Badge>;
      case "upcoming":
        return <Badge className="bg-blue-500 hover:bg-blue-600 text-white text-[9px] px-1.5 py-0 h-4">UPCOMING</Badge>;
      default:
        return <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">INFO</Badge>;
    }
  };

  const handleAction = (alert: PortalAlertItem) => {
    markAsRead(alert.id);
    setOpen(false);
    if (alert.mainAction.url) {
      navigate(alert.mainAction.url);
    } else if (alert.mainAction.modalType === "payment_voucher") {
      navigate(`/app/sales-expenses?tab=payment-vouchers&new=1&party=${alert.mainAction.modalProps?.partyId || ""}`);
    } else if (alert.mainAction.modalType === "expense") {
      navigate("/app/sales-expenses?tab=expenses&new=1");
    } else if (alert.mainAction.modalType === "refund") {
      navigate("/app/sales-expenses?tab=refunds-voids&new=1");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative h-9 w-9 hover:bg-accent/10 active:bg-accent/10 rounded-xl inline-flex items-center justify-center transition-all duration-200 active:scale-95 touch-manipulation flex-shrink-0 border border-border/40 text-foreground"
          aria-label="Open notifications"
        >
          <Bell className="h-4.5 w-4.5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-xs animate-in zoom-in-50">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[94vw] sm:w-[420px] p-0 shadow-xl border bg-card/98 backdrop-blur-md rounded-xl overflow-hidden z-50"
      >
        {/* Header */}
        <div className="p-3 border-b bg-muted/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm text-foreground">Notifications & Alerts</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5 font-bold">
                {unreadCount} unread
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllAsRead()}
                className="text-[11px] text-muted-foreground hover:text-foreground font-medium px-2 py-0.5 rounded hover:bg-muted"
              >
                Mark all read
              </button>
            )}
            <Link
              to="/app/notifications"
              onClick={() => setOpen(false)}
              className="text-xs text-primary hover:underline font-semibold flex items-center gap-0.5 ml-1"
            >
              View all
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Content: latest 5 alerts */}
        <div className="max-h-[380px] overflow-y-auto divide-y divide-border/60">
          {latestAlerts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-xs space-y-1">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500/50 mb-2" />
              <p className="font-semibold text-foreground">All clear!</p>
              <p>No unread operational alerts or pending tasks right now.</p>
            </div>
          ) : (
            latestAlerts.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  "p-3 hover:bg-muted/30 transition-colors flex flex-col gap-1.5 text-xs",
                  !alert.isRead ? "bg-primary/5 font-medium" : "opacity-90"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {getPriorityBadge(alert.priority)}
                    <span className={cn("truncate text-foreground", !alert.isRead ? "font-bold" : "font-medium")}>
                      {alert.title}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => markAsDone(alert.id)}
                    className="text-muted-foreground hover:text-emerald-600 p-0.5 rounded shrink-0"
                    title="Mark done"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-[11px] text-muted-foreground line-clamp-2">
                  {alert.description}
                </p>

                {/* Values copy bar if available */}
                {(alert.invoiceNo || alert.pnr || alert.clientName) && (
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground/80 mt-0.5">
                    {alert.invoiceNo && (
                      <span className="flex items-center gap-1">
                        Inv: <CopyValue value={alert.invoiceNo} label="invoice no" className="font-mono text-primary" />
                      </span>
                    )}
                    {alert.pnr && (
                      <span className="flex items-center gap-1">
                        PNR: <CopyValue value={alert.pnr} label="PNR" className="font-mono text-primary" />
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 pt-1 mt-0.5 border-t border-border/40">
                  <span className="text-[10px] text-muted-foreground/70">
                    {alert.dueDate ? `Due: ${alert.dueDate}` : "Active"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction(alert)}
                      className="h-6 text-[11px] px-2 font-semibold"
                    >
                      {alert.mainAction.label}
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-2 border-t bg-muted/20 text-center">
          <Link
            to="/app/notifications"
            onClick={() => setOpen(false)}
            className="text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1"
          >
            Open Full Notifications & Alerts Hub
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
export default NotificationBell;
