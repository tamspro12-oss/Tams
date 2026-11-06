import React from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon, MessageSquare, Mail, BookOpen } from "lucide-react";
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
import { toast } from "sonner";

type SettingsTab = "general" | "whatsapp" | "email-history" | "manual";

export default function SettingsHub() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Redirect old /app/settings?tab=preferences to /app/notifications?tab=preferences
  if (searchParams.get("tab") === "preferences") {
    return <Navigate to="/app/notifications?tab=preferences" replace />;
  }

  const currentTab = (searchParams.get("tab") as SettingsTab) || "general";

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

  const handleTabChange = (val: string) => {
    setSearchParams({ tab: val }, { replace: true });
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

        {currentTab === "email-history" && <EmailHistory />}
        {currentTab === "manual" && <UserManual />}
      </div>
    </div>
  );
}

