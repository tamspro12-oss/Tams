import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
            Record Daily Operating Expense
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-3.5 pt-1">
          {/* Category */}
          <div>
            <Label className="text-xs font-semibold">Expense Category</Label>
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
                className="h-8 text-xs mt-1"
                required
              />
            </div>
          )}

          {/* Amount & Mode */}
          <div className="grid grid-cols-2 gap-2">
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
          </div>

          {/* Date & Reference */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs font-semibold">Date</Label>
              <Input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="h-9 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Bill / Receipt No</Label>
              <Input
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="Optional"
                className="h-9 text-xs font-mono mt-1"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-xs">Particulars / Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Office electricity bill for month of October"
              rows={2}
              className="text-xs mt-1"
            />
          </div>

          <DialogFooter className="pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="text-xs bg-[#0B192C] hover:bg-[#1E3E62] text-white"
            >
              {isSubmitting ? "Saving..." : "Save Expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

