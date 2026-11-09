import React, { useState, useMemo } from "react";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  Plus,
  CheckCircle2,
  Circle,
  Plane,
  Sparkles,
  Receipt,
  Clock,
  Calendar,
  Settings,
  Trash2,
  ExternalLink,
  Filter,
} from "lucide-react";
import { useReminders } from "@/hooks/useReminders";
import { format } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { NewReminderDialog } from "@/components/NewReminderDialog";

export default function Reminders() {
  const navigate = useNavigate();
  const {
    reminders,
    settings,
    dynamicTravelAlerts,
    dailyPrompts,
    loadingReminders,
    addReminder,
    updateReminder,
    toggleReminderComplete,
    deleteReminder,
    updateSettings,
  } = useReminders();

  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Add Reminder Form State
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<"manual" | "flight" | "umrah" | "daily_expense">("manual");
  const [newDate, setNewDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newTime, setNewTime] = useState("09:00");
  const [newNotes, setNewNotes] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);

  // Settings State
  const [flightAlerts, setFlightAlerts] = useState(settings?.flight_alerts_enabled ?? true);
  const [umrahAlerts, setUmrahAlerts] = useState(settings?.umrah_alerts_enabled ?? true);
  const [expenseAlerts, setExpenseAlerts] = useState(settings?.daily_expense_reminder_enabled ?? true);
  const [openingTime, setOpeningTime] = useState(settings?.opening_time || "09:00:00");
  const [closingTime, setClosingTime] = useState(settings?.closing_time || "20:00:00");

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.error("Please enter a reminder title");
      return;
    }

    await addReminder.mutateAsync({
      title: newTitle.trim(),
      type: newType,
      remind_date: newDate,
      remind_time: newTime ? `${newTime}:00` : null,
      is_completed: false,
      is_recurring_daily: isRecurring,
      notes: newNotes.trim() || null,
    });

    setNewTitle("");
    setNewNotes("");
    setIsAddOpen(false);
  };

  const handleSaveSettings = async () => {
    await updateSettings.mutateAsync({
      flight_alerts_enabled: flightAlerts,
      umrah_alerts_enabled: umrahAlerts,
      daily_expense_reminder_enabled: expenseAlerts,
      opening_time: openingTime,
      closing_time: closingTime,
    });
    setIsSettingsOpen(false);
  };

  const filteredReminders = useMemo(() => {
    return reminders.filter((r) => {
      if (activeFilter === "Today") {
        return r.remind_date === todayStr && !r.is_completed;
      }
      if (activeFilter === "Manual") {
        return r.type === "manual" && !r.is_completed;
      }
      if (activeFilter === "Completed") {
        return r.is_completed;
      }
      return !r.is_completed;
    });
  }, [reminders, activeFilter, todayStr]);

  return (
    <div className="space-y-6">
      <SeoHead
        title="Smart Reminders & Operational Alerts - TAMS Pro"
        description="Daily operational alerts, flight departures, Umrah groups, and agency tasks in one unified view."
        path="/app/reminders"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Bell className="w-7 h-7 text-primary" />
            Smart Reminders & Operational Alerts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Automated flight departures, Umrah groups, daily closing reminders, and team tasks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsSettingsOpen(true)}
            className="h-10 px-3 text-xs gap-1.5"
          >
            <Settings className="w-4 h-4" />
            Settings
          </Button>
          <Button
            onClick={() => setIsAddOpen(true)}
            className="h-10 px-4 font-semibold text-xs gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Reminder
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 flex items-center justify-center shrink-0">
              <Plane className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Departures Today</p>
              <p className="text-lg font-bold text-foreground">
                {dynamicTravelAlerts.filter((a) => a.isToday).length}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Departures Tomorrow</p>
              <p className="text-lg font-bold text-foreground">
                {dynamicTravelAlerts.filter((a) => a.isTomorrow).length}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Due Tasks</p>
              <p className="text-lg font-bold text-foreground">
                {reminders.filter((r) => !r.is_completed).length}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-950/60 text-green-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Completed</p>
              <p className="text-lg font-bold text-foreground">
                {reminders.filter((r) => r.is_completed).length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dynamic Departures Section */}
      <Card className="border shadow-xs">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plane className="w-4 h-4 text-primary" />
              <CardTitle className="text-base font-semibold">
                Scheduled Departures (Today & Tomorrow)
              </CardTitle>
            </div>
            <Badge variant="outline" className="text-xs">
              {dynamicTravelAlerts.length} Passengers Scheduled
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {dynamicTravelAlerts.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No flight or Umrah departures scheduled for today or tomorrow.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {dynamicTravelAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${alert.type === "umrah"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                        }`}
                    >
                      {alert.type === "umrah" ? (
                        <Sparkles className="w-4 h-4" />
                      ) : (
                        <Plane className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{alert.clientName}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${alert.isToday
                              ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                        >
                          {alert.isToday ? "TODAY" : "TOMORROW"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {alert.sectorOrDetails}
                        {alert.passportNumber ? ` • Passport: ${alert.passportNumber}` : ""}
                        {alert.bookingRef ? ` • PNR: ${alert.bookingRef}` : ""}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/app/clients")}
                    className="h-8 text-xs gap-1.5 shrink-0"
                  >
                    View in Bookings
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Reminders & Operational Tasks */}
      <Card className="border shadow-xs">
        <CardHeader className="pb-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <CardTitle className="text-base font-semibold">Operational Tasks & Reminders</CardTitle>
          </div>

          {/* Filter chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {(["All", "Today", "Manual", "Completed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${activeFilter === f
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  }`}
              >
                {f}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredReminders.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-xs space-y-2">
              <CheckCircle2 className="w-8 h-8 mx-auto text-green-500/60" />
              <p>No reminders found for the selected filter.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddOpen(true)}
                className="text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add New Reminder
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredReminders.map((r) => (
                <div
                  key={r.id}
                  className="p-4 flex items-start justify-between gap-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        toggleReminderComplete.mutate({
                          id: r.id,
                          is_completed: !r.is_completed,
                        })
                      }
                      className="mt-0.5 text-muted-foreground hover:text-green-600 transition-colors"
                      title={r.is_completed ? "Mark incomplete" : "Mark completed"}
                    >
                      {r.is_completed ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>
                    <div>
                      <p
                        className={`font-semibold text-sm ${r.is_completed ? "line-through text-muted-foreground" : "text-foreground"
                          }`}
                      >
                        {r.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-0.5">
                        <span>Due: {r.remind_date}</span>
                        {r.remind_time && <span>Time: {r.remind_time.slice(0, 5)}</span>}
                        {r.is_recurring_daily && (
                          <Badge variant="outline" className="text-[10px]">
                            Daily Recurring
                          </Badge>
                        )}
                      </div>
                      {r.notes && (
                        <p className="text-xs text-muted-foreground mt-1 bg-muted/40 p-2 rounded-md">
                          {r.notes}
                        </p>
                      )}
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Reminder Dialog */}
      <NewReminderDialog open={isAddOpen} onOpenChange={setIsAddOpen} />

      {/* Reminder Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="w-[96vw] max-w-[96vw] h-[92vh] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Reminder & Alert Settings
            </DialogTitle>
            <DialogDescription>
              Configure automated notifications and operational checks for your agency.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="text-xs">
                <p className="font-semibold">Flight Departure Alerts</p>
                <p className="text-muted-foreground text-[11px]">
                  Show automated alerts for flights departing Today and Tomorrow
                </p>
              </div>
              <Switch checked={flightAlerts} onCheckedChange={setFlightAlerts} />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="text-xs">
                <p className="font-semibold">Umrah Group Alerts</p>
                <p className="text-muted-foreground text-[11px]">
                  Show alerts for Umrah packages scheduled for departure
                </p>
              </div>
              <Switch checked={umrahAlerts} onCheckedChange={setUmrahAlerts} />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="text-xs">
                <p className="font-semibold">Daily Expense & Closing Reminder</p>
                <p className="text-muted-foreground text-[11px]">
                  Prompt team at end of day to record daily expenses and close ledger
                </p>
              </div>
              <Switch checked={expenseAlerts} onCheckedChange={setExpenseAlerts} />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Morning Review Time</Label>
                <Input
                  type="time"
                  value={openingTime.slice(0, 5)}
                  onChange={(e) => setOpeningTime(`${e.target.value}:00`)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Evening Closing Time</Label>
                <Input
                  type="time"
                  value={closingTime.slice(0, 5)}
                  onChange={(e) => setClosingTime(`${e.target.value}:00`)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsSettingsOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSaveSettings} className="font-semibold">
                Save Preferences
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

