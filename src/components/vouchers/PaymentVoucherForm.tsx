import React, { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AddPartyDialog } from "@/components/parties/AddPartyDialog";
import { AddBankDialog } from "@/components/banks/AddBankDialog";
import { useParties, Party } from "@/hooks/useParties";
import { useAgency } from "@/hooks/useAgency";
import { useAgencyBanks } from "@/hooks/useAgencyBanks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Search,
  CheckCircle2,
  Lock,
  Plus,
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
  const { allBankNames = [] } = useAgencyBanks();

  // Direction: Received | Paid | Transfer
  const [direction, setDirection] = useState<"received" | "paid" | "transfer">("received");
  const [paymentMode, setPaymentMode] = useState<"cash" | "bank">("cash");
  const [voucherDate, setVoucherDate] = useState<string>(
    () => new Date().toISOString().slice(0, 10)
  );

  // Bank selection
  const [selectedBank, setSelectedBank] = useState<string>("");
  const [dbBanks, setDbBanks] = useState<string[]>([]);

  // Transfer accounts
  const [fromAccount, setFromAccount] = useState<string>("Cash in Hand");
  const [toAccount, setToAccount] = useState<string>("");

  // Invoice & Party Linking
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [matchedInvoice, setMatchedInvoice] = useState<MatchedInvoice | null>(null);
  const [partyId, setPartyId] = useState<string>("");

  // Amount & Reference
  const [amount, setAmount] = useState<string>("0");
  const [referenceNo, setReferenceNo] = useState<string>("");

  // Remarks & Write-off
  const [notes, setNotes] = useState<string>("");
  const [isAdjustment, setIsAdjustment] = useState<boolean>(false);
  const [adjustmentReason, setAdjustmentReason] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Quick Add Dialogs
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [isAddVendorOpen, setIsAddVendorOpen] = useState(false);
  const [isAddBankOpen, setIsAddBankOpen] = useState(false);

  // Auto Voucher Number
  const [voucherSeq, setVoucherSeq] = useState<string>("1001");

  // Load banks
  useEffect(() => {
    async function loadBankAccounts() {
      try {
        const { data } = await (supabase as any)
          .from("accounts")
          .select("name, type, active")
          .eq("type", "bank")
          .eq("active", true);

        const accountNames = (data || []).map((a: any) => a.name);
        const combined = Array.from(new Set([...allBankNames, ...accountNames, ...DEFAULT_BANKS]));
        setDbBanks(combined);

        if (!selectedBank && combined[0]) {
          setSelectedBank(combined[0]);
        }
        if (!toAccount && combined[0]) {
          setToAccount(combined[0]);
        }
      } catch {
        setDbBanks(DEFAULT_BANKS);
        if (!selectedBank) setSelectedBank(DEFAULT_BANKS[0]);
        if (!toAccount) setToAccount(DEFAULT_BANKS[0]);
      }
    }

    if (open) {
      loadBankAccounts();
    }
  }, [open, allBankNames]);

  // Generate sequence on open or direction change
  useEffect(() => {
    async function fetchNextNumber() {
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
    }

    if (open) {
      fetchNextNumber();
    }
  }, [open, direction]);

  const voucherPrefix =
    direction === "received" ? "CRV" : direction === "paid" ? "CPV" : "ITV";
  const autoVoucherNo = `${voucherPrefix}-${voucherSeq}`;

  const typeLabel =
    direction === "received"
      ? "Cash / Bank Receipt Voucher (CRV)"
      : direction === "paid"
      ? "Cash / Bank Payment Voucher (CPV)"
      : "Internal Account Transfer (ITV)";

  const bankOptions = dbBanks.length > 0 ? dbBanks : DEFAULT_BANKS;

  const clients = useMemo(() => parties.filter((p) => p.type === "client" || p.type === "both"), [parties]);
  const vendors = useMemo(() => parties.filter((p) => p.type === "vendor" || p.type === "both"), [parties]);

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
      // 1. Invoices table
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

      // 2. Clients / Bookings table (PNR / Ticket / Name)
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

      toast.info("No matching invoice found. You can select party manually.");
      setMatchedInvoice(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to search invoice");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSave = async () => {
    if (direction === "transfer") {
      if (fromAccount === toAccount) {
        toast.error("Source and destination accounts cannot be the same");
        return;
      }
    } else {
      if (!partyId && !matchedInvoice?.clientName) {
        toast.error("Please select a client or vendor, or link an invoice");
        return;
      }
      if (paymentMode === "bank" && !selectedBank) {
        toast.error("Please select a bank account");
        return;
      }
    }

    if (numericAmount <= 0) {
      toast.error("Amount must be greater than zero");
      return;
    }

    setIsSubmitting(true);
    const voucherNo = autoVoucherNo;

    try {
      if (direction === "transfer") {
        const transferDesc = `Transfer from ${fromAccount} to ${toAccount}`;

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
          p_notes: [
            paymentMode === "bank" && selectedBank ? `Bank: ${selectedBank}` : null,
            notes,
          ].filter(Boolean).join(" — ") || null,
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
      <DialogContent className="w-[96vw] max-w-5xl max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0 bg-background border rounded-xl shadow-2xl">
        {/* HEADER: Title, Auto-generated Voucher # badge, Type Label, Close (X) */}
        <div className="px-5 py-2.5 border-b flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
              New Payment Voucher
            </DialogTitle>

            {/* Read-Only Voucher # badge */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border text-xs font-mono font-bold text-slate-700 dark:text-slate-200">
              <Lock className="w-3 h-3 text-slate-400" />
              <span>Voucher #:</span>
              <span className="text-emerald-600 dark:text-emerald-400">{autoVoucherNo}</span>
              <Badge variant="secondary" className="text-[9px] px-1 h-3.5 ml-0.5">
                Auto
              </Badge>
            </div>
          </div>

          <Badge variant="outline" className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            {typeLabel}
          </Badge>
        </div>

        {/* BODY: ONE FLAT COMPACT FORM, NO SCROLLING */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3 space-y-2.5">
          {/* LINE 1: Voucher Date | Direction | Payment Mode | Amount (PKR) * | Cheque / Reference No */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 items-end">
            {/* Voucher Date */}
            <div>
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Voucher Date <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                value={voucherDate}
                onChange={(e) => setVoucherDate(e.target.value)}
                className="h-8 text-xs mt-0.5"
                required
              />
            </div>

            {/* Direction */}
            <div>
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
                  <SelectItem value="transfer">Transfer (ITV)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Payment Mode (only when direction != transfer) */}
            {direction !== "transfer" ? (
              <div>
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
            ) : (
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-semibold text-red-600 dark:text-red-400">
                    From Account
                  </Label>
                  <button
                    type="button"
                    onClick={() => setIsAddBankOpen(true)}
                    className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-2.5 h-2.5" /> Quick Add Bank
                  </button>
                </div>
                <Select value={fromAccount} onValueChange={setFromAccount}>
                  <SelectTrigger className="h-8 text-xs mt-0.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    <SelectItem value="Cash in Hand">Cash in Hand</SelectItem>
                    {bankOptions.map((b) => (
                      <SelectItem key={`from-${b}`} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Amount (PKR) * */}
            <div>
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Amount (PKR) <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="h-8 text-xs font-mono font-bold text-right mt-0.5"
                required
              />
            </div>

            {/* Cheque / Reference No */}
            <div>
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Cheque / Reference No
              </Label>
              <Input
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="CHQ / IBFT / Ref #"
                className="h-8 text-xs font-mono mt-0.5"
              />
            </div>
          </div>

          {/* LINE 2: Link to Invoice | Party dropdown (or To Account if Transfer) | Bank dropdown (if Bank Account) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2 items-end">
            {direction !== "transfer" ? (
              <>
                {/* Link to Invoice (with search button inside input) */}
                <div className={paymentMode === "bank" ? "lg:col-span-4" : "lg:col-span-6"}>
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Link to Invoice
                  </Label>
                  <div className="relative mt-0.5">
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSearchInvoice();
                        }
                      }}
                      placeholder="Invoice #, Ticket # or PNR..."
                      className="h-8 text-xs font-mono pr-20 uppercase"
                    />
                    <div className="absolute right-1 top-1/2 -translate-y-1/2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSearchInvoice}
                        disabled={isSearching}
                        className="h-6 text-[10px] px-2 bg-[#0B192C] hover:bg-[#1E3E62] text-white cursor-pointer"
                      >
                        <Search className="w-2.5 h-2.5 mr-1" />
                        {isSearching ? "..." : "Search"}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Party (dropdown grouped Clients & Vendors with Quick Add links) */}
                <div className={paymentMode === "bank" ? "lg:col-span-4" : "lg:col-span-6"}>
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      Party <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAddClientOpen(true)}
                        className="text-[10px] font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-2.5 h-2.5" /> Client
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAddVendorOpen(true)}
                        className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-2.5 h-2.5" /> Vendor
                      </button>
                    </div>
                  </div>
                  <Select value={partyId} onValueChange={setPartyId}>
                    <SelectTrigger className="h-8 text-xs mt-0.5">
                      <SelectValue placeholder="Select Client or Vendor" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      <SelectGroup>
                        <SelectLabel className="text-[10px] font-bold text-muted-foreground uppercase">
                          Clients
                        </SelectLabel>
                        {clients.map((c) => (
                          <SelectItem key={`client-${c.id}`} value={c.id}>
                            {c.name} {c.code ? `(${c.code})` : ""}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel className="text-[10px] font-bold text-muted-foreground uppercase">
                          Vendors
                        </SelectLabel>
                        {vendors.map((v) => (
                          <SelectItem key={`vendor-${v.id}`} value={v.id}>
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                {/* BANK (only when Payment Mode = Bank Account) */}
                {paymentMode === "bank" && (
                  <div className="lg:col-span-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Bank Account <span className="text-red-500">*</span>
                      </Label>
                      <button
                        type="button"
                        onClick={() => setIsAddBankOpen(true)}
                        className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-2.5 h-2.5" /> Quick Add Bank
                      </button>
                    </div>
                    <Select value={selectedBank} onValueChange={setSelectedBank}>
                      <SelectTrigger className="h-8 text-xs mt-0.5">
                        <SelectValue placeholder="Select Bank" />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {bankOptions.map((b) => (
                          <SelectItem key={b} value={b}>
                            {b}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            ) : (
              /* TRANSFER MODE: To Account */
              <div className="lg:col-span-12">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-semibold text-teal-600 dark:text-teal-400">
                    To (Destination Account) <span className="text-red-500">*</span>
                  </Label>
                  <button
                    type="button"
                    onClick={() => setIsAddBankOpen(true)}
                    className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-2.5 h-2.5" /> Quick Add Bank
                  </button>
                </div>
                <Select value={toAccount} onValueChange={setToAccount}>
                  <SelectTrigger className="h-8 text-xs mt-0.5">
                    <SelectValue placeholder="Select destination account" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    <SelectItem value="Cash in Hand">Cash in Hand</SelectItem>
                    {bankOptions.map((b) => (
                      <SelectItem key={`to-${b}`} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Matched Invoice compact preview banner */}
          {matchedInvoice && direction !== "transfer" && (
            <div className="p-2 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                <span className="font-bold text-teal-900 dark:text-teal-200">
                  {matchedInvoice.clientName}
                </span>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {matchedInvoice.invoiceNo}
                </Badge>
              </div>
              <div className="flex items-center gap-3 font-mono text-[11px]">
                <span>Total: <strong>PKR {matchedInvoice.totalAmount.toLocaleString()}</strong></span>
                <span>Paid: <strong>PKR {matchedInvoice.paidAmount.toLocaleString()}</strong></span>
                <span className="text-teal-700 dark:text-teal-300 font-bold">
                  Remaining: PKR {matchedInvoice.remainingAmount.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* LINE 3: Single-line "Remarks" input (grows only if user types more) + inline write-off toggle */}
          <div className="space-y-1.5 pt-1 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Remarks
              </Label>
              {direction !== "transfer" && (
                <label className="flex items-center gap-1 text-[11px] cursor-pointer text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={isAdjustment}
                    onChange={(e) => setIsAdjustment(e.target.checked)}
                    className="rounded border-slate-300 text-teal-600 h-3 w-3"
                  />
                  <span>Write-off / Discount adjustment</span>
                </label>
              )}
            </div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Advance payment for ticket booking, remaining on passport collection..."
              className="w-full min-h-[32px] h-8 max-h-[80px] text-xs resize-y py-1.5 leading-snug"
            />
            {isAdjustment && direction !== "transfer" && (
              <Input
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                placeholder="Reason for write-off or discount adjustment..."
                className="h-7 text-xs"
              />
            )}
          </div>
        </div>

        {/* FOOTER: Only Cancel and Save Voucher */}
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
            disabled={isSubmitting}
            onClick={handleSave}
            className="h-8 text-xs bg-[#0B192C] hover:bg-[#1E3E62] text-white cursor-pointer min-w-[110px]"
          >
            {isSubmitting ? "Saving..." : "Save Voucher"}
          </Button>
        </div>

        {/* Quick Add Popups */}
        <AddPartyDialog
          open={isAddClientOpen}
          onOpenChange={setIsAddClientOpen}
          initialType="client"
          onSaved={(newParty: Party) => {
            setPartyId(newParty.id);
            toast.success(`Client ${newParty.name} added and selected`);
          }}
        />

        <AddPartyDialog
          open={isAddVendorOpen}
          onOpenChange={setIsAddVendorOpen}
          initialType="vendor"
          onSaved={(newParty: Party) => {
            setPartyId(newParty.id);
            toast.success(`Vendor ${newParty.name} added and selected`);
          }}
        />

        <AddBankDialog
          open={isAddBankOpen}
          onOpenChange={setIsAddBankOpen}
          onSaved={(bankName: string) => {
            setDbBanks((prev) => Array.from(new Set([bankName, ...prev])));
            setSelectedBank(bankName);
            setToAccount(bankName);
          }}
        />
      </DialogContent>
    </Dialog>
  );
};
