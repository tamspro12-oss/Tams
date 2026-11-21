import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
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
import { useParties } from "@/hooks/useParties";
import { useAgency } from "@/hooks/useAgency";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useAccounts } from "@/hooks/useUnifiedTransactions";
import {
  resolveAccountIdForPayment,
  refreshAffectedFinancialQueries,
} from "@/lib/accountingEngine";
import { LockedDateField, getTodayDateString } from "@/components/ui/LockedDateField";
import { useFormKeyboardNav } from "@/hooks/useFormKeyboardNav";
import { UniversalPartySelect } from "@/components/parties/UniversalPartySelect";
import { AgencyBankSelect } from "@/components/banks/AgencyBankSelect";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cleanPastedSearch } from "@/lib/searchUtils";
import { DocumentNumberControl } from "@/components/ui/DocumentNumberControl";
import {
  createRequestId,
  rpcWithPreSqlFallback,
  runBackgroundTask,
} from "@/lib/atomicSave";
import { runUiAtomicSave } from "@/lib/atomicSaveUi";
import {
  hasPaymentPermission,
  resolveVoucherOpenState,
  type VoucherDirection,
} from "@/lib/paymentVoucherHelpers";
import { getDrCrLabelForParty } from "@/lib/partyLedger";
import {
  Search,
  CheckCircle2,
  CreditCard,
  Loader2,
  AlertCircle,
  Lock,
  AlertTriangle,
  Link2,
} from "lucide-react";
import {
  hydrateVoucherForEdit,
  evaluateVoucherEdit,
  type VoucherEditMode,
  type VoucherEditSnapshot,
} from "@/lib/documentEditHelpers";

interface PaymentVoucherFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  initialPartyId?: string;
  initialDirection?: VoucherDirection;
  initialInvoiceNo?: string;
  initialAmount?: number;
  editingVoucher?: any | null;
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
  sourceTable?: "booking_invoices" | "invoices";
}

