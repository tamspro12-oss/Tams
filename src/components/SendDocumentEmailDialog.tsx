import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Send, Loader2, AlertCircle, Settings, Paperclip } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAgency } from "@/hooks/useAgency";
import {
  CONNECT_GMAIL_PROMPT,
  fetchAgencyGmailStatus,
  sendEmail,
} from "@/lib/emailService";
import { toFriendlyMessage } from "@/lib/friendlyError";

export interface DocumentEmailPayload {
  documentLabel: string; // e.g. "Invoice INV-2026-0001"
  emailType: "invoice" | "booking" | "voucher" | "quotation";
  defaultRecipientEmail?: string | null;
  recipientName?: string | null;
  clientId?: string | null;
  subject: string;
  attachmentFileName: string;
  buildPdfAndBody: (agencyName: string) => Promise<{
    pdfBase64: string;
    htmlBody: string;
  }>;
  onSentSuccess?: () => void;
}

interface SendDocumentEmailDialogProps {
  payload: DocumentEmailPayload | null;
  onClose: () => void;
}

export const SendDocumentEmailDialog: React.FC<SendDocumentEmailDialogProps> = ({
  payload,
  onClose,
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: agency } = useAgency();

  const { data: gmailStatus, isLoading: checkingGmail } = useQuery({
    queryKey: ["agency-gmail-status", agency?.id ?? "anonymous"],
    queryFn: fetchAgencyGmailStatus,
    enabled: Boolean(payload && agency?.id),
    staleTime: 30 * 1000,
  });

  const [recipientEmail, setRecipientEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [sending, setSending] = useState(false);

  const agencyName = (agency?.name || "Travel Agency").trim();

  useEffect(() => {
    if (payload) {
      setRecipientEmail((payload.defaultRecipientEmail || "").trim());
      setSubject(payload.subject);
    }
  }, [payload]);

  const isConnected = Boolean(gmailStatus?.connected && gmailStatus?.gmailAddress);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payload || sending) return;

    if (!isConnected || !gmailStatus?.gmailAddress) {
      toast.error(CONNECT_GMAIL_PROMPT);
      return;
    }

    const cleanTo = recipientEmail.trim();
    if (!cleanTo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanTo)) {
      toast.error("Please enter a valid recipient email address.");
      return;
    }

    setSending(true);
    try {
      const { pdfBase64, htmlBody } = await payload.buildPdfAndBody(agencyName);
      if (!pdfBase64) {
        toast.error("Could not generate the PDF attachment. Please try again.");
        setSending(false);
        return;
      }

      const result = await sendEmail(
        {
          email: gmailStatus.gmailAddress,
          agencyName,
        },
        {
          to: cleanTo,
          subject: subject.trim() || payload.subject,
          body: htmlBody,
          attachments: [
            {
              name: payload.attachmentFileName,
              data: pdfBase64,
            },
          ],
          emailType: payload.emailType,
          clientId: payload.clientId || undefined,
        }
      );

      if (!result.success) {
        toast.error(result.message || CONNECT_GMAIL_PROMPT);
        return;
      }

      toast.success(`${payload.documentLabel} sent to ${cleanTo}`);
      queryClient.invalidateQueries({ queryKey: ["email-logs"] });
      payload.onSentSuccess?.();
      onClose();
    } catch (err) {
      toast.error(toFriendlyMessage(err, "Could not send email right now."));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={Boolean(payload)} onOpenChange={(open) => !open && !sending && onClose()}>
      <DialogContent className="w-[95vw] max-w-md h-auto max-h-[90vh] overflow-y-auto rounded-xl">
        {payload && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Mail className="w-4 h-4 text-primary" />
                <span>Send by Email</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                {payload.documentLabel}
              </DialogDescription>
            </DialogHeader>

            {checkingGmail ? (
              <div className="py-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Checking your agency Gmail connection...</span>
              </div>
            ) : !isConnected ? (
              <div className="space-y-4 py-2">
                <div className="p-4 rounded-xl border border-amber-300/80 bg-amber-50/80 dark:bg-amber-950/30 space-y-2 text-xs">
                  <p className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{CONNECT_GMAIL_PROMPT}</span>
                  </p>
                  <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
                    To send invoices, vouchers, quotations, and booking confirmations under <strong>{agencyName}</strong>, connect your agency&apos;s own Gmail address and 16-character App Password in Settings.
                  </p>
                </div>

                <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      onClose();
                      navigate("/app/settings?tab=email");
                    }}
                    className="gap-1.5 font-semibold"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Connect your Gmail in Settings</span>
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <form onSubmit={handleSend} className="space-y-3.5 text-xs pt-1">
                <div className="p-2.5 rounded-lg bg-muted/40 border space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Sender:</span>
                    <span className="font-semibold text-foreground truncate">
                      {agencyName} &lt;{gmailStatus?.gmailAddress}&gt;
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Attached PDF:</span>
                    <span className="font-mono text-[11px] inline-flex items-center gap-1 text-primary font-medium truncate">
                      <Paperclip className="w-3 h-3 shrink-0" />
                      {payload.attachmentFileName}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="doc-email-to" className="text-xs font-semibold">
                    Recipient Email *
                  </Label>
                  <Input
                    id="doc-email-to"
                    type="email"
                    placeholder="client@example.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="h-9 text-xs"
                    required
                    autoFocus={!recipientEmail}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="doc-email-subject" className="text-xs font-semibold">
                    Subject *
                  </Label>
                  <Input
                    id="doc-email-subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="h-9 text-xs"
                    required
                  />
                </div>

                <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={sending}
                    onClick={onClose}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={sending || !recipientEmail.trim()}
                    className="gap-1.5 font-semibold"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending PDF...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Send by Email</span>
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

