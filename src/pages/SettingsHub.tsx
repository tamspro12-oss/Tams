import { useSearchParams, Navigate } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Palette, Mail, HardDrive, BookOpen } from "lucide-react";

// The 5 Consolidated Modular Settings Components
import { AccountSettings } from "@/components/AccountSettings";
import { BrandingSettings } from "@/components/BrandingSettings";
import { EmailIntegration } from "@/components/EmailIntegration";
import { StorageSettings } from "@/components/StorageSettings";
import UserManual from "@/pages/UserManual";

export type SettingsMainTab = "account" | "branding" | "email-integration" | "storage" | "manual";

export default function SettingsHub() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Redirect old /app/settings?tab=preferences to /app/notifications?tab=preferences
  if (searchParams.get("tab") === "preferences") {
    return <Navigate to="/app/notifications?tab=preferences" replace />;
  }

  const rawTab = searchParams.get("tab");

  // Map legacy tabs to consolidated 5-tab scheme
  const normalizeTab = (tab: string | null): SettingsMainTab => {
    switch (tab) {
      case "branding":
      case "general":
      case "templates":
        return "branding";
      case "email-integration":
      case "email-history":
        return "email-integration";
      case "storage":
        return "storage";
      case "manual":
        return "manual";
      case "account":
      default:
        return "account";
    }
  };

  const currentTab = normalizeTab(rawTab);

  const handleTabChange = (val: string) => {
    setSearchParams({ tab: val }, { replace: true });
  };

  return (
    <div className="space-y-3 max-w-7xl mx-auto w-full">
      <SeoHead
        title="Settings - TAMS Pro"
        description="Manage your account, branding templates, email integration, storage quota, and access user manual."
        path="/app/settings"
      />

      {/* Clean Header: ONLY the title "Settings" */}
      <div className="flex items-center justify-between pb-1 border-b border-border/40">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Settings
        </h1>
      </div>

      {/* Main Top Settings Navigation Bar with 5 Prominent Buttons */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md pb-2 pt-0.5 border-b border-border/50">
        <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto h-11 p-1 bg-muted/60 border rounded-xl gap-1 shadow-xs">
            {/* 1. Account */}
            <TabsTrigger
              value="account"
              className="gap-2 text-xs sm:text-sm font-semibold px-3.5 py-1.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all shrink-0"
            >
              <User className="w-4 h-4" />
              <span>Account</span>
            </TabsTrigger>

            {/* 2. Branding (formerly Agency Branding / General & Branding) */}
            <TabsTrigger
              value="branding"
              className="gap-2 text-xs sm:text-sm font-semibold px-3.5 py-1.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all shrink-0"
            >
              <Palette className="w-4 h-4" />
              <span>Branding</span>
            </TabsTrigger>

            {/* 3. Email Integration (formerly Email History) */}
            <TabsTrigger
              value="email-integration"
              className="gap-2 text-xs sm:text-sm font-semibold px-3.5 py-1.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all shrink-0"
            >
              <Mail className="w-4 h-4" />
              <span>Email Integration</span>
            </TabsTrigger>

            {/* 4. Storage & Backup */}
            <TabsTrigger
              value="storage"
              className="gap-2 text-xs sm:text-sm font-semibold px-3.5 py-1.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all shrink-0"
            >
              <HardDrive className="w-4 h-4" />
              <span>Storage & Backup</span>
            </TabsTrigger>

            {/* 5. User Manual */}
            <TabsTrigger
              value="manual"
              className="gap-2 text-xs sm:text-sm font-semibold px-3.5 py-1.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all shrink-0"
            >
              <BookOpen className="w-4 h-4" />
              <span>User Manual</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Active Tab View - Compact Zero-Scroll Content Container */}
      <div className="pt-1">
        {currentTab === "account" && <AccountSettings />}
        {currentTab === "branding" && <BrandingSettings />}
        {currentTab === "email-integration" && <EmailIntegration />}
        {currentTab === "storage" && <StorageSettings />}
        {currentTab === "manual" && (
          <div className="rounded-xl border bg-card/60 p-3 sm:p-5 max-h-[calc(100vh-200px)] overflow-y-auto">
            <UserManual />
          </div>
        )}
      </div>
    </div>
  );
}
