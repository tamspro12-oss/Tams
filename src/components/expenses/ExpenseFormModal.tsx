import React, { useState, useMemo, useEffect } from "react";
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
import { useExpenses } from "@/hooks/useStorage";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { LockedDateField } from "@/components/ui/LockedDateField";
import { AgencyBankSelect } from "@/components/banks/AgencyBankSelect";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CopyValue } from "@/components/ui/CopyValue";
import {
  Receipt,
  Repeat,
  CalendarDays,
  Lock,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ExpenseFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const DEFAULT_CATEGORIES = [
  "Rent",
  "Salary",
  "Electricity",
  "Phone & Internet",
  "Tea & Entertainment",
  "Petrol & Conveyance",
  "Office Stationery",
  "Software & Maintenance",
  "Other",
];

export const ExpenseFormModal: React.FC<ExpenseFormModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const { data: currentAgencyId } = useCurrentAgencyId();
  const { expenses = [] } = useExpenses();

  // Top toggle: Normal vs Recurring
  const [expenseMode, setExpenseMode] = useState<"normal" | "recurring">("normal");

  // Form Fields
  const [expenseDate, setExpenseDate] = useState<string>(
    () => new Date().toISOString().slice(0, 10)
  );
  const [category, setCategory] = useState<string>("Rent");
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [amount, setAmount] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<"cash" | "bank">("cash");
  const [selectedBank, setSelectedBank] = useState<string>("");
  const [referenceNo, setReferenceNo] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Recurring-specific fields
  const [frequency, setFrequency] = useState<"Daily" | "Weekly" | "Monthly" | "Yearly">("Monthly");
  const [startDate, setStartDate] = useState<string>(
    () => new Date().toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState<string>("");
  const [nextDueDate, setNextDueDate] = useState<string>("");

  // Auto-calculated next due date based on startDate and frequency
  useEffect(() => {
    if (!startDate) return;
    const d = new Date(startDate);
    if (isNaN(d.getTime())) return;
    if (frequency === "Daily") d.setDate(d.getDate() + 1);
    else if (frequency === "Weekly") d.setDate(d.getDate() + 7);
    else if (frequency === "Monthly") d.setMonth(d.getMonth() + 1);
    else if (frequency === "Yearly") d.setFullYear(d.getFullYear() + 1);
    setNextDueDate(d.toISOString().slice(0, 10));
  }, [startDate, frequency]);

  // Dialogs
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCatInput, setNewCatInput] = useState("");
  const [autoExpenseNo, setAutoExpenseNo] = useState<string>("EXP-1001");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Fetch / preview auto expense number
  const fetchNextExpenseNumber = async () => {
    try {
      const { data, error } = await supabase.rpc("preview_next_number", {
        p_counter_type: "expense",
      });
      if (!error && data) {
        setAutoExpenseNo(String(data));
        return;
      }
    } catch { }
    const count = (expenses?.length || 0) + 1001;
    setAutoExpenseNo(`EXP-${count}`);
  };

  useEffect(() => {
    if (open) {
      fetchNextExpenseNumber();
    }
  }, [open, expenses.length]);

  const allCategories = useMemo(() => {
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...customCategories]));
  }, [customCategories]);

  // Latest 5 records for the compact sheet below form
  const recentFiveExpenses = useMemo(() => {
    return [...expenses]
      .sort((a: any, b: any) => {
        const dateA = new Date(a.expense_date || a.created_at || 0).getTime();
        const dateB = new Date(b.expense_date || b.created_at || 0).getTime();
        return dateB - dateA;
      })
      .slice(0, 5);
  }, [expenses]);

  const handleAddCategory = () => {
    const trimmed = newCatInput.trim();
    if (!trimmed) {
      toast.error("Please enter a category name");
      return;
    }
    setCustomCategories((prev) => [...prev, trimmed]);
    setCategory(trimmed);
    setNewCatInput("");
    setIsAddCategoryOpen(false);
    toast.success(`Category "${trimmed}" added`);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("You are offline, not saved");
      return;
    }
    const numAmount = parseFloat(amount) || 0;
    if (numAmount <= 0) {
      toast.error("Expense amount must be greater than zero");
      return;
    }

    if (paymentMode === "bank" && !selectedBank) {
      toast.error("Please select a bank account");
      return;
    }

    setIsSubmitting(true);
    try {
      let activeAgencyId = currentAgencyId;
      if (!activeAgencyId) {
        const { getAuthenticatedAgencyId } = await import("@/lib/agencyContext");
        activeAgencyId = await getAuthenticatedAgencyId();
      }

      if (expenseMode === "recurring") {
        const recurringPayload: any = {
          agency_id: activeAgencyId,
          expense_type: category,
          amount: numAmount,
          payment_mode: paymentMode,
          bank_name: paymentMode === "bank" ? selectedBank : null,
          expense_date: startDate || expenseDate,
          notes: notes ? `[Recurring ${frequency}] ${notes}` : `[Recurring ${frequency}]`,
          is_recurring: true,
          recurring_frequency: frequency.toLowerCase(),
          recurring_parent_id: null,
          is_paid: true,
          reference_number: referenceNo || null,
        };

        const { error } = await (supabase as any).from("expenses").insert(recurringPayload);
        if (error) throw error;
        toast.success(`Recurring expense (${frequency}) registered successfully`);
      } else {
        const { error: rpcError } = await (supabase as any).rpc("record_expense", {
          p_amount: numAmount,
          p_account_id: null,
          p_category: category,
          p_date: expenseDate,
          p_method: paymentMode,
          p_reference_no: referenceNo || null,
          p_agency_id: activeAgencyId || null,
          p_notes: [
            paymentMode === "bank" && selectedBank ? `Bank: ${selectedBank}` : null,
            notes,
          ]
            .filter(Boolean)
            .join(" — ") || null,
        });

        if (rpcError) {
          // Direct insert fallback to expenses table with agency_id
          const { error: directError } = await (supabase as any).from("expenses").insert({
            agency_id: activeAgencyId,
            expense_type: category,
            amount: numAmount,
            payment_mode: paymentMode,
            bank_name: paymentMode === "bank" ? selectedBank : null,
            expense_date: expenseDate,
            reference_number: referenceNo || null,
            notes: notes || null,
            is_paid: true,
          });

          if (directError) {
            throw new Error(`Failed to save expense: ${directError.message}`);
          }
        }
        toast.success("Expense recorded successfully");
      }

      // Invalidate queries so the live sheet immediately shows the newly saved expense
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["sales_expenses"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });

      // Clear form inputs (keep Date, Mode and Type)
      setAmount("");
      setReferenceNo("");
      setNotes("");

      // Regenerate next auto expense number
      fetchNextExpenseNumber();

      if (onSuccess) onSuccess();
      // Keep modal open so user can enter the next record quickly!
    } catch (err: any) {
      toast.error(`Could not save: ${err.message || "Failed to record expense"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-5xl max-h-[92vh] flex flex-col overflow-hidden p-0 gap-0 bg-background border rounded-xl shadow-2xl">
        {/* HEADER: Left Title | CENTER Segmented Toggle | Right Read-only Expense No badge */}
        <div className="px-5 py-2.5 border-b flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
          {/* Left Title */}
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-amber-600" />
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
              Record Daily Operating Expense
            </DialogTitle>
          </div>

          {/* CENTER: Normal Expense | Recurring Expense switch */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setExpenseMode("normal")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer",
                expenseMode === "normal"
                  ? "bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Receipt className="w-3.5 h-3.5" />
              Normal Expense
            </button>
            <button
              type="button"
              onClick={() => setExpenseMode("recurring")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer",
                expenseMode === "recurring"
                  ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Repeat className="w-3.5 h-3.5" />
              Recurring Expense
            </button>
          </div>

          {/* Right: auto-generated Expense No badge */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border text-xs font-mono font-bold text-slate-700 dark:text-slate-200">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>Expense #:</span>
            <span className="text-amber-600 dark:text-amber-400">{autoExpenseNo}</span>
            <Badge variant="secondary" className="text-[9px] px-1 h-3.5 ml-0.5">
              Auto
            </Badge>
          </div>
        </div>

        {/* ONE COMPACT FORM: Fits on one screen with NO scrolling */}
        <form onSubmit={handleSave} className="flex-1 min-h-0 flex flex-col justify-between overflow-hidden">
          <div className="px-5 py-3 space-y-2.5">
            {/* LINE 1: Expense Date | Category * | Amount (PKR) * | Paid From | (Bank if Bank Account) | Bill / Receipt / Ref No */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-12 gap-2 items-end">
              {/* Expense Date: Standardized Locked System Date */}
              <div className="lg:col-span-2">
                <LockedDateField
                  label="Expense Date"
                  value={expenseDate}
                  onChange={setExpenseDate}
                  required
                />
              </div>

              {/* Category * with + Quick Add Category link */}
              <div className={paymentMode === "bank" ? "lg:col-span-2" : "lg:col-span-3"}>
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Category <span className="text-red-500">*</span>
                  </Label>
                  <button
                    type="button"
                    onClick={() => setIsAddCategoryOpen(true)}
                    className="text-[10px] font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-2.5 h-2.5" /> Quick Add
                  </button>
                </div>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-8 text-xs mt-0.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {allCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Amount (PKR) * */}
              <div className={paymentMode === "bank" ? "lg:col-span-2" : "lg:col-span-2"}>
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

              {/* Paid From: dropdown (Cash in Hand / Bank Account) */}
              <div className={paymentMode === "bank" ? "lg:col-span-2" : "lg:col-span-2"}>
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Paid From <span className="text-red-500">*</span>
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

              {/* Bank dropdown when Paid From = Bank Account (strictly agency banks) */}
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

              {/* Bill / Receipt / Ref No */}
              <div className={paymentMode === "bank" ? "lg:col-span-2" : "lg:col-span-3"}>
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Bill / Receipt / Ref No
                </Label>
                <Input
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  placeholder="e.g. REC-1024"
                  className="h-8 text-xs font-mono mt-0.5"
                />
              </div>
            </div>

            {/* If Recurring Expense: extra compact inline row with frequency, start date, end date, next due date */}
            {expenseMode === "recurring" && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end pt-1">
                <div>
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Frequency
                  </Label>
                  <Select value={frequency} onValueChange={(val: any) => setFrequency(val)}>
                    <SelectTrigger className="h-8 text-xs mt-0.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Daily">Daily</SelectItem>
                      <SelectItem value="Weekly">Weekly</SelectItem>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                      <SelectItem value="Yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Start Date
                  </Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-8 text-xs mt-0.5"
                  />
                </div>

                <div>
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    End Date (Optional)
                  </Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-8 text-xs mt-0.5"
                  />
                </div>

                <div>
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Next Due Date
                  </Label>
                  <Input
                    type="date"
                    value={nextDueDate}
                    onChange={(e) => setNextDueDate(e.target.value)}
                    className="h-8 text-xs mt-0.5 bg-slate-50 dark:bg-slate-900 font-mono"
                  />
                </div>
              </div>
            )}

            {/* LINE 2: Particulars & Notes as one single-line input that grows only if user types more */}
            <div className="space-y-1 pt-1">
              <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Particulars & Notes
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Office electricity bill, refreshments, printer maintenance, travel conveyance..."
                className="w-full min-h-[32px] h-8 max-h-[80px] text-xs resize-y py-1.5 leading-snug"
              />
            </div>

            {/* COMPACT SHEET BELOW FORM: Recent Recorded Expenses (5 records, read-only) */}
            <div className="pt-2 border-t space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Recent Recorded Expenses
                  </span>
                  <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                    {recentFiveExpenses.length} entries
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
                      <th className="py-1.5 px-2.5">Expense No</th>
                      <th className="py-1.5 px-2.5">Category</th>
                      <th className="py-1.5 px-2.5">Type</th>
                      <th className="py-1.5 px-2.5">Paid From</th>
                      <th className="py-1.5 px-2.5">Ref</th>
                      <th className="py-1.5 px-2.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                    {recentFiveExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-3 text-center text-muted-foreground text-xs">
                          No records yet. Save an entry above to see it here.
                        </td>
                      </tr>
                    ) : (
                      recentFiveExpenses.map((item: any, idx: number) => {
                        const isRec = item.is_recurring === true && !item.recurring_parent_id;
                        const amt = parseFloat(item.amount) || 0;
                        const expNo =
                          item.reference_number ||
                          item.reference_no ||
                          (item.id ? `EXP-${item.id.slice(0, 6).toUpperCase()}` : "EXP-1001");
                        const refVal = item.reference_number || item.reference_no || "—";
                        const paidFrom =
                          item.payment_mode === "bank"
                            ? item.bank_name
                              ? `Bank (${item.bank_name})`
                              : "Bank Account"
                            : "Cash in Hand";

                        return (
                          <tr key={item.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 select-text">
                            <td className="py-1.5 px-2.5 font-mono text-slate-600 dark:text-slate-300">
                              {item.expense_date || (item.created_at ? item.created_at.slice(0, 10) : "—")}
                            </td>
                            <td className="py-1.5 px-2.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                              <CopyValue value={expNo} label="expense number" />
                            </td>
                            <td className="py-1.5 px-2.5 font-medium text-slate-800 dark:text-slate-100">
                              <CopyValue value={item.expense_type || item.category || "General"} label="category" />
                            </td>
                            <td className="py-1.5 px-2.5">
                              {isRec ? (
                                <Badge className="text-[9px] h-4 px-1.5 bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 border-0">
                                  Recurring
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                                  Normal
                                </Badge>
                              )}
                            </td>
                            <td className="py-1.5 px-2.5 text-slate-600 dark:text-slate-400 truncate max-w-[120px]">
                              {paidFrom}
                            </td>
                            <td className="py-1.5 px-2.5 font-mono text-slate-500">
                              {refVal !== "—" ? <CopyValue value={refVal} label="reference" /> : "—"}
                            </td>
                            <td className="py-1.5 px-2.5 font-mono font-bold text-right text-red-600 dark:text-red-400">
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

          {/* FOOTER: Only Cancel and Save Expense */}
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
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="h-8 text-xs bg-[#0B192C] hover:bg-[#1E3E62] text-white cursor-pointer min-w-[110px]"
            >
              {isSubmitting ? "Saving..." : "Save Expense"}
            </Button>
          </div>
        </form>

        {/* Quick Add Category Inline Dialog */}
        <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
          <DialogContent className="sm:max-w-md p-4 space-y-3">
            <DialogTitle className="text-sm font-bold">Add New Expense Category</DialogTitle>
            <div className="space-y-1">
              <Label className="text-xs">Category Name</Label>
              <Input
                autoFocus
                value={newCatInput}
                onChange={(e) => setNewCatInput(e.target.value)}
                placeholder="e.g. Courier & Delivery, Renovation, Marketing"
                className="h-8 text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCategory();
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddCategoryOpen(false)}
                className="h-7 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAddCategory}
                className="h-7 text-xs bg-[#0B192C] hover:bg-[#1E3E62] text-white"
              >
                Add Category
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
};
