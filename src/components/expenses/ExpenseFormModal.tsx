import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Receipt } from "lucide-react";

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
  const [category, setCategory] = useState<string>("Rent");
  const [customCategory, setCustomCategory] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<"cash" | "bank">("cash");
  const [expenseDate, setExpenseDate] = useState<string>(
    () => new Date().toISOString().slice(0, 10)
  );
  const [referenceNo, setReferenceNo] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const finalCategory = category === "Other" && customCategory.trim() ? customCategory.trim() : category;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount) || 0;
    if (numAmount <= 0) {
      toast.error("Expense amount must be greater than zero");
      return;
    }

    setIsSubmitting(true);
    try {
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
      onOpenChange(false);
      setAmount("");
      setNotes("");
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
        <div className="px-6 py-3.5 border-b flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
          <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-600" />
            Record Daily Operating Expense
          </DialogTitle>
        </div>

        {/* 2. Flexible Form Body */}
        <form onSubmit={handleSave} className="flex-1 min-h-0 flex flex-col justify-between overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Primary Details Grid */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Expense Information
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 w-full">
                <div>
                  <Label className="text-xs font-semibold">Select Category</Label>
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

                {category === "Other" && (
                  <div>
                    <Label className="text-xs font-semibold">Custom Category Name</Label>
                    <Input
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="e.g. Legal Fees, Renovation"
                      className="h-9 text-xs mt-1"
                      required
                    />
                  </div>
                )}

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
                    placeholder="Optional voucher / receipt #"
                    className="h-9 text-xs font-mono mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Documentation & Particulars Notes */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
              <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Particulars & Documentation Notes
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Office electricity bill for month of October, staff refreshments..."
                className="w-full min-h-[140px] text-xs resize-none"
              />
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
              className="text-xs bg-[#0B192C] hover:bg-[#1E3E62] text-white cursor-pointer"
            >
              {isSubmitting ? "Saving..." : "Save Expense"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

