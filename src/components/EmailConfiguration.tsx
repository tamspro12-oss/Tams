import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Key, ShieldCheck, CheckCircle2, AlertCircle, Save, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAgency } from "@/hooks/useAgency";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GmailAppPasswordGuide } from "@/components/GmailAppPasswordGuide";
import { useFormKeyboardNav } from "@/hooks/useFormKeyboardNav";
import { handleSupabaseError } from "@/lib/supabaseErrorHandler";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const APP_PASSWORD_PATTERN = /^[a-zA-Z0-9]{16}$/;

export function EmailConfiguration() {
  const { data: agency } = useAgency();
  const { isSubUser } = useUserPermissions();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const formRef = useRef<HTMLFormElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const [agencyEmail, setAgencyEmail] = useState("");
  const [hasInitializedEmail, setHasInitializedEmail] = useState(false);
  // App Password always defaults to empty and is never loaded back from auth, state, or database.
  const [agencyEmailPassword, setAgencyEmailPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);

  useEffect(() => {
    setHasInitializedEmail(false);
    setAgencyEmailPassword("");
    setShowPassword(false);
  }, [agency?.id]);

  useEffect(() => {
    if (!hasInitializedEmail && (agency || user)) {
      const initialEmail = agency?.email || user?.email || "";
      setAgencyEmail(initialEmail);
      setHasInitializedEmail(true);
    }
  }, [agency, user, hasInitializedEmail]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSavingRef.current || isSaving) return;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("Network connection issue. You are offline, not saved.");
      return;
    }

    if (!agency?.id) {
      toast.error("No active agency found");
      return;
    }

    const trimmedEmail = agencyEmail.trim();
    if (!trimmedEmail || !EMAIL_PATTERN.test(trimmedEmail)) {
      toast.error("Please enter a valid Agency Gmail Email");
      emailInputRef.current?.focus();
      return;
    }

    const rawPasswordInput = agencyEmailPassword;
    const cleanPassword = rawPasswordInput.replace(/\s+/g, "");
    if (rawPasswordInput.length > 0 && !APP_PASSWORD_PATTERN.test(cleanPassword)) {
      toast.error("Gmail App Password must be a 16-character Google App Password (spaces allowed)");
      passwordInputRef.current?.focus();
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    try {
      const updatePayload: { email: string; email_password?: string } = {
        email: trimmedEmail,
      };
      if (cleanPassword.length === 16) {
        updatePayload.email_password = cleanPassword;
      }

      const { error } = await supabase
        .from("agencies")
        .update(updatePayload)
        .eq("id", agency.id);

      if (error) throw error;

      setAgencyEmail(trimmedEmail);
      setAgencyEmailPassword("");
      setShowPassword(false);
      await queryClient.invalidateQueries({ queryKey: ["agency"] });

      if (cleanPassword.length === 16) {
        toast.success("Email configuration saved");
      } else if (agency?.smtp_configured) {
        toast.success("Agency email updated");
      } else {
        toast.success("Agency email saved. Add a 16-character Gmail App Password to enable email sending.");
      }
    } catch (error: unknown) {
      handleSupabaseError(error, "Failed to update email configuration", "EmailConfiguration.handleSave");
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  useFormKeyboardNav({
    containerRef: formRef,
    enabled: true,
    autoFocusFirst: false,
    onSave: () => {
      void handleSave();
    },
  });

  const savedEmail = (agency?.email || "").trim();
  const isConfigured = Boolean(EMAIL_PATTERN.test(savedEmail) && agency?.smtp_configured);

  if (isSubUser) {
    return (
      <Card className="border shadow-xs max-w-4xl mx-auto">
        <CardContent className="py-8 text-center space-y-2">
          <p className="text-sm font-semibold">Agency Owner Access Required</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Only the main agency owner can view or update SMTP email credentials.
          </p>
        </CardContent>
      </Card>
    );
  }

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
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Configured
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
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4">
        <form
          ref={formRef}
          onSubmit={handleSave}
          autoComplete="off"
          data-lpignore="true"
          data-1p-ignore="true"
          data-form-type="other"
          noValidate
          className="space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="smtp_agency_email" className="text-xs font-semibold flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                Agency Gmail Email *
              </Label>
              <Input
                ref={emailInputRef}
                id="smtp_agency_email"
                name="smtp_agency_email"
                type="email"
                value={agencyEmail}
                onChange={(e) => {
                  setHasInitializedEmail(true);
                  setAgencyEmail(e.target.value);
                }}
                placeholder="youragency@gmail.com"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
                className="h-9 text-xs"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                All client vouchers, invoices, and receipts will show this email as sender.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="smtp_app_password" className="text-xs font-semibold flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-muted-foreground" />
                16-Character Gmail App Password
              </Label>
              <div className="relative">
                <Input
                  ref={passwordInputRef}
                  id="smtp_app_password"
                  name="smtp_app_password"
                  type={showPassword ? "text" : "password"}
                  value={agencyEmailPassword}
                  onChange={(e) => setAgencyEmailPassword(e.target.value)}
                  placeholder={agency?.smtp_configured ? "Saved · type a new one to replace" : "abcd efgh ijkl mnop"}
                  maxLength={19}
                  autoComplete="new-password"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                  className="h-9 text-xs pr-10 font-mono tracking-wider"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  data-nav-skip="true"
                  aria-label={showPassword ? "Hide App Password" : "Show App Password"}
                  onClick={() => setShowPassword((prev) => !prev)}
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

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-[11px] text-muted-foreground">
              Enter = next field · Enter on Save = save configuration
            </p>
            <Button
              type="submit"
              disabled={isSaving || !agencyEmail.trim()}
              size="sm"
              className="h-8 text-xs font-semibold gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? "Saving..." : "Save Configuration"}</span>
            </Button>
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
