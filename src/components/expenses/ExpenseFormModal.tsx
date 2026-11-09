import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useExpenses } from "@/hooks/useStorage";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Receipt, Repeat, CalendarDays, DollarSign, ArrowDownRight } from "lucide-react";

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
  const { expenses = [] } = useExpenses();

  // Top toggle: Normal vs Recurring
  const [expenseMode, setExpenseMode] = useState<"normal" | "recurring">("normal");

  // Form Fields
  const [category, setCategory] = useState<string>("Rent");
  const [customCategory, setCustomCategory] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<"cash" | "bank">("cash");
  const [expenseDate, setExpenseDate] = useState<string>(
    () => new Date().toISOString().slice(0, 10)
  );
  const [referenceNo, setReferenceNo] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Recurring-specific fields
  const [frequency, setFrequency] = useState<"Daily" | "Weekly" | "Monthly" | "Yearly">("Monthly");
  const [startDate, setStartDate] = useState<string>(
    () => new Date().toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const finalCategory = category === "Other" && customCategory.trim() ? customCategory.trim() : category;

  // Live expenses list: sort recent first (latest 10 entries)
  const recentExpenses = useMemo(() => {
    return [...expenses]
      .sort((a: any, b: any) => {
        const dateA = new Date(a.expense_date || a.created_at || 0).getTime();
        const dateB = new Date(b.expense_date || b.created_at || 0).getTime();
        return dateB - dateA;
      })
      .slice(0, 8);
  }, [expenses]);

  // Total amount of recent expenses
  const recentTotal = useMemo(() => {
    return recentExpenses.reduce((sum, item: any) => sum + (parseFloat(item.amount) || 0), 0);
  }, [recentExpenses]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount) || 0;
    if (numAmount <= 0) {
      toast.error("Expense amount must be greater than zero");
      return;
    }

    setIsSubmitting(true);
    try {
      if (expenseMode === "recurring") {
        // Save as recurring expense template
        const recurringPayload: any = {
          expense_type: finalCategory,
          amount: numAmount,
          payment_mode: paymentMode,
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
        // Save as regular normal expense via atomic RPC
        await (supabase as any).rpc("record_expense", {
          p_amount: numAmount,
          p_account_id: null,
          p_category: finalCategory,
          p_date: expenseDate,
          p_method: paymentMode,
          p_reference_no: referenceNo || null,
          p_notes: notes || null,
        });
        toast.success("Expense recorded successfully");
      }

      // Invalidate queries so the live sheet immediately shows the newly saved expense
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });

      // Reset input fields
      setAmount("");
      setNotes("");
      setReferenceNo("");
      setCustomCategory("");

      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to record expense");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[98vw] max-w-[98vw] h-[96vh] max-h-[96vh] flex flex-col overflow-hidden p-0 gap-0 bg-background border rounded-xl shadow-2xl">
        {/* 1. Sticky Header */}
        <div className="px-6 py-3 border-b flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-600" />
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Record Daily Operating Expense
            </DialogTitle>
          </div>

          {/* Segmented Top Toggle: Normal vs Recurring */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setExpenseMode("normal")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                expenseMode === "normal"
                  ? "bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              Normal Expense
            </button>
            <button
              type="button"
              onClick={() => setExpenseMode("recurring")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                expenseMode === "recurring"
                  ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
              Recurring Expense
            </button>
          </div>
        </div>

        {/* 2. Flexible Form Body */}
        <form onSubmit={handleSave} className="flex-1 min-h-0 flex flex-col justify-between overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Primary Details Grid: Evenly spaced equal columns */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                  {expenseMode === "normal" ? "Expense Details (One-Time)" : "Recurring Expense Schedule & Information"}
                </span>
                {expenseMode === "recurring" && (
                  <Badge variant="outline" className="text-[11px] bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200">
                    Auto-posts on schedule
                  </Badge>
                )}
              </div>

              {/* Input Row: Equal width columns */}
              {expenseMode === "normal" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 w-full items-end">
                  <div>
                    <Label className="text-xs font-semibold">
                      Category <span className="text-red-500">*</span>
                    </Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="h-9 text-xs mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEFAULT_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {category === "Other" ? (
                    <div>
                      <Label className="text-xs font-semibold">Custom Category Name</Label>
                      <Input
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        placeholder="e.g. Renovation"
                        className="h-9 text-xs mt-1"
                        required
                      />
                    </div>
                  ) : (
                    <div>
                      <Label className="text-xs font-semibold">
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
                  )}

                  {category === "Other" && (
                    <div>
                      <Label className="text-xs font-semibold">
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
                  )}

                  <div>
                    <Label className="text-xs font-semibold">Paid From</Label>
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

                  <div>
                    <Label className="text-xs font-semibold">Expense Date</Label>
                    <Input
                      type="date"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className="h-9 text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Bill / Receipt / Ref No</Label>
                    <Input
                      value={referenceNo}
                      onChange={(e) => setReferenceNo(e.target.value)}
                      placeholder="e.g. REC-1024"
                      className="h-9 text-xs font-mono mt-1"
                    />
                  </div>
                </div>
              ) : (
                /* Recurring Expense Grid */
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 w-full items-end">
                  <div>
                    <Label className="text-xs font-semibold">
                      Category <span className="text-red-500">*</span>
                    </Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="h-9 text-xs mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEFAULT_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">
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
                    <Label className="text-xs font-semibold">Paid From</Label>
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

                  <div>
                    <Label className="text-xs font-semibold">Frequency</Label>
                    <Select value={frequency} onValueChange={(val: any) => setFrequency(val)}>
                      <SelectTrigger className="h-9 text-xs mt-1">
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
                    <Label className="text-xs font-semibold">Start Date</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-9 text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">End Date (Optional)</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-9 text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Bill / Ref No</Label>
                    <Input
                      value={referenceNo}
                      onChange={(e) => setReferenceNo(e.target.value)}
                      placeholder="e.g. REC-1024"
                      className="h-9 text-xs font-mono mt-1"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Documentation & Particulars Notes */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5">
              <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Particulars & Notes
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Office electricity bill for month of October, staff refreshments, internet subscription..."
                className="w-full min-h-[70px] max-h-[100px] text-xs resize-none"
              />
            </div>

            {/* Live Expenses Sheet Table */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Recent Recorded Expenses Sheet
                  </span>
                  <Badge variant="secondary" className="text-[10px] h-5">
                    {recentExpenses.length} entries
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  Newly saved expenses appear here immediately
                </span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b">
                    <tr>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Category</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Paid From</th>
                      <th className="py-2 px-3">Ref / Receipt #</th>
                      <th className="py-2 px-3 text-right">Amount (PKR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {recentExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-muted-foreground">
                          No expenses recorded yet. Save an expense above to see it here.
                        </td>
                      </tr>
                    ) : (
                      recentExpenses.map((item: any, idx: number) => {
                        const isRec = item.is_recurring === true && !item.recurring_parent_id;
                        const amt = parseFloat(item.amount) || 0;
                        return (
                          <tr key={item.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td className="py-2 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                              {item.expense_date || (item.created_at ? item.created_at.slice(0, 10) : "—")}
                            </td>
                            <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-100">
                              {item.expense_type || item.category || "General"}
                            </td>
                            <td className="py-2 px-3">
                              {isRec ? (
                                <Badge className="text-[10px] bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 border-0">
                                  Recurring ({item.recurring_frequency || "Monthly"})
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px]">
                                  Normal
                                </Badge>
                              )}
                            </td>
                            <td className="py-2 px-3 capitalize text-slate-600 dark:text-slate-400">
                              {item.payment_mode === "bank" ? "Bank Account" : "Cash in Hand"}
                            </td>
                            <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                              {item.reference_number || item.reference_no || "—"}
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-right text-slate-800 dark:text-slate-100">
                              PKR {amt.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {recentExpenses.length > 0 && (
                    <tfoot className="bg-slate-100/80 dark:bg-slate-800/80 font-bold border-t">
                      <tr>
                        <td colSpan={5} className="py-2 px-3 text-slate-700 dark:text-slate-200 text-right uppercase tracking-wider text-[11px]">
                          Sheet Total:
                        </td>
                        <td className="py-2 px-3 font-mono text-right text-amber-700 dark:text-amber-400 text-sm">
                          PKR {recentTotal.toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
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
              className="text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="text-xs bg-[#0B192C] hover:bg-[#1E3E62] text-white cursor-pointer min-w-[120px]"
            >
              {isSubmitting
                ? "Saving..."
                : expenseMode === "recurring"
                ? "Save Recurring Expense"
                : "Save Expense"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
