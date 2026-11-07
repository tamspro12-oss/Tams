import React, { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell,
  CheckCircle2,
  Circle,
  Plane,
  Sparkles,
  Receipt,
  Clock,
  ExternalLink,
  Plus,
  AlertCircle,
  Calendar,
  Wallet,
  Building2,
  Trash2,
  Moon,
  Sliders,
  RefreshCw,
} from "lucide-react";
import { useReminders } from "@/hooks/useReminders";
import { useNotifications } from "@/hooks/useNotifications";
import { DateFilter, DatePresetFilterValue, isDateWithinPreset } from "@/components/DateFilter";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { NotificationPreferences } from "@/components/NotificationPreferences";
import { NewReminderDialog } from "@/components/NewReminderDialog";

type NotificationTab = "all" | "travel" | "accounts" | "reminders" | "preferences";

const safeFormatDateTime = (dateVal: any, formatPattern = "dd MMM, hh:mm a") => {
  if (!dateVal) return "";
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return format(d, formatPattern);
  } catch {
    return String(dateVal);
  }
};

export default function NotificationsHub() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get("tab") as NotificationTab) || "all";

  const {
    reminders = [],
    dynamicTravelAlerts = [],
    dailyPrompts = { openingAlert: null, closingAlert: null },
    pendingRemindersCount = 0,
    toggleReminderComplete,
    deleteReminder,
  } = useReminders();

  const {
    notifications = [],
    unreadNotifications = [],
    unreadCount = 0,
    markAsRead,
    markAllAsRead,
    snoozeNotification,
  } = useNotifications();

  const [dateFilter, setDateFilter] = useState<DatePresetFilterValue>({
    preset: "this_month",
  });

  const safeReminders = useMemo(() => {
    const list = Array.isArray(reminders) ? reminders : [];
    return list.filter((r) => isDateWithinPreset(r.remind_date || r.created_at, dateFilter.preset, dateFilter.customFrom, dateFilter.customTo));
  }, [reminders, dateFilter]);

  const safeDynamicAlerts = useMemo(() => {
    const list = Array.isArray(dynamicTravelAlerts) ? dynamicTravelAlerts : [];
    return list.filter((a: any) => isDateWithinPreset(a.flight_date || a.created_at, dateFilter.preset, dateFilter.customFrom, dateFilter.customTo));
  }, [dynamicTravelAlerts, dateFilter]);

  const safeUnreadNotifs = useMemo(() => {
    const list = Array.isArray(unreadNotifications) ? unreadNotifications : [];
    return list.filter((n: any) => isDateWithinPreset(n.created_at, dateFilter.preset, dateFilter.customFrom, dateFilter.customTo));
  }, [unreadNotifications, dateFilter]);

  const activeReminders = safeReminders.filter((r) => r && !r.is_completed);
  const totalActiveCount = (Number(pendingRemindersCount) || 0) + (Number(safeUnreadNotifs.length) || 0);

  const [isAddReminderOpen, setIsAddReminderOpen] = useState(false);

  // Snoozed items state (persisted locally until DB migration run)
  const [snoozedIds, setSnoozedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("tams_snoozed_alerts");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleSnooze = (id: string) => {
    const next = [...snoozedIds, id];
    setSnoozedIds(next);
    localStorage.setItem("tams_snoozed_alerts", JSON.stringify(next));
    toast.info("Alert snoozed until next session");
  };

  const handleTabChange = (val: string) => {
    setSearchParams({ tab: val }, { replace: true });
  };

  return (
    <div className="space-y-4">
      <SeoHead
        title="Notifications & Operational Alerts Hub - TAMS Pro"
        description="Unified live alert feed: flights, Umrah departures, daily expense prompts, and custom tasks."
        path="/app/notifications"
      />

      {/* Hub Top Navigation Tabs */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md pb-2 pt-1 border-b border-border/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Notifications & Alerts Hub
                {totalActiveCount > 0 && (
                  <Badge variant="destructive" className="text-xs font-bold h-5 px-1.5">
                    {totalActiveCount} Active
                  </Badge>
                )}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <DateFilter
              value={dateFilter}
              onChange={setDateFilter}
              className="h-9 shrink-0"
            />
            <Button
              size="sm"
              onClick={() => setIsAddReminderOpen(true)}
              className="h-9 px-3 text-xs font-semibold gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              New Reminder
            </Button>
          </div>
        </div>

        <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto h-11 p-1 bg-muted/60 border">
            <TabsTrigger value="all" className="gap-2 text-xs sm:text-sm font-semibold shrink-0">
              <Bell className="w-4 h-4 text-primary" />
              All Activity ({totalActiveCount})
            </TabsTrigger>
            <TabsTrigger value="travel" className="gap-2 text-xs sm:text-sm font-semibold shrink-0">
              <Plane className="w-4 h-4 text-blue-500" />
              Flights & Umrah ({safeDynamicAlerts.length})
            </TabsTrigger>
            <TabsTrigger value="accounts" className="gap-2 text-xs sm:text-sm font-semibold shrink-0">
              <Wallet className="w-4 h-4 text-emerald-500" />
              Accounts & Operations
            </TabsTrigger>
            <TabsTrigger value="reminders" className="gap-2 text-xs sm:text-sm font-semibold shrink-0">
              <Clock className="w-4 h-4 text-amber-500" />
              My Reminders ({activeReminders.length})
            </TabsTrigger>
            <TabsTrigger value="preferences" className="gap-2 text-xs sm:text-sm font-semibold shrink-0">
              <Sliders className="w-4 h-4 text-purple-500" />
              Preferences
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab 1: All Activity Feed */}
      {currentTab === "all" && (
        <div className="space-y-4">
          {/* Live Operational Alerts from Database */}
          {safeUnreadNotifs.length > 0 && (
            <Card className="border shadow-xs border-primary/20 bg-primary/5">
              <CardHeader className="pb-2 pt-3 border-b bg-primary/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-primary" />
                    <CardTitle className="text-sm font-bold">Live Agency Activity & Alerts</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[11px] bg-background">{safeUnreadNotifs.length} New</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => markAllAsRead.mutate()}
                      className="h-7 text-xs font-semibold text-primary hover:bg-primary/10"
                    >
                      Mark All Read
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-border/60 bg-card">
                {safeUnreadNotifs.map((notif) => (
                  <div key={notif.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 font-bold">
                        <Bell className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-foreground">{notif.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{notif.message}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">{safeFormatDateTime(notif.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      {notif.link && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(notif.link!)}
                          className="h-8 text-xs gap-1"
                        >
                          View <ExternalLink className="w-3 h-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => snoozeNotification.mutate({ id: notif.id, hours: 24 })}
                        className="h-8 text-xs text-muted-foreground"
                      >
                        <Moon className="w-3.5 h-3.5 mr-1" /> Snooze
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAsRead.mutate(notif.id)}
                        className="h-8 text-xs text-emerald-600 hover:bg-emerald-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark Read
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Departures Section */}
          {safeDynamicAlerts.length > 0 && (
            <Card className="border shadow-xs">
              <CardHeader className="pb-2 pt-3 border-b bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Plane className="w-4 h-4 text-blue-500" />
                    <CardTitle className="text-sm font-bold">Upcoming Scheduled Departures</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-[11px]">{safeDynamicAlerts.length} Due</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-border/60">
                {safeDynamicAlerts.map((alert) => (
                  <div key={alert.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                        alert.type === "umrah" ? "bg-amber-100 text-amber-700 dark:bg-amber-950" : "bg-blue-100 text-blue-700 dark:bg-blue-950"
                      )}>
                        {alert.type === "umrah" ? <Sparkles className="w-4 h-4" /> : <Plane className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">{alert.clientName}</span>
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-bold",
                            alert.isToday ? "bg-red-100 text-red-700 dark:bg-red-950" : "bg-amber-100 text-amber-700 dark:bg-amber-950"
                          )}>
                            {alert.isToday ? "DEPARTING TODAY" : "DEPARTING TOMORROW"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {alert.sectorOrDetails} {alert.bookingRef ? `• PNR: ${alert.bookingRef}` : ""} {alert.passportNumber ? `• Passport: ${alert.passportNumber}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSnooze(alert.id)}
                        className="h-8 text-xs text-muted-foreground"
                      >
                        <Moon className="w-3.5 h-3.5 mr-1" /> Snooze
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate("/app/bookings?tab=clients")}
                        className="h-8 text-xs gap-1"
                      >
                        Open Booking <ExternalLink className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Daily Operational Prompts */}
          {(dailyPrompts?.openingAlert || dailyPrompts?.closingAlert) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {dailyPrompts?.openingAlert && (
                <Card className="border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/60 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                      <Clock className="w-4 h-4" /> Morning Agency Briefing
                    </p>
                    <Badge variant="outline" className="text-[10px] border-amber-300">09:00 AM</Badge>
                  </div>
                  <p className="text-xs text-amber-800/80 dark:text-amber-300/80">{dailyPrompts.openingAlert.title}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate("/app/dashboard")}
                    className="h-7 text-xs border-amber-300 text-amber-900"
                  >
                    Review Dashboard Tasks
                  </Button>
                </Card>
              )}

              {dailyPrompts?.closingAlert && (
                <Card className="border bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/60 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                      <Receipt className="w-4 h-4" /> Evening Expense & Ledger Close
                    </p>
                    <Badge variant="outline" className="text-[10px] border-blue-300">End of Day</Badge>
                  </div>
                  <p className="text-xs text-blue-800/80 dark:text-blue-300/80">{dailyPrompts.closingAlert.title}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate("/app/accounts?tab=expenses")}
                    className="h-7 text-xs border-blue-300 text-blue-900"
                  >
                    Record Daily Expenses
                  </Button>
                </Card>
              )}
            </div>
          )}

          {/* Pending Tasks */}
          <Card className="border shadow-xs">
            <CardHeader className="pb-2 pt-3 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <CardTitle className="text-sm font-bold">Pending Operational Tasks</CardTitle>
                </div>
                <Badge variant="outline" className="text-[11px]">{activeReminders.length} Active</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border/60">
              {activeReminders.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  All operational reminders are completed!
                </div>
              ) : (
                activeReminders.map((r) => (
                  <div key={r.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => toggleReminderComplete.mutate({ id: r.id, is_completed: true })}
                        className="mt-0.5 text-muted-foreground hover:text-green-600 transition-colors"
                        title="Mark completed"
                      >
                        <Circle className="w-4 h-4" />
                      </button>
                      <div>
                        <p className="font-semibold text-sm text-foreground">{r.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Due: {r.remind_date} {typeof r.remind_time === "string" && r.remind_time.length >= 5 ? `• ${r.remind_time.slice(0, 5)}` : ""}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleReminderComplete.mutate({ id: r.id, is_completed: true })}
                      className="h-8 text-xs text-emerald-600 hover:bg-emerald-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Done
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 2: Flights & Umrah */}
      {currentTab === "travel" && (
        <Card className="border">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Plane className="w-5 h-5 text-blue-500" />
              Flights & Umrah Group Departures
            </CardTitle>
            <CardDescription>
              Automatic departure alerts calculated directly from your live bookings for Today and Tomorrow.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-border/60">
            {safeDynamicAlerts.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No flights or Umrah packages scheduled for departure today or tomorrow.
              </div>
            ) : (
              safeDynamicAlerts.map((alert) => (
                <div key={alert.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                      alert.type === "umrah" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                    )}>
                      {alert.type === "umrah" ? <Sparkles className="w-5 h-5" /> : <Plane className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{alert.clientName}</span>
                        <Badge className={alert.isToday ? "bg-red-500" : "bg-amber-500"}>
                          {alert.isToday ? "TODAY" : "TOMORROW"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {alert.sectorOrDetails} • Travel Date: {alert.travelDate}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/app/bookings?tab=clients")}
                    className="h-8 text-xs gap-1"
                  >
                    View in Bookings <ExternalLink className="w-3 h-3" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Accounts & Operations */}
      {currentTab === "accounts" && (
        <div className="space-y-4">
          <Card className="border">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-500" />
                Operational & Financial Reminders
              </CardTitle>
              <CardDescription>
                Automated daily closing reminders, expense reconciliations, and cash/bank balance reviews.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="p-3.5 rounded-lg border bg-blue-50/40 dark:bg-blue-950/20 flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm text-blue-900 dark:text-blue-200">Daily Cash & Expense Check</p>
                  <p className="text-xs text-blue-800/80 dark:text-blue-300/80 mt-0.5">
                    Remember to log all cash vouchers and vendor payments before ending business hours.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => navigate("/app/accounts?tab=expenses")}
                  className="h-8 text-xs font-semibold"
                >
                  Log Expense
                </Button>
              </div>

              <div className="p-3.5 rounded-lg border bg-purple-50/40 dark:bg-purple-950/20 flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm text-purple-900 dark:text-purple-200">Bank Position Review</p>
                  <p className="text-xs text-purple-800/80 dark:text-purple-300/80 mt-0.5">
                    Verify client bank transfers and update cleared transaction statuses.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("/app/accounts?tab=bank-cash")}
                  className="h-8 text-xs font-semibold"
                >
                  Open Bank & Cash
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 4: My Reminders */}
      {currentTab === "reminders" && (
        <Card className="border">
          <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold">Custom Reminders ({activeReminders.length})</CardTitle>
              <CardDescription>Your personal and agency task checklist.</CardDescription>
            </div>
            <Button size="sm" onClick={() => setIsAddReminderOpen(true)} className="h-8 text-xs gap-1 shadow-xs">
              <Plus className="w-3.5 h-3.5" /> Add Task
            </Button>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-border/60">
            {safeReminders.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No reminders recorded. Click "Add Task" to create one.
              </div>
            ) : (
              safeReminders.map((r) => (
                <div key={r.id} className="p-3.5 flex items-start justify-between gap-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleReminderComplete.mutate({ id: r.id, is_completed: !r.is_completed })}
                      className="mt-0.5 text-muted-foreground hover:text-green-600"
                    >
                      {r.is_completed ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <Circle className="w-5 h-5" />}
                    </button>
                    <div>
                      <p className={cn("font-semibold text-sm", r.is_completed && "line-through text-muted-foreground")}>
                        {r.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Due: {r.remind_date} {typeof r.remind_time === "string" && r.remind_time.length >= 5 ? `• ${r.remind_time.slice(0, 5)}` : ""}
                      </p>
                      {r.notes && <p className="text-xs text-muted-foreground mt-1 bg-muted/40 p-2 rounded">{r.notes}</p>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteReminder.mutate(r.id)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 5: Preferences */}
      {currentTab === "preferences" && <NotificationPreferences />}

      {/* New Reminder Dialog */}
      <NewReminderDialog
        open={isAddReminderOpen}
        onOpenChange={setIsAddReminderOpen}
      />
    </div>
  );
}
