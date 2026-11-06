import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Mail, History, Trash2, Key } from "lucide-react";
import { EmailConfiguration } from "@/components/EmailConfiguration";
import EmailHistory from "@/pages/EmailHistory";
import { EmailCleanupSettings } from "@/components/EmailCleanupSettings";

export type EmailSubTab = "config" | "history" | "cleanup";

interface EmailIntegrationProps {
  initialSubTab?: EmailSubTab;
}

export function EmailIntegration({ initialSubTab = "config" }: EmailIntegrationProps) {
  const [activeSubTab, setActiveSubTab] = useState<EmailSubTab>(initialSubTab);

  return (
    <div className="space-y-3">
      {/* Three clean sub-tabs in exact specified order */}
      <div className="flex items-center justify-start border-b pb-2">
        <Tabs value={activeSubTab} onValueChange={(val) => setActiveSubTab(val as EmailSubTab)} className="w-full">
          <TabsList className="h-9 p-1 bg-muted/60 border rounded-lg flex items-center justify-start gap-1 w-fit">
            <TabsTrigger
              value="config"
              className="gap-1.5 text-xs font-semibold px-3 py-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs rounded-md transition-all"
            >
              <Key className="w-3.5 h-3.5 text-blue-500" />
              Email Configuration
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="gap-1.5 text-xs font-semibold px-3 py-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs rounded-md transition-all"
            >
              <History className="w-3.5 h-3.5 text-primary" />
              Email History
            </TabsTrigger>
            <TabsTrigger
              value="cleanup"
              className="gap-1.5 text-xs font-semibold px-3 py-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs rounded-md transition-all"
            >
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
              Email Log Cleanup
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Sub-tab Views */}
      <div className="pt-1">
        {activeSubTab === "config" && <EmailConfiguration />}
        {activeSubTab === "history" && (
          <div className="rounded-lg border bg-card/60 p-2 sm:p-4">
            <EmailHistory />
          </div>
        )}
        {activeSubTab === "cleanup" && (
          <div className="max-w-3xl mx-auto">
            <EmailCleanupSettings />
          </div>
        )}
      </div>
    </div>
  );
}
export default EmailIntegration;
