import React from "react";
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
import {
  generateBookingConfirmationPdf,
  generateBookingInvoicePdf,
} from "@/lib/pdf/bookingInvoicePdf";
import { FileCheck, Printer } from "lucide-react";

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
  const total = Number(invoice?.client_amount) || 0;
  const paid = Number(invoice?.paid_amount) || 0;
  const remaining = invoice
    ? isInvoiceVoidedOrRefunded(invoice)
      ? 0
      : Math.max(0, total - paid)
    : 0;
  const displayClientName =
    invoice?.party?.name || invoice?.client_name || fallbackPartyName || "Customer";

  return (
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
              <div className="grid grid-cols-2 gap-2.5 p-3 rounded-lg bg-muted/40 border">
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
              <div className="grid grid-cols-3 gap-2 text-center p-3 rounded-lg border bg-card font-mono">
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
                  onClick={() =>
                    generateBookingConfirmationPdf({
                      invoiceNo: invoice.invoice_no,
                      invoiceDate: invoice.invoice_date,
                      clientName: displayClientName,
                      service: invoice.service || "Ticket",
                      pnr: invoice.pnr,
                      ticketNo: invoice.ticket_no,
                      passportNo: invoice.passport_no,
                      clientAmount: total,
                      paidAmount: paid,
                      balanceDue: remaining,
                      passengers: invoice.passengers || [],
                      currency: invoice.currency,
                    })
                  }
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  Confirmation PDF
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() =>
                    generateBookingInvoicePdf({
                      invoiceNo: invoice.invoice_no,
                      invoiceDate: invoice.invoice_date,
                      clientName: displayClientName,
                      service: invoice.service || "Ticket",
                      clientAmount: total,
                      paidAmount: paid,
                      balanceDue: remaining,
                      pnr: invoice.pnr,
                      ticketNo: invoice.ticket_no,
                      passportNo: invoice.passport_no,
                      passengers: invoice.passengers || [],
                      currency: invoice.currency,
                    })
                  }
                >
                  <Printer className="w-3.5 h-3.5" />
                  Invoice PDF
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
  );
};

