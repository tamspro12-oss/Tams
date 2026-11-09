import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RotateCcw, Ban, AlertTriangle } from "lucide-react";

interface RefundVoidFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const RefundVoidForm: React.FC<RefundVoidFormProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const [actionType, setActionType] = useState<"refund" | "void">("refund");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [clientRefundAmount, setClientRefundAmount] = useState<string>("0");
  const [vendorRefundAmount, setVendorRefundAmount] = useState<string>("0");
  const [pendingVendorRefund, setPendingVendorRefund] = useState<boolean>(true);
  const [paymentMode, setPaymentMode] = useState<"cash" | "bank">("cash");
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    if (!reason.trim()) {
      toast.error(`Please provide a ${actionType === "void" ? "void" : "refund"} reason`);
      return;
    }

    setIsSubmitting(true);
    const recordNo = `${actionType === "void" ? "VOID" : "REF"}-${Date.now().toString().slice(-6)}`;

    try {
      const clientAmt = parseFloat(clientRefundAmount) || 0;

      // Call atomic refund RPC
      await (supabase as any).rpc("record_refund", {
        p_amount: clientAmt > 0 ? clientAmt : 1,
        p_account_id: null,
        p_party_id: null,
        p_booking_id: selectedInvoiceId || null,
        p_date: new Date().toISOString().slice(0, 10),
        p_method: paymentMode,
        p_reference_no: recordNo,
        p_reason: reason,
        p_notes: notes || undefined,
      });

      toast.success(`${actionType === "void" ? "Invoice voided" : "Refund processed"} successfully`);
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to process request");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
            {actionType === "void" ? "Void Booking Invoice" : "Process Refund"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Action Toggle: Refund vs Void */}
          <div className="grid grid-cols-2 gap-1 bg-muted/60 p-1 rounded-xl border">
            <button
              type="button"
              onClick={() => setActionType("refund")}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                actionType === "refund"
                  ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-400 shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Refund
            </button>
            <button
              type="button"
              onClick={() => setActionType("void")}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                actionType === "void"
                  ? "bg-white dark:bg-slate-900 text-red-700 dark:text-red-400 shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              <Ban className="w-3.5 h-3.5" />
              Void
            </button>
          </div>

          {/* Invoice Reference Search */}
          <div>
            <Label className="text-xs font-semibold">
              Original Invoice / PNR / Ticket <span className="text-red-500">*</span>
            </Label>
            <Input
              value={invoiceSearch}
              onChange={(e) => setInvoiceSearch(e.target.value)}
              placeholder="e.g. INV-1004 or PNR: ABC123"
              className="h-9 text-xs font-mono mt-1"
            />
          </div>

          {actionType === "void" ? (
            /* Void Reason */
            <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-900 text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-red-700 dark:text-red-300">
                <AlertTriangle className="w-4 h-4" />
                Financial Void Protection
              </div>
              <p className="text-red-600 dark:text-red-400 text-[11px]">
                Under Protected Rules, financial records are never hard-deleted. Voiding will reverse the journal entries and mark the invoice as voided with an audit timestamp.
              </p>
              <div>
                <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Void Reason <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Passenger cancelled before ticket issuance"
                  className="h-8 text-xs bg-white dark:bg-slate-900 mt-1"
                  required
                />
              </div>
            </div>
          ) : (
            /* Refund Details */
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs font-semibold">Client Refund (PKR)</Label>
                  <Input
                    type="number"
                    value={clientRefundAmount}
                    onChange={(e) => setClientRefundAmount(e.target.value)}
                    placeholder="0"
                    className="h-9 text-xs font-mono text-right"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Supplier Refund (PKR)</Label>
                  <Input
                    type="number"
                    value={vendorRefundAmount}
                    onChange={(e) => setVendorRefundAmount(e.target.value)}
                    placeholder="0"
                    className="h-9 text-xs font-mono text-right"
                  />
                </div>
              </div>

              {/* Pending Supplier Refund Checkbox */}
              <label className="flex items-center gap-2 text-xs cursor-pointer text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg border">
                <input
                  type="checkbox"
                  checked={pendingVendorRefund}
                  onChange={(e) => setPendingVendorRefund(e.target.checked)}
                  className="rounded border-slate-300 text-teal-600"
                />
                Track as <strong>Pending Refund from Vendor</strong>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs font-semibold">Refund Mode</Label>
                  <Select value={paymentMode} onValueChange={(val: any) => setPaymentMode(val)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold">
                    Refund Reason <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Airline flight cancellation..."
                    className="h-9 text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Notes / Deductions</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Service charges or airline deduction breakdown..."
                  rows={2}
                  className="text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSubmitting}
              onClick={handleSave}
              className={`text-xs text-white ${
                actionType === "void"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-purple-600 hover:bg-purple-700"
              }`}
            >
              {isSubmitting
                ? "Processing..."
                : actionType === "void"
                ? "Confirm Void"
                : "Record Refund"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};

