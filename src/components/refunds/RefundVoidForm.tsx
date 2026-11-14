import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AgencyBankSelect } from "@/components/banks/AgencyBankSelect";
import { LockedDateField, getTodayDateString } from "@/components/ui/LockedDateField";
import { useFormKeyboardNav } from "@/hooks/useFormKeyboardNav";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { useAccounts } from "@/hooks/useUnifiedTransactions";
import { getAuthenticatedAgencyId } from "@/lib/agencyContext";
import {
  resolveAccountIdForPayment,
  invalidateAllFinancialQueries,
} from "@/lib/accountingEngine";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CopyValue } from "@/components/ui/CopyValue";
import { cleanPastedSearch } from "@/lib/searchUtils";
import {
  RotateCcw,
  Search,
  CheckCircle2,
  Lock,
  Plus,
  CalendarDays,
} from "lucide-react";

interface RefundVoidFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface MatchedBooking {
  id: string;
  invoiceNo?: string;
  clientName: string;
  partyId?: string;
  pnr?: string;
  ticketNo?: string;
  totalAmount: number;
  paidAmount: number;
  service?: string;
  sourceTable?: "booking_invoices" | "invoices" | "clients";
}

export const RefundVoidForm: React.FC<RefundVoidFormProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const { data: currentAgencyId } = useCurrentAgencyId();
  const { accounts = [] } = useAccounts();

  const formRef = useRef<HTMLDivElement>(null);
  const lastSearchedRef = useRef<string>("");

  // Line 1: Date | Type | Original Invoice / PNR / Ticket No * | Party
  const [refundDate, setRefundDate] = useState<string>(
    () => getTodayDateString()
  );
  const [actionType, setActionType] = useState<"refund" | "void">("refund");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [matchedBooking, setMatchedBooking] = useState<MatchedBooking | null>(null);
  const [partyName, setPartyName] = useState("");

  // Line 2: Client Refund / Void Charges | Supplier Refund | Deductions | Mode | Bank
  const [clientRefundAmount, setClientRefundAmount] = useState<string>("0");
  const [vendorRefundAmount, setVendorRefundAmount] = useState<string>("0");
  const [deductionsAmount, setDeductionsAmount] = useState<string>("0");
  const [paymentMode, setPaymentMode] = useState<"cash" | "bank">("cash");
  const [selectedBank, setSelectedBank] = useState<string>("");

  // Line 3: Reason | Notes | Pending Vendor Toggle
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [pendingVendorRefund, setPendingVendorRefund] = useState<boolean>(true);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-generated sequence for Refund No
  const [refundSeq, setRefundSeq] = useState<string>("1001");

  // Generate sequence on open or actionType change
  const fetchNextNumber = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("preview_next_number", {
        p_counter_type: "refund",
      });
      if (!error && data) {
        const match = String(data).match(/\d+$/);
        if (match) {
          setRefundSeq(match[0]);
          return;
        }
      }
    } catch {}
    const randomSeq = String(Math.floor(1000 + Math.random() * 9000));
    setRefundSeq(randomSeq);
  }, []);

  useEffect(() => {
    if (open) {
      setRefundDate(getTodayDateString());
      fetchNextNumber();
    }
  }, [open, actionType, fetchNextNumber]);

  // Fetch recent refunds for compact sheet below form (strictly agency-scoped)
  const { data: recentRefunds = [], refetch: refetchRecentRefunds } = useQuery({
    queryKey: ["recent_sales_refunds", currentAgencyId],
    queryFn: async () => {
      const activeAgencyId = currentAgencyId || (await getAuthenticatedAgencyId());
      if (!activeAgencyId) return [];
      const { data } = await (supabase as any)
        .from("refunds")
        .select("*")
        .eq("agency_id", activeAgencyId)
        .order("refund_date", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: open && !!currentAgencyId,
  });

  const recordPrefix = actionType === "void" ? "VOID" : "REF";
  const autoRecordNo = `${recordPrefix}-${refundSeq}`;

  // Search booking / invoice by Invoice No, PNR, or Ticket No
  const executeSearchInvoice = async (queryText?: string) => {
    const query = (queryText ?? invoiceSearch).trim();
    if (!query) {
      toast.error("Please enter an Invoice No, PNR, or Ticket No to search");
      return;
    }

    setIsSearching(true);
    try {
      const activeAgencyId = currentAgencyId || (await getAuthenticatedAgencyId());
      if (!activeAgencyId) {
        toast.error("Unable to verify your active agency");
        return;
      }

      // 1. Search canonical booking_invoices table first
      const { data: biData } = await (supabase as any)
        .from("booking_invoices")
        .select("id, invoice_no, party_id, pnr, ticket_no, client_amount, paid_amount, service, is_void, party:parties!party_id(name)")
        .eq("agency_id", activeAgencyId)
        .or(`invoice_no.ilike.%${query}%,pnr.ilike.%${query}%,ticket_no.ilike.%${query}%`)
        .limit(1)
        .maybeSingle();

      if (biData) {
        if (biData.is_void) {
          toast.warning(`Invoice ${biData.invoice_no} is already voided`);
        }
        const match: MatchedBooking = {
          id: biData.id,
          invoiceNo: biData.invoice_no,
          clientName: biData.party?.name || "Customer",
          partyId: biData.party_id || undefined,
          pnr: biData.pnr || undefined,
          ticketNo: biData.ticket_no || undefined,
          totalAmount: Number(biData.client_amount) || 0,
          paidAmount: Number(biData.paid_amount) || 0,
          service: biData.service || "Booking",
          sourceTable: "booking_invoices",
        };
        setMatchedBooking(match);
        setPartyName(match.clientName);
        setClientRefundAmount(String(match.paidAmount || match.totalAmount));
        toast.success(`Matched invoice: ${match.invoiceNo} (${match.clientName})`);
        return;
      }

      // 2. Fallback: legacy invoices table
      const { data: invData } = await (supabase as any)
        .from("invoices")
        .select("id, invoice_number, amount, amount_paid, balance_due, client_id, item_description")
        .eq("agency_id", activeAgencyId)
        .ilike("invoice_number", `%${query}%`)
        .limit(1)
        .maybeSingle();

      if (invData) {
        let name = "Customer";
        if (invData.client_id) {
          const { data: client } = await (supabase as any)
            .from("clients")
            .select("name, pnr, passport_number")
            .eq("agency_id", activeAgencyId)
            .eq("id", invData.client_id)
            .maybeSingle();
          if (client?.name) name = client.name;
        }

        const match: MatchedBooking = {
          id: invData.id,
          invoiceNo: invData.invoice_number,
          clientName: name,
          totalAmount: Number(invData.amount) || 0,
          paidAmount: Number(invData.amount_paid) || 0,
          service: invData.item_description || "Booking",
          sourceTable: "invoices",
        };

        setMatchedBooking(match);
        setPartyName(name);
        setClientRefundAmount(String(match.paidAmount || match.totalAmount));
        toast.success(`Matched invoice: ${match.invoiceNo} (${match.clientName})`);
        return;
      }

      // 3. Fallback: legacy clients / bookings table
      const { data: bookingData } = await (supabase as any)
        .from("clients")
        .select("id, name, pnr, selling_price, amount_paid, travel_type, passport_number")
        .eq("agency_id", activeAgencyId)
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
          sourceTable: "clients",
        };

        setMatchedBooking(match);
        setPartyName(bookingData.name);
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
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("You are offline, not saved");
      return;
    }

    if (!invoiceSearch.trim() && !matchedBooking) {
      toast.error("Please specify target invoice, PNR, or ticket number");
      return;
    }

    if (!reason.trim()) {
      toast.error(`Please provide a ${actionType === "void" ? "void" : "refund"} reason`);
      return;
    }

    const clientAmt = parseFloat(clientRefundAmount) || 0;
    // When Type = Refund: Client Refund is REQUIRED (> 0)
    // When Type = Void: Void Charges is OPTIONAL (no validation error if empty or 0)
    if (actionType === "refund" && clientAmt <= 0) {
      toast.error("Client refund amount must be greater than zero");
      return;
    }

    if (paymentMode === "bank" && !selectedBank) {
      toast.error("Please select a bank account");
      return;
    }

    setIsSubmitting(true);
    const recordNo = autoRecordNo;

    try {
      let activeAgencyId = currentAgencyId;
      if (!activeAgencyId) {
        activeAgencyId = await getAuthenticatedAgencyId();
      }
      if (!activeAgencyId) {
        throw new Error("Unable to identify active agency account.");
      }

      const deductions = parseFloat(deductionsAmount) || 0;
      const vendorRefAmt = parseFloat(vendorRefundAmount) || 0;
      const combinedNotes = [
        notes,
        paymentMode === "bank" && selectedBank ? `Bank: ${selectedBank}` : null,
        deductions > 0 ? `Service Charges/Deductions: PKR ${deductions}` : null,
        pendingVendorRefund && actionType === "refund" ? `Track as pending vendor refund: YES` : null,
        matchedBooking ? `Ref Invoice: ${matchedBooking.invoiceNo || matchedBooking.pnr}` : null,
        partyName ? `Party: ${partyName}` : null,
      ]
        .filter(Boolean)
        .join(" | ");

      const resolvedAccountId =
        clientAmt > 0
          ? resolveAccountIdForPayment(accounts, paymentMode, selectedBank)
          : null;

      // Call atomic refund RPC (single transaction updating refund, invoice, ledger & cash/bank)
      const { data: rpcData, error: rpcError } = await (supabase as any).rpc("record_refund", {
        p_amount: clientAmt,
        p_account_id: resolvedAccountId,
        p_party_id: matchedBooking?.partyId || null,
        p_party_type: "client",
        p_booking_id:
          matchedBooking?.sourceTable === "booking_invoices" ? matchedBooking.id : null,
        p_date: refundDate,
        p_method: paymentMode,
        p_reference_no: recordNo,
        p_reason: reason,
        p_notes: combinedNotes || null,
        p_action_type: actionType,
        p_vendor_refund_amount: vendorRefAmt,
        p_deductions: deductions,
        p_bank_name: paymentMode === "bank" ? selectedBank || null : null,
        p_party_name: partyName || null,
        p_invoice_search: invoiceSearch || null,
        p_void_invoice: actionType === "void",
      });

      if (rpcError) {
        throw new Error(rpcError.message || "Failed to record refund/void");
      }
      if (rpcData && rpcData.success === false) {
        throw new Error(rpcData.error || "Failed to record refund/void");
      }

      toast.success(`${actionType === "void" ? "Void recorded" : "Refund recorded"} successfully`);

      await invalidateAllFinancialQueries(queryClient, activeAgencyId);
      refetchRecentRefunds();

      // Clear input fields (keep Date, Mode, Type)
      setInvoiceSearch("");
      setMatchedBooking(null);
      setPartyName("");
      setClientRefundAmount("0");
      setVendorRefundAmount("0");
      setDeductionsAmount("0");
      setReason("");
      setNotes("");

      // Regenerate sequence for next number
      fetchNextNumber();

      if (onSuccess) onSuccess();
      // Keep modal open so user can enter next record quickly!
    } catch (err: any) {
      toast.error(`Could not save: ${err.message || "Failed to process request"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDirty = useMemo(() => {
    return Boolean(
      invoiceSearch.trim() ||
        matchedBooking ||
        partyName.trim() ||
        (parseFloat(clientRefundAmount) || 0) > 0 ||
        (parseFloat(vendorRefundAmount) || 0) > 0 ||
        (parseFloat(deductionsAmount) || 0) > 0 ||
        reason.trim() ||
        notes.trim()
    );
  }, [
    invoiceSearch,
    matchedBooking,
    partyName,
    clientRefundAmount,
    vendorRefundAmount,
    deductionsAmount,
    reason,
    notes,
  ]);

  useFormKeyboardNav({
    containerRef: formRef,
    enabled: open,
    isDirty,
    onSave: handleSave,
    onCancel: () => onOpenChange(false),
    onBeforeAdvance: (el) => {
      if (el.dataset.enterSearch === "true") {
        const q = invoiceSearch.trim();
        if (q && q !== lastSearchedRef.current) {
          lastSearchedRef.current = q;
          executeSearchInvoice(q);
          return false;
        }
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-5xl max-h-[92vh] flex flex-col overflow-hidden p-0 gap-0 bg-background border rounded-xl shadow-2xl">
        {/* HEADER: Title, Auto-generated Refund # badge, Close (X) */}
        <div className="px-5 py-2.5 border-b flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-purple-600" />
              Process Refund / Void
            </DialogTitle>

            {/* Read-Only Refund # badge */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border text-xs font-mono font-bold text-slate-700 dark:text-slate-200" data-nav-skip="true">
              <Lock className="w-3 h-3 text-slate-400" />
              <span>{actionType === "void" ? "Void #:" : "Refund #:"}</span>
              <span className={actionType === "void" ? "text-red-600 dark:text-red-400" : "text-purple-600 dark:text-purple-400"}>
                {autoRecordNo}
              </span>
              <Badge variant="secondary" className="text-[9px] px-1 h-3.5 ml-0.5">
                Auto
              </Badge>
            </div>
          </div>
        </div>

        {/* BODY + FOOTER wrapped for keyboard navigation */}
        <div ref={formRef} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3 space-y-2.5">
          {/* LINE 1: Date | Type | Original Invoice / PNR / Ticket No * | Party */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-12 gap-2 items-start">
            {/* Date (Locked to System Date) */}
            <div className="lg:col-span-2">
              <LockedDateField
                label="Date"
                value={refundDate}
                onChange={setRefundDate}
                required
              />
            </div>

            {/* Type: DROPDOWN styled like Service Type */}
            <div className="lg:col-span-2 space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Type <span className="text-red-500">*</span>
              </Label>
              <Select value={actionType} onValueChange={(val: any) => setActionType(val)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="refund">Refund</SelectItem>
                  <SelectItem value="void">Void</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Original Invoice / PNR / Ticket No * (Search button inside input + auto-trim on paste) */}
            <div className="lg:col-span-5 space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Original Invoice / PNR / Ticket No <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  value={invoiceSearch}
                  onChange={(e) => {
                    lastSearchedRef.current = "";
                    setInvoiceSearch(e.target.value);
                  }}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData("text");
                    if (pasted) {
                      e.preventDefault();
                      const cleaned = cleanPastedSearch(pasted);
                      lastSearchedRef.current = cleaned.trim();
                      setInvoiceSearch(cleaned);
                      setTimeout(() => executeSearchInvoice(cleaned), 0);
                    }
                  }}
                  data-enter-search="true"
                  required
                  data-required-message="Please specify target invoice, PNR, or ticket number"
                  placeholder="e.g. INV-1004, PNR, Ticket #"
                  className="h-8 text-xs font-mono uppercase pr-20"
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2">
                  <Button
                    type="button"
                    size="sm"
                    tabIndex={-1}
                    onClick={() => {
                      lastSearchedRef.current = invoiceSearch.trim();
                      executeSearchInvoice();
                    }}
                    disabled={isSearching}
                    className="h-6 text-[10px] px-2 bg-[#0B192C] hover:bg-[#1E3E62] text-white cursor-pointer"
                  >
                    <Search className="w-2.5 h-2.5 mr-1" />
                    {isSearching ? "..." : "Search"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Party (auto-filled, read-only) */}
            <div className="lg:col-span-3 space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Party Name
              </Label>
              <Input
                value={partyName || (matchedBooking ? matchedBooking.clientName : "")}
                readOnly
                tabIndex={-1}
                placeholder="Auto-filled on search"
                className="h-8 text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-not-allowed font-medium"
              />
            </div>
          </div>

          {/* Matched booking brief preview */}
          {matchedBooking && (
            <div className="p-2 bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50 rounded flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                <span className="font-bold text-purple-900 dark:text-purple-200">
                  {matchedBooking.clientName}
                </span>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {matchedBooking.invoiceNo || matchedBooking.pnr}
                </Badge>
                {matchedBooking.service && (
                  <span className="text-muted-foreground text-[10px]">• {matchedBooking.service}</span>
                )}
              </div>
              <div className="flex items-center gap-3 font-mono text-[11px]">
                <span>Total: <strong>PKR {matchedBooking.totalAmount.toLocaleString()}</strong></span>
                <span>Paid: <strong className="text-teal-600">PKR {matchedBooking.paidAmount.toLocaleString()}</strong></span>
              </div>
            </div>
          )}

          {/* LINE 2: Client Refund / Void Charges | Supplier Refund | Deductions | Mode | Bank */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-12 gap-2 items-end">
            {/* Amount Field:
                When Type = Void: "Void Charges (PKR)", OPTIONAL (no star)
                When Type = Refund: "Client Refund (PKR) *", REQUIRED */}
            <div className={actionType === "void" ? "lg:col-span-6" : paymentMode === "bank" ? "lg:col-span-3" : "lg:col-span-3"}>
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                {actionType === "void" ? "Void Charges (PKR)" : (
                  <>
                    Client Refund (PKR) <span className="text-red-500">*</span>
                  </>
                )}
              </Label>
              <Input
                type="number"
                value={clientRefundAmount}
                onChange={(e) => setClientRefundAmount(e.target.value)}
                placeholder="0"
                className="h-8 text-xs font-mono font-bold text-right mt-0.5"
                required={actionType === "refund"}
                data-required-positive={actionType === "refund" ? "true" : undefined}
                data-required-message="Client refund amount must be greater than zero"
              />
            </div>

            {/* If Type != Void, show Supplier Refund and Deductions */}
            {actionType !== "void" && (
              <>
                <div className={paymentMode === "bank" ? "lg:col-span-2" : "lg:col-span-3"}>
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Supplier Refund (PKR)
                  </Label>
                  <Input
                    type="number"
                    value={vendorRefundAmount}
                    onChange={(e) => setVendorRefundAmount(e.target.value)}
                    placeholder="0"
                    className="h-8 text-xs font-mono text-right mt-0.5"
                  />
                </div>

                <div className={paymentMode === "bank" ? "lg:col-span-2" : "lg:col-span-3"}>
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Deductions (PKR)
                  </Label>
                  <Input
                    type="number"
                    value={deductionsAmount}
                    onChange={(e) => setDeductionsAmount(e.target.value)}
                    placeholder="0"
                    className="h-8 text-xs font-mono text-right mt-0.5"
                  />
                </div>
              </>
            )}

            {/* Mode: "Void Mode" when void, "Refund Mode" when refund */}
            <div className={actionType === "void" ? "lg:col-span-6" : paymentMode === "bank" ? "lg:col-span-2" : "lg:col-span-3"}>
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                {actionType === "void" ? "Void Mode" : "Refund Mode"}
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

            {/* Bank Dropdown (strictly agency banks with Quick Add) */}
            {paymentMode === "bank" && (
              <div className={actionType === "void" ? "lg:col-span-12" : "lg:col-span-3"}>
                <AgencyBankSelect
                  value={selectedBank}
                  onChange={setSelectedBank}
                  label="Bank Account"
                  required={true}
                />
              </div>
            )}
          </div>

          {/* LINE 3: Refund Reason * | Notes / Deductions Breakdown | Track as Pending toggle inline */}
          <div className="space-y-1 pt-1 border-t">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
              {/* Refund / Void Reason * */}
              <div className="md:col-span-5">
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  {actionType === "void" ? "Void Reason" : "Refund Reason"} <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    actionType === "void"
                      ? "e.g. Cancelled before ticket issuance"
                      : "e.g. Flight cancellation, medical emergency, visa refusal"
                  }
                  className="h-8 text-xs mt-0.5"
                  required
                />
              </div>

              {/* Notes / Deductions Breakdown */}
              <div className="md:col-span-5">
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Notes / Deductions Breakdown
                </Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Airline penalty, service fee, vendor claim reference..."
                  className="w-full min-h-[32px] h-8 max-h-[80px] text-xs resize-y mt-0.5 py-1.5 leading-snug"
                />
              </div>

              {/* Track as Pending Refund from Vendor */}
              {actionType === "refund" && (
                <div
                  className="md:col-span-2 flex items-center justify-between h-8 px-2 bg-background border rounded-md mt-0.5"
                  title="Flag this in Accounts as awaiting supplier refund recovery"
                >
                  <Label className="text-[10px] font-medium text-slate-700 dark:text-slate-300 cursor-pointer truncate mr-1">
                    Pending Vendor
                  </Label>
                  <Switch
                    checked={pendingVendorRefund}
                    onCheckedChange={setPendingVendorRefund}
                    className="scale-75 origin-right"
                  />
                </div>
              )}
            </div>
          </div>

          {/* COMPACT SHEET BELOW FORM: Recent Recorded Refunds & Voids (5 records, read-only) */}
          <div className="pt-2 border-t space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Recent Recorded Refunds & Voids
                </span>
                <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                  {recentRefunds.length} entries
                </Badge>
              </div>
              <span className="text-[10px] text-muted-foreground">
                Newly saved entries appear here immediately
              </span>
            </div>

            <div className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 max-h-[140px] overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 bg-slate-100/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-400 font-semibold border-b text-[11px]">
                  <tr>
                    <th className="py-1.5 px-2.5">Date</th>
                    <th className="py-1.5 px-2.5">Refund No</th>
                    <th className="py-1.5 px-2.5">Invoice / PNR</th>
                    <th className="py-1.5 px-2.5">Party</th>
                    <th className="py-1.5 px-2.5">Mode</th>
                    <th className="py-1.5 px-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                  {recentRefunds.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-3 text-center text-muted-foreground text-xs">
                        No records yet. Save an entry above to see it here.
                      </td>
                    </tr>
                  ) : (
                    recentRefunds.map((r: any, idx: number) => {
                      const rNo = r.refund_no || r.reference_no || `REF-${idx + 1}`;
                      const matchParty = r.notes?.match(/Party:\s*([^|]+)/);
                      const pName = matchParty ? matchParty[1].trim() : "Customer";
                      const matchInv = r.notes?.match(/Ref Invoice:\s*([^|]+)/);
                      const invPnr = matchInv ? matchInv[1].trim() : r.invoice_no || "—";
                      const amt = Number(r.refund_amount) || 0;

                      return (
                        <tr key={r.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 select-text">
                          <td className="py-1.5 px-2.5 font-mono text-slate-600 dark:text-slate-300">
                            {r.refund_date || "—"}
                          </td>
                          <td className="py-1.5 px-2.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                            <CopyValue value={rNo} label="refund number" />
                          </td>
                          <td className="py-1.5 px-2.5 font-mono text-slate-600 dark:text-slate-400">
                            {invPnr !== "—" ? <CopyValue value={invPnr} label="invoice or PNR" /> : "—"}
                          </td>
                          <td className="py-1.5 px-2.5 font-medium text-slate-800 dark:text-slate-100 truncate max-w-[150px]">
                            <CopyValue value={pName} label="party name" />
                          </td>
                          <td className="py-1.5 px-2.5 uppercase text-slate-600 dark:text-slate-400">
                            {r.payment_mode || "CASH"}
                          </td>
                          <td className="py-1.5 px-2.5 font-mono font-bold text-right text-purple-600 dark:text-purple-400">
                            <CopyValue value={amt} isAmount={true} displayValue={`PKR ${amt.toLocaleString()}`} label="amount" />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* FOOTER: Only Cancel and Record Void / Record Refund */}
        <div className="px-5 py-2.5 border-t bg-gray-50 dark:bg-slate-900/60 flex items-center justify-end gap-2.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            data-save-button="true"
            disabled={isSubmitting}
            onClick={handleSave}
            className={`h-8 text-xs text-white cursor-pointer min-w-[120px] ${
              actionType === "void"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-purple-600 hover:bg-purple-700"
            }`}
          >
            {isSubmitting
              ? "Saving..."
              : actionType === "void"
              ? "Record Void"
              : "Record Refund"}
          </Button>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
