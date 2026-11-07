import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Banknote, CheckCircle, ArrowDown, Clock, ShieldCheck, DollarSign } from "lucide-react";
import { B2BAgent } from "@/hooks/useB2BAgents";
import { useB2BBookings, B2BBooking, calculatePaymentStatus } from "@/hooks/useB2BBookings";
import { useB2BLedger } from "@/hooks/useB2BLedger";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface AgentLumpSumPaymentDialogProps {
  agent: B2BAgent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AgentLumpSumPaymentDialog({
  agent,
  open,
  onOpenChange,
  onSuccess,
}: AgentLumpSumPaymentDialogProps) {
  const [amount, setAmount] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<string>("cash");
  const [bankName, setBankName] = useState<string>("");
  const [entryDate, setEntryDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [remarks, setRemarks] = useState<string>("Lump sum payment received");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const { bookings, updateBooking } = useB2BBookings(agent?.id);
  const { ledgerEntries, addSplitPayment } = useB2BLedger(agent?.id);

  // Calculate outstanding balance for a specific booking
  const getBookingPaidAmount = (booking: B2BBooking): number => {
    const bookingRef = booking.pnr || booking.passenger_name;
    return ledgerEntries
      .filter(
        (e) =>
          e.entry_type === "credit" &&
          e.remarks?.includes(`[Booking: ${bookingRef}]`)
      )
      .reduce((sum, e) => sum + e.amount, 0);
  };

  const getBookingOutstanding = (booking: B2BBooking): number => {
    const serviceAmount = (booking.selling_price || 0) - (booking.commission_amount || 0);
    const paid = getBookingPaidAmount(booking);
    return Math.max(0, serviceAmount - paid);
  };

  // Pending bookings sorted by oldest first
  const pendingBookings = useMemo(() => {
    if (!bookings.length) return [];
    return bookings
      .filter((b) => getBookingOutstanding(b) > 0)
      .sort((a, b) => {
        const dateA = a.flight_date || a.created_at || "";
        const dateB = b.flight_date || b.created_at || "";
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      });
  }, [bookings, ledgerEntries]);

  const totalOutstandingAll = useMemo(() => {
    return pendingBookings.reduce((sum, b) => sum + getBookingOutstanding(b), 0);
  }, [pendingBookings]);

  // Allocation preview: allocates amount to oldest pending first
  const allocationPreview = useMemo(() => {
    const totalPayment = parseFloat(amount) || 0;
    let remaining = totalPayment;

    return pendingBookings.map((b) => {
      const outstanding = getBookingOutstanding(b);
      const allocated = Math.min(outstanding, Math.max(0, remaining));
      remaining -= allocated;
      const statusAfter =
        allocated >= outstanding
          ? "paid"
          : allocated > 0
          ? "partial"
          : "pending";

      return {
        booking: b,
        outstanding,
        allocated,
        remainingAfter: Math.max(0, outstanding - allocated),
        statusAfter,
      };
    });
  }, [pendingBookings, amount]);

  const totalAllocated = useMemo(() => {
    return allocationPreview.reduce((sum, a) => sum + a.allocated, 0);
  }, [allocationPreview]);

  const unallocatedAmount = useMemo(() => {
    const total = parseFloat(amount) || 0;
    return Math.max(0, total - totalAllocated);
  }, [amount, totalAllocated]);

  const handlePayAll = () => {
    setAmount(totalOutstandingAll.toString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const paymentVal = parseFloat(amount) || 0;

    if (paymentVal <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    if (!agent) return;

    setIsSubmitting(true);

    try {
      // Build split payment allocations
      const validAllocations = allocationPreview
        .filter((a) => a.allocated > 0)
        .map((a) => ({
          bookingId: a.booking.id,
          bookingRef: a.booking.pnr || a.booking.passenger_name,
          amount: a.allocated,
        }));

      // Post to ledger using addSplitPayment
      await addSplitPayment.mutateAsync({
        agent_id: agent.id,
        total_amount: paymentVal,
        entry_date: entryDate,
        remarks: (paymentMode === "bank" && bankName ? `[${bankName}] ` : "") + (remarks || `Lump sum allocated to ${validAllocations.length} bookings`),
        allocations: validAllocations,
      });

      // Update payment_status on allocated bookings
      for (const a of allocationPreview) {
        if (a.allocated > 0) {
          await updateBooking.mutateAsync({
            id: a.booking.id,
            booking: {
              ...a.booking,
              payment_status: a.statusAfter,
            },
          });
        }
      }

      // Sync into master transactions table
      try {
        await supabase.from("transactions").insert({
          agency_id: agent.agency_id,
          date: entryDate,
          type: "payment_in",
          party_id: agent.id,
          party_type: "agent",
          debit: paymentVal,
          credit: 0,
          method: paymentMode || "cash",
          notes: remarks || `Lump sum allocated to ${validAllocations.length} bookings`,
        });
      } catch (e) {
        console.warn("Unified transactions sync notice:", e);
      }

      toast.success(
        `PKR ${paymentVal.toLocaleString()} received and allocated to ${validAllocations.length} booking(s)!`
      );
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.message || "Failed to process lump sum payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open || !agent) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b bg-muted/40 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                <Banknote className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  Receive Lump Sum Payment
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Agent: <b>{agent.agent_name}</b> {agent.business_name && `(${agent.business_name})`}
                </DialogDescription>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-muted-foreground block">
                Total Due
              </span>
              <span className="text-sm font-bold text-destructive">
                PKR {totalOutstandingAll.toLocaleString()}
              </span>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Amount and Auto Allocate */}
          <div className="bg-muted/20 border rounded-lg p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">
                Payment Amount (PKR) <span className="text-red-500">*</span>
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handlePayAll}
                className="h-6 text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold"
              >
                Pay Full Balance (PKR {totalOutstandingAll.toLocaleString()})
              </Button>
            </div>
            <Input
              type="number"
              min="1"
              step="any"
              placeholder="e.g. 50000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-9 text-base font-bold text-emerald-600"
              autoFocus
              required
            />
          </div>

          {/* Payment Mode, Bank, Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <Label className="text-xs font-semibold mb-1 block">Payment Mode</Label>
              <Select value={paymentMode} onValueChange={setPaymentMode}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold mb-1 block">Entry Date</Label>
              <Input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            {paymentMode === "bank" ? (
              <div>
                <Label className="text-xs font-semibold mb-1 block">Bank Name</Label>
                <Input
                  placeholder="Meezan, HBL..."
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            ) : (
              <div>
                <Label className="text-xs font-semibold mb-1 block">Remarks</Label>
                <Input
                  placeholder="Optional note"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            )}
          </div>

          {/* Allocation Preview Table */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-muted-foreground text-[11px]">
              <span className="font-semibold uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3 text-primary" />
                Automatic FIFO Allocation (Oldest Pending First)
              </span>
              <span>{pendingBookings.length} Pending Bookings</span>
            </div>

            <div className="border rounded-md overflow-hidden bg-background">
              <div className="max-h-[190px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 text-muted-foreground sticky top-0 border-b">
                    <tr>
                      <th className="p-1.5 text-left">Date</th>
                      <th className="p-1.5 text-left">Passenger / PNR</th>
                      <th className="p-1.5 text-right">Due</th>
                      <th className="p-1.5 text-right">Allocated</th>
                      <th className="p-1.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {allocationPreview.length > 0 ? (
                      allocationPreview.map((item, idx) => (
                        <tr
                          key={item.booking.id}
                          className={cn(
                            "hover:bg-muted/20",
                            item.allocated > 0 && "bg-emerald-500/5"
                          )}
                        >
                          <td className="p-1.5 text-muted-foreground whitespace-nowrap">
                            {item.booking.flight_date || item.booking.created_at?.split("T")[0] || "-"}
                          </td>
                          <td className="p-1.5">
                            <span className="font-semibold block truncate max-w-[140px]">
                              {item.booking.passenger_name}
                            </span>
                            {item.booking.pnr && (
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {item.booking.pnr}
                              </span>
                            )}
                          </td>
                          <td className="p-1.5 text-right font-medium">
                            PKR {item.outstanding.toLocaleString()}
                          </td>
                          <td className="p-1.5 text-right font-bold text-emerald-600">
                            {item.allocated > 0 ? `PKR ${item.allocated.toLocaleString()}` : "-"}
                          </td>
                          <td className="p-1.5 text-center">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] h-4.5 px-1.5 capitalize",
                                item.statusAfter === "paid"
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                  : item.statusAfter === "partial"
                                  ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                                  : "text-muted-foreground"
                              )}
                            >
                              {item.statusAfter}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-muted-foreground italic">
                          No pending bookings to settle
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {unallocatedAmount > 0 && (
              <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded text-[11px] text-amber-800 dark:text-amber-200 flex items-center justify-between">
                <span>Unallocated surplus (credits agent balance):</span>
                <span className="font-bold">PKR {unallocatedAmount.toLocaleString()}</span>
              </div>
            )}
          </div>
        </form>

        <DialogFooter className="p-3 border-t bg-muted/40 shrink-0 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="text-xs"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting || (parseFloat(amount) || 0) <= 0}
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Confirm & Allocate Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

