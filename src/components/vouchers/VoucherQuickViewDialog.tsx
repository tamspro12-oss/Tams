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
import { Printer } from "lucide-react";

interface VoucherQuickViewDialogProps {
  voucher: any | null;
  onClose: () => void;
  fallbackPartyName?: string;
}

export const VoucherQuickViewDialog: React.FC<VoucherQuickViewDialogProps> = ({
  voucher,
  onClose,
  fallbackPartyName,
}) => {
  const displayPartyName = voucher?.party?.name || fallbackPartyName || "Customer";
  const isReceived = voucher?.direction === "received" || voucher?.direction === "in";

  return (
    <Dialog open={Boolean(voucher)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        {voucher && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between gap-2 text-base pr-6">
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                  {voucher.voucher_no || "Voucher"}
                </span>
                <StatusChip
                  status={isReceived ? "paid" : "pending"}
                  label={
                    voucher.direction === "out" || voucher.direction === "paid"
                      ? "PAID OUT"
                      : "RECEIVED"
                  }
                  size="sm"
                />
              </DialogTitle>
              <DialogDescription className="text-xs">
                Payment Voucher Record · {voucher.voucher_date || "—"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-xs pt-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 p-3 rounded-lg bg-muted/40 border">
                <div>
                  <span className="text-muted-foreground block">Party</span>
                  <span className="font-semibold">{displayPartyName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Mode</span>
                  <span className="font-semibold uppercase">
                    {voucher.payment_mode || "cash"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Amount</span>
                  <span className="font-mono font-bold">
                    PKR {(Number(voucher.amount) || 0).toLocaleString()}
                  </span>
                </div>
                {voucher.reference_no && (
                  <div>
                    <span className="text-muted-foreground block">Ref / Cheque #</span>
                    <span className="font-mono">{voucher.reference_no}</span>
                  </div>
                )}
              </div>
              {voucher.notes && (
                <p className="text-xs text-muted-foreground bg-card p-2.5 rounded border">
                  {voucher.notes}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={async () => {
                    const { generateVoucherPdf } = await import(
                      "@/lib/pdf/voucherReceiptPdf"
                    );
                    generateVoucherPdf({
                      voucherNo: voucher.voucher_no,
                      voucherDate: voucher.voucher_date,
                      direction: voucher.direction,
                      paymentMode: voucher.payment_mode,
                      partyName: displayPartyName,
                      amount: voucher.amount,
                      accountName: voucher.bank_name
                        ? `${String(voucher.payment_mode || "cash").toUpperCase()} (${voucher.bank_name})`
                        : `${String(voucher.payment_mode || "cash").toUpperCase()} Account`,
                      notes: voucher.notes,
                      isEdited: voucher.is_edited,
                      lastEditedAt: voucher.last_edited_at,
                    });
                  }}
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Receipt
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

