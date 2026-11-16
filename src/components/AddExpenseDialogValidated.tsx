import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useExpenses } from "@/hooks/useStorage";
import { Maximize2, Minimize2 } from "lucide-react";
import { expenseSchema, validateData } from "@/lib/validations/schemas";
import { toast } from "sonner";
import { LockedDateField, getTodayDateString } from "@/components/ui/LockedDateField";
import { useFormKeyboardNav } from "@/hooks/useFormKeyboardNav";
import { createRequestId, rpcWithPreSqlFallback, runBackgroundTask } from "@/lib/atomicSave";
import { runUiAtomicSave } from "@/lib/atomicSaveUi";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { refreshAffectedFinancialQueries } from "@/lib/accountingEngine";
import { supabase } from "@/integrations/supabase/client";

interface AddExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editExpense?: any;
}

export function AddExpenseDialogValidated({ open, onOpenChange, editExpense }: AddExpenseDialogProps) {
  const { addExpense, updateExpense } = useExpenses();
  const formRef = useRef<HTMLFormElement>(null);
  const isSubmittingRef = useRef(false);
  const requestIdRef = useRef<string>(createRequestId());
  const queryClient = useQueryClient();
  const { data: userAgencyId } = useCurrentAgencyId();
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expenseDate, setExpenseDate] = useState(() => getTodayDateString());

  useEffect(() => {
    if (open) {
      setExpenseDate(getTodayDateString());
    }
  }, [open, editExpense]);

  useFormKeyboardNav({
    containerRef: formRef,
    enabled: open,
    onSave: () => formRef.current?.requestSubmit(),
    onCancel: () => onOpenChange(false),
    autoFocusFirst: true,
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmittingRef.current || isSubmitting) return;

    const formEl = e.currentTarget;
    const formData = new FormData(formEl);
    const parsedAmount = parseFloat(formData.get("amount") as string);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }

    const expenseData = {
      expense_date: formData.get("expenseDate") as string,
      expense_type: formData.get("expenseType") as string,
      amount: parsedAmount,
      notes: formData.get("notes") as string || undefined,
    };

    const validation = validateData(expenseSchema, expenseData);
    if (!validation.success) {
      toast.error((validation as { success: false; error: string }).error);
      return;
    }

    const validatedData = validation.data;

    await runUiAtomicSave<{ usedFallbackToast?: boolean }>({
      requestIdRef,
      isLockedRef: isSubmittingRef,
      setIsSubmitting,
      contextLabel: "AddExpenseDialogValidated.handleSubmit",
      fallbackErrorMessage: "Failed to save expense. Please try again.",
      execute: async (requestId) => {
        let usedFallbackToast = false;
        if (editExpense) {
          usedFallbackToast = true;
          await updateExpense.mutateAsync({ id: editExpense.id, expense: validatedData });
          return { usedFallbackToast };
        }
        await rpcWithPreSqlFallback<any>(
          supabase as any,
          "record_expense",
          {
            p_amount: validatedData.amount,
            p_account_id: null,
            p_category: validatedData.expense_type,
            p_date: validatedData.expense_date,
            p_method: "cash",
            p_reference_no: null,
            p_notes: validatedData.notes || null,
            p_party_id: null,
            p_party_type: null,
            p_bank_name: null,
            p_is_manual: false,
            p_request_id: requestId,
          },
          {
            isAutoMode: true,
            legacyFallback: async () => {
              usedFallbackToast = true;
              return await addExpense.mutateAsync(validatedData);
            },
          }
        );
        return { usedFallbackToast };
      },
      onSuccess: ({ usedFallbackToast }) => {
        if (!usedFallbackToast) {
          toast.success(editExpense ? "Expense updated successfully" : "Expense recorded successfully");
        }
        if (!editExpense) formEl.reset();
        onOpenChange(false);
        runBackgroundTask("AddExpenseDialogValidated.refresh", () => {
          refreshAffectedFinancialQueries(queryClient, "expense", userAgencyId);
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={isFullScreen ? "max-w-full h-screen m-0 rounded-none" : "w-[98vw] max-w-[98vw] h-[96vh] max-h-[96vh]"}
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>{editExpense ? 'Edit Expense' : 'Add New Expense'}</DialogTitle>
              <DialogDescription>Record an expense entry with validation.</DialogDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              tabIndex={-1}
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="h-8 w-8 p-0"
            >
              {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className={isFullScreen ? "p-6 lg:p-8" : ""}>
          <div className={isFullScreen ? "max-w-6xl mx-auto space-y-4" : "space-y-4"}>
            <LockedDateField
              id="expenseDate"
              name="expenseDate"
              label="Date"
              value={expenseDate}
              onChange={setExpenseDate}
              required
            />
            <div className="space-y-2">
              <Label htmlFor="expenseType">Expense Type *</Label>
              <Input
                id="expenseType"
                name="expenseType"
                required
                placeholder="e.g., Office Rent, Salaries"
                defaultValue={editExpense?.expense_type || ''}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (₨) *</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                max="10000000"
                required
                data-required-positive="true"
                data-required-message="Amount must be greater than 0"
                defaultValue={editExpense?.amount || ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={editExpense?.notes || ''}
                maxLength={5000}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" tabIndex={-1} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" data-save-button="true" disabled={isSubmitting}>
                {isSubmitting ? (editExpense ? "Updating..." : "Adding...") : (editExpense ? "Update Expense" : "Add Expense")}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