export const PaymentVoucherForm: React.FC<PaymentVoucherFormProps> = ({
  open,
  onOpenChange,
  onSuccess,
  initialPartyId,
  initialDirection,
  initialInvoiceNo,
  initialAmount,
  editingVoucher,
}) => {
  const queryClient = useQueryClient();
  const { parties, isLoading: isLoadingParties } = useParties();
  const { data: agency } = useAgency();
  const { data: currentAgencyId } = useCurrentAgencyId();
  const { isSubUser, isActive, permissions, isLoading: isLoadingPerms } = useUserPermissions();
  const { accounts = [] } = useAccounts();

  const formRef = useRef<HTMLDivElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const lastSearchedQueryRef = useRef<string>("");
  const appliedOpenSessionRef = useRef<string | null>(null);
  const notFoundHandledRef = useRef<boolean>(false);
  const permissionHandledRef = useRef<boolean>(false);

  // Line 1: Voucher Date | Payment Mode | Direction | Amount (PKR) * | Cheque / Reference No
  const [voucherDate, setVoucherDate] = useState<string>(
    () => getTodayDateString()
  );
  const [paymentMode, setPaymentMode] = useState<VoucherEditMode>("cash");
  const [direction, setDirection] = useState<"received" | "paid">("received");
  const [amount, setAmount] = useState<string>("");
  const [referenceNo, setReferenceNo] = useState<string>("");

  // Bank selection (strictly agency bank)
  const [selectedBank, setSelectedBank] = useState<string>("");

  // Invoice & Party Linking
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [matchedInvoice, setMatchedInvoice] = useState<MatchedInvoice | null>(null);
  const [partyId, setPartyId] = useState<string>("");
  const [isResolvingInitialParty, setIsResolvingInitialParty] = useState(false);
  const [partyNotice, setPartyNotice] = useState<string | null>(null);

  // Remarks & Write-off & Audit Reason
  const [notes, setNotes] = useState<string>("");
  const [isAdjustment, setIsAdjustment] = useState<boolean>(false);
  const [adjustmentReason, setAdjustmentReason] = useState<string>("");
  const [editReason, setEditReason] = useState<string>("");
  const [initialEditSnapshot, setInitialEditSnapshot] = useState<VoucherEditSnapshot | null>(null);
  const hydratedVoucherIdRef = useRef<string | null>(null);

  const isEditMode = Boolean(editingVoucher?.id);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);
  const requestIdRef = useRef<string>(createRequestId());

  // Auto Voucher Number preview + optional manual override
  const [autoVoucherNo, setAutoVoucherNo] = useState<string>("Auto-assigned");
  const [isManualVoucherNo, setIsManualVoucherNo] = useState<boolean>(false);
  const [manualVoucherNo, setManualVoucherNo] = useState<string>("");

  const activeDocType = direction === "received" ? "voucher_crv" : "voucher_cpv";

  // Generate sequence preview on open or direction change
  const fetchNextNumber = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("preview_next_number", {
        p_counter_type: direction === "received" ? "voucher_crv" : "voucher_cpv",
      });
      if (!error && data) {
        setAutoVoucherNo(String(data));
        return;
      }
    } catch {}
    setAutoVoucherNo(`${direction === "received" ? "CRV" : "CPV"}-Auto`);
  }, [direction]);

  const focusAmountField = useCallback(() => {
    window.requestAnimationFrame(() => {
      const el = amountInputRef.current;
      if (el) {
        el.focus({ preventScroll: false });
        try {
          el.select();
        } catch {
          // Ignore selection errors on number inputs
        }
      }
    });
  }, []);

  const canRecordPayments = hasPaymentPermission({
    isSubUser,
    isActive,
    permissions,
    isLoading: isLoadingPerms,
  });

  // Fetch linked invoices when editing an existing voucher
  const { data: linkedAllocations = [] } = useQuery({
    queryKey: ["voucher_linked_allocations", currentAgencyId, editingVoucher?.id],
    enabled: Boolean(open && isEditMode && currentAgencyId && editingVoucher?.id),
    queryFn: async () => {
      if (!currentAgencyId || !editingVoucher?.id) return [];
      const { data } = await (supabase as any)
        .from("invoice_allocations")
        .select(
          "allocated_amount, invoice:booking_invoices!invoice_id(id, invoice_no, client_amount, paid_amount, payment_status)"
        )
        .eq("agency_id", currentAgencyId)
        .eq("voucher_id", editingVoucher.id);
      return data || [];
    },
  });

  useEffect(() => {
    if (!open) {
      appliedOpenSessionRef.current = null;
      hydratedVoucherIdRef.current = null;
      notFoundHandledRef.current = false;
      permissionHandledRef.current = false;
      setIsResolvingInitialParty(false);
      setPartyNotice(null);
      setPartyId("");
      setAmount("");
      setPaymentMode("cash");
      setSelectedBank("");
      setReferenceNo("");
      setNotes("");
      setSearchQuery("");
      setMatchedInvoice(null);
      setIsAdjustment(false);
      setAdjustmentReason("");
      setEditReason("");
      setInitialEditSnapshot(null);
      return;
    }

    if (!isLoadingPerms && !canRecordPayments) {
      if (!permissionHandledRef.current) {
        permissionHandledRef.current = true;
        toast.error("You do not have permission to record payments.");
        onOpenChange(false);
      }
      return;
    }

    if (editingVoucher?.id) {
      if (hydratedVoucherIdRef.current !== editingVoucher.id) {
        hydratedVoucherIdRef.current = editingVoucher.id;
        requestIdRef.current = createRequestId();
        const hydrated = hydrateVoucherForEdit(editingVoucher, accounts);
        setVoucherDate(
          String(editingVoucher.voucher_date || getTodayDateString()).slice(0, 10)
        );
        setDirection(editingVoucher.direction === "paid" ? "paid" : "received");
        setPartyId(editingVoucher.party_id || "");
        setIsAdjustment(Boolean(editingVoucher.is_adjustment));
        setAdjustmentReason(String(editingVoucher.adjustment_reason || ""));
        setAmount(hydrated.amount);
        setPaymentMode(hydrated.paymentMode);
        setSelectedBank(hydrated.selectedBank);
        setReferenceNo(hydrated.referenceNo);
        setNotes(hydrated.notes);
        setInitialEditSnapshot(hydrated.initialSnapshot);
        setEditReason("");
        setIsManualVoucherNo(false);
        setManualVoucherNo("");
      }
      return;
    }

    requestIdRef.current = createRequestId();
    setVoucherDate(getTodayDateString());
    setIsManualVoucherNo(false);
    setManualVoucherNo("");
  }, [open, editingVoucher, accounts, isLoadingPerms, canRecordPayments, onOpenChange]);

  // Complete bank name hydration if accounts finished loading after edit dialog opened
  useEffect(() => {
    if (!open || !isEditMode || !editingVoucher?.account_id || accounts.length === 0) return;
    if (paymentMode === "cash" || selectedBank) return;
    if (!initialEditSnapshot || initialEditSnapshot.selectedBank) return;

    const resolvedAcc = accounts.find((a) => a.id === editingVoucher.account_id);
    if (resolvedAcc?.name) {
      setSelectedBank(resolvedAcc.name);
      setInitialEditSnapshot((prev) =>
        prev
          ? {
              ...prev,
              selectedBank: resolvedAcc.name,
            }
          : prev
      );
    }
  }, [open, isEditMode, editingVoucher, accounts, paymentMode, selectedBank, initialEditSnapshot]);

  // Apply pre-fill (party, direction, invoice, amount) when opening in Create mode
  useEffect(() => {
    if (!open || isEditMode || (!isLoadingPerms && !canRecordPayments)) return;

    const sessionKey = `${initialPartyId || ""}|${initialDirection || ""}|${initialInvoiceNo || ""}|${initialAmount || ""}`;
    const resolved = resolveVoucherOpenState({
      partyId: initialPartyId,
      direction: initialDirection,
      parties,
      isLoadingParties,
      hasPermission: isLoadingPerms ? true : canRecordPayments,
    });

    if (resolved.status === "loading") {
      setIsResolvingInitialParty(true);
      setPartyNotice(null);
      if (initialDirection) {
        setDirection(resolved.direction);
      }
      return;
    }

    setIsResolvingInitialParty(false);

    if (resolved.status === "not_found") {
      setPartyId("");
      setDirection(resolved.direction);
      setPartyNotice(resolved.friendlyMessage);
      if (!notFoundHandledRef.current) {
        notFoundHandledRef.current = true;
        toast.info(resolved.friendlyMessage || "Selected party was not found.");
      }
      if (appliedOpenSessionRef.current !== sessionKey) {
        appliedOpenSessionRef.current = sessionKey;
        setAmount(initialAmount && initialAmount > 0 ? String(initialAmount) : "");
        focusAmountField();
      }
      return;
    }

    if (appliedOpenSessionRef.current !== sessionKey) {
      appliedOpenSessionRef.current = sessionKey;
      setPartyNotice(null);
      setPartyId(resolved.partyId);
      setDirection(resolved.direction);
      setAmount(initialAmount && initialAmount > 0 ? String(initialAmount) : "");
      if (initialInvoiceNo) {
        setSearchQuery(initialInvoiceNo);
      }
      if (resolved.partyId) {
        focusAmountField();
      }
    }
  }, [
    open,
    initialPartyId,
    initialDirection,
    initialInvoiceNo,
    initialAmount,
    parties,
    isLoadingParties,
    isLoadingPerms,
    canRecordPayments,
    focusAmountField,
  ]);

  useEffect(() => {
    if (open && !isEditMode) {
      fetchNextNumber();
    }
  }, [open, isEditMode, direction, fetchNextNumber]);

  const selectedPartyObj = useMemo(
    () => (partyId ? parties.find((p) => p.id === partyId) || null : null),
    [parties, partyId]
  );

  const selectedPartyBalanceInfo = useMemo(() => {
    if (!selectedPartyObj) return null;
    return getDrCrLabelForParty(
      Number(selectedPartyObj.current_balance) || 0,
      selectedPartyObj.type
    );
  }, [selectedPartyObj]);

  // Fetch recent vouchers for compact sheet below form
  const { data: recentVouchers = [], refetch: refetchRecentVouchers } = useQuery({
    queryKey: ["recent_payment_vouchers", currentAgencyId],
    queryFn: async () => {
      if (!currentAgencyId) return [];
      const { data } = await (supabase as any)
        .from("payment_vouchers")
        .select("*, party:parties!party_id(name)")
        .eq("agency_id", currentAgencyId)
        .order("voucher_date", { ascending: false })
        .limit(5);

      if (data && data.length > 0) return data;

      // Fallback: read from transactions table
      const { data: txData } = await (supabase as any)
        .from("transactions")
        .select("*")
        .eq("agency_id", currentAgencyId)
        .in("type", ["payment_in", "payment_out"])
        .order("date", { ascending: false })
        .limit(5);

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
    enabled: open && !!currentAgencyId,
  });

  const typeLabel =
    direction === "received"
      ? "Cash / Bank Receipt Voucher (CRV)"
      : "Cash / Bank Payment Voucher (CPV)";

  const rawNumericAmount = Number.parseFloat(amount);
  const numericAmount = Number.isFinite(rawNumericAmount) ? rawNumericAmount : 0;

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
          sourceTable: "booking_invoices",
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
          sourceTable: "invoices",
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

  const voucherLedgerChanged = Boolean(
    isEditMode &&
      initialEditSnapshot &&
      (numericAmount !== initialEditSnapshot.amount ||
        paymentMode !== initialEditSnapshot.paymentMode ||
        (paymentMode !== "cash" &&
          selectedBank.trim() !== initialEditSnapshot.selectedBank))
  );

  // Save handler
  const handleSave = async () => {
    if (isSubmittingRef.current || isSubmitting) return;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("Network connection issue. You are offline, not saved.");
      return;
    }

    // EDIT MODE PATH
    if (isEditMode && editingVoucher && initialEditSnapshot) {
      const evaluation = evaluateVoucherEdit(
        initialEditSnapshot,
        {
          amount: numericAmount,
          paymentMode,
          selectedBank,
          referenceNo,
          notes,
        },
        editReason,
        isAdjustment
      );

      if (evaluation.noChanges) {
        toast.info("No changes were made.");
        onOpenChange(false);
        return;
      }

      if (!evaluation.ok) {
        toast.error(evaluation.error || "Please review your changes.");
        return;
      }

      const changed = new Set(evaluation.changedFields);
      const resolvedAccountId = isAdjustment
        ? null
        : resolveAccountIdForPayment(accounts, paymentMode, selectedBank);

      await runUiAtomicSave({
        requestIdRef,
        isLockedRef: isSubmittingRef,
        setIsSubmitting,
        contextLabel: "PaymentVoucherForm.handleEditSave",
        fallbackErrorMessage: "Failed to update payment voucher. Please try again.",
        execute: async (requestId) => {
          const { data: rpcData, error: rpcErr } = await (supabase as any).rpc(
            "edit_payment_voucher_atomic",
            {
              p_voucher_id: editingVoucher.id,
              p_reason: editReason.trim(),
              p_amount: changed.has("amount") ? numericAmount : null,
              p_payment_mode: changed.has("payment_mode") ? paymentMode : null,
              p_account_id:
                !isAdjustment &&
                (changed.has("payment_mode") || changed.has("bank_name"))
                  ? resolvedAccountId
                  : null,
              p_bank_name:
                changed.has("bank_name") || changed.has("payment_mode")
                  ? paymentMode === "cash"
                    ? ""
                    : selectedBank.trim()
                  : null,
              p_reference_no: changed.has("reference_no") ? referenceNo.trim() : null,
              p_notes: changed.has("notes") ? notes.trim() : null,
              p_request_id: requestId,
            }
          );
          if (rpcErr) throw rpcErr;
          if (rpcData && rpcData.success === false) {
            throw new Error(rpcData.error || "Failed to update payment voucher");
          }
          return rpcData;
        },
        onSuccess: (rpcData) => {
          onOpenChange(false);
          toast.success(
            rpcData?.affected_ledger
              ? `Voucher ${editingVoucher.voucher_no} updated & ledger corrected`
              : `Voucher ${editingVoucher.voucher_no} updated`
          );

          runBackgroundTask("payment-voucher-post-edit", () => {
            refreshAffectedFinancialQueries(queryClient, "all", currentAgencyId);
            void queryClient.invalidateQueries({
              queryKey: ["voucher_linked_allocations"],
            });
            refetchRecentVouchers();
            if (onSuccess) onSuccess();
          });
        },
      });
      return;
    }

    // CREATE MODE PATH
    if (!partyId && !matchedInvoice?.clientName) {
      toast.error("Please select a client or vendor, or link an invoice");
      return;
    }
    if ((paymentMode === "bank" || paymentMode === "transfer") && !selectedBank) {
      toast.error("Please select an agency bank account");
      return;
    }

    if (numericAmount <= 0 || !Number.isFinite(numericAmount)) {
      toast.error("Amount must be greater than zero");
      return;
    }

    if (isManualVoucherNo) {
      const customNo = manualVoucherNo.trim();
      if (!customNo) {
        toast.error("Please enter a custom voucher number or switch back to Auto");
        return;
      }
    }

    const resolvedAccountId = isAdjustment
      ? null
      : resolveAccountIdForPayment(accounts, paymentMode, selectedBank);

    const legacyParams = {
      p_direction: direction,
      p_amount: numericAmount,
      p_payment_mode: paymentMode,
      p_account_id: resolvedAccountId,
      p_party_id: partyId || null,
      p_voucher_no: isManualVoucherNo ? manualVoucherNo.trim() : null,
      p_voucher_date: voucherDate,
      p_reference_no: referenceNo || null,
      p_is_adjustment: isAdjustment,
      p_adjustment_reason: adjustmentReason || null,
      p_bank_name:
        paymentMode === "bank" || paymentMode === "transfer" ? selectedBank || null : null,
      p_invoice_id: matchedInvoice?.sourceTable === "booking_invoices" ? matchedInvoice.id : null,
      p_notes:
        [
          (paymentMode === "bank" || paymentMode === "transfer") && selectedBank
            ? `Bank: ${selectedBank}`
            : null,
          notes,
        ]
          .filter(Boolean)
          .join(" — ") || null,
      p_is_manual: isManualVoucherNo,
    };

    await runUiAtomicSave({
      requestIdRef,
      isLockedRef: isSubmittingRef,
      setIsSubmitting,
      contextLabel: "PaymentVoucherForm.handleSave",
      fallbackErrorMessage: "Failed to record payment voucher. Please try again.",
      execute: async (requestId) => {
        const rpcData = await rpcWithPreSqlFallback(
          supabase as any,
          "save_payment_voucher",
          { ...legacyParams, p_request_id: requestId },
          { legacyParams, isAutoMode: !isManualVoucherNo }
        );
        if (rpcData && rpcData.success === false) {
          throw new Error(rpcData.error || "Failed to record payment voucher");
        }
        return rpcData;
      },
      onSuccess: (rpcData) => {
        const assignedNo =
          rpcData?.voucher_no || (isManualVoucherNo ? manualVoucherNo.trim() : autoVoucherNo);
        const savedLabel = direction === "received" ? "Receipt (CRV)" : "Payment (CPV)";

        // Close modal IMMEDIATELY on successful save
        onOpenChange(false);
        toast.success(`${savedLabel} ${assignedNo} saved`);

        // Clear fields cleanly & refresh affected queries in background
        setAmount("");
        setReferenceNo("");
        setNotes("");
        setSearchQuery("");
        setMatchedInvoice(null);
        setPartyId("");
        setPartyNotice(null);
        setIsAdjustment(false);
        setAdjustmentReason("");
        setIsManualVoucherNo(false);
        setManualVoucherNo("");

        runBackgroundTask("payment-voucher-post-save", () => {
          refreshAffectedFinancialQueries(queryClient, "voucher", currentAgencyId);
          refetchRecentVouchers();
          fetchNextNumber();
          if (onSuccess) onSuccess();
        });
      },
    });
  };

  const isDirty = useMemo(() => {
    if (isEditMode && initialEditSnapshot) {
      const ev = evaluateVoucherEdit(
        initialEditSnapshot,
        {
          amount: numericAmount,
          paymentMode,
          selectedBank,
          referenceNo,
          notes,
        },
        editReason,
        isAdjustment
      );
      return Boolean(editReason.trim() || !ev.noChanges);
    }
    return Boolean(
      numericAmount > 0 ||
        referenceNo.trim() ||
        searchQuery.trim() !== (initialInvoiceNo || "").trim() ||
        matchedInvoice ||
        partyId !== (initialPartyId || "") ||
        notes.trim() ||
        isAdjustment ||
        adjustmentReason.trim()
    );
  }, [
    isEditMode,
    initialEditSnapshot,
    paymentMode,
    selectedBank,
    editReason,
    numericAmount,
    referenceNo,
    searchQuery,
    initialInvoiceNo,
    matchedInvoice,
    partyId,
    initialPartyId,
    notes,
    isAdjustment,
    adjustmentReason,
  ]);

  useFormKeyboardNav({
    containerRef: formRef,
    enabled: open,
    autoFocusFirst: isEditMode ? true : !initialPartyId,
    isDirty,
    onSave: handleSave,
    onCancel: () => onOpenChange(false),
    onBeforeAdvance: (el) => {
      if (el.dataset.enterSearch === "true") {
        const q = searchQuery.trim();
        if (q && q !== lastSearchedQueryRef.current) {
          lastSearchedQueryRef.current = q;
          executeSearchInvoice(q);
          return false;
        }
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(e) => {
          if (!isEditMode && initialPartyId) {
            e.preventDefault();
            focusAmountField();
          }
        }}
        className="w-[96vw] max-w-5xl max-h-[92vh] flex flex-col overflow-hidden p-0 gap-0 bg-background border rounded-xl shadow-2xl"
      >
        {/* HEADER: Title, Auto/Manual Voucher # badge, Type Label, Close (X) */}
        <div className="px-4 sm:px-5 pr-10 py-2.5 border-b flex flex-wrap items-center justify-between gap-2 shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <CreditCard className="w-4 h-4 text-teal-600 shrink-0" />
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
              {isEditMode ? "Edit Payment Voucher" : "Payment Voucher"}
            </DialogTitle>
          </div>

          {isEditMode && editingVoucher ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border text-xs font-mono font-bold text-teal-600 dark:text-teal-400">
              <Lock className="w-3 h-3 text-amber-600 shrink-0" />
              <span>Voucher #: {editingVoucher.voucher_no}</span>
            </div>
          ) : (
            <DocumentNumberControl
              label="Voucher #:"
              docType={activeDocType}
              previewNumber={autoVoucherNo}
              isManual={isManualVoucherNo}
              manualValue={manualVoucherNo}
              onManualModeChange={setIsManualVoucherNo}
              onManualValueChange={setManualVoucherNo}
              accentClassName="text-teal-600 dark:text-teal-400"
            />
          )}

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

        {/* BODY + FOOTER wrapped for unified keyboard nav */}
        <div ref={formRef} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-5 py-3 space-y-2.5">
          {/* ROW 1: Voucher Date | Link to Invoice (or Linked Invoices in Edit) | Party (Client / Vendor) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2 items-start">
            {/* 1. Voucher Date (Locked System Date or Original Date) */}
            <div className="lg:col-span-2">
              <LockedDateField
                label="Voucher Date"
                value={voucherDate}
                lockedDate={isEditMode ? voucherDate : undefined}
                onChange={isEditMode ? undefined : setVoucherDate}
                helperText={
                  isEditMode
                    ? "Original entry date is locked"
                    : "Locked to current system date for audit integrity"
                }
                required
              />
            </div>

            {/* 2. Link to Invoice (Create) OR Linked Invoices Summary (Edit) */}
            {isEditMode ? (
              <div className="lg:col-span-5">
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <span>Linked Invoice(s)</span>
                  <Lock className="w-2.5 h-2.5 text-amber-600" />
                </Label>
                <div className="mt-1 min-h-[32px] px-2.5 py-1.5 rounded-md border bg-slate-100/80 dark:bg-slate-800/80 text-xs flex flex-wrap items-center gap-1.5">
                  {linkedAllocations.length > 0 ? (
                    linkedAllocations.map((alloc: any, i: number) => (
                      <span
                        key={alloc.invoice?.id || i}
                        className="inline-flex items-center gap-1 font-mono text-[11px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800"
                      >
                        <Link2 className="w-2.5 h-2.5" />
                        {alloc.invoice?.invoice_no || "Invoice"} (PKR{" "}
                        {Number(alloc.allocated_amount || 0).toLocaleString()})
                      </span>
                    ))
                  ) : (
                    <span className="text-muted-foreground text-[11px]">
                      General party voucher (updates party ledger automatically)
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="lg:col-span-5">
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Link to Invoice
                </Label>
                <div className="relative mt-1">
                  <Input
                    value={searchQuery}
                    onChange={(e) => {
                      lastSearchedQueryRef.current = "";
                      setSearchQuery(e.target.value);
                    }}
                    onPaste={(e) => {
                      const pasted = e.clipboardData.getData("text");
                      if (pasted) {
                        e.preventDefault();
                        const cleaned = cleanPastedSearch(pasted);
                        lastSearchedQueryRef.current = cleaned.trim();
                        setSearchQuery(cleaned);
                        setTimeout(() => executeSearchInvoice(cleaned), 0);
                      }
                    }}
                    data-enter-search="true"
                    placeholder="Invoice #, Ticket # or PNR..."
                    className="h-8 text-xs font-mono pr-20 uppercase"
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2">
                    <Button
                      type="button"
                      size="sm"
                      tabIndex={-1}
                      data-compact-btn=""
                      onClick={() => {
                        lastSearchedQueryRef.current = searchQuery.trim();
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
            )}

            {/* 3. Party (Locked in Edit mode, Searchable in Create mode) */}
            <div className="sm:col-span-2 lg:col-span-5">
              {isEditMode ? (
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <span>Party (Client / Vendor)</span>
                    <Lock className="w-2.5 h-2.5 text-amber-600" />
                  </Label>
                  <Input
                    value={
                      editingVoucher?.party?.name ||
                      selectedPartyObj?.name ||
                      "Direct Account"
                    }
                    readOnly
                    tabIndex={-1}
                    className="h-8 text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-not-allowed font-medium"
                  />
                  {selectedPartyObj && selectedPartyBalanceInfo && (
                    <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                      <span>Current balance:</span>
                      <span
                        className={`font-mono font-semibold ${
                          selectedPartyBalanceInfo.code === ""
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {selectedPartyBalanceInfo.formatted}
                      </span>
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <UniversalPartySelect
                    value={partyId}
                    onChange={(nextId, nextParty) => {
                      setPartyId(nextId);
                      setPartyNotice(null);
                      if (nextParty && !initialDirection) {
                        setDirection(nextParty.type === "vendor" ? "paid" : "received");
                      }
                    }}
                    label="Party (Client / Vendor)"
                    placeholder="Search client or vendor..."
                    defaultQuickAddType={direction === "received" ? "client" : "vendor"}
                    required
                  />
                  {isResolvingInitialParty ? (
                    <p className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Loading party details...
                    </p>
                  ) : selectedPartyObj && selectedPartyBalanceInfo ? (
                    <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                      <span>Current balance:</span>
                      <span
                        className={`font-mono font-semibold ${
                          selectedPartyBalanceInfo.code === ""
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {selectedPartyBalanceInfo.formatted}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        ({selectedPartyBalanceInfo.statusLabel})
                      </span>
                    </p>
                  ) : partyNotice ? (
                    <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{partyNotice}</span>
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </div>

          {/* ROW 2: Direction | Payment Mode (+ Bank) | Amount (PKR) * | Cheque / Reference No */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2 items-start">
            {/* 1. Direction (Locked in Edit mode) */}
            <div className={paymentMode === "bank" || paymentMode === "transfer" ? "lg:col-span-2 space-y-1" : "lg:col-span-3 space-y-1"}>
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <span>Direction <span className="text-red-500">*</span></span>
                {isEditMode && <Lock className="w-2.5 h-2.5 text-amber-600" />}
              </Label>
              <Select
                value={direction}
                onValueChange={(val: any) => setDirection(val)}
                disabled={isEditMode}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="received">Received (CRV)</SelectItem>
                  <SelectItem value="paid">Paid (CPV)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 2. Payment Mode */}
            <div className={paymentMode === "bank" || paymentMode === "transfer" ? "lg:col-span-2 space-y-1" : "lg:col-span-3 space-y-1"}>
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Payment Mode <span className="text-red-500">*</span>
              </Label>
              <Select value={paymentMode} onValueChange={(val: any) => setPaymentMode(val)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash in Hand</SelectItem>
                  <SelectItem value="bank">Bank Account</SelectItem>
                  <SelectItem value="transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Conditional Bank Account (Agency Banks with Quick Add) */}
            {(paymentMode === "bank" || paymentMode === "transfer") && (
              <div className="lg:col-span-2">
                <AgencyBankSelect
                  value={selectedBank}
                  onChange={setSelectedBank}
                  label="Bank Account"
                  required={true}
                />
              </div>
            )}

            {/* 3. Amount (PKR) * */}
            <div className="lg:col-span-3 space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Amount (PKR) <span className="text-red-500">*</span>
              </Label>
              <Input
                ref={amountInputRef}
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="h-8 text-xs font-mono font-bold text-slate-900 dark:text-slate-100"
                required
                data-required-positive="true"
                data-required-message="Amount must be greater than zero"
              />
            </div>

            {/* 4. Cheque / Reference No */}
            <div className="lg:col-span-3 space-y-1">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Cheque / Reference No
              </Label>
              <Input
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="Chq #, Trx ID..."
                className="h-8 text-xs"
              />
            </div>
          </div>

          {voucherLedgerChanged && (
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>
                Amount or payment mode changed — the original accounting entry will be reversed and a corrected entry will be posted automatically, updating cash/bank balances, party dues, and linked invoice status.
              </span>
            </div>
          )}

          {/* Matched Invoice compact preview banner */}
          {!isEditMode && matchedInvoice && (
            <div className="p-2 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
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
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px]">
                <span>Total: PKR {matchedInvoice.totalAmount.toLocaleString()}</span>
                <span>Paid: PKR {matchedInvoice.paidAmount.toLocaleString()}</span>
                <span className="font-bold text-red-600 dark:text-red-400">
                  Remaining: PKR {matchedInvoice.remainingAmount.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* LINE 3: Remarks (+ Reason for Edit in Edit mode) */}
          <div className="space-y-1 pt-1 border-t">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Remarks / Particulars
              </Label>
              <label className="flex items-center gap-1 text-[11px] cursor-pointer text-slate-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={isAdjustment}
                  disabled={isEditMode}
                  onChange={(e) => setIsAdjustment(e.target.checked)}
                  className="rounded w-3 h-3 text-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1"
                />
                <span>Discount / Write-off Adjustment</span>
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-start">
              <div className={isEditMode ? "md:col-span-7" : "md:col-span-12"}>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Advance payment for ticket booking, remaining on passport collection..."
                  className="w-full min-h-[32px] h-8 max-h-[80px] text-xs resize-y py-1.5 leading-snug"
                />
              </div>
              {isEditMode && (
                <div className="md:col-span-5">
                  <Label className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 block mb-0.5">
                    Reason for Edit <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="e.g. Client transferred to Meezan instead of cash..."
                    required
                    data-required-message="Please enter a reason for this edit"
                    className="h-8 text-xs border-amber-300 dark:border-amber-800 focus-visible:ring-amber-500"
                  />
                </div>
              )}
            </div>
            {isAdjustment && (
              <Input
                value={adjustmentReason}
                readOnly={isEditMode}
                tabIndex={isEditMode ? -1 : undefined}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                placeholder="Reason for write-off or discount adjustment..."
                className="h-7 text-xs mt-1"
              />
            )}
          </div>

          {/* COMPACT RECENT VOUCHERS SHEET (Create mode only) */}
          {!isEditMode && (
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
                      className="px-2.5 py-1.5 sm:py-1 flex flex-wrap sm:flex-nowrap items-center justify-between gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          {v.voucher_no}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{v.voucher_date}</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {v.party?.name || "Direct"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
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
          )}
        </div>

        {/* FOOTER */}
        <div className="px-4 md:px-5 py-2.5 border-t bg-slate-50 dark:bg-slate-900 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            tabIndex={-1}
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs cursor-pointer w-full sm:w-auto"
          >
            {isEditMode ? "Cancel" : "Close"}
          </Button>
          <Button
            type="button"
            size="sm"
            data-save-button="true"
            disabled={isSubmitting}
            onClick={handleSave}
            className="h-8 text-xs bg-[#0B192C] hover:bg-[#1E3E62] text-white cursor-pointer w-full sm:w-auto min-w-[110px]"
          >
            {isSubmitting ? "Saving..." : isEditMode ? "Save Changes" : "Save Voucher"}
          </Button>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
