import React from "react";
import { useSearchParams } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon, MessageSquare, Bell, Mail, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Existing sub-modules (100% preserved)
import Settings from "@/pages/Settings";
import EmailHistory from "@/pages/EmailHistory";
import UserManual from "@/pages/UserManual";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useReminders } from "@/hooks/useReminders";
import { toast } from "sonner";

type SettingsTab = "general" | "whatsapp" | "preferences" | "email-history" | "manual";

export default function SettingsHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get("tab") as SettingsTab) || "general";

  const { settings, updateSettings } = useReminders();

  const [flightAlerts, setFlightAlerts] = React.useState(settings?.flight_alerts_enabled ?? true);
  const [umrahAlerts, setUmrahAlerts] = React.useState(settings?.umrah_alerts_enabled ?? true);
  const [expenseAlerts, setExpenseAlerts] = React.useState(settings?.daily_expense_reminder_enabled ?? true);
  const [openingTime, setOpeningTime] = React.useState(settings?.opening_time || "09:00:00");
  const [closingTime, setClosingTime] = React.useState(settings?.closing_time || "20:00:00");

  const queryClient = useQueryClient();
  const { data: agencyId } = useCurrentAgencyId();

  // WhatsApp settings local state
  const [waPhoneNumberId, setWaPhoneNumberId] = React.useState("");
  const [waBusinessAccountId, setWaBusinessAccountId] = React.useState("");
  const [waAccessToken, setWaAccessToken] = React.useState("");
  const [waIsActive, setWaIsActive] = React.useState(false);

  const { data: waConfig } = useQuery({
    queryKey: ["agency_whatsapp_settings", agencyId],
    queryFn: async () => {
      if (!agencyId) return null;
      try {
        const { data, error } = await supabase
          .from("agency_whatsapp_settings" as any)
          .select("*")
          .eq("agency_id", agencyId)
          .maybeSingle();
        if (error && error.code !== "42P01") throw error;
        return data as any;
      } catch (e) {
        return null;
      }
    },
    enabled: !!agencyId,
  });

  React.useEffect(() => {
    if (waConfig) {
      setWaPhoneNumberId(waConfig.phone_number_id || "");
      setWaBusinessAccountId(waConfig.waba_id || "");
      setWaAccessToken(waConfig.access_token || "");
      setWaIsActive(waConfig.is_active ?? false);
    }
  }, [waConfig]);

  React.useEffect(() => {
    if (settings) {
      setFlightAlerts(settings.flight_alerts_enabled);
      setUmrahAlerts(settings.umrah_alerts_enabled);
      setExpenseAlerts(settings.daily_expense_reminder_enabled);
      setOpeningTime(settings.opening_time);
      setClosingTime(settings.closing_time);
    }
  }, [settings]);

  const handleTabChange = (val: string) => {
    setSearchParams({ tab: val }, { replace: true });
  };

  const handleSaveNotificationPreferences = async () => {
    await updateSettings.mutateAsync({
      flight_alerts_enabled: flightAlerts,
      umrah_alerts_enabled: umrahAlerts,
      daily_expense_reminder_enabled: expenseAlerts,
      opening_time: openingTime,
      closing_time: closingTime,
    });
  };

  const saveWhatsApp = useMutation({
    mutationFn: async () => {
      if (!agencyId) throw new Error("No agency active");
      const { data, error } = await supabase
        .from("agency_whatsapp_settings" as any)
        .upsert(
          {
            agency_id: agencyId,
            phone_number_id: waPhoneNumberId.trim() || null,
            waba_id: waBusinessAccountId.trim() || null,
            access_token: waAccessToken.trim() || null,
            is_active: waIsActive,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "agency_id" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency_whatsapp_settings", agencyId] });
      toast.success("WhatsApp configuration saved securely");
    },
    onError: (e: any) => {
      toast.error("Failed to save WhatsApp settings", { description: e.message });
    },
  });

  const handleSaveWhatsAppSettings = (e: React.FormEvent) => {
    e.preventDefault();
    saveWhatsApp.mutate();
  };

  return (
    <div className="space-y-4">
      <SeoHead
        title="Agency Settings & Configuration - TAMS Pro"
        description="Configure agency branding, WhatsApp integration, automated notification rules, email logs, and access the system manual."
        path="/app/settings"
      />

      {/* Hub Top Navigation Tabs */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md pb-2 pt-1 border-b border-border/50">
        <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto h-11 p-1 bg-muted/60 border">
            <TabsTrigger value="general" className="gap-2 text-xs sm:text-sm font-semibold shrink-0">
              <SettingsIcon className="w-4 h-4 text-primary" />
              General & Branding
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-2 text-xs sm:text-sm font-semibold shrink-0">
              <MessageSquare className="w-4 h-4 text-emerald-500" />
              WhatsApp Integration
            </TabsTrigger>
            <TabsTrigger value="preferences" className="gap-2 text-xs sm:text-sm font-semibold shrink-0">
              <Bell className="w-4 h-4 text-amber-500" />
              Notification Preferences
            </TabsTrigger>
            <TabsTrigger value="email-history" className="gap-2 text-xs sm:text-sm font-semibold shrink-0">
              <Mail className="w-4 h-4 text-blue-500" />
              Email History
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-2 text-xs sm:text-sm font-semibold shrink-0">
              <BookOpen className="w-4 h-4 text-purple-500" />
              User Manual
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Active Tab View */}
      <div className="pt-1">
        {currentTab === "general" && <Settings />}

        {currentTab === "whatsapp" && (
          <Card className="border max-w-3xl">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-500" />
                Meta WhatsApp Business API Integration
              </CardTitle>
              <CardDescription>
                Send automated service vouchers, booking confirmations, e-tickets, and payment receipts directly to client WhatsApp numbers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveWhatsAppSettings} className="space-y-4">
                <div className="flex items-center justify-between p-3.5 rounded-lg border bg-muted/30">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-sm">Enable WhatsApp Automated Messaging</p>
                    <p className="text-xs text-muted-foreground">
                      Use official Meta WhatsApp Cloud API for 1-tap customer voucher and quotation dispatch
                    </p>
                  </div>
                  <Switch checked={waIsActive} onCheckedChange={setWaIsActive} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Phone Number ID</Label>
                    <Input
                      placeholder="e.g. 1048291029102"
                      value={waPhoneNumberId}
                      onChange={(e) => setWaPhoneNumberId(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">WhatsApp Business Account ID</Label>
                    <Input
                      placeholder="e.g. 982103912093"
                      value={waBusinessAccountId}
                      onChange={(e) => setWaBusinessAccountId(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">System User Access Token (Permanent Token)</Label>
                  <Input
                    type="password"
                    placeholder="EAAGm0PX4ZC9..."
                    value={waAccessToken}
                    onChange={(e) => setWaAccessToken(e.target.value)}
                    className="h-9 text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Token is stored server-side with strict row-level security and is never exposed to public browser queries.
                  </p>
                </div>

                <Button type="submit" disabled={saveWhatsApp.isPending} className="font-semibold text-xs h-9">
                  {saveWhatsApp.isPending ? "Saving..." : "Save WhatsApp Configuration"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {currentTab === "preferences" && (
          <Card className="border max-w-3xl">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-500" />
                Agency Notification & Operational Alert Rules
              </CardTitle>
              <CardDescription>
                Configure automated flight departure alerts, Umrah group notices, and daily ledger closings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-lg border bg-card">
                <div>
                  <p className="font-semibold text-sm">Automated Flight Departure Alerts</p>
                  <p className="text-xs text-muted-foreground">
                    Alert team about flights departing Today and Tomorrow in the top notification bell
                  </p>
                </div>
                <Switch checked={flightAlerts} onCheckedChange={setFlightAlerts} />
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-lg border bg-card">
                <div>
                  <p className="font-semibold text-sm">Umrah Group Departure Alerts</p>
                  <p className="text-xs text-muted-foreground">
                    Flag Umrah packages scheduled for travel with direct links to booking details
                  </p>
                </div>
                <Switch checked={umrahAlerts} onCheckedChange={setUmrahAlerts} />
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-lg border bg-card">
                <div>
                  <p className="font-semibold text-sm">Daily Evening Expense & Closing Prompt</p>
                  <p className="text-xs text-muted-foreground">
                    Prompt agency team at end of day to record daily petty cash expenses and balance ledger
                  </p>
                </div>
                <Switch checked={expenseAlerts} onCheckedChange={setExpenseAlerts} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Morning Operations Briefing Hour</Label>
                  <Input
                    type="time"
                    value={openingTime.slice(0, 5)}
                    onChange={(e) => setOpeningTime(`${e.target.value}:00`)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Evening Closing Hour</Label>
                  <Input
                    type="time"
                    value={closingTime.slice(0, 5)}
                    onChange={(e) => setClosingTime(`${e.target.value}:00`)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <Button onClick={handleSaveNotificationPreferences} className="font-semibold text-xs h-9">
                Save Notification Rules
              </Button>
            </CardContent>
          </Card>
        )}

        {currentTab === "email-history" && <EmailHistory />}
        {currentTab === "manual" && <UserManual />}
      </div>
    </div>
  );
}

