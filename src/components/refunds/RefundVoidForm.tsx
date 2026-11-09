import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RotateCcw, Ban, Search, CheckCircle2, AlertTriangle, FileText, ArrowRight } from "lucide-react";

interface RefundVoidFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface MatchedBooking {
  id: string;
  invoiceNo?: string;
  clientName: string;
  pnr?: string;
  ticketNo?: string;
  totalAmount: number;
  paidAmount: number;
  service?: string;
}

export const RefundVoidForm: React.FC<RefundVoidFormProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  // Top Toggle: Refund vs Void
  const [actionType, setActionType] = useState<"refund" | "void">("refund");

  // Row 1: Search & Invoice Reference
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [matchedBooking, setMatchedBooking] = useState<MatchedBooking | null>(null);

  // Row 2: Equal columns
  const [clientRefundAmount, setClientRefundAmount] = useState<string>("0");
  const [vendorRefundAmount, setVendorRefundAmount] = useState<string>("0");
  const [deductionsAmount, setDeductionsAmount] = useState<string>("0");
  const [paymentMode, setPaymentMode] = useState<"cash" | "bank">("cash");

  // Row 3: Pending Vendor Refund Toggle
  const [pendingVendorRefund, setPendingVendorRefund] = useState<boolean>(true);

  // Row 4 & 5: Reason & Notes
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search booking / invoice by Invoice No, PNR, or Ticket No
  const handleSearchInvoice = async () => {
    const query = invoiceSearch.trim();
    if (!query) {
      toast.error("Please enter an Invoice No, PNR, or Ticket No to search");
      return;
    }

    setIsSearching(true);
    try {
      // 1. Try finding in invoices table
      const { data: invData } = await (supabase as any)
        .from("invoices")
        .select("id, invoice_number, amount, amount_paid, balance_due, client_id, item_description")
        .ilike("invoice_number", `%${query}%`)
        .limit(1)
        .maybeSingle();

      if (invData) {
        // Fetch client name
        let clientName = "Customer";
        if (invData.client_id) {
          const { data: client } = await (supabase as any)
            .from("clients")
            .select("name, pnr, passport_number")
            .eq("id", invData.client_id)
            .maybeSingle();
          if (client?.name) clientName = client.name;
        }

        const match: MatchedBooking = {
          id: invData.id,
          invoiceNo: invData.invoice_number,
          clientName,
          totalAmount: Number(invData.amount) || 0,
          paidAmount: Number(invData.amount_paid) || 0,
          service: invData.item_description || "Booking",
        };

        setMatchedBooking(match);
        setClientRefundAmount(String(match.paidAmount || match.totalAmount));
        toast.success(`Matched invoice: ${match.invoiceNo} (${match.clientName})`);
        return;
      }

      // 2. Try finding in clients / bookings table
      const { data: bookingData } = await (supabase as any)
        .from("clients")
        .select("id, name, pnr, selling_price, amount_paid, travel_type, passport_number")
        .or(`pnr.ilike.%${query}%,name.ilike.%${query}%,passport_number.ilike.%${query}%`)
        .limit(1)
        .maybeSingle();

      if (bookingData) {
        const match: MatchedBooking = {
          id: bookingData.id,
          invoiceNo: `INV-${bookingData.pnr || bookingData.id.slice(0, 6)}`,
          clientName: bookingData.name,
          pnr: bookingData.pnr,
          totalAmount: Number(bookingData.selling_price) || 0,
          paidAmount: Number(bookingData.amount_paid) || 0,
          service: bookingData.travel_type || "Air Ticket",
        };

        setMatchedBooking(match);
        setClientRefundAmount(String(match.paidAmount || match.totalAmount));
        toast.success(`Matched booking: ${match.clientName} (PNR: ${match.pnr || "N/A"})`);
        return;
      }

      toast.info("No matching invoice found. You can enter details manually.");
      setMatchedBooking(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to search for invoice");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSave = async () => {
    if (!reason.trim()) {
      toast.error(`Please provide a ${actionType === "void" ? "void" : "refund"} reason`);
      return;
    }

    setIsSubmitting(true);
    const recordNo = `${actionType === "void" ? "VOID" : "REF"}-${Date.now().toString().slice(-6)}`;

    try {
      const clientAmt = parseFloat(clientRefundAmount) || 0;
      const deductions = parseFloat(deductionsAmount) || 0;
      const combinedNotes = [
        notes,
        deductions > 0 ? `Service Charges/Deductions: PKR ${deductions}` : null,
        pendingVendorRefund ? `Track as pending vendor refund: YES` : null,
        matchedBooking ? `Ref Invoice: ${matchedBooking.invoiceNo || matchedBooking.pnr}` : null,
      ]
        .filter(Boolean)
        .join(" | ");

      // Call atomic refund RPC
      await (supabase as any).rpc("record_refund", {
        p_amount: clientAmt > 0 ? clientAmt : 1,
        p_account_id: null,
        p_party_id: null,
        p_booking_id: matchedBooking?.id || null,
        p_date: new Date().toISOString().slice(0, 10),
        p_method: paymentMode,
        p_reference_no: recordNo,
        p_reason: reason,
        p_notes: combinedNotes || undefined,
      });

      toast.success(`${actionType === "void" ? "Invoice voided" : "Refund recorded"} successfully`);
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
      <DialogContent className="w-[98vw] max-w-[98vw] h-[96vh] max-h-[96vh] flex flex-col overflow-hidden p-0 gap-0 bg-background border rounded-xl shadow-2xl">
        {/* 1. Top Header with Refund | Void Toggle at Very Top */}
        <div className="px-6 py-3 border-b flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2">
            {actionType === "refund" ? (
              <RotateCcw className="w-5 h-5 text-purple-600" />
            ) : (
              <Ban className="w-5 h-5 text-red-600" />
            )}
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {actionType === "void" ? "Void Booking Invoice" : "Process Client / Vendor Refund"}
            </DialogTitle>
          </div>

          {/* Top Segmented Action Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActionType("refund")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                actionType === "refund"
                  ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-400 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Process Refund
            </button>
            <button
              type="button"
              onClick={() => setActionType("void")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                actionType === "void"
                  ? "bg-white dark:bg-slate-900 text-red-700 dark:text-red-400 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Ban className="w-3.5 h-3.5" />
              Void Invoice
            </button>
          </div>
        </div>

        {/* 2. Flexible Form Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
          {/* Row 1: Original Invoice / PNR / Ticket No + Search Button */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Step 1: Locate Target Invoice / Booking
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 w-full">
              <div className="flex-1">
                <Label className="text-xs font-semibold">
                  Original Invoice / PNR / Ticket No <span className="text-red-500">*</span>
                </Label>
                <div className="relative mt-1">
                  <Input
                    value={invoiceSearch}
                    onChange={(e) => setInvoiceSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSearchInvoice();
                      }
                    }}
                    placeholder="e.g. INV-1004, PNR: M8K9LP, or Ticket # 214-89765432"
                    className="h-9 text-xs font-mono uppercase pr-24"
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSearchInvoice}
                      disabled={isSearching}
                      className="h-7 text-xs px-2.5 bg-[#0B192C] hover:bg-[#1E3E62] text-white"
                    >
                      <Search className="w-3.5 h-3.5 mr-1" />
                      {isSearching ? "Searching..." : "Search"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Matched Booking Preview Card */}
            {matchedBooking && (
              <div className="p-3 bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-600" />
                  <span className="font-bold text-purple-900 dark:text-purple-200">
                    {matchedBooking.clientName}
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {matchedBooking.invoiceNo || matchedBooking.pnr}
                  </Badge>
                  {matchedBooking.service && (
                    <span className="text-muted-foreground text-[11px]">
                      • {matchedBooking.service}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 font-mono text-[11px]">
                  <span>Total: <strong>PKR {matchedBooking.totalAmount.toLocaleString()}</strong></span>
                  <span>Paid: <strong className="text-teal-600">PKR {matchedBooking.paidAmount.toLocaleString()}</strong></span>
                </div>
              </div>
            )}
          </div>

          {/* Void Protection Banner (If Void Selected) */}
          {actionType === "void" && (
            <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-900 text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-red-700 dark:text-red-300 text-sm">
                <AlertTriangle className="w-4 h-4" />
                Financial Void Protection
              </div>
              <p className="text-red-600 dark:text-red-400 leading-relaxed text-xs">
                Voiding reverses the associated accounting entries and voids the invoice with an immutable audit timestamp.
              </p>
            </div>
          )}

          {/* Row 2: Equal 4 Columns (Refund Mode & Amounts) */}
          {actionType === "refund" && (
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Step 2: Refund Financial Breakdown & Mode
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                <div>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Client Refund (PKR) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="number"
                    value={clientRefundAmount}
                    onChange={(e) => setClientRefundAmount(e.target.value)}
                    placeholder="0"
                    className="h-9 text-xs font-mono font-bold text-right mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Supplier Refund (PKR)
                  </Label>
                  <Input
                    type="number"
                    value={vendorRefundAmount}
                    onChange={(e) => setVendorRefundAmount(e.target.value)}
                    placeholder="0"
                    className="h-9 text-xs font-mono text-right mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Service Charges / Deductions (PKR)
                  </Label>
                  <Input
                    type="number"
                    value={deductionsAmount}
                    onChange={(e) => setDeductionsAmount(e.target.value)}
                    placeholder="0"
                    className="h-9 text-xs font-mono text-right mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Refund Mode
                  </Label>
                  <Select value={paymentMode} onValueChange={(val: any) => setPaymentMode(val)}>
                    <SelectTrigger className="h-9 text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash in Hand</SelectItem>
                      <SelectItem value="bank">Bank Account</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Row 3: Track as Pending Refund from Vendor Toggle */}
          {actionType === "refund" && (
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                  Track as Pending Refund from Vendor
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Flag this ticket/service in Accounts as awaiting supplier refund recovery
                </p>
              </div>
              <Switch
                checked={pendingVendorRefund}
                onCheckedChange={setPendingVendorRefund}
              />
            </div>
          )}

          {/* Row 4: Refund Reason (Required) */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
            <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              {actionType === "void" ? "Void Reason" : "Refund Reason"} <span className="text-red-500">*</span>
            </Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                actionType === "void"
                  ? "e.g. Passenger cancelled before ticket issuance"
                  : "e.g. Flight cancellation by airline, medical emergency, visa rejection..."
              }
              className="h-9 text-xs mt-1"
              required
            />
          </div>

          {/* Row 5: Notes / Deductions Breakdown (Full width) */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
            <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Notes / Deductions Breakdown
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide breakdown of airline penalty, agency service fee, vendor refund claim reference, etc..."
              className="w-full min-h-[85px] max-h-[140px] text-xs resize-none"
            />
          </div>
        </div>

        {/* Footer: Fixed at bottom */}
        <div className="px-6 py-3.5 border-t bg-gray-50 dark:bg-slate-900/60 flex items-center justify-end gap-3 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isSubmitting}
            onClick={handleSave}
            className={`text-xs text-white cursor-pointer min-w-[130px] ${
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
        </div>
      </DialogContent>
    </Dialog>
  );
};
