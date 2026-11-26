import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Save,
  Eye,
  EyeOff,
  Send,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { useAgency } from "@/hooks/useAgency";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GmailAppPasswordGuide } from "@/components/GmailAppPasswordGuide";
import { useFormKeyboardNav } from "@/hooks/useFormKeyboardNav";
import {
  fetchAgencyGmailStatus,
  RESERVED_SYSTEM_EMAIL,
  saveAgencyGmailCredentials,
  sendAgencyTestEmail,
} from "@/lib/emailService";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const APP_PASSWORD_PATTERN = /^[a-zA-Z0-9]{16}$/;

export function EmailConfiguration() {
  const { data: agency } = useAgency();
  const { isSubUser } = useUserPermissions();
  const queryClient = useQueryClient();

  const { data: gmailStatus, isLoading: loadingStatus } = useQuery({
    queryKey: ["agency-gmail-status", agency?.id ?? "anonymous"],
    queryFn: fetchAgencyGmailStatus,
    enabled: Boolean(agency?.id),
    staleTime: 60 * 1000,
  });

  const formRef = useRef<HTMLFormElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const [agencyEmail, setAgencyEmail] = useState("");
  const [hasInitializedEmail, setHasInitializedEmail] = useState(false);
  // App Password is NEVER returned from the server; field starts empty and shows masked placeholder when saved.
  const [agencyEmailPassword, setAgencyEmailPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [testRecipient, setTestRecipient] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);

  useEffect(() => {
    setHasInitializedEmail(false);
    setAgencyEmailPassword("");
    setShowPassword(false);
  }, [agency?.id]);

  useEffect(() => {
    if (!hasInitializedEmail && gmailStatus) {
      const candidate = gmailStatus.gmailAddress || agency?.email || "";
      const safeInitial =
        candidate.trim().toLowerCase() === RESERVED_SYSTEM_EMAIL ? "" : candidate.trim();
      setAgencyEmail(safeInitial);
      if (safeInitial && !testRecipient) {
        setTestRecipient(safeInitial);
      }
      setHasInitializedEmail(true);
    }
  }, [gmailStatus, agency?.email, hasInitializedEmail, testRecipient]);

  const isConnected = Boolean(gmailStatus?.connected && gmailStatus?.gmailAddress);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSaving) return;

    if (!agency?.id) {
      toast.error("No active agency found.");
      return;
    }

    const trimmedEmail = agencyEmail.trim().toLowerCase();
    if (!trimmedEmail || !EMAIL_PATTERN.test(trimmedEmail)) {
      toast.error("Please enter a valid Gmail address.");
      emailInputRef.current?.focus();
      return;
    }

    if (trimmedEmail === RESERVED_SYSTEM_EMAIL) {
      toast.error("Please enter your agency's own Gmail address.");
      emailInputRef.current?.focus();
      return;
    }

    const cleanPassword = agencyEmailPassword.replace(/\s+/g, "");
    if (!cleanPassword && !isConnected) {
      toast.error("Please enter your 16-character Gmail App Password.");
      passwordInputRef.current?.focus();
      return;
    }

    if (cleanPassword && !APP_PASSWORD_PATTERN.test(cleanPassword)) {
      toast.error("Gmail App Password must be 16 letters/numbers (spaces are removed automatically).");
      passwordInputRef.current?.focus();
      return;
    }

    setIsSaving(true);
    try {
      const res = await saveAgencyGmailCredentials({
        gmailAddress: trimmedEmail,
        appPassword: cleanPassword || undefined,
      });

      if (!res.ok) {
        toast.error(res.error || "Could not save Gmail settings.");
        return;
      }

      setAgencyEmail(trimmedEmail);
      setAgencyEmailPassword("");
      setShowPassword(false);
      if (!testRecipient) {
        setTestRecipient(trimmedEmail);
      }

      toast.success("Your agency Gmail is encrypted and connected.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["agency-gmail-status"] }),
        queryClient.invalidateQueries({ queryKey: ["agency-smtp-configured"] }),
        queryClient.invalidateQueries({ queryKey: ["agency"] }),
      ]);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (isSendingTest) return;
    if (!isConnected) {
      toast.error("Save your Gmail address and 16-character App Password first, then click Send test email.");
      return;
    }

    const target = (testRecipient || gmailStatus?.gmailAddress || "").trim();
    if (!target || !EMAIL_PATTERN.test(target)) {
      toast.error("Please enter a valid test recipient email address.");
      return;
    }

    setIsSendingTest(true);
    try {
      const result = await sendAgencyTestEmail(target);
      if (result.success) {
        toast.success(`Test email sent to ${target} from ${gmailStatus?.gmailAddress}`);
        queryClient.invalidateQueries({ queryKey: ["email-logs"] });
      } else {
        toast.error(result.message || "Test email could not be delivered.");
      }
    } finally {
      setIsSendingTest(false);
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

  if (isSubUser) {
    return (
      <Card className="border shadow-xs max-w-4xl mx-auto">
        <CardContent className="py-8 text-center space-y-2">
          <p className="text-sm font-semibold">Agency Owner Access Required</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Only the agency owner can connect or update the agency&apos;s Gmail App Password. Once connected, authorized staff can send invoices, vouchers, quotations, and confirmations by email.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <Card className="border shadow-xs">
        <CardHeader className="py-3.5 px-4 sm:px-5 border-b">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base sm:text-lg">
                    Connect Your Agency Gmail
                  </CardTitle>
                  {loadingStatus ? (
                    <Badge variant="outline" className="text-[11px] h-5 gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Checking
                    </Badge>
                  ) : isConnected ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[11px] h-5 gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-600 border-amber-300 text-[11px] h-5 gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Not Connected
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs mt-0.5">
                  Send PDF invoices, vouchers, quotations, and booking confirmations directly from your agency&apos;s own Gmail
                </CardDescription>
              </div>
            </div>

            <GmailAppPasswordGuide />
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 space-y-5">
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
                  Agency Gmail Address *
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
                  className="h-9 text-xs"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Clients will receive emails from <strong>{agency?.name || "your agency"}</strong> using this Gmail address.
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="smtp_app_password" className="text-xs font-semibold flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-muted-foreground" />
                    Gmail App Password {isConnected ? "(Masked)" : "*"}
                  </Label>
                  {isConnected && (
                    <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                      {gmailStatus?.maskedPassword || "•••• •••• •••• ••••"}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <Input
                    ref={passwordInputRef}
                    id="smtp_app_password"
                    name="smtp_app_password"
                    type={showPassword ? "text" : "password"}
                    value={agencyEmailPassword}
                    onChange={(e) => setAgencyEmailPassword(e.target.value)}
                    placeholder={
                      isConnected
                        ? "•••• •••• •••• •••• (type a new 16-char code to replace)"
                        : "abcd efgh ijkl mnop"
                    }
                    maxLength={19}
                    autoComplete="new-password"
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
                  {isConnected
                    ? "Stored encrypted on the server and never sent back to the browser."
                    : "Enter the 16-character Google App Password (not your regular Gmail login password)."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-[11px] text-muted-foreground">
                Isolated strictly to <strong>{agency?.name || "your agency"}</strong>.
              </p>
              <Button
                type="submit"
                disabled={isSaving || !agencyEmail.trim()}
                size="sm"
                className="h-9 text-xs font-semibold gap-1.5"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>{isSaving ? "Encrypting & Saving..." : "Save Gmail Settings"}</span>
              </Button>
            </div>
          </form>

          {/* Send Test Email Bar */}
          <div className="p-3.5 rounded-xl border bg-muted/20 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="agency-test-email-to" className="text-xs font-semibold">
                Test Your Connection
              </Label>
              <Input
                id="agency-test-email-to"
                type="email"
                placeholder={gmailStatus?.gmailAddress || "recipient@example.com"}
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                className="h-9 text-xs bg-background"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSendingTest || !isConnected}
              onClick={() => void handleSendTest()}
              className="h-9 text-xs font-semibold gap-1.5 shrink-0"
            >
              {isSendingTest ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5 text-primary" />
              )}
              <span>Send test email</span>
            </Button>
          </div>

          {/* Short Plain-Language Guide */}
          <div className="p-4 rounded-xl border bg-card space-y-2.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold text-foreground">
                How to create a Gmail App Password (takes 1 minute):
              </p>
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary font-semibold hover:underline"
              >
                <span>Open Google App Passwords</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground leading-relaxed">
              <li>
                Open your Google Account &rarr; <strong>Security</strong> and make sure <strong>2-Step Verification</strong> is turned <strong>ON</strong>.
              </li>
              <li>
                Go to <strong>Google App Passwords</strong> (<span className="font-mono">myaccount.google.com/apppasswords</span>) and sign in.
              </li>
              <li>
                Type <strong>TAMS Pro</strong> as the app name and click <strong>Create</strong>.
              </li>
              <li>
                Copy the <strong>16-letter code</strong> Google shows on screen, paste it into the box above, and click <strong>Save Gmail Settings</strong>.
              </li>
            </ol>
          </div>

          <div className="p-3 bg-muted/40 rounded-lg border flex items-start gap-2.5 text-xs text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-foreground">Encrypted &amp; Isolated Per Agency</p>
              <p className="text-[11px] leading-relaxed">
                Your Gmail App Password is encrypted server-side, protected by Row-Level Security so only your agency&apos;s workspace can trigger it, and never returned to the browser.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
