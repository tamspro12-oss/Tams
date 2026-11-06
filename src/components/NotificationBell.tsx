import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Bell,
  CheckCircle2,
  Circle,
  Plane,
  Sparkles,
  Receipt,
  Calendar,
  ExternalLink,
  Plus,
  Clock,
  ArrowRight,
} from "lucide-react";
import { useReminders } from "@/hooks/useReminders";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const {
    reminders,
    dynamicTravelAlerts,
    dailyPrompts,
    pendingRemindersCount,
    toggleReminderComplete,
  } = useReminders();

  const activeReminders = reminders.filter((r) => !r.is_completed);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative h-9 w-9 hover:bg-accent/10 active:bg-accent/10 rounded-xl inline-flex items-center justify-center transition-all duration-200 active:scale-95 touch-manipulation flex-shrink-0 border border-border/40 text-foreground"
          aria-label="Open notifications"
        >
          <Bell className="h-4.5 w-4.5" />
          {pendingRemindersCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-xs animate-in zoom-in-50">
              {pendingRemindersCount > 99 ? "99+" : pendingRemindersCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[92vw] sm:w-[380px] p-0 shadow-xl border bg-card/98 backdrop-blur-md rounded-xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-3.5 border-b bg-muted/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm text-foreground">Reminders & Alerts</h3>
            {pendingRemindersCount > 0 && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-bold">
                {pendingRemindersCount} Due
              </Badge>
            )}
          </div>
          <Link
            to="/app/reminders"
            onClick={() => setOpen(false)}
            className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
          >
            Manage
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Content Tabs */}
        <Tabs defaultValue="travel" className="w-full">
          <TabsList className="grid grid-cols-3 w-full rounded-none border-b h-9 bg-muted/20">
            <TabsTrigger value="travel" className="text-[11px] gap-1 px-1">
              Departures ({dynamicTravelAlerts.length})
            </TabsTrigger>
            <TabsTrigger value="daily" className="text-[11px] gap-1 px-1">
              Daily Tasks
            </TabsTrigger>
            <TabsTrigger value="manual" className="text-[11px] gap-1 px-1">
              Reminders ({activeReminders.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Today & Tomorrow Departures */}
          <TabsContent value="travel" className="p-0 m-0 max-h-[300px] overflow-y-auto">
            {dynamicTravelAlerts.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs space-y-1">
                <Plane className="w-6 h-6 mx-auto text-muted-foreground/40" />
                <p>No flight or Umrah departures scheduled for today or tomorrow.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {dynamicTravelAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-3 hover:bg-muted/40 transition-colors flex items-start gap-2.5 text-xs"
                  >
                    <div
                      className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                        alert.type === "umrah"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                      )}
                    >
                      {alert.type === "umrah" ? (
                        <Sparkles className="w-3.5 h-3.5" />
                      ) : (
                        <Plane className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-foreground truncate">
                          {alert.clientName}
                        </span>
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0",
                            alert.isToday
                              ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          )}
                        >
                          {alert.isToday ? "TODAY" : "TOMORROW"}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-[11px] truncate mt-0.5">
                        {alert.sectorOrDetails || "Scheduled Travel"}
                        {alert.bookingRef ? ` • PNR: ${alert.bookingRef}` : ""}
                      </p>
                      <button
                        onClick={() => {
                          setOpen(false);
                          navigate("/app/clients");
                        }}
                        className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-1 mt-1"
                      >
                        Open Booking <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* TAB 2: Daily Scheduled Prompts */}
          <TabsContent value="daily" className="p-3 m-0 space-y-2.5 max-h-[300px] overflow-y-auto">
            {dailyPrompts.openingAlert && (
              <div className="p-3 rounded-lg border bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/70 text-xs space-y-1">
                <p className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Morning Operations Check
                </p>
                <p className="text-amber-800/80 dark:text-amber-300/80 text-[11px]">
                  {dailyPrompts.openingAlert.title}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setOpen(false);
                    navigate("/app/dashboard");
                  }}
                  className="h-6 text-[10px] mt-1 text-amber-900 border-amber-300"
                >
                  View Dashboard
                </Button>
              </div>
            )}

            {dailyPrompts.closingAlert && (
              <div className="p-3 rounded-lg border bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/70 text-xs space-y-1">
                <p className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5" />
                  Evening Expense & Ledger Closing
                </p>
                <p className="text-blue-800/80 dark:text-blue-300/80 text-[11px]">
                  {dailyPrompts.closingAlert.title}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setOpen(false);
                    navigate("/app/expenses");
                  }}
                  className="h-6 text-[10px] mt-1 text-blue-900 border-blue-300"
                >
                  Log Daily Expenses
                </Button>
              </div>
            )}

            {!dailyPrompts.openingAlert && !dailyPrompts.closingAlert && (
              <div className="p-6 text-center text-muted-foreground text-xs space-y-1">
                <CheckCircle2 className="w-6 h-6 mx-auto text-green-500/60" />
                <p>All daily operational checks are currently up to date.</p>
              </div>
            )}
          </TabsContent>

          {/* TAB 3: Manual Reminders */}
          <TabsContent value="manual" className="p-0 m-0 max-h-[300px] overflow-y-auto">
            {activeReminders.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs space-y-2">
                <CheckCircle2 className="w-6 h-6 mx-auto text-green-500/60" />
                <p>No pending reminders.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setOpen(false);
                    navigate("/app/reminders");
                  }}
                  className="h-7 text-xs"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Reminder
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {activeReminders.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 hover:bg-muted/40 transition-colors flex items-start gap-2.5 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        toggleReminderComplete.mutate({
                          id: r.id,
                          is_completed: true,
                        })
                      }
                      className="mt-0.5 text-muted-foreground hover:text-green-600 transition-colors"
                      title="Mark as completed"
                    >
                      <Circle className="w-4 h-4" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground">{r.title}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                        <span>{r.remind_date}</span>
                        {r.remind_time && <span>• {r.remind_time.slice(0, 5)}</span>}
                      </div>
                      {r.notes && (
                        <p className="text-muted-foreground/80 text-[11px] truncate mt-0.5">
                          {r.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="p-2.5 border-t bg-muted/30 text-center">
          <Link
            to="/app/reminders"
            onClick={() => setOpen(false)}
            className="text-xs text-primary hover:underline font-semibold block"
          >
            Open Full Reminders & Departure Schedule →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

