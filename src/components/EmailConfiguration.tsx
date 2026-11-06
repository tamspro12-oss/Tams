import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Key, ShieldCheck, CheckCircle2, AlertCircle, Save, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAgency } from "@/hooks/useAgency";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GmailAppPasswordGuide } from "@/components/GmailAppPasswordGuide";

export function EmailConfiguration() {
  const { data: agency } = useAgency();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [agencyEmail, setAgencyEmail] = useState("");
  const [agencyEmailPassword, setAgencyEmailPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (agency?.email) {
      setAgencyEmail(agency.email);
    } else if (user?.email) {
      setAgencyEmail(user.email);
    }

    if (agency?.id) {
      supabase
        .rpc("get_agency_smtp_password")
        .then(({ data }) => {
          if (typeof data === "string" && data) setAgencyEmailPassword(data);
        });
    }
  }, [agency, user]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!agency?.id) {
      toast.error("No active agency found");
      return;
    }

    if (agencyEmail && !agencyEmailPassword) {
      toast.error("Gmail App Password is required when email is provided");
      return;
    }

    const cleanPassword = agencyEmailPassword.replace(/\s+/g, "");
    if (cleanPassword && cleanPassword.length !== 16) {
      toast.error("Gmail App Password must be exactly 16 characters");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("agencies")
        .update({
          email: agencyEmail.trim() || null,
          email_password: cleanPassword || null,
        })
        .eq("id", agency.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["agency"] });
      toast.success("Email configuration updated successfully");
    } catch (error: any) {
      toast.error("Failed to update email configuration", { description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const isConfigured = Boolean(agency?.smtp_configured || (agency?.email && agencyEmailPassword));

  return (
    <Card className="border shadow-xs max-w-4xl mx-auto">
      <CardHeader className="py-3 px-4 sm:px-5 border-b">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base sm:text-lg">Agency Gmail SMTP Configuration</CardTitle>
                <Badge
                  variant={isConfigured ? "default" : "outline"}
                  className={isConfigured ? "bg-emerald-600 hover:bg-emerald-600 text-white text-[11px] h-5" : "text-amber-600 text-[11px] h-5"}
                >
                  {isConfigured ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Connected
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3 h-3 mr-1" /> Not Configured
                    </>
                  )}
                </Badge>
              </div>
              <CardDescription className="text-xs mt-0.5">
                Send booking confirmations, invoices, and vouchers directly from your official agency Gmail address
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <GmailAppPasswordGuide />
            <Button
              onClick={handleSave}
              disabled={isSaving || !agencyEmail.trim()}
              size="sm"
              className="h-8 text-xs font-semibold gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? "Saving..." : "Save Configuration"}</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="agency-gmail-email" className="text-xs font-semibold flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                Agency Gmail Email *
              </Label>
              <Input
                id="agency-gmail-email"
                type="email"
                value={agencyEmail}
                onChange={(e) => setAgencyEmail(e.target.value)}
                placeholder="youragency@gmail.com"
                className="h-9 text-xs"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                All client vouchers, invoices, and receipts will show this email as sender.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="agency-gmail-password" className="text-xs font-semibold flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-muted-foreground" />
                16-Character Gmail App Password *
              </Label>
              <div className="relative">
                <Input
                  id="agency-gmail-password"
                  type={showPassword ? "text" : "password"}
                  value={agencyEmailPassword}
                  onChange={(e) => setAgencyEmailPassword(e.target.value)}
                  placeholder="abcd efgh ijkl mnop"
                  maxLength={19}
                  className="h-9 text-xs pr-10 font-mono tracking-wider"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Generate in your Google Account security page (2-Step Verification &rarr; App passwords).
              </p>
            </div>
          </div>

          <div className="p-3 bg-muted/40 rounded-lg border flex items-start gap-2.5 text-xs text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-foreground">Secure Multi-Tenant Encryption</p>
              <p className="text-[11px] leading-relaxed">
                Your SMTP credentials are encrypted and stored with column-level database security. They are only invoked server-side by authenticated backend Edge Functions to dispatch client communications.
              </p>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
