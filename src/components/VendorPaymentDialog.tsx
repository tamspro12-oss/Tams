import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useVendors } from "@/hooks/useStorage";
import { useVendorPaymentHistoryLocal } from "@/hooks/useLocalPaymentHistory";
import { useAgency } from "@/hooks/useAgency";
import { supabase } from "@/integrations/supabase/client";
import { Banknote, CheckCircle2 } from "lucide-react";
import { PaymentHistorySection } from "./PaymentHistorySection";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { PaymentModeSelect } from "./PaymentModeSelect";

interface VendorPaymentDialogProps {
  vendor: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VendorPaymentDialog({ vendor, open, onOpenChange }: VendorPaymentDialogProps) {
  const { updateVendor } = useVendors();
  const { history, isLoading: historyLoading, addPaymentHistory } = useVendorPaymentHistoryLocal(vendor?.id);
  const { data: agency } = useAgency();
  const { toast } = useToast();
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [bankName, setBankName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentPaid = Number(vendor.amount_paid) || 0;
  const totalPayable = vendor.totalPayable || 0;
  const remaining = totalPayable - currentPaid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agency?.id) {
      toast({
        title: "Error",
        description: "Agency information not found",
        variant: "destructive",
      });
      return;
    }

    // Validate input - allow both positive and negative values
    const additionalPayment = parseFloat(paymentAmount);

    if (isNaN(additionalPayment) || additionalPayment === 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount (positive to add, negative to adjust)",
        variant: "destructive",
      });
      return;
    }

    // For positive payments, check if it exceeds remaining balance
    if (additionalPayment > 0 && additionalPayment > remaining) {
      toast({
        title: "Amount Too Large",
        description: `Payment amount cannot exceed remaining balance of ₨${remaining.toLocaleString()}`,
        variant: "destructive",
      });
      return;
    }

    // For negative adjustments, check if it would make total paid negative
    const projectedTotal = currentPaid + additionalPayment;
    if (projectedTotal < 0) {
      toast({
        title: "Invalid Adjustment",
        description: `Adjustment would result in negative paid amount. Current paid: ₨${currentPaid.toLocaleString()}`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const newTotalPaid = Math.max(0, currentPaid + additionalPayment);

      // Calculate payment status based on amounts
      let paymentStatus = "Pending";
      let paymentType: "partial" | "full" = "partial";

      if (newTotalPaid >= totalPayable && totalPayable > 0) {
        paymentStatus = "Paid";
        paymentType = "full";
      } else if (newTotalPaid > 0) {
        paymentStatus = "Partial";
      }

      // Determine note based on positive or negative amount
      const noteText = additionalPayment >= 0
        ? `Payment of ₨${additionalPayment.toLocaleString()}`
        : `Adjustment: ₨${additionalPayment.toLocaleString()} (correction/reversal)`;

      // First record payment history (stores both positive and negative)
      await addPaymentHistory.mutateAsync({
        vendor_id: vendor.id,
        agency_id: agency.id,
        payment_amount: additionalPayment,
        payment_type: paymentType,
        payment_date: new Date().toISOString().split('T')[0],
        notes: noteText,
        payment_mode: paymentMode,
        bank_name: paymentMode === "bank" ? bankName : null,
      });

      // Then update vendor totals
      await updateVendor.mutateAsync({
        id: vendor.id,
        vendor: {
          amount_paid: newTotalPaid,
          payment_status: paymentStatus,
        }
      });

      // Sync into master transactions table
      try {
        await supabase.from("transactions").insert({
          agency_id: agency.id,
          date: new Date().toISOString().split("T")[0],
          type: "payment_out",
          party_id: vendor.id,
          party_type: "vendor",
          debit: 0,
          credit: additionalPayment,
          method: paymentMode || "cash",
          notes: noteText,
        });
      } catch (e) {
        console.warn("Unified transactions sync notice:", e);
      }

      toast({
        title: "Success",
        description: additionalPayment >= 0
          ? "Vendor payment recorded successfully"
          : "Payment adjustment recorded successfully",
      });

      setPaymentAmount("");
      setPaymentMode("cash");
      setBankName("");
      onOpenChange(false);
    } catch (error: any) {
      console.error('Vendor payment error:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to record payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayFull = () => {
    if (remaining > 0) {
      setPaymentAmount(remaining.toFixed(2));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-[96vw] h-[92vh] max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="shrink-0 pb-2 border-b">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Banknote className="w-5 h-5 text-primary" />
            Record Payment - {vendor.name}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Record payment received or adjust vendor payment balance
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-5 py-2">
          {/* Left Column: Form & Calculations */}
          <div className="lg:col-span-6 flex flex-col gap-3 min-h-0">
            {/* Payment Summary */}
            <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-muted/50 border">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Total Payable</p>
                <p className="text-base font-bold">₨ {totalPayable.toLocaleString()}</p>
              </div>
              <div className="text-center border-l border-r">
                <p className="text-xs text-muted-foreground mb-1">Already Paid</p>
                <p className="text-base font-bold text-green-600">₨ {currentPaid.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Remaining</p>
                <p className="text-base font-bold text-orange-600">₨ {remaining.toLocaleString()}</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between space-y-3">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="payment" className="text-xs font-semibold">Payment Amount (₨)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="payment"
                      type="number"
                      step="0.01"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="e.g., 5000 or -500"
                      className="h-9 text-sm"
                      required
                    />
                    {remaining > 0 && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handlePayFull}
                        className="shrink-0 h-9 px-4"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1.5" />
                        Pay Full
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    <span className="text-green-600 font-medium">+ve</span> to add payment | <span className="text-orange-600 font-medium">-ve</span> to adjust/reverse
                  </p>
                </div>

                {/* Payment Mode - ADDITIVE FIELD */}
                <PaymentModeSelect
                  value={paymentMode}
                  onChange={setPaymentMode}
                  bankName={bankName}
                  onBankNameChange={setBankName}
                />

                {paymentAmount && parseFloat(paymentAmount) !== 0 && (
                  <div className={`p-3 rounded-lg border ${parseFloat(paymentAmount) >= 0 ? 'bg-primary/5 border-primary/20' : 'bg-orange-50 border-orange-200 dark:bg-orange-900/10 dark:border-orange-800/30'}`}>
                    <p className="text-xs font-semibold mb-1.5 flex items-center gap-1.5">
                      <CheckCircle2 className={`w-3.5 h-3.5 ${parseFloat(paymentAmount) >= 0 ? 'text-primary' : 'text-orange-600'}`} />
                      {parseFloat(paymentAmount) >= 0 ? 'Payment Preview:' : 'Adjustment Preview:'}
                    </p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Current Total Paid:</span>
                        <span className="font-medium">₨ {currentPaid.toLocaleString()}</span>
                      </div>
                      <div className={`flex justify-between text-xs font-semibold ${parseFloat(paymentAmount) >= 0 ? 'text-primary' : 'text-orange-600'}`}>
                        <span>{parseFloat(paymentAmount) >= 0 ? 'Payment Amount:' : 'Adjustment:'}</span>
                        <span>₨ {(parseFloat(paymentAmount) || 0).toLocaleString()}</span>
                      </div>
                      <Separator className="my-1.5" />
                      <div className="flex justify-between text-xs font-bold">
                        <span>New Total Paid:</span>
                        <span className={Math.max(0, currentPaid + (parseFloat(paymentAmount) || 0)) > currentPaid ? 'text-green-600' : 'text-orange-600'}>
                          ₨ {Math.max(0, currentPaid + (parseFloat(paymentAmount) || 0)).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs font-bold">
                        <span>Remaining Balance:</span>
                        <span className="text-orange-600">₨ {Math.max(0, totalPayable - Math.max(0, currentPaid + (parseFloat(paymentAmount) || 0))).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    setPaymentAmount("");
                    setPaymentMode("cash");
                    setBankName("");
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting || !paymentAmount || parseFloat(paymentAmount) === 0}
                  className={`min-w-[140px] ${paymentAmount && parseFloat(paymentAmount) < 0 ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
                >
                  {isSubmitting ? (
                    "Processing..."
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      {paymentAmount && parseFloat(paymentAmount) < 0 ? 'Record Adjustment' : 'Record Payment'}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>

          {/* Right Column: Payment History */}
          <div className="lg:col-span-6 flex flex-col min-h-0 bg-muted/20 rounded-xl border p-3">
            <div className="flex-1 min-h-0 overflow-y-auto">
              <PaymentHistorySection
                history={history}
                isLoading={historyLoading}
                title="Payment History"
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
