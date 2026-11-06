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
  MessageSquare,
  AlertTriangle,
} from "lucide-react";
import { useReminders } from "@/hooks/useReminders";
import { useNotifications } from "@/hooks/useNotifications";
import { useActionableAlerts } from "@/hooks/useActionableAlerts";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const {
    reminders = [],
    dailyPrompts = { openingAlert: null, closingAlert: null },
    toggleReminderComplete,
  } = useReminders();
  const { unreadCount = 0 } = useNotifications();
  const {
    upcomingFlights = [],
    nameUpdateReminders = [],
    activeQueries = [],
  } = useActionableAlerts();

  const safeReminders = Array.isArray(reminders) ? reminders : [];
  const activeReminders = safeReminders.filter((r) => r && !r.is_completed);

  // Total actionable count combining departures, name updates, queries, tasks, and system notifications
  const totalDueCount =
    (upcomingFlights?.length || 0) +
    (nameUpdateReminders?.length || 0) +
    (activeQueries?.length || 0) +
    (activeReminders?.length || 0) +
    (Number(unreadCount) || 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative h-9 w-9 hover:bg-accent/10 active:bg-accent/10 rounded-xl inline-flex items-center justify-center transition-all duration-200 active:scale-95 touch-manipulation flex-shrink-0 border border-border/40 text-foreground"
          aria-label="Open notifications"
        >
          <Bell className="h-4.5 w-4.5" />
          {totalDueCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-xs animate-in zoom-in-50">
              {totalDueCount > 99 ? "99+" : totalDueCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[94vw] sm:w-[420px] p-0 shadow-xl border bg-card/98 backdrop-blur-md rounded-xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-3.5 border-b bg-muted/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm text-foreground">Reminders & Actionable Alerts</h3>
            {totalDueCount > 0 && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-bold">
                {totalDueCount} Due
              </Badge>
            )}
          </div>
          <Link
            to="/app/notifications"
            onClick={() => setOpen(false)}
            className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
          >
            Manage
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Content Tabs */}
        <Tabs defaultValue="travel" className="w-full">
          <TabsList className="grid grid-cols-4 w-full rounded-none border-b h-9 bg-muted/20">
            <TabsTrigger value="travel" className="text-[10px] sm:text-[11px] gap-1 px-1">
              Departures ({upcomingFlights.length})
            </TabsTrigger>
            <TabsTrigger value="nameUpdates" className="text-[10px] sm:text-[11px] gap-1 px-1">
              Names ({nameUpdateReminders.length})
            </TabsTrigger>
            <TabsTrigger value="queries" className="text-[10px] sm:text-[11px] gap-1 px-1">
              Queries ({activeQueries.length})
            </TabsTrigger>
            <TabsTrigger value="tasks" className="text-[10px] sm:text-[11px] gap-1 px-1">
              Tasks ({activeReminders.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Today & Tomorrow Departures (Tickets & Umrah) */}
          <TabsContent value="travel" className="p-0 m-0 max-h-[320px] overflow-y-auto">
            {upcomingFlights.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs space-y-1">
                <Plane className="w-6 h-6 mx-auto text-muted-foreground/40" />
                <p>No flight or Umrah departures scheduled for today or tomorrow.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {upcomingFlights.map((flight) => (
                  <div
                    key={`${flight.source}-${flight.id}`}
                    className="p-3 hover:bg-muted/40 transition-colors flex items-start gap-2.5 text-xs"
                  >
                    <div
                      className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                        flight.serviceType?.toLowerCase() === "umrah"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                      )}
                    >
                      {flight.serviceType?.toLowerCase() === "umrah" ? (
                        <Sparkles className="w-3.5 h-3.5" />
                      ) : (
                        <Plane className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-semibold text-foreground truncate">
                            {flight.name}
                          </span>
                          {flight.source === "b2b" && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1 bg-purple-50 text-purple-700 border-purple-200">
                              B2B
                            </Badge>
                          )}
                        </div>
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0",
                            flight.isToday
                              ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          )}
                        >
                          {flight.isToday ? "TODAY" : "TOMORROW"}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-[11px] truncate mt-0.5">
                        {flight.destination} • PNR: {flight.pnr}
                      </p>
                      <button
                        onClick={() => {
                          setOpen(false);
                          if (flight.source === "b2b") {
                            navigate("/app/bookings?tab=b2b-agents");
                          } else {
                            navigate("/app/bookings?tab=clients");
                          }
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

          {/* TAB 2: Name Update Reminders */}
          <TabsContent value="nameUpdates" className="p-0 m-0 max-h-[320px] overflow-y-auto">
            {nameUpdateReminders.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs space-y-1">
                <CheckCircle2 className="w-6 h-6 mx-auto text-green-500/60" />
                <p>No passenger name updates pending today.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {nameUpdateReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="p-3 hover:bg-muted/40 transition-colors flex items-start gap-2.5 text-xs"
                  >
                    <div className="w-7 h-7 rounded-lg bg-warning/15 text-warning flex items-center justify-center shrink-0 mt-0.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-foreground truncate">
                          {reminder.name}
                        </span>
                        <Badge variant="outline" className="text-[10px] h-4.5 px-1 bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200">
                          Due Today
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-[11px] truncate mt-0.5">
                        {reminder.destination} • PNR: {reminder.pnr}
                      </p>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
                        <span>Travel: {reminder.travelDate}</span>
                        <span>•</span>
                        <span>Update: {reminder.updateDate}</span>
                      </div>
                      <button
                        onClick={() => {
                          setOpen(false);
                          navigate("/app/bookings?tab=clients");
                        }}
                        className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-1 mt-1"
                      >
                        Update Passenger Name <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* TAB 3: Active Client Queries */}
          <TabsContent value="queries" className="p-0 m-0 max-h-[320px] overflow-y-auto">
            {activeQueries.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs space-y-1">
                <CheckCircle2 className="w-6 h-6 mx-auto text-green-500/60" />
                <p>No active client queries pending.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {activeQueries.map((query) => (
                  <div
                    key={query.id}
                    className="p-3 hover:bg-muted/40 transition-colors flex items-start gap-2.5 text-xs"
                  >
                    <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <MessageSquare className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-foreground truncate">
                          {query.client_name}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge
                            variant={
                              query.priority === "high"
                                ? "destructive"
                                : query.priority === "medium"
                                ? "default"
                                : "secondary"
                            }
                            className="text-[9px] h-4 px-1"
                          >
                            {query.priority}
                          </Badge>
                          <Badge variant="outline" className="text-[9px] h-4 px-1">
                            {query.status}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-muted-foreground text-[11px] line-clamp-2 mt-0.5">
                        {query.query_text}
                      </p>
                      {query.due_date && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Due: {query.due_date}
                        </p>
                      )}
                      <button
                        onClick={() => {
                          setOpen(false);
                          navigate("/app/leads-quotes?tab=queries");
                        }}
                        className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-1 mt-1"
                      >
                        View Query in Hub <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* TAB 4: Daily Tasks & Manual Reminders */}
          <TabsContent value="tasks" className="p-0 m-0 max-h-[320px] overflow-y-auto">
            <div className="p-3 space-y-2.5">
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
                      navigate("/app/accounts?tab=expenses");
                    }}
                    className="h-6 text-[10px] mt-1 text-blue-900 border-blue-300"
                  >
                    Log Daily Expenses
                  </Button>
                </div>
              )}

              {activeReminders.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-xs space-y-2">
                  <CheckCircle2 className="w-5 h-5 mx-auto text-green-500/60" />
                  <p>No pending manual reminders.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setOpen(false);
                      navigate("/app/notifications?tab=reminders");
                    }}
                    className="h-7 text-xs"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Reminder
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border/60 -mx-3 border-t">
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
                          {typeof r.remind_time === "string" && r.remind_time.length >= 5 && (
                            <span>• {r.remind_time.slice(0, 5)}</span>
                          )}
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
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="p-2.5 border-t bg-muted/30 text-center">
          <Link
            to="/app/notifications"
            onClick={() => setOpen(false)}
            className="text-xs text-primary hover:underline font-semibold block"
          >
            Open Notifications Hub & Departure Schedule →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
