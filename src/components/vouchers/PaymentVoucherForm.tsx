import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useParties } from "@/hooks/useParties";
import { useAgency } from "@/hooks/useAgency";
import { generateVoucherPdf, VoucherPdfData } from "@/lib/pdf/voucherReceiptPdf";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Printer, CheckCircle2 } from "lucide-react";

interface PaymentVoucherFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const PaymentVoucherForm: React.FC<PaymentVoucherFormProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { parties } = useParties();
  const { data: agency } = useAgency();

  // Toggles
  const [direction, setDirection] = useState<"received" | "paid" | "transfer">("received");
  const [mode, setMode] = useState<"cash" | "bank">("cash");
  const [partyType, setPartyType] = useState<"client" | "vendor">("client");

  // Fields
  const [partyId, setPartyId] = useState<string>("");
  const [amount, setAmount] = useState<string>("0");
  const [voucherDate, setVoucherDate] = useState<string>(
    () => new Date().toISOString().slice(0, 10)
  );
  const [referenceNo, setReferenceNo] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isAdjustment, setIsAdjustment] = useState<boolean>(false);
  const [adjustmentReason, setAdjustmentReason] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Filtered party list
  const filteredParties = useMemo(() => {
    return parties.filter((p) => p.type === partyType || p.type === "both");
  }, [parties, partyType]);

  const selectedParty = parties.find((p) => p.id === partyId);
  const numericAmount = parseFloat(amount) || 0;

  const handleSave = async (printPdf = false) => {
    if (direction !== "transfer" && !partyId) {
      toast.error("Please select a party");
      return;
    }

    if (numericAmount <= 0) {
      toast.error("Amount must be greater than zero");
      return;
    }

    setIsSubmitting(true);
    const voucherNo = `${direction === "received" ? "CRV" : "CPV"}-${Date.now().toString().slice(-6)}`;

    try {
      if (direction === "transfer") {
        // Record account transfer
        await (supabase as any).rpc("record_transfer", {
          p_from_account_id: null,
          p_to_account_id: null,
          p_amount: numericAmount,
          p_date: voucherDate,
          p_reference_no: referenceNo || null,
          p_notes: notes || "Account transfer",
        });
      } else {
        // Record payment voucher
        const { error } = await (supabase as any).rpc("save_payment_voucher", {
          p_direction: direction,
          p_amount: numericAmount,
          p_payment_mode: mode,
          p_account_id: null,
          p_party_id: partyId,
          p_voucher_no: voucherNo,
          p_voucher_date: voucherDate,
          p_reference_no: referenceNo || null,
          p_is_adjustment: isAdjustment,
          p_adjustment_reason: adjustmentReason || null,
          p_notes: notes || null,
        });

        if (error) {
          // Fallback to record_payment
          await (supabase as any).rpc("record_payment", {
            p_direction: direction === "received" ? "in" : "out",
            p_amount: numericAmount,
            p_account_id: null,
            p_party_id: partyId,
            p_party_type: partyType,
            p_date: voucherDate,
            p_method: mode,
            p_reference_no: referenceNo || null,
            p_notes: notes || null,
          });
        }
      }

      toast.success("Payment voucher recorded successfully");

      if (printPdf) {
        const pdfData: VoucherPdfData = {
          voucherNo,
          voucherDate,
          direction: direction === "transfer" ? "received" : direction,
          paymentMode: mode,
          partyName: selectedParty?.name || "Direct Party",
          partyPhone: selectedParty?.phone,
          amount: numericAmount,
          accountName: mode === "cash" ? "Cash Account" : "Bank Account",
          referenceNo: referenceNo || undefined,
          notes: notes || undefined,
          isAdjustment,
          agency: {
            name: agency?.name,
            phone: agency?.contact_info,
          },
        };
        generateVoucherPdf(pdfData);
      }

      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to record payment voucher");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-[96vw] h-[92vh] max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="shrink-0 pb-2 border-b">
          <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            Payment Voucher
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-4 py-2">
          {/* Column 1: Direction & Mode */}
          <div className="lg:col-span-4 flex flex-col gap-3 min-h-0">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Transaction Direction
              </div>

              {/* Toggle 1: Direction (Received / Paid / Transfer) */}
              <div className="grid grid-cols-3 gap-1 bg-muted/60 p-1 rounded-xl border">
                <button
                  type="button"
                  onClick={() => setDirection("received")}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    direction === "received"
                      ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  Received
                </button>
                <button
                  type="button"
                  onClick={() => setDirection("paid")}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    direction === "paid"
                      ? "bg-white dark:bg-slate-900 text-red-700 dark:text-red-400 shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  Paid
                </button>
                <button
                  type="button"
                  onClick={() => setDirection("transfer")}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    direction === "transfer"
                      ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  Transfer
                </button>
              </div>

              {/* Payment Mode */}
              <div>
                <Label className="text-xs font-semibold">Payment Mode</Label>
                <div className="grid grid-cols-2 gap-1 bg-muted/60 p-1 rounded-lg border mt-1">
                  <button
                    type="button"
                    onClick={() => setMode("cash")}
                    className={`py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                      mode === "cash" ? "bg-white dark:bg-slate-900 shadow-sm font-semibold" : "text-muted-foreground"
                    }`}
                  >
                    Cash in Hand
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("bank")}
                    className={`py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                      mode === "bank" ? "bg-white dark:bg-slate-900 shadow-sm font-semibold" : "text-muted-foreground"
                    }`}
                  >
                    Bank Account
                  </button>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">Voucher Date</Label>
                <Input
                  type="date"
                  value={voucherDate}
                  onChange={(e) => setVoucherDate(e.target.value)}
                  className="h-9 text-xs mt-1"
                />
              </div>
            </div>
          </div>

          {/* Column 2: Party Selection */}
          <div className="lg:col-span-4 flex flex-col gap-3 min-h-0">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Party / Account Ledger
              </div>

              {direction !== "transfer" ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Party Type</Label>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setPartyType("client")}
                        className={`font-semibold cursor-pointer ${
                          partyType === "client" ? "text-teal-600 underline" : "text-muted-foreground"
                        }`}
                      >
                        Client
                      </button>
                      <span className="text-muted-foreground">/</span>
                      <button
                        type="button"
                        onClick={() => setPartyType("vendor")}
                        className={`font-semibold cursor-pointer ${
                          partyType === "vendor" ? "text-teal-600 underline" : "text-muted-foreground"
                        }`}
                      >
                        Vendor
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold mb-1 block">Select Party</Label>
                    <Select value={partyId} onValueChange={setPartyId}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder={`Select ${partyType === "client" ? "Client" : "Vendor"}`} />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {filteredParties.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} {p.code ? `(${p.code})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedParty && (
                    <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800/60 text-xs flex justify-between items-center border">
                      <span className="text-muted-foreground font-medium">Current Net Balance:</span>
                      <span
                        className={`font-mono font-bold text-sm ${
                          selectedParty.current_balance > 0
                            ? "text-red-600"
                            : selectedParty.current_balance < 0
                            ? "text-emerald-600"
                            : "text-slate-600"
                        }`}
                      >
                        PKR {Math.abs(selectedParty.current_balance).toLocaleString()}{" "}
                        {selectedParty.current_balance > 0 ? "(DR)" : selectedParty.current_balance < 0 ? "(CR)" : ""}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs text-blue-700 dark:text-blue-300">
                  Transferring funds internally between cash in hand and company bank accounts.
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Amount, Reference & Notes */}
          <div className="lg:col-span-4 flex flex-col gap-3 min-h-0">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex-1 flex flex-col space-y-3">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Amount & Particulars
              </div>

              <div>
                <Label className="text-xs font-semibold">
                  Amount (PKR) <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="h-10 text-base font-mono font-bold text-right mt-1"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Cheque / Reference / Slip No</Label>
                <Input
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  placeholder="e.g. Chq# 48102 or Bank Ref"
                  className="h-8 text-xs font-mono mt-1"
                />
              </div>

              <div className="flex-1 flex flex-col space-y-1">
                <Label className="text-xs font-semibold">Description / Remarks</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Payment particulars..."
                  className="flex-1 min-h-[60px] text-xs resize-none"
                />
              </div>

              {/* Adjustment Toggle (E14 write-off adjustment) */}
              <div className="pt-1 border-t">
                <label className="flex items-center gap-2 text-xs cursor-pointer text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={isAdjustment}
                    onChange={(e) => setIsAdjustment(e.target.checked)}
                    className="rounded border-slate-300 text-teal-600"
                  />
                  Mark as write-off / discount adjustment
                </label>
                {isAdjustment && (
                  <Input
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                    placeholder="Reason for write-off adjustment"
                    className="h-8 text-xs mt-1.5"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-3 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={() => handleSave(true)}
              className="text-xs gap-1"
            >
              <Printer className="w-3.5 h-3.5" />
              Save & Print
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSubmitting}
              onClick={() => handleSave(false)}
              className="text-xs bg-[#0B192C] hover:bg-[#1E3E62] text-white"
            >
              {isSubmitting ? "Saving..." : "Save Voucher"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

