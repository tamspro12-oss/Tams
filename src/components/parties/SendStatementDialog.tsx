import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAgency } from "@/hooks/useAgency";
import { loadAgencyTemplate } from "@/lib/agencyTemplates";
import { sendEmail } from "@/lib/emailService";
import { logAndFriendlyMessage, toFriendlyMessage } from "@/lib/friendlyError";
import {
  generateAccountStatementPdf,
  sanitizeFilename,
  type AgencyInfo,
  type StatementRow,
} from "@/lib/reportPdfGenerator";
import {
  buildPartyStatement,
  buildStatementWhatsAppText,
  formatDrCrAmount,
  type PartyLedgerPartyInput,
  type PartyLedgerResult,
  type StatementPeriodPreset,
} from "@/lib/partyLedger";
import {
  AlertCircle,
  Calendar,
  Download,
  Info,
  Loader2,
  Mail,
  MessageCircle,
} from "lucide-react";

interface SendStatementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  party: PartyLedgerPartyInput;
  ledger: PartyLedgerResult;
  initialCustomFrom?: string;
  initialCustomTo?: string;
}

const PERIOD_OPTIONS: Array<{ value: StatementPeriodPreset; label: string }> = [
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "last_3_months", label: "Last 3 months" },
  { value: "all_time", label: "All time" },
  { value: "custom", label: "Custom range" },
];

