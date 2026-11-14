import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClients } from "@/hooks/useStorage";
import { useClientPaymentHistoryLocal } from "@/hooks/useLocalPaymentHistory";
import { supabase } from "@/integrations/supabase/client";
import { Banknote, Plus, Minus } from "lucide-react";
import { PaymentHistorySection } from "./PaymentHistorySection";
import { PaymentModeSelect } from "./PaymentModeSelect";
import { useFormKeyboardNav } from "@/hooks/useFormKeyboardNav";

interface ClientPaymentDialogProps {
  client: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientPaymentDialog({ client, open, onOpenChange }: ClientPaymentDialogProps) {
  const { updateClient } = useClients();
  const { history, isLoading: historyLoading, addPaymentHistory } = useClientPaymentHistoryLocal(client?.id);
  const formRef = useRef<HTMLFormElement>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [bankName, setBankName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useFormKeyboardNav({
    containerRef: formRef,
    enabled: open && Boolean(client),
    isDirty: Boolean(paymentAmount),
    onSave: () => formRef.current?.requestSubmit(),
    onCancel: () => onOpenChange(false),
    autoFocusFirst: true,
  });

  // Handle null client
  if (!client) {
    return null;
  }

  const currentPaid = Number(client.amount_paid) || 0;
  const totalReceivable = Number(client.selling_price) || 0;
  const remaining = totalReceivable - currentPaid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const additionalPayment = parseFloat(paymentAmount) || 0;
      const newTotalPaid = currentPaid + additionalPayment;

      // Determine payment status
      let paymentStatus = "Pending";
      let paymentType: "partial" | "full" = "partial";

      if (newTotalPaid >= totalReceivable) {
        paymentStatus = "Paid";
        paymentType = "full";
      } else if (newTotalPaid > 0) {
        paymentStatus = "Partial";
      }

      // Update client payment
      await updateClient.mutateAsync({
        id: client.id,
        client: {
          ...client,
          amount_paid: newTotalPaid,
          payment_status: paymentStatus,
        }
      });

      // Record payment history (only for positive payments)
      if (additionalPayment > 0) {
        await addPaymentHistory.mutateAsync({
          client_id: client.id,
          payment_amount: additionalPayment,
          payment_type: paymentType,
          payment_date: new Date().toISOString().split('T')[0],
          notes: `Payment of ₨${additionalPayment.toLocaleString()}`,
          payment_mode: paymentMode,
          bank_name: paymentMode === "bank" ? bankName : null,
        });

        // Sync into master transactions table
        try {
          await supabase.from("transactions").insert({
            agency_id: client.agency_id,
            date: new Date().toISOString().split("T")[0],
            type: "payment_in",
            party_id: client.id,
            party_type: "client",
            booking_id: client.id,
            debit: additionalPayment,
            credit: 0,
            method: paymentMode || "cash",
            reference_no: client.pnr,
            notes: `Payment for booking #${client.pnr || client.name}`,
          });
        } catch (e) {
          console.warn("Unified transactions sync notice:", e);
        }
      }

      onOpenChange(false);
      setPaymentAmount("");
      setPaymentMode("cash");
      setBankName("");
    } catch (error) {
      // Error handled by mutation
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayFull = () => {
    setPaymentAmount(remaining.toString());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-[96vw] max-w-[96vw] h-[92vh] max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden"
      >
        <DialogHeader className="shrink-0 pb-2 border-b">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Banknote className="w-5 h-5 text-primary" />
            Adjust Payment - {client.name}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Add payment (+) or correct overpayment (-)
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-5 py-2">
          {/* Left Column: Form & Calculations */}
          <div className="lg:col-span-6 flex flex-col gap-3 min-h-0">
            {/* Payment Summary */}
            <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-muted/60 border">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Amount</p>
                <p className="font-bold text-base">₨ {totalReceivable.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Already Paid</p>
                <p className="font-bold text-base text-success">₨ {currentPaid.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Remaining</p>
                <p className="font-bold text-base text-warning">₨ {remaining.toLocaleString()}</p>
              </div>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between space-y-3">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="payment" className="text-xs font-semibold">Adjustment Amount (₨)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="payment"
                      type="number"
                      step="0.01"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="+ to add, - to reduce"
                      className="h-9 text-sm"
                      required
                      data-required-message="Payment amount is required"
                    />
                    {remaining > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        tabIndex={-1}
                        onClick={handlePayFull}
                        className="shrink-0 h-9"
                      >
                        Pay Full
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Use positive (+) to add payment or negative (-) to correct mistakes
                  </p>
                </div>

                {/* Payment Mode - ADDITIVE FIELD */}
                <PaymentModeSelect
                  value={paymentMode}
                  onChange={setPaymentMode}
                  bankName={bankName}
                  onBankNameChange={setBankName}
                />

                {paymentAmount && (
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="text-xs font-semibold mb-1">After this payment:</p>
                    <p className="text-xs text-muted-foreground">
                      Total Paid: ₨ {(currentPaid + (parseFloat(paymentAmount) || 0)).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Remaining: ₨ {(remaining - (parseFloat(paymentAmount) || 0)).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  tabIndex={-1}
                  onClick={() => {
                    onOpenChange(false);
                    setPaymentAmount("");
                    setPaymentMode("cash");
                    setBankName("");
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" data-save-button="true" disabled={isSubmitting || !paymentAmount}>
                  {isSubmitting ? "Updating..." : "Update Payment"}
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
