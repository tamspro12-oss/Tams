import { useState } from "react";
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

interface ClientPaymentDialogProps {
  client: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientPaymentDialog({ client, open, onOpenChange }: ClientPaymentDialogProps) {
  const { updateClient } = useClients();
  const { history, isLoading: historyLoading, addPaymentHistory } = useClientPaymentHistoryLocal(client?.id);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [bankName, setBankName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-primary" />
            Adjust Payment - {client.name}
          </DialogTitle>
          <DialogDescription>
            Add payment (+) or correct overpayment (-)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Payment Summary */}
          <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-muted">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total Amount</p>
              <p className="font-bold">₨ {totalReceivable.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Already Paid</p>
              <p className="font-bold text-success">₨ {currentPaid.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Remaining</p>
              <p className="font-bold text-warning">₨ {remaining.toLocaleString()}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payment">Adjustment Amount (₨)</Label>
              <div className="flex gap-2">
                <Input
                  id="payment"
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="+ to add, - to reduce"
                  required
                />
                {remaining > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePayFull}
                    className="shrink-0"
                  >
                    Pay Full
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <p className="text-xs text-muted-foreground flex-1">
                  Use positive (+) to add payment or negative (-) to correct mistakes
                </p>
              </div>
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
                <p className="text-sm font-medium mb-1">After this payment:</p>
                <p className="text-xs text-muted-foreground">
                  Total Paid: ₨ {(currentPaid + (parseFloat(paymentAmount) || 0)).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  Remaining: ₨ {(remaining - (parseFloat(paymentAmount) || 0)).toLocaleString()}
                </p>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  setPaymentAmount("");
                  setPaymentMode("cash");
                  setBankName("");
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !paymentAmount}>
                {isSubmitting ? "Updating..." : "Update Payment"}
              </Button>
            </div>
          </form>

          {/* Payment History Section */}
          <div className="mt-6 pt-6 border-t">
            <PaymentHistorySection 
              history={history} 
              isLoading={historyLoading}
              title="Payment History"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
