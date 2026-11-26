import React, { useCallback, useEffect, useState } from "react";
import {
  Mail,
  Send,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldAlert,
  KeyRound,
  Clock,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toFriendlyMessage } from "@/lib/friendlyError";

interface SystemEmailStatus {
  configured: boolean;
  senderEmail: string;
  fromName: string;
  requiredSecrets: string[];
}

interface SystemEmailLogRow {
  id: string;
  recipient_email: string;
  recipient_name?: string | null;
  subject: string;
  email_category: "test" | "welcome" | "announcement" | "admin_message";
  status: "sent" | "failed";
  error_message?: string | null;
  created_at: string;
}

const DEFAULT_STATUS: SystemEmailStatus = {
  configured: false,
  senderEmail: "tamspro12@gmail.com",
  fromName: "TAMS Pro",
  requiredSecrets: ["SYSTEM_GMAIL_USER", "SYSTEM_GMAIL_APP_PASSWORD"],
};

const CATEGORY_LABELS: Record<SystemEmailLogRow["email_category"], string> = {
  test: "Test Email",
  welcome: "Welcome",
  announcement: "Announcement",
  admin_message: "Admin Message",
};

export const AdminSystemEmailManager: React.FC = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<SystemEmailStatus>(DEFAULT_STATUS);
  const [logs, setLogs] = useState<SystemEmailLogRow[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const [testRecipient, setTestRecipient] = useState(user?.email || "tamspro12@gmail.com");
  const [sendingTest, setSendingTest] = useState(false);

  const [composeTo, setComposeTo] = useState("");
  const [composeName, setComposeName] = useState("");
  const [composeCategory, setComposeCategory] =
    useState<"welcome" | "announcement" | "admin_message">("admin_message");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  const loadStatusAndLogs = useCallback(async () => {
    setLoadingStatus(true);
    setLoadingLogs(true);
    try {
      const [statusRes, logsRes] = await Promise.all([
        supabase.functions.invoke("send-system-email", {
          body: { action: "status" },
        }),
        supabase.functions.invoke("send-system-email", {
          body: { action: "logs", limit: 50 },
        }),
      ]);

      if (!statusRes.error && statusRes.data?.success) {
        setStatus({
          configured: Boolean(statusRes.data.configured),
          senderEmail: statusRes.data.senderEmail || "tamspro12@gmail.com",
          fromName: statusRes.data.fromName || "TAMS Pro",
          requiredSecrets: statusRes.data.requiredSecrets || DEFAULT_STATUS.requiredSecrets,
        });
      }

      if (!logsRes.error && Array.isArray(logsRes.data?.logs)) {
        setLogs(logsRes.data.logs as SystemEmailLogRow[]);
      } else {
        const { data: fallbackRows } = await (supabase as any)
          .from("system_email_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50);
        if (Array.isArray(fallbackRows)) {
          setLogs(fallbackRows as SystemEmailLogRow[]);
        }
      }
    } catch (err) {
      console.warn("[AdminSystemEmailManager] Status/logs load note:", err);
    } finally {
      setLoadingStatus(false);
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    void loadStatusAndLogs();
  }, [loadStatusAndLogs]);

  useEffect(() => {
    if (user?.email && !testRecipient) {
      setTestRecipient(user.email);
    }
  }, [user?.email, testRecipient]);

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sendingTest) return;
    const cleanTo = testRecipient.trim();
    if (!cleanTo) {
      toast.error("Please enter a recipient email for the test.");
      return;
    }

    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-system-email", {
        body: {
          action: "send_test",
          to: cleanTo,
        },
      });

      if (error || !data?.success) {
        const msg =
          data?.error ||
          toFriendlyMessage(
            error,
            "Could not send system test email. Verify SYSTEM_GMAIL_USER and SYSTEM_GMAIL_APP_PASSWORD in Supabase Edge Function secrets."
          );
        toast.error(msg);
        await loadStatusAndLogs();
        return;
      }

      toast.success(data.message || `Test email sent to ${cleanTo}`);
      await loadStatusAndLogs();
    } catch (err) {
      toast.error(toFriendlyMessage(err, "Could not send system test email."));
    } finally {
      setSendingTest(false);
    }
  };

  const handleSendSystemMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sendingMessage) return;

    const cleanTo = composeTo.trim();
    const cleanSubject = composeSubject.trim();
    const cleanBody = composeBody.trim();

    if (!cleanTo || !cleanSubject || !cleanBody) {
      toast.error("Recipient email, subject, and message are all required.");
      return;
    }

    setSendingMessage(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-system-email", {
        body: {
          action: "send",
          to: cleanTo,
          recipientName: composeName.trim() || undefined,
          category: composeCategory,
          subject: cleanSubject,
          body: cleanBody,
        },
      });

      if (error || !data?.success) {
        const msg =
          data?.error ||
          toFriendlyMessage(error, "Could not send system email. Check Edge Function secrets.");
        toast.error(msg);
        await loadStatusAndLogs();
        return;
      }

      toast.success(data.message || `System email sent to ${cleanTo}`);
      setComposeSubject("");
      setComposeBody("");
      await loadStatusAndLogs();
    } catch (err) {
      toast.error(toFriendlyMessage(err, "Could not send system email."));
    } finally {
      setSendingMessage(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Sender Status & Edge Function Secret Isolation */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="h-5 w-5 text-primary" />
                <span>TAMS Pro System Email</span>
                {loadingStatus ? (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Checking
                  </Badge>
                ) : status.configured ? (
                  <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-xs gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Secrets Required
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Dedicated exclusively to TAMS Pro platform emails (welcome notes, announcements, and admin messages). Never shared with or used by agency accounts.
              </CardDescription>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadStatusAndLogs()}
              disabled={loadingStatus || loadingLogs}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingStatus || loadingLogs ? "animate-spin" : ""}`} />
              <span>Refresh Status</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl border bg-muted/20">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Official System Sender
              </span>
              <span className="text-sm font-bold font-mono text-foreground mt-1 block">
                {status.senderEmail}
              </span>
            </div>

            <div className="p-3.5 rounded-xl border bg-muted/20">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Display Name
              </span>
              <span className="text-sm font-semibold text-foreground mt-1 block">
                {status.fromName}
              </span>
            </div>

            <div className="p-3.5 rounded-xl border bg-muted/20">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Credential Storage
              </span>
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mt-1 flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 shrink-0" />
                Supabase Edge Function Secrets Only
              </span>
            </div>
          </div>

          {!status.configured && !loadingStatus && (
            <div className="p-3.5 rounded-xl border border-amber-300/70 bg-amber-50/70 dark:bg-amber-950/30 text-xs space-y-1.5">
              <p className="font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>Configure Edge Function Secrets in Supabase Dashboard</span>
              </p>
              <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
                Add <code className="font-mono bg-background px-1.5 py-0.5 rounded">SYSTEM_GMAIL_USER=tamspro12@gmail.com</code> and{" "}
                <code className="font-mono bg-background px-1.5 py-0.5 rounded">SYSTEM_GMAIL_APP_PASSWORD</code> (16-character Google App Password) under{" "}
                <strong>Supabase Dashboard &rarr; Edge Functions &rarr; Secrets</strong>, and deploy the{" "}
                <code className="font-mono bg-background px-1.5 py-0.5 rounded">send-system-email</code> function. Auth confirmation &amp; password-reset emails are configured separately in Supabase Dashboard Authentication SMTP.
              </p>
            </div>
          )}

          {/* Quick Test Email Form */}
          <form
            onSubmit={handleSendTest}
            className="p-4 rounded-xl border bg-card flex flex-col sm:flex-row sm:items-end gap-3"
          >
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="system-test-recipient" className="text-xs font-semibold">
                Test Email Recipient
              </Label>
              <Input
                id="system-test-recipient"
                type="email"
                placeholder="tamspro12@gmail.com"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={sendingTest || !testRecipient.trim()}
              className="h-9 gap-1.5 font-semibold shrink-0"
            >
              {sendingTest ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              <span>Send Test Email</span>
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 2. Send Welcome / Announcement / Admin Email */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Send Platform Email</CardTitle>
          <CardDescription className="text-xs">
            Send a welcome note, feature announcement, or admin message from tamspro12@gmail.com.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSendSystemMessage} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sys-compose-to" className="text-xs font-semibold">
                  Recipient Email *
                </Label>
                <Input
                  id="sys-compose-to"
                  type="email"
                  placeholder="agency@example.com"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sys-compose-name" className="text-xs font-semibold">
                  Recipient / Agency Name (Optional)
                </Label>
                <Input
                  id="sys-compose-name"
                  type="text"
                  placeholder="Al-Haramain Travels"
                  value={composeName}
                  onChange={(e) => setComposeName(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sys-compose-cat" className="text-xs font-semibold">
                  Email Type
                </Label>
                <Select
                  value={composeCategory}
                  onValueChange={(v) =>
                    setComposeCategory(v as "welcome" | "announcement" | "admin_message")
                  }
                >
                  <SelectTrigger id="sys-compose-cat" className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="welcome">Welcome Email</SelectItem>
                    <SelectItem value="announcement">Platform Announcement</SelectItem>
                    <SelectItem value="admin_message">Admin Message</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sys-compose-subject" className="text-xs font-semibold">
                Subject *
              </Label>
              <Input
                id="sys-compose-subject"
                type="text"
                placeholder="Welcome to TAMS Pro — Getting started with your agency workspace"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sys-compose-body" className="text-xs font-semibold">
                Message *
              </Label>
              <Textarea
                id="sys-compose-body"
                rows={4}
                placeholder="Write your official TAMS Pro message..."
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                className="text-xs"
                required
              />
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={sendingMessage}
                className="gap-1.5 font-semibold"
              >
                {sendingMessage ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                <span>Send System Email</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 3. Sent System Emails Log */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">System Sent Emails Log</CardTitle>
              <CardDescription className="text-xs">
                Recent emails sent from tamspro12@gmail.com ({logs.length})
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingLogs ? (
            <div className="py-10 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading system email log...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground space-y-1">
              <Clock className="h-7 w-7 mx-auto text-muted-foreground/50" />
              <p className="font-semibold text-foreground">No system emails logged yet</p>
              <p>Send a test email above to verify delivery and record your first log entry.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {logs.map((row) => (
                <div
                  key={row.id}
                  className="p-3 rounded-xl border bg-background/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {row.status === "sent" ? (
                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200 text-[11px] gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Sent
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 text-[11px] gap-1">
                          <XCircle className="h-3 w-3" />
                          Failed
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[11px]">
                        {CATEGORY_LABELS[row.email_category] || row.email_category}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {format(new Date(row.created_at), "dd MMM yyyy, hh:mm a")}
                      </span>
                    </div>
                    <p className="font-semibold text-foreground truncate">{row.subject}</p>
                    <p className="text-muted-foreground truncate">
                      To: {row.recipient_name ? `${row.recipient_name} <${row.recipient_email}>` : row.recipient_email}
                    </p>
                    {row.error_message && (
                      <p className="text-[11px] text-destructive">{row.error_message}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSystemEmailManager;

