import React, { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useParties } from "@/hooks/useParties";
import { useAgency } from "@/hooks/useAgency";
import { generateVoucherPdf, VoucherPdfData } from "@/lib/pdf/voucherReceiptPdf";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Search,
  CheckCircle2,
  Printer,
  FileCheck,
  Building2,
  Wallet,
  AlertCircle,
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

const DEFAULT_BANKS = [
  "Meezan Bank",
  "Habib Bank Limited (HBL)",
  "United Bank Limited (UBL)",
  "MCB Bank",
  "Allied Bank Limited",
  "Bank Alfalah",
  "Faysal Bank",
  "Askari Bank",
  "Dubai Islamic Bank",
  "Standard Chartered",
];

export const PaymentVoucherForm: React.FC<PaymentVoucherFormProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { parties } = useParties();
  const { data: agency } = useAgency();

  // Row 1: Direction, Mode, Date
  const [direction, setDirection] = useState<"received" | "paid" | "transfer">("received");
  const [paymentMode, setPaymentMode] = useState<"cash" | "bank">("cash");
  const [voucherDate, setVoucherDate] = useState<string>(
    () => new Date().toISOString().slice(0, 10)
  );

  // Transfer Mode: From & To
  const [fromMode, setFromMode] = useState<"cash" | "bank">("cash");
  const [fromBank, setFromBank] = useState<string>(DEFAULT_BANKS[0]);
  const [toMode, setToMode] = useState<"cash" | "bank">("bank");
  const [toBank, setToBank] = useState<string>(DEFAULT_BANKS[1]);

  // Bank accounts fetched from DB
  const [dbBanks, setDbBanks] = useState<string[]>([]);

  // Row 2: Search & Link Invoice
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [matchedInvoice, setMatchedInvoice] = useState<MatchedInvoice | null>(null);
  const [partyId, setPartyId] = useState<string>("");
  const [partyType, setPartyType] = useState<"client" | "vendor">("client");

  // Row 3: Amount & Ref
  const [amount, setAmount] = useState<string>("0");
  const [referenceNo, setReferenceNo] = useState<string>("");

  // Row 4: Remarks & Adjustment
  const [notes, setNotes] = useState<string>("");
  const [isAdjustment, setIsAdjustment] = useState<boolean>(false);
  const [adjustmentReason, setAdjustmentReason] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Fetch registered bank accounts
  useEffect(() => {
    async function loadBankAccounts() {
      try {
        const { data } = await (supabase as any)
          .from("accounts")
          .select("name, type, active")
          .eq("type", "bank")
          .eq("active", true);

        if (data && data.length > 0) {
          const names = data.map((a: any) => a.name);
          setDbBanks(names);
          if (names[0]) setFromBank(names[0]);
          if (names[1] || names[0]) setToBank(names[1] || names[0]);
        }
      } catch {
        // Fallback to DEFAULT_BANKS
      }
    }
    loadBankAccounts();
  }, []);

  const bankOptions = dbBanks.length > 0 ? dbBanks : DEFAULT_BANKS;

  // Filter clients/vendors
  const filteredParties = useMemo(() => {
    return parties.filter((p) => {
      if (direction === "received") return p.type === "client" || p.type === "both";
      if (direction === "paid") return p.type === "vendor" || p.type === "both";
      return true;
    });
  }, [parties, direction]);

  const selectedParty = parties.find((p) => p.id === partyId);
  const numericAmount = parseFloat(amount) || 0;

  // Search invoice
  const handleSearchInvoice = async () => {
    const q = searchQuery.trim();
    if (!q) {
      toast.error("Please enter an Invoice No, Ticket No, or PNR");
      return;
    }

    setIsSearching(true);
    try {
      // 1. Try invoices table
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
        if (remaining > 0) setAmount(String(remaining));
        if (invData.client_id) setPartyId(invData.client_id);
        toast.success(`Matched Invoice: ${match.invoiceNo} (${match.clientName})`);
        return;
      }

      // 2. Try clients table (PNR / Ticket / Passport)
      const { data: bookingData } = await (supabase as any)
        .from("clients")
        .select("id, name, pnr, selling_price, amount_paid, passport_number")
        .or(`pnr.ilike.%${q}%,name.ilike.%${q}%,passport_number.ilike.%${q}%`)
        .limit(1)
        .maybeSingle();

      if (bookingData) {
        const total = Number(bookingData.selling_price) || 0;
        const paid = Number(bookingData.amount_paid) || 0;
        const remaining = total - paid > 0 ? total - paid : 0;

        const match: MatchedInvoice = {
          id: bookingData.id,
          invoiceNo: `INV-${bookingData.pnr || bookingData.id.slice(0, 6)}`,
          clientName: bookingData.name,
          totalAmount: total,
          paidAmount: paid,
          remainingAmount: remaining,
          pnr: bookingData.pnr,
        };

        setMatchedInvoice(match);
        if (remaining > 0) setAmount(String(remaining));
        setPartyId(bookingData.id);
        toast.success(`Matched Booking: ${match.clientName} (PNR: ${match.pnr || "N/A"})`);
        return;
      }

      toast.info("No matching invoice or booking found. You can select client manually below.");
      setMatchedInvoice(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to search invoice");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSave = async (printPdf = false) => {
    if (direction === "transfer") {
      if (fromMode === toMode && fromMode === "cash") {
        toast.error("Source and destination cannot both be Cash in Hand");
        return;
      }
      if (fromMode === "bank" && toMode === "bank" && fromBank === toBank) {
        toast.error("Source and destination cannot be the same bank account");
        return;
      }
    } else {
      if (!partyId && !matchedInvoice?.clientName) {
        toast.error("Please select a client or vendor, or link an invoice");
        return;
      }
    }

    if (numericAmount <= 0) {
      toast.error("Amount must be greater than zero");
      return;
    }

    setIsSubmitting(true);
    const voucherPrefix =
      direction === "received" ? "CRV" : direction === "paid" ? "CPV" : "ITV";
    const voucherNo = `${voucherPrefix}-${Date.now().toString().slice(-6)}`;

    try {
      if (direction === "transfer") {
        const transferDesc = `Transfer from ${
          fromMode === "bank" ? fromBank : "Cash in Hand"
        } to ${toMode === "bank" ? toBank : "Cash in Hand"}`;

        await (supabase as any).rpc("record_transfer", {
          p_from_account_id: null,
          p_to_account_id: null,
          p_amount: numericAmount,
          p_date: voucherDate,
          p_reference_no: referenceNo || null,
          p_notes: notes ? `${transferDesc} — ${notes}` : transferDesc,
        });
        toast.success("Internal transfer recorded successfully");
      } else {
        // Record payment voucher
        const { error } = await (supabase as any).rpc("save_payment_voucher", {
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
          p_notes: notes || null,
        });

        if (error) {
          // Fallback to record_payment
          await (supabase as any).rpc("record_payment", {
            p_direction: direction === "received" ? "in" : "out",
            p_amount: numericAmount,
            p_account_id: null,
            p_party_id: partyId || null,
            p_party_type: direction === "received" ? "client" : "vendor",
            p_date: voucherDate,
            p_method: paymentMode,
            p_reference_no: referenceNo || null,
            p_notes: notes || null,
          });
        }
        toast.success("Payment voucher recorded successfully");
      }

      if (printPdf) {
        const partyDisplayName =
          direction === "transfer"
            ? "Internal Account Transfer"
            : selectedParty?.name || matchedInvoice?.clientName || "Direct Party";

        const pdfData: VoucherPdfData = {
          voucherNo,
          voucherDate,
          direction: direction === "transfer" ? "received" : direction,
          paymentMode: direction === "transfer" ? "transfer" : paymentMode,
          partyName: partyDisplayName,
          partyPhone: selectedParty?.phone,
          amount: numericAmount,
          accountName:
            direction === "transfer"
              ? `${fromMode === "bank" ? fromBank : "Cash"} -> ${
                  toMode === "bank" ? toBank : "Cash"
                }`
              : paymentMode === "cash"
              ? "Cash in Hand"
              : "Bank Account",
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
      <DialogContent className="w-[98vw] max-w-[98vw] h-[96vh] max-h-[96vh] flex flex-col overflow-hidden p-0 gap-0 bg-background border rounded-xl shadow-2xl">
        {/* 1. Header */}
        <div className="px-6 py-3 border-b flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2">
            {direction === "received" ? (
              <ArrowDownLeft className="w-5 h-5 text-teal-600" />
            ) : direction === "paid" ? (
              <ArrowUpRight className="w-5 h-5 text-blue-600" />
            ) : (
              <ArrowLeftRight className="w-5 h-5 text-purple-600" />
            )}
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Payment Voucher
            </DialogTitle>
          </div>

          <Badge variant="outline" className="text-xs">
            {direction === "received"
              ? "Cash / Bank Receipt Voucher (CRV)"
              : direction === "paid"
              ? "Cash / Bank Payment Voucher (CPV)"
              : "Internal Account Transfer (ITV)"}
          </Badge>
        </div>

        {/* 2. Flexible Form Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
          {/* Row 1: Direction, Mode, Date (Equal Columns) */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Row 1: Transaction Flow & Date
            </div>

            {direction !== "transfer" ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full items-end">
                {/* Transaction Direction Toggle */}
                <div>
                  <Label className="text-xs font-semibold">Transaction Direction</Label>
                  <div className="grid grid-cols-3 gap-1 bg-muted/70 p-1 rounded-lg border mt-1">
                    <button
                      type="button"
                      onClick={() => setDirection("received")}
                      className={`flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        direction === "received"
                          ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5" /> Received
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirection("paid")}
                      className={`flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        direction === "paid"
                          ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" /> Paid
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirection("transfer")}
                      className="flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" /> Transfer
                    </button>
                  </div>
                </div>

                {/* Payment Mode Toggle */}
                <div>
                  <Label className="text-xs font-semibold">Payment Mode</Label>
                  <div className="grid grid-cols-2 gap-1 bg-muted/70 p-1 rounded-lg border mt-1">
                    <button
                      type="button"
                      onClick={() => setPaymentMode("cash")}
                      className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        paymentMode === "cash"
                          ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Wallet className="w-3.5 h-3.5 text-amber-600" /> Cash in Hand
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMode("bank")}
                      className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        paymentMode === "bank"
                          ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5 text-blue-600" /> Bank Account
                    </button>
                  </div>
                </div>

                {/* Voucher Date */}
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
            ) : (
              /* Transfer Mode Layout */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full items-end">
                {/* Direction Switcher */}
                <div>
                  <Label className="text-xs font-semibold">Transaction Direction</Label>
                  <div className="grid grid-cols-3 gap-1 bg-muted/70 p-1 rounded-lg border mt-1">
                    <button
                      type="button"
                      onClick={() => setDirection("received")}
                      className="py-1.5 rounded-md text-xs font-semibold text-muted-foreground"
                    >
                      Received
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirection("paid")}
                      className="py-1.5 rounded-md text-xs font-semibold text-muted-foreground"
                    >
                      Paid
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirection("transfer")}
                      className="bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-400 py-1.5 rounded-md text-xs font-semibold shadow-sm"
                    >
                      Transfer
                    </button>
                  </div>
                </div>

                {/* Transfer Source (From) */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-red-600 dark:text-red-400">
                    From (Source Account)
                  </Label>
                  <div className="flex gap-2">
                    <Select value={fromMode} onValueChange={(val: any) => setFromMode(val)}>
                      <SelectTrigger className="h-9 text-xs w-32 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash in Hand</SelectItem>
                        <SelectItem value="bank">Bank Account</SelectItem>
                      </SelectContent>
                    </Select>
                    {fromMode === "bank" && (
                      <Select value={fromBank} onValueChange={setFromBank}>
                        <SelectTrigger className="h-9 text-xs flex-1">
                          <SelectValue placeholder="Select Bank" />
                        </SelectTrigger>
                        <SelectContent>
                          {bankOptions.map((b) => (
                            <SelectItem key={b} value={b}>
                              {b}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                {/* Transfer Destination (To) */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-teal-600 dark:text-teal-400">
                    To (Destination Account)
                  </Label>
                  <div className="flex gap-2">
                    <Select value={toMode} onValueChange={(val: any) => setToMode(val)}>
                      <SelectTrigger className="h-9 text-xs w-32 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash in Hand</SelectItem>
                        <SelectItem value="bank">Bank Account</SelectItem>
                      </SelectContent>
                    </Select>
                    {toMode === "bank" && (
                      <Select value={toBank} onValueChange={setToBank}>
                        <SelectTrigger className="h-9 text-xs flex-1">
                          <SelectValue placeholder="Select Bank" />
                        </SelectTrigger>
                        <SelectContent>
                          {bankOptions.map((b) => (
                            <SelectItem key={b} value={b}>
                              {b}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                {/* Voucher Date */}
                <div>
                  <Label className="text-xs font-semibold">Voucher Date</Label>
                  <Input
                    type="date"
                    value={voucherDate}
                    onChange={(e) => setVoucherDate(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Row 2: Link to Invoice or Client Selector (Hidden if Transfer) */}
          {direction !== "transfer" && (
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Row 2: Link to Invoice or Party
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
                {/* Search Box */}
                <div className="lg:col-span-7">
                  <Label className="text-xs font-semibold">
                    Link to Invoice (Search Invoice No / Ticket No / PNR)
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSearchInvoice();
                        }
                      }}
                      placeholder="Type Invoice #, Ticket # or PNR..."
                      className="h-9 text-xs font-mono pr-24 uppercase"
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

                {/* Direct Party / Client Selector */}
                <div className="lg:col-span-5">
                  <Label className="text-xs font-semibold">
                    Or Select {direction === "received" ? "Client" : "Vendor"} Manually
                  </Label>
                  <Select value={partyId} onValueChange={setPartyId}>
                    <SelectTrigger className="h-9 text-xs mt-1">
                      <SelectValue placeholder="Select Party" />
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
              </div>

              {/* Matched Invoice Summary Card */}
              {matchedInvoice && (
                <div className="p-3 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600" />
                    <span className="font-bold text-teal-900 dark:text-teal-200">
                      {matchedInvoice.clientName}
                    </span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {matchedInvoice.invoiceNo}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 font-mono text-[11px]">
                    <span>Total: <strong>PKR {matchedInvoice.totalAmount.toLocaleString()}</strong></span>
                    <span>Paid: <strong>PKR {matchedInvoice.paidAmount.toLocaleString()}</strong></span>
                    <span className="text-teal-700 dark:text-teal-300 font-bold">
                      Remaining: PKR {matchedInvoice.remainingAmount.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Row 3: Amount (PKR), Cheque / Reference / Slip No (Equal Columns) */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Row 3: Amount & Banking References
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Amount (PKR) <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="h-9 text-xs font-mono font-bold text-right mt-1"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Cheque / Reference / Deposit Slip No
                </Label>
                <Input
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  placeholder="e.g. CHQ-98124 or IBFT-675241"
                  className="h-9 text-xs font-mono mt-1"
                />
              </div>
            </div>
          </div>

          {/* Row 4: Description / Remarks (Full Width) & Write-off */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
            <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Row 4: Description / Remarks
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Received partial advance payment for ticket booking, remaining on passport collection..."
              className="w-full min-h-[75px] max-h-[120px] text-xs resize-none"
            />

            {/* Write-off / Discount adjustment checkbox */}
            {direction !== "transfer" && (
              <div className="pt-2 border-t space-y-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={isAdjustment}
                    onChange={(e) => setIsAdjustment(e.target.checked)}
                    className="rounded border-slate-300 text-teal-600"
                  />
                  <span>Mark as write-off / discount adjustment</span>
                </label>
                {isAdjustment && (
                  <Input
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                    placeholder="Reason for write-off or discount adjustment (e.g. Goodwill waiver, negotiated discount)..."
                    className="h-8 text-xs"
                  />
                )}
              </div>
            )}
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
            variant="outline"
            size="sm"
            disabled={isSubmitting}
            onClick={() => handleSave(true)}
            className="text-xs gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-blue-600" />
            Save & Print
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isSubmitting}
            onClick={() => handleSave(false)}
            className="text-xs bg-[#0B192C] hover:bg-[#1E3E62] text-white cursor-pointer min-w-[120px]"
          >
            {isSubmitting ? "Saving..." : "Save Voucher"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
