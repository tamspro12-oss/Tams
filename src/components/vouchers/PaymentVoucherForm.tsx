import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useParties, Party } from "@/hooks/useParties";
import { useAgency } from "@/hooks/useAgency";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { LockedDateField } from "@/components/ui/LockedDateField";
import { UniversalPartySelect } from "@/components/parties/UniversalPartySelect";
import { AgencyBankSelect } from "@/components/banks/AgencyBankSelect";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CopyValue } from "@/components/ui/CopyValue";
import { cleanPastedSearch } from "@/lib/searchUtils";
import {
  Search,
  CheckCircle2,
  Lock,
  CreditCard,
} from "lucide-react";

interface PaymentVoucherFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface MatchedInvoice {
  id: string;
  invoiceNo: string;
  clientName: string;
  clientId?: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  pnr?: string;
}

export const PaymentVoucherForm: React.FC<PaymentVoucherFormProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const { parties } = useParties();
  const { data: agency } = useAgency();
  const { data: currentAgencyId } = useCurrentAgencyId();

  // Line 1: Voucher Date | Payment Mode | Direction | Amount (PKR) * | Cheque / Reference No
  const [voucherDate, setVoucherDate] = useState<string>(
    () => new Date().toISOString().slice(0, 10)
  );
  const [paymentMode, setPaymentMode] = useState<"cash" | "bank">("cash");
  const [direction, setDirection] = useState<"received" | "paid">("received");
  const [amount, setAmount] = useState<string>("0");
  const [referenceNo, setReferenceNo] = useState<string>("");

  // Bank selection (strictly agency bank)
  const [selectedBank, setSelectedBank] = useState<string>("");

  // Invoice & Party Linking
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [matchedInvoice, setMatchedInvoice] = useState<MatchedInvoice | null>(null);
  const [partyId, setPartyId] = useState<string>("");

  // Remarks & Write-off
  const [notes, setNotes] = useState<string>("");
  const [isAdjustment, setIsAdjustment] = useState<boolean>(false);
  const [adjustmentReason, setAdjustmentReason] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Auto Voucher Number
  const [voucherSeq, setVoucherSeq] = useState<string>("1001");

  // Generate sequence on open or direction change
  const fetchNextNumber = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("preview_next_number", {
        p_counter_type: "voucher",
      });
      if (!error && data) {
        const match = String(data).match(/\d+$/);
        if (match) {
          setVoucherSeq(match[0]);
          return;
        }
      }
    } catch {}
    const randomSeq = String(Math.floor(1000 + Math.random() * 9000));
    setVoucherSeq(randomSeq);
  }, []);

  useEffect(() => {
    if (open) {
      fetchNextNumber();
    }
  }, [open, direction, fetchNextNumber]);

  // Fetch recent vouchers for compact sheet below form
  const { data: recentVouchers = [], refetch: refetchRecentVouchers } = useQuery({
    queryKey: ["recent_payment_vouchers", currentAgencyId],
    queryFn: async () => {
      let query = (supabase as any)
        .from("payment_vouchers")
        .select("*, party:parties!party_id(name)")
        .order("voucher_date", { ascending: false })
        .limit(5);

      if (currentAgencyId) {
        query = query.eq("agency_id", currentAgencyId);
      }

      const { data } = await query;
      if (data && data.length > 0) return data;

      // Fallback: read from transactions table
      let txQuery = (supabase as any)
        .from("transactions")
        .select("*")
        .in("type", ["payment_in", "payment_out"])
        .order("date", { ascending: false })
        .limit(5);

      if (currentAgencyId) {
        txQuery = txQuery.eq("agency_id", currentAgencyId);
      }

      const { data: txData } = await txQuery;

      return (txData || []).map((t: any) => ({
        id: t.id,
        voucher_no: t.reference_no || `VCH-${t.id.slice(0, 4).toUpperCase()}`,
        voucher_date: t.date,
        direction: t.type === "payment_in" ? "received" : "paid",
        payment_mode: t.method || "cash",
        amount: t.debit > 0 ? t.debit : t.credit,
        party: { name: t.notes || "Party" },
      }));
    },
    enabled: open,
  });

  const voucherPrefix = direction === "received" ? "CRV" : "CPV";
  const autoVoucherNo = `${voucherPrefix}-${voucherSeq}`;

  const typeLabel =
    direction === "received"
      ? "Cash / Bank Receipt Voucher (CRV)"
      : "Cash / Bank Payment Voucher (CPV)";

  const numericAmount = parseFloat(amount) || 0;

  // Search invoice
  const executeSearchInvoice = async (queryText?: string) => {
    const q = (queryText ?? searchQuery).trim();
    if (!q) {
      toast.error("Please enter an Invoice No, Ticket No, or PNR");
      return;
    }

    setIsSearching(true);
    try {
      // 1. booking_invoices table
      let bQuery = (supabase as any)
        .from("booking_invoices")
        .select("id, invoice_no, client_amount, paid_amount, party_id, pnr, party:parties!party_id(name)")
        .or(`invoice_no.ilike.%${q}%,pnr.ilike.%${q}%,ticket_no.ilike.%${q}%`)
        .limit(1)
        .maybeSingle();

      if (currentAgencyId) {
        bQuery = bQuery.eq("agency_id", currentAgencyId);
      }

      const { data: bData } = await bQuery;

      if (bData) {
        const total = Number(bData.client_amount) || 0;
        const paid = Number(bData.paid_amount) || 0;
        const remaining = total - paid > 0 ? total - paid : 0;

        const match: MatchedInvoice = {
          id: bData.id,
          invoiceNo: bData.invoice_no,
          clientName: bData.party?.name || "Customer",
          clientId: bData.party_id,
          totalAmount: total,
          paidAmount: paid,
          remainingAmount: remaining,
          pnr: bData.pnr || undefined,
        };

        setMatchedInvoice(match);
        if (bData.party_id) {
          setPartyId(bData.party_id);
        }
        if (remaining > 0) {
          setAmount(String(remaining));
        }
        toast.success(`Matched Invoice ${match.invoiceNo} (${match.clientName})`);
        return;
      }

      // 2. Invoices fallback table
      const { data: invData } = await (supabase as any)
        .from("invoices")
        .select("id, invoice_number, amount, amount_paid, balance_due, client_id, item_description")
        .ilike("invoice_number", `%${q}%`)
        .limit(1)
        .maybeSingle();

      if (invData) {
        let clientName = "Customer";
        if (invData.client_id) {
          const { data: cl } = await (supabase as any)
            .from("clients")
            .select("name")
            .eq("id", invData.client_id)
            .maybeSingle();
          if (cl?.name) clientName = cl.name;
        }

        const total = Number(invData.amount) || 0;
        const paid = Number(invData.amount_paid) || 0;
        const remaining = total - paid > 0 ? total - paid : 0;

        const match: MatchedInvoice = {
          id: invData.id,
          invoiceNo: invData.invoice_number,
          clientName,
          clientId: invData.client_id,
          totalAmount: total,
          paidAmount: paid,
          remainingAmount: remaining,
        };

        setMatchedInvoice(match);
        if (remaining > 0) {
          setAmount(String(remaining));
        }
        toast.success(`Matched Invoice ${match.invoiceNo} (${clientName})`);
        return;
      }

      toast.info(`No invoice found for "${q}". You can still proceed by selecting party manually.`);
    } catch (err: any) {
      console.warn("Error searching invoice:", err);
      toast.error("Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  // Save handler
  const handleSave = async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("You are offline, not saved");
      return;
    }

    if (!partyId && !matchedInvoice?.clientName) {
      toast.error("Please select a client or vendor, or link an invoice");
      return;
    }
    if (paymentMode === "bank" && !selectedBank) {
      toast.error("Please select an agency bank account");
      return;
    }

    if (numericAmount <= 0) {
      toast.error("Amount must be greater than zero");
      return;
    }

    setIsSubmitting(true);
    const voucherNo = autoVoucherNo;

    try {
      // Ensure agency_id is resolved
      let activeAgencyId = currentAgencyId;
      if (!activeAgencyId) {
        const { getAuthenticatedAgencyId } = await import("@/lib/agencyContext");
        activeAgencyId = await getAuthenticatedAgencyId();
      }

      const { data: rpcData, error: rpcError } = await (supabase as any).rpc("save_payment_voucher", {
        p_direction: direction,
        p_amount: numericAmount,
        p_payment_mode: paymentMode,
        p_account_id: null,
        p_party_id: partyId || null,
        p_voucher_no: voucherNo,
        p_voucher_date: voucherDate,
        p_reference_no: referenceNo || null,
        p_is_adjustment: isAdjustment,
        p_adjustment_reason: adjustmentReason || null,
        p_agency_id: activeAgencyId || null,
        p_notes: [
          paymentMode === "bank" && selectedBank ? `Bank: ${selectedBank}` : null,
          notes,
        ].filter(Boolean).join(" — ") || null,
      });

      if (rpcError) {
        // Fallback: direct insert into payment_vouchers table with agency_id
        const { error: directError } = await (supabase as any)
          .from("payment_vouchers")
          .insert({
            agency_id: activeAgencyId,
            voucher_no: voucherNo,
            voucher_date: voucherDate,
            direction,
            payment_mode: paymentMode,
            bank_name: paymentMode === "bank" ? selectedBank : null,
            amount: numericAmount,
            party_id: partyId || null,
            reference_no: referenceNo || null,
            is_adjustment: isAdjustment,
            adjustment_reason: adjustmentReason || null,
            notes: notes || null,
          });

        if (directError) {
          throw new Error(`Failed to save payment voucher: ${directError.message}`);
        }

        // Also post double-entry payment
        try {
          await (supabase as any).rpc("record_payment", {
            p_direction: direction === "received" ? "in" : "out",
            p_amount: numericAmount,
            p_account_id: null,
            p_party_id: partyId || null,
            p_party_type: direction === "received" ? "client" : "vendor",
            p_date: voucherDate,
            p_method: paymentMode,
            p_reference_no: referenceNo || voucherNo,
            p_notes: notes || null,
          });
        } catch (pe) {
          console.warn("record_payment error:", pe);
        }
      }

      toast.success(`${direction === "received" ? "Receipt (CRV)" : "Payment (CPV)"} ${voucherNo} recorded successfully`);

      // Invalidate queries so lists, KPIs, reports, and ledgers immediately refresh
      queryClient.invalidateQueries({ queryKey: ["payment_vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["recent_payment_vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["booking_invoices"] });
      queryClient.invalidateQueries({ queryKey: ["sales_expenses_invoices"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["parties"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      refetchRecentVouchers();

      // Clear input fields
      setAmount("0");
      setReferenceNo("");
      setNotes("");
      setSearchQuery("");
      setMatchedInvoice(null);
      setPartyId("");
      setIsAdjustment(false);
      setAdjustmentReason("");

      // Regenerate sequence for next voucher
      fetchNextNumber();

      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(`Could not save: ${err.message || "Failed to record payment voucher"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-5xl max-h-[92vh] flex flex-col overflow-hidden p-0 gap-0 bg-background border rounded-xl shadow-2xl">
        {/* HEADER: Title, Auto-generated Voucher # badge, Type Label, Close (X) */}
        <div className="px-5 py-2.5 border-b flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <CreditCard className="w-4 h-4 text-teal-600" />
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
              Payment Voucher
            </DialogTitle>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border text-xs font-mono font-bold text-slate-700 dark:text-slate-200">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>Voucher #:</span>
            <CopyValue value={autoVoucherNo} label="voucher number" className="text-teal-600 dark:text-teal-400" />
          </div>

          <Badge
            variant="outline"
            className={`text-xs px-2 py-0.5 font-bold ${
              direction === "received"
                ? "border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                : "border-red-500 text-red-600 bg-red-50 dark:bg-red-950/40"
            }`}
          >
            {typeLabel}
          </Badge>
        </div>

        {/* BODY: ONE FLAT COMPACT FORM, NO SCROLLING */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3 space-y-2.5">
          {/* LINE 1: Voucher Date | Direction | Payment Mode | (Bank if bank) | Amount (PKR) * | Cheque / Reference No */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-12 gap-2 items-end">
            {/* 1. Voucher Date (Locked System Date) */}
            <div className="lg:col-span-2">
              <LockedDateField
                label="Voucher Date"
                value={voucherDate}
                onChange={setVoucherDate}
                required
              />
            </div>

            {/* 2. Direction */}
            <div className="lg:col-span-2">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Direction <span className="text-red-500">*</span>
              </Label>
              <Select value={direction} onValueChange={(val: any) => setDirection(val)}>
                <SelectTrigger className="h-8 text-xs mt-0.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="received">Received (CRV)</SelectItem>
                  <SelectItem value="paid">Paid (CPV)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 3. Payment Mode */}
            <div className={paymentMode === "bank" ? "lg:col-span-2" : "lg:col-span-3"}>
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Payment Mode <span className="text-red-500">*</span>
              </Label>
              <Select value={paymentMode} onValueChange={(val: any) => setPaymentMode(val)}>
                <SelectTrigger className="h-8 text-xs mt-0.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash in Hand</SelectItem>
                  <SelectItem value="bank">Bank Account</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 4. Bank Account (Strictly Agency Banks with Quick Add) */}
            {paymentMode === "bank" && (
              <div className="lg:col-span-2">
                <AgencyBankSelect
                  value={selectedBank}
                  onChange={setSelectedBank}
                  label="Bank Account"
                  required={true}
                />
              </div>
            )}

            {/* 5. Amount (PKR) * */}
            <div className={paymentMode === "bank" ? "lg:col-span-2" : "lg:col-span-3"}>
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Amount (PKR) <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="h-8 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5"
                required
              />
            </div>

            {/* 6. Cheque / Reference No */}
            <div className="lg:col-span-2">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Cheque / Reference No
              </Label>
              <Input
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="Chq #, Trx ID..."
                className="h-8 text-xs mt-0.5"
              />
            </div>
          </div>

          {/* LINE 2: Link to Invoice | Party dropdown (Unified cross-search) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2 items-end">
            {/* Link to Invoice (with search button inside input + auto-trim on paste) */}
            <div className="lg:col-span-6">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Link to Invoice
              </Label>
              <div className="relative mt-0.5">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData("text");
                    if (pasted) {
                      e.preventDefault();
                      const cleaned = cleanPastedSearch(pasted);
                      setSearchQuery(cleaned);
                      setTimeout(() => executeSearchInvoice(cleaned), 0);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      executeSearchInvoice();
                    }
                  }}
                  placeholder="Invoice #, Ticket # or PNR..."
                  className="h-8 text-xs font-mono pr-20 uppercase"
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => executeSearchInvoice()}
                    disabled={isSearching}
                    className="h-6 text-[10px] px-2 bg-[#0B192C] hover:bg-[#1E3E62] text-white cursor-pointer"
                  >
                    <Search className="w-2.5 h-2.5 mr-1" />
                    {isSearching ? "..." : "Search"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Party (Unified Client & Vendor Cross-Search with + Quick Add) */}
            <div className="lg:col-span-6">
              <UniversalPartySelect
                value={partyId}
                onChange={setPartyId}
                label="Party (Client / Vendor)"
                placeholder="Search client or vendor..."
                defaultQuickAddType={direction === "received" ? "client" : "vendor"}
                required
              />
            </div>
          </div>

          {/* Matched Invoice compact preview banner */}
          {matchedInvoice && (
            <div className="p-2 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                <span className="font-bold text-teal-900 dark:text-teal-200">
                  {matchedInvoice.clientName}
                </span>
                <span className="text-teal-700 dark:text-teal-300 font-mono">
                  ({matchedInvoice.invoiceNo})
                </span>
                {matchedInvoice.pnr && (
                  <span className="text-teal-600 font-mono text-[11px]">
                    PNR: {matchedInvoice.pnr}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 font-mono text-[11px]">
                <span>Total: PKR {matchedInvoice.totalAmount.toLocaleString()}</span>
                <span>Paid: PKR {matchedInvoice.paidAmount.toLocaleString()}</span>
                <span className="font-bold text-red-600 dark:text-red-400">
                  Remaining: PKR {matchedInvoice.remainingAmount.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* LINE 3: Remarks (Single-line input, expandable, with write-off checkbox) */}
          <div className="space-y-1 pt-1 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Remarks
              </Label>
              <label className="flex items-center gap-1 text-[11px] cursor-pointer text-slate-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={isAdjustment}
                  onChange={(e) => setIsAdjustment(e.target.checked)}
                  className="rounded w-3 h-3 text-teal-600"
                />
                <span>Discount / Write-off Adjustment</span>
              </label>
            </div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Advance payment for ticket booking, remaining on passport collection..."
              className="w-full min-h-[32px] h-8 max-h-[80px] text-xs resize-y py-1.5 leading-snug"
            />
            {isAdjustment && (
              <Input
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                placeholder="Reason for write-off or discount adjustment..."
                className="h-7 text-xs mt-1"
              />
            )}
          </div>

          {/* COMPACT RECENT VOUCHERS SHEET */}
          <div className="pt-1.5 border-t">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Recent Vouchers Log
              </span>
              <span className="text-[10px] text-muted-foreground">Last 5 entries</span>
            </div>
            <div className="border rounded bg-slate-50 dark:bg-slate-900/40 divide-y text-[11px]">
              {recentVouchers.length === 0 ? (
                <div className="p-2 text-center text-muted-foreground text-[10px]">
                  No recent vouchers found. New entries will appear here instantly.
                </div>
              ) : (
                recentVouchers.map((v: any, idx: number) => (
                  <div
                    key={v.id || idx}
                    className="px-2.5 py-1 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800/60"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                        {v.voucher_no}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{v.voucher_date}</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {v.party?.name || "Direct"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1 py-0 uppercase ${
                          v.direction === "received"
                            ? "border-emerald-500 text-emerald-600"
                            : "border-red-500 text-red-600"
                        }`}
                      >
                        {v.direction === "received" ? "CRV" : "CPV"}
                      </Badge>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        PKR {Number(v.amount).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="px-5 py-2.5 border-t bg-slate-50 dark:bg-slate-900 flex items-center justify-end gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs cursor-pointer"
          >
            Close
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isSubmitting}
            onClick={handleSave}
            className="h-8 text-xs bg-[#0B192C] hover:bg-[#1E3E62] text-white cursor-pointer min-w-[110px]"
          >
            {isSubmitting ? "Saving..." : "Save Voucher"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
