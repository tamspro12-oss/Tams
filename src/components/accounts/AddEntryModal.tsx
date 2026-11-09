import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowDownLeft, ArrowUpRight, Receipt, ArrowRightLeft, User, Building2, Store, Calendar, CreditCard, FileText } from "lucide-react";
import { useAccounts, useTransactionMutations } from "@/hooks/useUnifiedTransactions";
import { useClients, useVendors } from "@/hooks/useStorage";
import { useB2BAgents } from "@/hooks/useB2BAgents";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AddEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMode?: "received" | "paid" | "expense" | "transfer";
  defaultPartyId?: string;
  defaultPartyType?: "client" | "agent" | "vendor";
}

const COMMON_EXPENSE_CATEGORIES = [
  "Office Rent",
  "Utilities & Electricity",
  "Staff Salaries",
  "Marketing & Ads",
  "Software & SaaS",
  "Visa Processing Fees",
  "Office Supplies & Tea",
  "Internet & Phone",
  "Travel & Conveyance",
  "Commission Paid",
  "Maintenance & Repair",
  "Miscellaneous",
];

export function AddEntryModal({
  open,
  onOpenChange,
  defaultMode = "received",
  defaultPartyId,
  defaultPartyType,
}: AddEntryModalProps) {
  const [mode, setMode] = useState<"received" | "paid" | "expense" | "transfer">(defaultMode);
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [accountId, setAccountId] = useState<string>("");
  const [toAccountId, setToAccountId] = useState<string>("");
  const [partyType, setPartyType] = useState<"client" | "agent" | "vendor">(defaultPartyType || "client");
  const [selectedPartyId, setSelectedPartyId] = useState<string>(defaultPartyId || "");
  const [category, setCategory] = useState<string>("Office Supplies & Tea");
  const [customCategory, setCustomCategory] = useState<string>("");
  const [method, setMethod] = useState<string>("cash");
  const [referenceNo, setReferenceNo] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const { accounts, cashAccount, bankAccounts } = useAccounts();
  const { clients } = useClients();
  const { agents } = useB2BAgents();
  const { vendors } = useVendors();
  const { recordPayment, recordExpense, recordTransfer } = useTransactionMutations();

  // Set default account when accounts load
  React.useEffect(() => {
    if (!accountId && accounts.length > 0) {
      setAccountId(accounts[0].id);
    }
    if (!toAccountId && bankAccounts.length > 0) {
      setToAccountId(bankAccounts[0].id);
    }
  }, [accounts, accountId, toAccountId, bankAccounts]);

  // Reset or preset party
  React.useEffect(() => {
    if (defaultPartyId) setSelectedPartyId(defaultPartyId);
    if (defaultPartyType) setPartyType(defaultPartyType);
    if (defaultMode) setMode(defaultMode);
  }, [defaultPartyId, defaultPartyType, defaultMode, open]);

  // Combined party list based on selected party type
  const partyOptions = useMemo(() => {
    if (partyType === "client") {
      return (clients || []).map((c) => ({
        id: c.id,
        name: `${c.name} ${c.pnr ? `(${c.pnr})` : ""}`,
        type: "client" as const,
      }));
    } else if (partyType === "agent") {
      return (agents || []).map((a) => {
        const agentName = a.agent_name || (a as any).name || "Agent";
        const businessName = a.business_name || (a as any).company_name;
        return {
          id: a.id,
          name: `${agentName} ${businessName ? `(${businessName})` : ""}`.trim(),
          type: "agent" as const,
        };
      });
    } else {
      return (vendors || []).map((v) => ({
        id: v.id,
        name: `${v.name} ${v.company_name ? `(${v.company_name})` : ""}`,
        type: "vendor" as const,
      }));
    }
  }, [partyType, clients, agents, vendors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      toast.error("Please enter a valid amount greater than 0");
      return;
    }

    if (!accountId) {
      toast.error("Please select an account");
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === "received") {
        await recordPayment.mutateAsync({
          direction: "in",
          amount: numAmount,
          accountId,
          partyId: selectedPartyId || null,
          partyType: selectedPartyId ? partyType : null,
          date,
          method,
          referenceNo: referenceNo.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      } else if (mode === "paid") {
        await recordPayment.mutateAsync({
          direction: "out",
          amount: numAmount,
          accountId,
          partyId: selectedPartyId || null,
          partyType: selectedPartyId ? partyType : null,
          date,
          method,
          referenceNo: referenceNo.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      } else if (mode === "expense") {
        const finalCategory = category === "Other" ? (customCategory.trim() || "Miscellaneous") : category;
        await recordExpense.mutateAsync({
          amount: numAmount,
          accountId,
          category: finalCategory,
          date,
          method,
          referenceNo: referenceNo.trim() || undefined,
          notes: notes.trim() || undefined,
          partyId: selectedPartyId || null,
          partyType: selectedPartyId ? partyType : null,
        });
      } else if (mode === "transfer") {
        if (!toAccountId || toAccountId === accountId) {
          toast.error("Destination account must be different from source account");
          setIsSubmitting(false);
          return;
        }
        await recordTransfer.mutateAsync({
          fromAccountId: accountId,
          toAccountId,
          amount: numAmount,
          date,
          referenceNo: referenceNo.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      }

      // Reset form
      setAmount("");
      setReferenceNo("");
      setNotes("");
      setSelectedPartyId("");
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-[1600px] h-[92vh] flex flex-col p-0 overflow-hidden bg-background border rounded-xl shadow-2xl">
        {/* 1. Sticky Header */}
        <div className="px-6 py-3.5 border-b shrink-0 bg-white dark:bg-slate-900">
          <DialogTitle className="text-base font-bold flex items-center justify-between">
            <span className="text-lg">Add Financial Entry</span>
            <span className="text-xs font-normal text-muted-foreground uppercase tracking-wider">
              Unified Ledger
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Instantly records single-truth transactions across Agency, Accounts, and Party Ledgers.
          </DialogDescription>

          {/* 4 Entry Modes */}
          <Tabs value={mode} onValueChange={(val: any) => setMode(val)} className="w-full mt-3">
            <TabsList className="grid grid-cols-4 w-full h-9 p-0.5 bg-background border">
              <TabsTrigger
                value="received"
                className="text-xs font-semibold data-[state=active]:bg-emerald-600 data-[state=active]:text-white cursor-pointer"
              >
                <ArrowDownLeft className="w-3.5 h-3.5 mr-1" />
                Received
              </TabsTrigger>
              <TabsTrigger
                value="paid"
                className="text-xs font-semibold data-[state=active]:bg-blue-600 data-[state=active]:text-white cursor-pointer"
              >
                <ArrowUpRight className="w-3.5 h-3.5 mr-1" />
                Paid
              </TabsTrigger>
              <TabsTrigger
                value="expense"
                className="text-xs font-semibold data-[state=active]:bg-red-600 data-[state=active]:text-white cursor-pointer"
              >
                <Receipt className="w-3.5 h-3.5 mr-1" />
                Expense
              </TabsTrigger>
              <TabsTrigger
                value="transfer"
                className="text-xs font-semibold data-[state=active]:bg-purple-600 data-[state=active]:text-white cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 mr-1" />
                Transfer
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* 2. Flexible Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col justify-between overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Column 1: Amount, Date & Account Selection */}
            <div className="flex flex-col gap-3 min-h-0">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Amount & Account
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground flex items-center justify-between">
                    <span>Amount (PKR) *</span>
                    <span className="text-[10px] text-muted-foreground font-mono">Numbers only</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-muted-foreground">₨</span>
                    <Input
                      type="number"
                      step="any"
                      min="1"
                      required
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="pl-7 font-mono font-bold text-base h-10"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Date *</Label>
                  <Input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                {/* Account Selection */}
                {mode === "transfer" ? (
                  <div className="space-y-2.5 pt-1">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">From Account *</Label>
                      <Select value={accountId} onValueChange={setAccountId}>
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="Source Account" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id}>
                              {acc.name} ({acc.type.toUpperCase()})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">To Account *</Label>
                      <Select value={toAccountId} onValueChange={setToAccountId}>
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="Destination Account" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id} disabled={acc.id === accountId}>
                              {acc.name} ({acc.type.toUpperCase()})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5 pt-1">
                    <Label className="text-xs font-medium">
                      {mode === "received" ? "Deposit Into (Account) *" : "Withdraw From (Account) *"}
                    </Label>
                    <Select value={accountId} onValueChange={setAccountId}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Select Cash or Bank" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.name} ({acc.type.toUpperCase()})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            {/* Column 2: Linked Party & Expense Category */}
            <div className="flex flex-col gap-3 min-h-0">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Party Association
                </div>

                {/* Party Selection (For Received / Paid / Expense) */}
                {mode !== "transfer" ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-primary" />
                        <span>Linked Party (Optional)</span>
                      </Label>
                      {/* Party Type Radio Pills */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => { setPartyType("client"); setSelectedPartyId(""); }}
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded border transition-colors",
                            partyType === "client" ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
                          )}
                        >
                          Client
                        </button>
                        <button
                          type="button"
                          onClick={() => { setPartyType("agent"); setSelectedPartyId(""); }}
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded border transition-colors",
                            partyType === "agent" ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
                          )}
                        >
                          Agent
                        </button>
                        <button
                          type="button"
                          onClick={() => { setPartyType("vendor"); setSelectedPartyId(""); }}
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded border transition-colors",
                            partyType === "vendor" ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
                          )}
                        >
                          Vendor
                        </button>
                      </div>
                    </div>

                    <Select value={selectedPartyId} onValueChange={setSelectedPartyId}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder={`Choose ${partyType} to update their ledger...`} />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        <SelectItem value="">-- None (General Entry) --</SelectItem>
                        {partyOptions.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedPartyId && (
                      <p className="text-[11px] text-emerald-600 font-medium">
                        ✓ This entry will automatically reflect in this {partyType}'s ledger & statement!
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Internal transfer between your company's own accounts. No external party affected.
                  </p>
                )}

                {/* Expense Category (Only in Expense mode) */}
                {mode === "expense" && (
                  <div className="space-y-1.5 pt-2 border-t">
                    <Label className="text-xs font-medium">Expense Category *</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMON_EXPENSE_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                        <SelectItem value="Other">Custom Category...</SelectItem>
                      </SelectContent>
                    </Select>
                    {category === "Other" && (
                      <Input
                        placeholder="Enter custom category name..."
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        className="h-8 text-xs mt-1.5"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Column 3: Payment Method, Reference & Description */}
            <div className="flex flex-col gap-3 min-h-0">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex-1 flex flex-col space-y-3">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Payment Method & Documentation
                </div>

                {mode !== "transfer" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Payment Method</Label>
                    <Select value={method} onValueChange={setMethod}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash In Hand</SelectItem>
                        <SelectItem value="bank_transfer">Online Bank Transfer</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="card">Credit / Debit Card</SelectItem>
                        <SelectItem value="easypaisa">Easypaisa / JazzCash</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Reference / Cheque #</Label>
                  <Input
                    placeholder="e.g. TXN-10294, Chq #482"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="flex-1 flex flex-col space-y-1">
                  <Label className="text-xs font-medium">Description / Remarks</Label>
                  <Input
                    placeholder="Optional transaction remarks..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3. Pinned Bottom Footer */}
          <div className="px-6 py-3.5 border-t bg-gray-50 dark:bg-slate-900/60 flex items-center justify-end gap-3 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className={cn(
                "min-w-28 font-semibold text-xs cursor-pointer",
                mode === "received" && "bg-emerald-600 hover:bg-emerald-700 text-white",
                mode === "paid" && "bg-blue-600 hover:bg-blue-700 text-white",
                mode === "expense" && "bg-red-600 hover:bg-red-700 text-white",
                mode === "transfer" && "bg-purple-600 hover:bg-purple-700 text-white"
              )}
            >
              {isSubmitting ? "Recording..." : `Post ${mode.toUpperCase()}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
