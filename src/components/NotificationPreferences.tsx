import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sliders } from "lucide-react";
import { useReminders } from "@/hooks/useReminders";

export function NotificationPreferences() {
  const { settings, updateSettings } = useReminders();

  const [flightAlerts, setFlightAlerts] = useState<boolean>(() => Boolean(settings?.flight_alerts_enabled ?? true));
  const [umrahAlerts, setUmrahAlerts] = useState<boolean>(() => Boolean(settings?.umrah_alerts_enabled ?? true));
  const [expenseAlerts, setExpenseAlerts] = useState<boolean>(() => Boolean(settings?.daily_expense_reminder_enabled ?? true));
  const [openingTime, setOpeningTime] = useState<string>(() => String(settings?.opening_time || "09:00:00"));
  const [closingTime, setClosingTime] = useState<string>(() => String(settings?.closing_time || "20:00:00"));

  useEffect(() => {
    if (settings) {
      if (settings.flight_alerts_enabled !== undefined && settings.flight_alerts_enabled !== null) {
        setFlightAlerts(Boolean(settings.flight_alerts_enabled));
      }
      if (settings.umrah_alerts_enabled !== undefined && settings.umrah_alerts_enabled !== null) {
        setUmrahAlerts(Boolean(settings.umrah_alerts_enabled));
      }
      if (settings.daily_expense_reminder_enabled !== undefined && settings.daily_expense_reminder_enabled !== null) {
        setExpenseAlerts(Boolean(settings.daily_expense_reminder_enabled));
      }
      if (settings.opening_time) {
        setOpeningTime(String(settings.opening_time));
      }
      if (settings.closing_time) {
        setClosingTime(String(settings.closing_time));
      }
    }
  }, [settings]);

  const safeOpening = typeof openingTime === "string" && openingTime.length >= 5 ? openingTime.slice(0, 5) : "09:00";
  const safeClosing = typeof closingTime === "string" && closingTime.length >= 5 ? closingTime.slice(0, 5) : "20:00";

  const handleSave = async () => {
    const finalOpening = typeof openingTime === "string" && openingTime.length === 5 ? `${openingTime}:00` : (openingTime || "09:00:00");
    const finalClosing = typeof closingTime === "string" && closingTime.length === 5 ? `${closingTime}:00` : (closingTime || "20:00:00");

    await updateSettings.mutateAsync({
      flight_alerts_enabled: Boolean(flightAlerts),
      umrah_alerts_enabled: Boolean(umrahAlerts),
      daily_expense_reminder_enabled: Boolean(expenseAlerts),
      opening_time: finalOpening,
      closing_time: finalClosing,
    });
  };

  return (
    <Card className="border max-w-3xl shadow-sm rounded-xl">
      <CardHeader className="py-3 px-4 sm:px-6 border-b">
        <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
          <Sliders className="w-4 h-4 text-primary" />
          Notification Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-5 space-y-3">
        {/* Slim rows: title + one-line description + switch on the right */}
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg border bg-muted/15 hover:bg-muted/25 transition-colors">
            <div className="space-y-0.5 pr-4">
              <p className="font-semibold text-xs sm:text-sm text-foreground">Automated Flight Departure Alerts</p>
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                Alert team about flights departing Today and Tomorrow in the top notification bell
              </p>
            </div>
            <Switch checked={flightAlerts} onCheckedChange={setFlightAlerts} />
          </div>

          <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg border bg-muted/15 hover:bg-muted/25 transition-colors">
            <div className="space-y-0.5 pr-4">
              <p className="font-semibold text-xs sm:text-sm text-foreground">Umrah Group Departure Alerts</p>
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                Flag Umrah packages scheduled for travel with direct links to booking details
              </p>
            </div>
            <Switch checked={umrahAlerts} onCheckedChange={setUmrahAlerts} />
          </div>

          <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg border bg-muted/15 hover:bg-muted/25 transition-colors">
            <div className="space-y-0.5 pr-4">
              <p className="font-semibold text-xs sm:text-sm text-foreground">Daily Evening Expense & Closing Prompt</p>
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                Prompt agency team at end of day to record daily petty cash expenses and balance ledger
              </p>
            </div>
            <Switch checked={expenseAlerts} onCheckedChange={setExpenseAlerts} />
          </div>
        </div>

        {/* Two time pickers side by side in one row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-foreground">Morning Operations Briefing Hour</Label>
            <Input
              type="time"
              value={safeOpening}
              onChange={(e) => setOpeningTime(e.target.value ? `${e.target.value}:00` : "09:00:00")}
              className="h-9 text-xs sm:text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-foreground">Evening Closing Hour</Label>
            <Input
              type="time"
              value={safeClosing}
              onChange={(e) => setClosingTime(e.target.value ? `${e.target.value}:00` : "20:00:00")}
              className="h-9 text-xs sm:text-sm"
            />
          </div>
        </div>

        {/* Save button right-aligned at the bottom */}
        <div className="flex justify-end pt-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={updateSettings.isPending}
            className="font-semibold text-xs h-9 px-5 shadow-xs"
          >
            {updateSettings.isPending ? "Saving..." : "Save Preferences"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default NotificationPreferences;
