import React, { useState, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  Plane,
  Wallet,
  Clock,
  Sliders,
  Plus,
  Search,
  CheckCircle2,
  Check,
  Moon,
  Trash2,
  ExternalLink,
  ChevronDown,
  ArrowUpDown,
  Filter,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useUnifiedAlerts, type PortalAlertItem, type AlertPreferences } from "@/hooks/useUnifiedAlerts";
import { DatePresetFilter, type DatePresetFilterValue } from "@/components/leads-quotes/DatePresetFilter";
import { isDateWithinPreset } from "@/lib/dateFilterUtils";
import { NewReminderDialog } from "@/components/NewReminderDialog";
import { CopyValue } from "@/components/ui/CopyValue";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type NotificationTab = "all" | "travel" | "accounts" | "reminders" | "preferences";
type StatusFilter = "active" | "done" | "snoozed" | "all";

export default function NotificationsHub() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab") as NotificationTab;
  const currentTab: NotificationTab =
    rawTab === "travel" || rawTab === "accounts" || rawTab === "reminders" || rawTab === "preferences"
      ? rawTab
      : "all";

  const {
    allAlerts = [],
    activeAlerts = [],
    counts,
    preferences,
    savePreferences,
    markAsRead,
    markAllAsRead,
    markAsDone,
    snoozeAlert,
    dismissAlert,
  } = useUnifiedAlerts();

  // Search, Status, and Date filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [dateFilter, setDateFilter] = useState<DatePresetFilterValue>({
    preset: "this_month",
  });

  const [isAddReminderOpen, setIsAddReminderOpen] = useState(false);

  const handleTabChange = useCallback(
    (val: NotificationTab) => {
      setSearchParams({ tab: val }, { replace: true });
    },
    [setSearchParams]
  );

  // Filter alerts by Tab, Date, Search, and Status
  const filteredAlerts = useMemo(() => {
    return allAlerts.filter((item) => {
      // 1. Tab filter
      if (currentTab === "travel" && item.type !== "travel") return false;
      if (currentTab === "accounts" && item.type !== "accounts") return false;
      if (currentTab === "reminders" && item.type !== "reminders") return false;

      // 2. Status filter
      const nowIso = new Date().toISOString();
      const isSnoozed = item.snoozedUntil && item.snoozedUntil > nowIso;
      if (statusFilter === "active" && (item.isDone || isSnoozed)) return false;
      if (statusFilter === "done" && !item.isDone) return false;
      if (statusFilter === "snoozed" && !isSnoozed) return false;

      // 3. Date filter
      const itemDate = item.dueDate || item.createdAt.slice(0, 10);
      if (!isDateWithinPreset(itemDate, dateFilter.preset, dateFilter.customFrom, dateFilter.customTo)) {
        return false;
      }

      // 4. Search query: title, client, invoice no, PNR, ticket no
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        const matchesClient = item.clientName ? item.clientName.toLowerCase().includes(q) : false;
        const matchesVendor = item.vendorName ? item.vendorName.toLowerCase().includes(q) : false;
        const matchesInvoice = item.invoiceNo ? item.invoiceNo.toLowerCase().includes(q) : false;
        const matchesPnr = item.pnr ? item.pnr.toLowerCase().includes(q) : false;
        const matchesTicket = item.ticketNo ? item.ticketNo.toLowerCase().includes(q) : false;

        if (
          !matchesTitle &&
          !matchesDesc &&
          !matchesClient &&
          !matchesVendor &&
          !matchesInvoice &&
          !matchesPnr &&
          !matchesTicket
        ) {
          return false;
        }
      }

      return true;
    });
  }, [allAlerts, currentTab, statusFilter, dateFilter, searchQuery]);

  // Priority border and badge styling
  const getPriorityStyle = (priority: PortalAlertItem["priority"]) => {
    switch (priority) {
      case "overdue":
        return {
          border: "border-l-4 border-l-red-500",
          badge: <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0 h-4 font-bold">OVERDUE</Badge>,
          bg: "bg-red-50/30 dark:bg-red-950/20",
        };
      case "due_today":
        return {
          border: "border-l-4 border-l-amber-500",
          badge: <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0 h-4 font-bold">DUE TODAY</Badge>,
          bg: "bg-amber-50/30 dark:bg-amber-950/20",
        };
      case "upcoming":
        return {
          border: "border-l-4 border-l-blue-500",
          badge: <Badge className="bg-blue-500 text-white text-[10px] px-1.5 py-0 h-4 font-bold">UPCOMING</Badge>,
          bg: "bg-blue-50/20 dark:bg-blue-950/20",
        };
      default:
        return {
          border: "border-l-4 border-l-slate-400",
          badge: <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">INFO</Badge>,
          bg: "bg-slate-50/30 dark:bg-slate-900/30",
        };
    }
  };

  const handleActionClick = (alert: PortalAlertItem) => {
    markAsRead(alert.id);
    if (alert.mainAction.url) {
      navigate(alert.mainAction.url);
    } else if (alert.mainAction.modalType === "payment_voucher") {
      navigate(
        `/app/sales-expenses?tab=payment-vouchers&new=1&party=${alert.mainAction.modalProps?.partyId || ""}&invoice=${alert.mainAction.modalProps?.invoiceNo || ""}`
      );
    } else if (alert.mainAction.modalType === "expense") {
      navigate("/app/sales-expenses?tab=expenses&new=1");
    } else if (alert.mainAction.modalType === "refund") {
      navigate("/app/sales-expenses?tab=refunds-voids&new=1");
    }
  };

  return (
    <div className="space-y-3 max-w-7xl mx-auto">
      <SeoHead
        title="Notifications & Alerts Hub - TAMS Pro"
        description="Unified live alert feed: flights, Umrah departures, daily expense prompts, and custom tasks."
        path="/app/notifications"
      />

      {/* 1. TOP HEADER & PILL TABS */}
      <div className="bg-background/95 backdrop-blur-md pb-2 pt-1 border-b space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Notifications & Alerts Hub
                {counts.all > 0 && (
                  <Badge variant="destructive" className="text-xs font-bold h-5 px-1.5">
                    {counts.all} Unread
                  </Badge>
                )}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <DatePresetFilter
              value={dateFilter}
              onChange={setDateFilter}
              className="h-8 text-xs shrink-0"
            />
            <Button
              size="sm"
              onClick={() => setIsAddReminderOpen(true)}
              className="h-8 px-3 text-xs font-bold gap-1.5 bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              New Reminder
            </Button>
          </div>
        </div>

        {/* Tabs Bar styled like Sales & Expenses: All Activity | Flights & Umrah | Accounts & Operations | My Reminders | Preferences */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
          <div className="flex items-center gap-1 bg-muted/60 dark:bg-muted/40 p-1 rounded-xl border">
            <button
              type="button"
              onClick={() => handleTabChange("all")}
              className={cn(
                "h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all select-none whitespace-nowrap",
                currentTab === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>All Activity</span>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                  currentTab === "all"
                    ? "bg-primary-foreground/20 text-primary-foreground font-bold"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {counts.all}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("travel")}
              className={cn(
                "h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all select-none whitespace-nowrap",
                currentTab === "travel"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <Plane className="w-3.5 h-3.5 text-blue-500" />
              <span>Flights & Umrah</span>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                  currentTab === "travel"
                    ? "bg-primary-foreground/20 text-primary-foreground font-bold"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {counts.travel}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("accounts")}
              className={cn(
                "h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all select-none whitespace-nowrap",
                currentTab === "accounts"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <Wallet className="w-3.5 h-3.5 text-emerald-500" />
              <span>Accounts & Operations</span>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                  currentTab === "accounts"
                    ? "bg-primary-foreground/20 text-primary-foreground font-bold"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {counts.accounts}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("reminders")}
              className={cn(
                "h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all select-none whitespace-nowrap",
                currentTab === "reminders"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>My Reminders</span>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                  currentTab === "reminders"
                    ? "bg-primary-foreground/20 text-primary-foreground font-bold"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {counts.reminders}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("preferences")}
              className={cn(
                "h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all select-none whitespace-nowrap",
                currentTab === "preferences"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <Sliders className="w-3.5 h-3.5 text-purple-500" />
              <span>Preferences</span>
            </button>
          </div>

          {currentTab !== "preferences" && (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllAsRead()}
                className="h-8 text-xs font-semibold text-primary hover:bg-primary/10"
              >
                Mark all read
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* FILTER BAR: Search Bar & Status Filter (for tabs other than preferences) */}
      {currentTab !== "preferences" && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2 bg-slate-50 dark:bg-slate-900/60 rounded-xl border">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by title, client, invoice no, PNR, or ticket no..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs bg-white dark:bg-slate-950"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-semibold text-muted-foreground">Status:</span>
            <div className="flex items-center gap-1">
              {(["active", "done", "snoozed", "all"] as StatusFilter[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={cn(
                    "h-7 px-2.5 rounded-lg text-xs font-semibold transition-all capitalize",
                    statusFilter === st
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border hover:bg-slate-100"
                  )}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT */}

      {/* TAB 1, 2, 3: CARDS FEED (All Activity, Flights & Umrah, Accounts & Operations) */}
      {(currentTab === "all" || currentTab === "travel" || currentTab === "accounts") && (
        <div className="space-y-2.5">
          {filteredAlerts.length === 0 ? (
            <div className="p-12 text-center border rounded-2xl bg-white dark:bg-slate-900 shadow-xs space-y-2">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500/60" />
              <h3 className="font-bold text-sm text-foreground">No alerts match your filter</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                All client dues, departures, and operational tasks are up to date for this period.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAlerts.map((alert) => {
                const style = getPriorityStyle(alert.priority);
                return (
                  <div
                    key={alert.id}
                    className={cn(
                      "p-3 sm:p-3.5 rounded-xl border bg-white dark:bg-slate-900 shadow-xs transition-all hover:shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                      style.border,
                      !alert.isRead ? style.bg : "opacity-90"
                    )}
                  >
                    {/* Left: Alert Information */}
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {style.badge}
                        <span
                          className={cn(
                            "text-xs sm:text-sm text-foreground truncate",
                            !alert.isRead ? "font-bold text-slate-950 dark:text-white" : "font-semibold"
                          )}
                        >
                          {alert.title}
                        </span>
                        {alert.dueDate && (
                          <span className="text-[11px] font-mono text-muted-foreground ml-auto sm:ml-0">
                            Due: {alert.dueDate}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {alert.description}
                      </p>

                      {/* Copyable tags */}
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap pt-0.5">
                        {alert.invoiceNo && (
                          <span className="inline-flex items-center gap-1 font-mono">
                            Inv: <CopyValue value={alert.invoiceNo} label="invoice no" className="text-primary font-bold" />
                          </span>
                        )}
                        {alert.pnr && (
                          <span className="inline-flex items-center gap-1 font-mono">
                            PNR: <CopyValue value={alert.pnr} label="PNR" className="text-primary font-bold" />
                          </span>
                        )}
                        {alert.ticketNo && (
                          <span className="inline-flex items-center gap-1 font-mono">
                            Ticket: <CopyValue value={alert.ticketNo} label="ticket no" className="text-primary font-bold" />
                          </span>
                        )}
                        {alert.clientName && (
                          <span className="inline-flex items-center gap-1">
                            Client: <CopyValue value={alert.clientName} label="client name" className="text-primary" />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      <Button
                        size="sm"
                        onClick={() => handleActionClick(alert)}
                        className="h-8 text-xs font-bold px-3 shadow-xs"
                      >
                        {alert.mainAction.label}
                      </Button>

                      {alert.secondaryAction && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            markAsRead(alert.id);
                            navigate(alert.secondaryAction!.url!);
                          }}
                          className="h-8 text-xs font-medium"
                        >
                          {alert.secondaryAction.label}
                        </Button>
                      )}

                      {/* Mark Done button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAsDone(alert.id)}
                        className="h-8 text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                        title="Mark Done"
                      >
                        <Check className="w-3.5 h-3.5 mr-1" />
                        Done
                      </Button>

                      {/* Snooze Dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 text-xs px-2 text-muted-foreground">
                            <Moon className="w-3.5 h-3.5 mr-1" />
                            Snooze
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="text-xs">
                          <DropdownMenuItem onClick={() => snoozeAlert(alert.id, "1h")}>
                            Snooze for 1 hour
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => snoozeAlert(alert.id, "tonight")}>
                            Snooze until tonight (9 PM)
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => snoozeAlert(alert.id, "tomorrow")}>
                            Snooze until tomorrow morning
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Dismiss */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => dismissAlert(alert.id)}
                        className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                        title="Dismiss"
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MY REMINDERS REGISTER TABLE */}
      {currentTab === "reminders" && (
        <div className="space-y-3">
          {/* Reminders Table Register */}
          <div className="border rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#0B192C] text-white uppercase text-[11px] font-bold tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">Reminder No</th>
                    <th className="py-2.5 px-4 min-w-[200px]">Title</th>
                    <th className="py-2.5 px-3">Linked To</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Priority</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredAlerts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-muted-foreground">
                        No reminders found for this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredAlerts.map((r) => {
                      const isOverdue = r.priority === "overdue";
                      return (
                        <tr
                          key={r.id}
                          className={cn(
                            "hover:bg-muted/40 transition-colors",
                            isOverdue && "bg-red-50/20 text-red-700 dark:text-red-400"
                          )}
                        >
                          <td className="py-2.5 px-3 font-mono">
                            {r.dueDate || r.createdAt.slice(0, 10)}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-muted-foreground">
                            09:00
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold">
                            <CopyValue value={r.sourceId ? `REM-${r.sourceId.slice(0, 4)}` : "REM-AUTO"} label="reminder no" />
                          </td>
                          <td className="py-2.5 px-4 font-semibold text-foreground">
                            {r.title}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">
                            {r.clientName || r.vendorName || "General"}
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {r.sourceType || "Task"}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3">
                            {getPriorityStyle(r.priority).badge}
                          </td>
                          <td className="py-2.5 px-3 font-bold">
                            {r.isDone ? (
                              <span className="text-emerald-600">Done</span>
                            ) : (
                              <span className="text-amber-600">Active</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => markAsDone(r.id)}
                                className="h-7 px-2 text-[11px] font-semibold text-emerald-600"
                              >
                                Done
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => snoozeAlert(r.id, "tomorrow")}
                                className="h-7 px-2 text-[11px] text-muted-foreground"
                              >
                                Snooze
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => dismissAlert(r.id)}
                                className="h-7 px-2 text-[11px] text-destructive hover:bg-destructive/10"
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Total count footer */}
            <div className="p-2.5 border-t bg-muted/20 flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>TOTAL REMINDERS</span>
              <span className="font-mono text-foreground font-bold">{filteredAlerts.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: PREFERENCES TAB (functional, saved per user) */}
      {currentTab === "preferences" && (
        <div className="max-w-4xl space-y-4">
          <div className="p-4 sm:p-5 rounded-xl border bg-white dark:bg-slate-900 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-foreground">Notification & Alert Generator Preferences</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure auto alert rules, threshold settings, and daily operational reminders.
              </p>
            </div>

            {/* Alert Type Toggles */}
            <div className="space-y-2 pt-2 border-t">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Alert Triggers
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/15">
                  <div className="pr-2">
                    <p className="font-semibold text-xs text-foreground">Pending Client Payments</p>
                    <p className="text-[11px] text-muted-foreground">Alert when invoice remaining amount is &gt; 0</p>
                  </div>
                  <Switch
                    checked={preferences.pendingClientPayment}
                    onCheckedChange={(val) => savePreferences({ pendingClientPayment: val })}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/15">
                  <div className="pr-2">
                    <p className="font-semibold text-xs text-foreground">Invoice Overdue Alerts</p>
                    <p className="text-[11px] text-muted-foreground">Flag invoices past Remaining Due Date</p>
                  </div>
                  <Switch
                    checked={preferences.invoiceOverdue}
                    onCheckedChange={(val) => savePreferences({ invoiceOverdue: val })}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/15">
                  <div className="pr-2">
                    <p className="font-semibold text-xs text-foreground">Payment Due Soon</p>
                    <p className="text-[11px] text-muted-foreground">Alert for balances due within configured days</p>
                  </div>
                  <Switch
                    checked={preferences.paymentDueSoon}
                    onCheckedChange={(val) => savePreferences({ paymentDueSoon: val })}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/15">
                  <div className="pr-2">
                    <p className="font-semibold text-xs text-foreground">Vendor Payable Due</p>
                    <p className="text-[11px] text-muted-foreground">Alert for outstanding supplier payable balances</p>
                  </div>
                  <Switch
                    checked={preferences.vendorPayableDue}
                    onCheckedChange={(val) => savePreferences({ vendorPayableDue: val })}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/15">
                  <div className="pr-2">
                    <p className="font-semibold text-xs text-foreground">Upcoming Departures (Flight/Umrah)</p>
                    <p className="text-[11px] text-muted-foreground">Flag passenger travel within departure window</p>
                  </div>
                  <Switch
                    checked={preferences.upcomingDeparture}
                    onCheckedChange={(val) => savePreferences({ upcomingDeparture: val })}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/15">
                  <div className="pr-2">
                    <p className="font-semibold text-xs text-foreground">Recurring Operating Expenses</p>
                    <p className="text-[11px] text-muted-foreground">Reminder when recurring rent/utility is due</p>
                  </div>
                  <Switch
                    checked={preferences.recurringExpenseDue}
                    onCheckedChange={(val) => savePreferences({ recurringExpenseDue: val })}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/15">
                  <div className="pr-2">
                    <p className="font-semibold text-xs text-foreground">Query & Quotation Follow-ups</p>
                    <p className="text-[11px] text-muted-foreground">Follow-up due for open leads & proposals</p>
                  </div>
                  <Switch
                    checked={preferences.queryQuoteFollowUp}
                    onCheckedChange={(val) => savePreferences({ queryQuoteFollowUp: val })}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/15">
                  <div className="pr-2">
                    <p className="font-semibold text-xs text-foreground">End-of-Day Ledger Close</p>
                    <p className="text-[11px] text-muted-foreground">Prompt team to log expenses and check cash</p>
                  </div>
                  <Switch
                    checked={preferences.endOfDayReminder}
                    onCheckedChange={(val) => savePreferences({ endOfDayReminder: val })}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/15">
                  <div className="pr-2">
                    <p className="font-semibold text-xs text-foreground">Low Cash/Bank Balance Alert</p>
                    <p className="text-[11px] text-muted-foreground">Flag when cash in hand drops below threshold</p>
                  </div>
                  <Switch
                    checked={preferences.lowBalanceAlert}
                    onCheckedChange={(val) => savePreferences({ lowBalanceAlert: val })}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/15">
                  <div className="pr-2">
                    <p className="font-semibold text-xs text-foreground">Pending Vendor Refunds</p>
                    <p className="text-[11px] text-muted-foreground">Track recovered refunds from airlines/suppliers</p>
                  </div>
                  <Switch
                    checked={preferences.pendingRefund}
                    onCheckedChange={(val) => savePreferences({ pendingRefund: val })}
                  />
                </div>
              </div>
            </div>

            {/* Threshold & Timing Settings */}
            <div className="space-y-3 pt-3 border-t">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Timing & Threshold Settings
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-foreground">Days Before Departure to Alert</Label>
                  <Input
                    type="number"
                    min="1"
                    max="30"
                    value={preferences.daysBeforeDeparture}
                    onChange={(e) => savePreferences({ daysBeforeDeparture: Number(e.target.value) || 7 })}
                    className="h-8 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-foreground">Days Before Due Date to Alert</Label>
                  <Input
                    type="number"
                    min="1"
                    max="14"
                    value={preferences.daysBeforeDueDate}
                    onChange={(e) => savePreferences({ daysBeforeDueDate: Number(e.target.value) || 3 })}
                    className="h-8 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-foreground">End-of-Day Reminder Time</Label>
                  <Input
                    type="time"
                    value={preferences.endOfDayTime}
                    onChange={(e) => savePreferences({ endOfDayTime: e.target.value })}
                    className="h-8 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-foreground">Low Cash Balance Threshold (PKR)</Label>
                  <Input
                    type="number"
                    value={preferences.lowBalanceThreshold}
                    onChange={(e) => savePreferences({ lowBalanceThreshold: Number(e.target.value) || 0 })}
                    className="h-8 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-foreground">Quiet Hours Start</Label>
                  <Input
                    type="time"
                    value={preferences.quietHoursStart}
                    onChange={(e) => savePreferences({ quietHoursStart: e.target.value })}
                    className="h-8 text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-foreground">Quiet Hours End</Label>
                  <Input
                    type="time"
                    value={preferences.quietHoursEnd}
                    onChange={(e) => savePreferences({ quietHoursEnd: e.target.value })}
                    className="h-8 text-xs mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Delivery Channels */}
            <div className="space-y-2 pt-3 border-t">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Delivery Channels
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/15">
                  <div className="pr-2">
                    <p className="font-semibold text-xs text-foreground">Sound Notifications</p>
                    <p className="text-[11px] text-muted-foreground">Play gentle chime on new high-priority alerts</p>
                  </div>
                  <Switch
                    checked={preferences.soundEnabled}
                    onCheckedChange={(val) => savePreferences({ soundEnabled: val })}
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/15">
                  <div className="pr-2">
                    <p className="font-semibold text-xs text-foreground">Browser Push Notifications</p>
                    <p className="text-[11px] text-muted-foreground">Receive background notifications on this device</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if ("Notification" in window) {
                        const perm = await Notification.requestPermission();
                        if (perm === "granted") {
                          savePreferences({ pushEnabled: true });
                          toast.success("Browser notifications enabled");
                        } else {
                          toast.error("Notification permission was denied");
                        }
                      } else {
                        toast.error("Notifications not supported on this browser");
                      }
                    }}
                    className="h-7 text-xs px-2.5"
                  >
                    {preferences.pushEnabled ? "Enabled" : "Request Access"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Reminder Dialog */}
      <NewReminderDialog
        open={isAddReminderOpen}
        onOpenChange={setIsAddReminderOpen}
        onSuccess={() => {
          setIsAddReminderOpen(false);
        }}
      />
    </div>
  );
}
