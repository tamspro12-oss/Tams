import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Users, Lock, Shield, Mail, FileText, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AdminAccountInfo } from "@/components/AdminAccountInfo";
import { SubUserManagement } from "@/components/SubUserManagement";
import { ChangePasswordSection } from "@/components/ChangePasswordSection";
import { usePolicyAcknowledgment } from "@/hooks/usePolicyAcknowledgment";

export type AccountSubView = "admin" | "subusers" | "security" | "legal";

export function AccountSettings() {
  const navigate = useNavigate();
  const [subView, setSubView] = useState<AccountSubView>("admin");
  const { acknowledgment, currentVersions } = usePolicyAcknowledgment();

  return (
    <div className="space-y-3">
      {/* Sub-navigation Segment Tabs */}
      <div className="flex items-center justify-start border-b pb-2">
        <Tabs value={subView} onValueChange={(v) => setSubView(v as AccountSubView)} className="w-full">
          <TabsList className="h-9 p-1 bg-muted/60 border rounded-lg flex items-center justify-start gap-1 w-fit overflow-x-auto">
            <TabsTrigger
              value="admin"
              className="gap-1.5 text-xs font-semibold px-3 py-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs rounded-md transition-all shrink-0"
            >
              <User className="w-3.5 h-3.5 text-primary" />
              Admin & Subscription
            </TabsTrigger>
            <TabsTrigger
              value="subusers"
              className="gap-1.5 text-xs font-semibold px-3 py-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs rounded-md transition-all shrink-0"
            >
              <Users className="w-3.5 h-3.5 text-blue-500" />
              Sub-Users
            </TabsTrigger>
            <TabsTrigger
              value="security"
              className="gap-1.5 text-xs font-semibold px-3 py-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs rounded-md transition-all shrink-0"
            >
              <Lock className="w-3.5 h-3.5 text-amber-500" />
              Security & Password
            </TabsTrigger>
            <TabsTrigger
              value="legal"
              className="gap-1.5 text-xs font-semibold px-3 py-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs rounded-md transition-all shrink-0"
            >
              <Shield className="w-3.5 h-3.5 text-emerald-500" />
              Legal & Support
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Sub-view Content */}
      <div className="pt-1">
        {subView === "admin" && (
          <div className="max-w-4xl mx-auto">
            <AdminAccountInfo />
          </div>
        )}

        {subView === "subusers" && (
          <div className="max-w-4xl mx-auto">
            <SubUserManagement />
          </div>
        )}

        {subView === "security" && (
          <div className="max-w-3xl mx-auto">
            <ChangePasswordSection />
          </div>
        )}

        {subView === "legal" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {/* Legal & Privacy Card */}
            <Card className="border shadow-xs">
              <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  Legal & Privacy
                </CardTitle>
                <CardDescription className="text-xs">
                  Review terms of service, privacy regulations & policy agreement
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <button
                  type="button"
                  onClick={() => navigate("/privacy")}
                  className="w-full flex items-center justify-between p-2.5 border rounded-lg hover:bg-accent/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-medium">Privacy Policy</p>
                      <p className="text-[11px] text-muted-foreground">How your data and clients are protected</p>
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/terms")}
                  className="w-full flex items-center justify-between p-2.5 border rounded-lg hover:bg-accent/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-medium">Terms of Service</p>
                      <p className="text-[11px] text-muted-foreground">Platform usage terms & conditions</p>
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                </button>

                {acknowledgment && (
                  <div className="pt-2 border-t text-xs text-muted-foreground flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Policy Accepted on {new Date(acknowledgment.acknowledged_at).toLocaleDateString()} (v{currentVersions.privacy})</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Support & Help Card */}
            <Card className="border shadow-xs">
              <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary" />
                  Technical Support & Inquiries
                </CardTitle>
                <CardDescription className="text-xs">
                  Reach out for assistance, onboarding, and platform requests
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="p-3 border rounded-lg bg-muted/40 space-y-2 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Official Support Email</span>
                    <a href="mailto:tamspro12@gmail.com" className="font-semibold text-primary hover:underline">
                      tamspro12@gmail.com
                    </a>
                  </div>
                  <div className="pt-2 border-t">
                    <span className="text-muted-foreground block text-[10px]">Direct Support Helpline</span>
                    <p className="font-semibold text-foreground">+92 319 0846768</p>
                    <p className="text-[10px] text-muted-foreground">Available Monday – Saturday, 9 AM to 8 PM PKT</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
export default AccountSettings;