export const SendStatementDialog: React.FC<SendStatementDialogProps> = ({
  open,
  onOpenChange,
  party,
  ledger,
  initialCustomFrom,
  initialCustomTo,
}) => {
  const { data: agency } = useAgency();

  const [preset, setPreset] = useState<StatementPeriodPreset>("this_month");
  const [customFrom, setCustomFrom] = useState<string>(initialCustomFrom || "");
  const [customTo, setCustomTo] = useState<string>(initialCustomTo || "");
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState<string>(party.email || "");
  const [busyAction, setBusyAction] = useState<"pdf" | "whatsapp" | "email" | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  // Reset to default "This month" and prefill Custom From/To from ledger filter whenever opened
  useEffect(() => {
    if (open) {
      setPreset("this_month");
      setCustomFrom(initialCustomFrom || "");
      setCustomTo(initialCustomTo || "");
      setRecipientEmail(party.email || "");
      setShowEmailForm(false);
      setSendError(null);
      setBusyAction(null);
    }
  }, [open, initialCustomFrom, initialCustomTo, party.id, party.email]);

  const statement = useMemo(() => {
    return buildPartyStatement({
      party,
      ledger,
      preset,
      customFrom,
      customTo,
    });
  }, [party, ledger, preset, customFrom, customTo]);

  const buildPdfDoc = async () => {
    let brandLogo: string | null = null;
    let templateName: string | undefined;
    let templatePhone: string | undefined;
    let templateEmail: string | undefined;
    let templateAddress: string | undefined;

    try {
      const tpl = await loadAgencyTemplate<Record<string, any>>("invoice_template", agency?.id);
      if (tpl?.data) {
        brandLogo = tpl.data.logo || null;
        templateName = tpl.data.agencyName || undefined;
        templatePhone = tpl.data.phone || undefined;
        templateEmail = tpl.data.email || undefined;
        templateAddress = tpl.data.address || undefined;
      }
    } catch {
      // Fall back silently to agency profile details
    }

    const agencyInfo: AgencyInfo = {
      name: templateName || agency?.name || "TAMS Pro Travel Agency",
      phone_number: templatePhone || agency?.phone_number || agency?.contact_info || undefined,
      contact_email: templateEmail || agency?.contact_email || agency?.email || undefined,
      address: templateAddress || undefined,
      logo: brandLogo,
    };

    const statementRows: StatementRow[] = statement.entries.map((entry) => ({
      date: entry.date,
      voucher_no: entry.reference,
      particulars: entry.description || entry.type,
      entry_type: entry.type,
      party_id: party.id,
      party_name: party.name,
      debit: entry.debit,
      credit: entry.credit,
      balance: entry.runningBalance,
      overdue_status: entry.isVoided ? "Voided" : "Current",
    }));

    const bfLabel =
      preset === "all_time" ? "Opening Balance" : "Balance brought forward";

    const doc = generateAccountStatementPdf({
      agency: agencyInfo,
      periodText: statement.period.summaryText,
      fromIso: statement.period.fromDate || "",
      toIso: statement.period.toDate || "",
      rows: statementRows,
      selectedParties: [
        {
          id: party.id,
          name: party.name,
          code: party.code || undefined,
          phone: party.phone || undefined,
          type: party.type,
          opening_balance: party.opening_balance ?? 0,
        },
      ],
      broughtForward: statement.broughtForward,
      broughtForwardLabel: bfLabel,
      isEmptyPeriod: statement.isEmptyPeriod,
    });

    const dateTag =
      statement.period.fromDate && statement.period.toDate
        ? `${statement.period.fromDate}_to_${statement.period.toDate}`
        : "All_Time";
    const filename = `${sanitizeFilename(party.name || "Party")}_Statement_${dateTag}.pdf`;

    return { doc, filename, agencyInfo };
  };

  const ensureValidStatement = (): boolean => {
    if (!statement.valid) {
      const msg = statement.error || "Please select a valid date range.";
      setSendError(msg);
      toast.error(msg);
      return false;
    }
    setSendError(null);
    return true;
  };

  const handleDownloadPdf = async () => {
    if (!ensureValidStatement() || busyAction) return;
    setBusyAction("pdf");
    try {
      const { doc, filename } = await buildPdfDoc();
      doc.save(filename);
      toast.success("Statement PDF downloaded.");
    } catch (err) {
      const friendly = logAndFriendlyMessage(
        "SendStatement.DownloadPdf",
        err,
        "Could not generate the statement PDF. Please try again."
      );
      setSendError(friendly);
      toast.error(friendly);
    } finally {
      setBusyAction(null);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!ensureValidStatement() || busyAction) return;
    setBusyAction("whatsapp");
    try {
      const rawPhone = (party.whatsapp || party.phone || "").replace(/[^0-9]/g, "");
      const message = buildStatementWhatsAppText(statement, agency?.name);
      const url = rawPhone
        ? `https://wa.me/${rawPhone}?text=${encodeURIComponent(message)}`
        : `https://wa.me/?text=${encodeURIComponent(message)}`;

      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) {
        const blockedMsg =
          "Your browser blocked opening WhatsApp. Please allow popups or download the PDF instead.";
        setSendError(blockedMsg);
        toast.error(blockedMsg);
        return;
      }

      toast.success("WhatsApp opened with the statement summary.");
    } catch (err) {
      const friendly = logAndFriendlyMessage(
        "SendStatement.WhatsApp",
        err,
        "Could not open WhatsApp. Please try again."
      );
      setSendError(friendly);
      toast.error(friendly);
    } finally {
      setBusyAction(null);
    }
  };

  const handleSendEmail = async () => {
    if (!ensureValidStatement() || busyAction) return;

    const cleanEmail = recipientEmail.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      const msg = "Please enter a valid recipient email address.";
      setSendError(msg);
      toast.error(msg);
      return;
    }

    if (!agency?.email || !agency?.smtp_configured) {
      const msg =
        "Email sending is not set up yet. Add your Gmail App Password in Settings → Email Integration, or download PDF.";
      setSendError(msg);
      toast.error(msg);
      return;
    }

    setBusyAction("email");
    try {
      const { doc, filename, agencyInfo } = await buildPdfDoc();
      const dataUri = doc.output("datauristring");
      const base64Data = dataUri.includes(",") ? dataUri.split(",")[1] : "";
      if (!base64Data) {
        throw new Error("Could not prepare PDF attachment.");
      }

      const partyCodeLabel = party.code ? ` (${party.code})` : "";
      const subject = `Account Statement - ${party.name}${partyCodeLabel} (${statement.period.summaryText})`;
      const bodyLines = [
        `Dear ${party.name},`,
        "",
        `Please find attached your Account Statement from ${agencyInfo.name || "our office"}.`,
        "",
        `Period: ${statement.period.summaryText}`,
        `Balance Brought Forward: ${statement.broughtForwardFormatted}`,
        `Total Debit: PKR ${statement.totalDebit.toLocaleString()}`,
        `Total Credit: PKR ${statement.totalCredit.toLocaleString()}`,
        `Closing Balance: ${statement.closingBalanceFormatted}`,
        statement.isEmptyPeriod ? "Note: No transactions recorded in this period." : "",
        "",
        "Regards,",
        agencyInfo.name || "Accounts Department",
      ]
        .filter((line) => line !== undefined)
        .join("\n");

      const result = await sendEmail(
        {
          email: agency.email,
          password: "",
          contactEmail: agency.contact_email || agency.email,
        },
        {
          to: cleanEmail,
          subject,
          body: bodyLines,
          emailType: "statement",
          attachments: [
            {
              name: filename,
              data: base64Data,
            },
          ],
        }
      );

      if (!result.success) {
        const friendly = toFriendlyMessage(
          result.message,
          "Could not send the statement email. Please try again."
        );
        setSendError(friendly);
        toast.error(friendly);
        return;
      }

      toast.success(`Statement sent to ${cleanEmail}.`);
      setShowEmailForm(false);
    } catch (err) {
      const friendly = logAndFriendlyMessage(
        "SendStatement.Email",
        err,
        "Could not send the statement email. Please try again."
      );
      setSendError(friendly);
      toast.error(friendly);
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-foreground">
            Send statement
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {party.code ? `${party.code} · ` : ""}
            {party.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1 text-xs">
          {/* Period Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              Choose statement period
            </Label>
            <div
              role="radiogroup"
              aria-label="Statement period"
              className="grid grid-cols-2 sm:grid-cols-3 gap-1.5"
            >
              {PERIOD_OPTIONS.map((opt) => {
                const selected = preset === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      setPreset(opt.value);
                      setSendError(null);
                    }}
                    className={`h-8 px-2.5 rounded-md border text-xs font-medium transition-colors cursor-pointer ${
                      selected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted text-foreground border-border"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {preset === "custom" && (
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div className="space-y-1">
                  <Label htmlFor="stmt-from-date" className="text-[11px] font-medium">
                    From
                  </Label>
                  <Input
                    id="stmt-from-date"
                    type="date"
                    value={customFrom}
                    onChange={(e) => {
                      setCustomFrom(e.target.value);
                      setSendError(null);
                    }}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="stmt-to-date" className="text-[11px] font-medium">
                    To
                  </Label>
                  <Input
                    id="stmt-to-date"
                    type="date"
                    value={customTo}
                    onChange={(e) => {
                      setCustomTo(e.target.value);
                      setSendError(null);
                    }}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            )}

            {/* One-line summary under the choice */}
            <p className="text-xs text-muted-foreground pt-0.5">
              {statement.period.summaryText}
            </p>
          </div>

          {/* Validation error (Custom range) */}
          {!statement.valid && statement.error && (
            <div className="rounded-md border border-red-200 bg-red-50/80 dark:bg-red-950/30 dark:border-red-900 p-2.5 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{statement.error}</span>
            </div>
          )}

          {/* Live Period Preview */}
          {statement.valid && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {preset === "all_time" ? "Opening balance" : "Balance brought forward"}
                </span>
                <span className="font-mono font-semibold text-foreground">
                  {statement.broughtForwardFormatted}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Transactions in period</span>
                <span className="font-mono font-medium text-foreground">
                  {statement.entries.length}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/60">
                <div>
                  <span className="text-[11px] text-muted-foreground block">Total Debit</span>
                  <span className="font-mono font-semibold text-foreground">
                    PKR {statement.totalDebit.toLocaleString()}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-muted-foreground block">Total Credit</span>
                  <span className="font-mono font-semibold text-foreground">
                    PKR {statement.totalCredit.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1.5 border-t border-border/60 text-xs font-semibold">
                <span>Closing balance</span>
                <span className="font-mono text-foreground">
                  {statement.closingBalanceFormatted}
                </span>
              </div>

              {statement.emptyNote && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>{statement.emptyNote}</span>
                </div>
              )}

              {statement.hasMismatch && (
                <div className="rounded border border-amber-200 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-900 px-2 py-1.5 text-[11px] text-amber-800 dark:text-amber-300">
                  Note: Closing statement balance ({statement.closingBalanceFormatted}) differs from
                  party current balance ({formatDrCrAmount(statement.storedCurrentBalance)}).
                </div>
              )}
            </div>
          )}

          {/* Optional Email Recipient Section */}
          {showEmailForm && (
            <div className="rounded-lg border p-3 space-y-2 bg-card">
              <Label htmlFor="stmt-email-to" className="text-xs font-medium">
                Send to email address
              </Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  id="stmt-email-to"
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => {
                    setRecipientEmail(e.target.value);
                    setSendError(null);
                  }}
                  placeholder="client@example.com"
                  className="h-8 text-xs flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSendEmail}
                  disabled={!statement.valid || busyAction !== null}
                  className="h-8 px-3 text-xs gap-1.5 cursor-pointer"
                >
                  {busyAction === "email" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Mail className="w-3.5 h-3.5" />
                  )}
                  Send Email
                </Button>
              </div>
            </div>
          )}

          {/* Send Action Failure Banner (stays open for retry) */}
          {sendError && statement.valid && (
            <div className="rounded-md border border-red-200 bg-red-50/80 dark:bg-red-950/30 dark:border-red-900 p-2.5 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{sendError}</span>
            </div>
          )}

          {/* Action Buttons (existing PDF / WhatsApp / Email channels) */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs cursor-pointer"
            >
              Close
            </Button>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!statement.valid || busyAction !== null}
                onClick={handleDownloadPdf}
                className="h-8 px-3 text-xs gap-1.5 cursor-pointer"
              >
                {busyAction === "pdf" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                Download PDF
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!statement.valid || busyAction !== null}
                onClick={handleSendWhatsApp}
                className="h-8 px-3 text-xs gap-1.5 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
              >
                {busyAction === "whatsapp" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <MessageCircle className="w-3.5 h-3.5" />
                )}
                WhatsApp
              </Button>

              <Button
                type="button"
                size="sm"
                disabled={!statement.valid || busyAction !== null}
                onClick={() => {
                  setSendError(null);
                  setShowEmailForm((prev) => !prev);
                }}
                className="h-8 px-3 text-xs gap-1.5 cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" />
                Email
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

