import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useExpenses } from "@/hooks/useStorage";
import { Maximize2, Minimize2 } from "lucide-react";
import { expenseSchema, validateData } from "@/lib/validations/schemas";
import { toast } from "sonner";

interface AddExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editExpense?: any;
}

export function AddExpenseDialogValidated({ open, onOpenChange, editExpense }: AddExpenseDialogProps) {
  const { addExpense, updateExpense } = useExpenses();
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const formData = new FormData(e.currentTarget);

    const expenseData = {
      expense_date: formData.get("expenseDate") as string,
      expense_type: formData.get("expenseType") as string,
      amount: parseFloat(formData.get("amount") as string),
      notes: formData.get("notes") as string || undefined,
    };

    // Validate data
    const validation = validateData(expenseSchema, expenseData);
    
    if (!validation.success) {
      setIsSubmitting(false);
      toast.error((validation as { success: false; error: string }).error);
      return;
    }

    const validatedData = validation.data;

    try {
      if (editExpense) {
        await updateExpense.mutateAsync({ id: editExpense.id, expense: validatedData });
        toast.success("Expense updated successfully");
      } else {
        await addExpense.mutateAsync(validatedData);
        toast.success("Expense added successfully");
        e.currentTarget.reset();
      }
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || "Failed to save expense");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isFullScreen ? "max-w-full h-screen m-0 rounded-none" : "w-[96vw] max-w-[1600px] h-[92vh] max-h-[92vh]"}>
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
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="h-8 w-8 p-0"
            >
              {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className={isFullScreen ? "p-6 lg:p-8" : ""}>
          <div className={isFullScreen ? "max-w-6xl mx-auto space-y-4" : "space-y-4"}>
          <div className="space-y-2">
            <Label htmlFor="expenseDate">Date *</Label>
            <Input 
              id="expenseDate" 
              name="expenseDate" 
              type="date" 
              required 
              defaultValue={editExpense?.expense_date || ''} 
            />
          </div>
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (editExpense ? "Updating..." : "Adding...") : (editExpense ? "Update Expense" : "Add Expense")}
            </Button>
          </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
