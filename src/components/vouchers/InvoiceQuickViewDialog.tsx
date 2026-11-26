import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/design-system";
import { isInvoiceVoidedOrRefunded } from "@/lib/accountingEngine";
import { useAgencyBranding } from "@/hooks/useAgencyBranding";
import {
  SendDocumentEmailDialog,
  type DocumentEmailPayload,
} from "@/components/SendDocumentEmailDialog";
import {
  createBookingEmailBody,
  createInvoiceEmailBody,
  jsPdfDocToBase64,
} from "@/lib/emailService";
import { FileCheck, Mail, Printer } from "lucide-react";

interface InvoiceQuickViewDialogProps {
  invoice: any | null;
  onClose: () => void;
  fallbackPartyName?: string;
}

export const InvoiceQuickViewDialog: React.FC<InvoiceQuickViewDialogProps> = ({
  invoice,
  onClose,
  fallbackPartyName,
}) => {
  const { getBrandingAsync } = useAgencyBranding();
  const [emailPayload, setEmailPayload] = useState<DocumentEmailPayload | null>(null);
  const total = Number(invoice?.client_amount) || 0;
  const paid = Number(invoice?.paid_amount) || 0;
  const remaining = invoice
    ? isInvoiceVoidedOrRefunded(invoice)
      ? 0
      : Math.max(0, total - paid)
    : 0;
  const displayClientName =
    invoice?.party?.name || invoice?.client_name || fallbackPartyName || "Customer";
  const defaultRecipientEmail = invoice?.party?.email || invoice?.email || "";

  return (
    <>
      <Dialog open={Boolean(invoice)} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg">
          {invoice && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between gap-2 text-base pr-6">
                  <span className="font-mono font-bold text-primary">
                    {invoice.invoice_no || "Invoice"}
                  </span>
                  <StatusChip
                    status={invoice.payment_status || "pending"}
                    label={String(invoice.payment_status || "pending").toUpperCase()}
                    size="sm"
                  />
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Booking Invoice Record · {invoice.invoice_date || "—"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-xs pt-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 p-3 rounded-lg bg-muted/40 border">
                  <div>
                    <span className="text-muted-foreground block">Client / Party</span>
                    <span className="font-semibold">{displayClientName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Service</span>
                    <span className="font-semibold">{invoice.service || "Booking"}</span>
                  </div>
                  {invoice.vendor?.name && (
                    <div>
                      <span className="text-muted-foreground block">Vendor</span>
                      <span className="font-medium">{invoice.vendor.name}</span>
                    </div>
                  )}
                  {(invoice.pnr || invoice.ticket_no) && (
                    <div>
                      <span className="text-muted-foreground block">PNR / Ticket</span>
                      <span className="font-mono font-medium">
                        {[invoice.pnr, invoice.ticket_no].filter(Boolean).join(" / ")}
                      </span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 min-[375px]:grid-cols-3 gap-2 text-center p-3 rounded-lg border bg-card font-mono">
                  <div>
                    <span className="text-[11px] text-muted-foreground block font-sans">Total</span>
                    <span className="font-bold">PKR {total.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block font-sans">Paid</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      PKR {paid.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block font-sans">
                      Remaining
                    </span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      PKR {remaining.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={async () => {
                      const [{ buildBookingPdfDataFromInvoice, generateBookingConfirmationPdf }, branding] =
                        await Promise.all([
                          import("@/lib/pdf/bookingInvoicePdf"),
                          getBrandingAsync(),
                        ]);
                      generateBookingConfirmationPdf(
                        buildBookingPdfDataFromInvoice(
                          {
                            ...invoice,
                            client_name: displayClientName,
                            client_amount: total,
                            paid_amount: paid,
                            remaining_amount: remaining,
                            service: invoice.service || "Ticket",
                          },
                          branding
                        )
                      );
                    }}
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    Confirmation PDF
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => {
                      const invNo = invoice.invoice_no || "Booking";
                      const safeSlug = String(invNo).replace(/[^a-zA-Z0-9_-]/g, "_");
                      setEmailPayload({
                        documentLabel: `Booking Confirmation (${invNo})`,
                        emailType: "booking",
                        defaultRecipientEmail,
                        recipientName: displayClientName,
                        clientId: invoice.party_id || undefined,
                        subject: `Booking Confirmation ${invNo}`,
                        attachmentFileName: `Confirmation_${safeSlug}.pdf`,
                        buildPdfAndBody: async (agencyName) => {
                          const [{ buildBookingPdfDataFromInvoice, buildBookingConfirmationPdfDoc }, branding] =
                            await Promise.all([
                              import("@/lib/pdf/bookingInvoicePdf"),
                              getBrandingAsync(),
                            ]);
                          const doc = buildBookingConfirmationPdfDoc(
                            buildBookingPdfDataFromInvoice(
                              {
                                ...invoice,
                                client_name: displayClientName,
                                client_amount: total,
                                paid_amount: paid,
                                remaining_amount: remaining,
                                service: invoice.service || "Ticket",
                              },
                              branding
                            )
                          );
                          return {
                            pdfBase64: jsPdfDocToBase64(doc),
                            htmlBody: createBookingEmailBody({
                              clientName: displayClientName,
                              agencyName,
                              pnr: invoice.pnr || undefined,
                              travelType: invoice.service || "Booking",
                              flightDate: invoice.invoice_date || undefined,
                            }),
                          };
                        },
                      });
                    }}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Send Confirmation by email
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={async () => {
                      const [{ buildBookingPdfDataFromInvoice, generateBookingInvoicePdf }, branding] =
                        await Promise.all([
                          import("@/lib/pdf/bookingInvoicePdf"),
                          getBrandingAsync(),
                        ]);
                      generateBookingInvoicePdf(
                        buildBookingPdfDataFromInvoice(
                          {
                            ...invoice,
                            client_name: displayClientName,
                            client_amount: total,
                            paid_amount: paid,
                            remaining_amount: remaining,
                            service: invoice.service || "Ticket",
                          },
                          branding
                        )
                      );
                    }}
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Invoice PDF
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => {
                      const invNo = invoice.invoice_no || "Invoice";
                      const safeSlug = String(invNo).replace(/[^a-zA-Z0-9_-]/g, "_");
                      setEmailPayload({
                        documentLabel: `Invoice ${invNo}`,
                        emailType: "invoice",
                        defaultRecipientEmail,
                        recipientName: displayClientName,
                        clientId: invoice.party_id || undefined,
                        subject: `Invoice ${invNo}`,
                        attachmentFileName: `Invoice_${safeSlug}.pdf`,
                        buildPdfAndBody: async (agencyName) => {
                          const [{ buildBookingPdfDataFromInvoice, buildBookingInvoicePdfDoc }, branding] =
                            await Promise.all([
                              import("@/lib/pdf/bookingInvoicePdf"),
                              getBrandingAsync(),
                            ]);
                          const doc = buildBookingInvoicePdfDoc(
                            buildBookingPdfDataFromInvoice(
                              {
                                ...invoice,
                                client_name: displayClientName,
                                client_amount: total,
                                paid_amount: paid,
                                remaining_amount: remaining,
                                service: invoice.service || "Ticket",
                              },
                              branding
                            )
                          );
                          return {
                            pdfBase64: jsPdfDocToBase64(doc),
                            htmlBody: createInvoiceEmailBody({
                              clientName: displayClientName,
                              agencyName,
                              invoiceNumber: invNo,
                              amount: total,
                            }),
                          };
                        },
                      });
                    }}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Send by email
                  </Button>
                  <Button type="button" size="sm" className="h-8 text-xs" onClick={onClose}>
                    Close
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <SendDocumentEmailDialog
        payload={emailPayload}
        onClose={() => setEmailPayload(null)}
      />
    </>
  );
};

