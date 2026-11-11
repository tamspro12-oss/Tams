import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useExpenses } from "@/hooks/useStorage";
import { Receipt, Calendar, DollarSign, FileText, Maximize2, Minimize2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { FormSectionNav } from "@/components/FormSectionNav";
import { PaymentModeSelect } from "@/components/PaymentModeSelect";
import { LockedDateField } from "@/components/ui/LockedDateField";

interface AddExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editExpense?: any;
}

const SECTIONS = [
  { id: 'expense-details', label: 'Expense Details', color: 'amber' },
];

export function AddExpenseDialog({ open, onOpenChange, editExpense }: AddExpenseDialogProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [paymentMode, setPaymentMode] = useState(editExpense?.payment_mode || "cash");
  const [bankName, setBankName] = useState(editExpense?.bank_name || "");
  const { addExpense, updateExpense } = useExpenses();
  
  const { activeSection, setSectionRef, scrollToSection, containerRef, isVisible } = useScrollAnimation(SECTIONS.length);

  // Reset payment mode when dialog opens with edit data
  useState(() => {
    if (editExpense) {
      setPaymentMode(editExpense.payment_mode || "cash");
      setBankName(editExpense.bank_name || "");
    }
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const expenseData = {
      expense_date: formData.get("expenseDate") as string,
      expense_type: formData.get("expenseType") as string,
      amount: parseFloat(formData.get("amount") as string),
      notes: formData.get("notes") as string,
      payment_mode: paymentMode,
      bank_name: paymentMode === "bank" ? bankName : null,
    };

    if (editExpense) {
      updateExpense.mutate({ id: editExpense.id, expense: expenseData }, {
        onSuccess: () => {
          onOpenChange(false);
        }
      });
    } else {
      addExpense.mutate(expenseData, {
        onSuccess: () => {
          onOpenChange(false);
          e.currentTarget.reset();
          setPaymentMode("cash");
          setBankName("");
        }
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "enterprise-dialog overflow-hidden flex flex-col transition-all duration-300",
        isFullScreen 
          ? "!fixed !inset-0 !left-0 !top-0 !translate-x-0 !translate-y-0 !max-w-none w-screen h-[100dvh] !rounded-none border-0" 
          : "w-[98vw] max-w-[98vw] h-[96vh] max-h-[96vh]"
      )}>
        <DialogHeader className="pb-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="form-section-icon form-section-icon-amber">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold">{editExpense ? 'Edit Expense' : 'Add New Expense'}</DialogTitle>
                <DialogDescription className="text-muted-foreground/80">Record and track your business expenses</DialogDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="h-8 w-8 shrink-0"
              title={isFullScreen ? "Compact mode" : "Fullscreen mode"}
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </div>
        </DialogHeader>
        
        {/* Section Navigation - Only in fullscreen (hidden for single section) */}
        {isFullScreen && SECTIONS.length > 1 && (
          <FormSectionNav
            sections={SECTIONS}
            activeSection={activeSection}
            onNavigate={scrollToSection}
          />
        )}
        
        <form 
          onSubmit={handleSubmit} 
          className={cn(
            "flex-1 overflow-y-auto form-scroll-container",
            isFullScreen ? "p-6 lg:p-8" : "p-2"
          )}
        >
          <div 
            ref={containerRef}
            className={isFullScreen ? "max-w-3xl mx-auto space-y-6" : "space-y-4"}
          >
          {/* Expense Details Card */}
          <div 
            ref={setSectionRef(0)}
            className={cn(
              "scroll-reveal",
              isVisible(0) && "is-visible"
            )}
          >
            <Card className="form-card form-card-amber">
              <CardHeader className="pb-4 pt-5">
                <div className="form-section-header">
                  <div className="form-section-icon form-section-icon-amber">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="form-section-title form-section-title-amber">Expense Details</h3>
                    <p className="form-section-description">Enter the expense information</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <LockedDateField
                    label="Date"
                    name="expenseDate"
                    value={editExpense?.expense_date}
                    required
                  />
                  <div className="space-y-2">
                    <Label htmlFor="amount" className="text-sm font-medium flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-amber-600" />
                      Amount (PKR) *
                    </Label>
                    <Input 
                      id="amount" 
                      name="amount" 
                      type="number" 
                      step="0.01" 
                      required 
                      defaultValue={editExpense?.amount || ''} 
                      placeholder="0.00"
                      className="enterprise-input"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="expenseType" className="text-sm font-medium flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-amber-600" />
                    Expense Type *
                  </Label>
                  <Input 
                    id="expenseType" 
                    name="expenseType" 
                    required 
                    placeholder="e.g., Office Rent, Salaries, Utilities" 
                    defaultValue={editExpense?.expense_type || ''} 
                    className="enterprise-input"
                  />
                </div>

                {/* Payment Mode - ADDITIVE FIELD */}
                <PaymentModeSelect
                  value={paymentMode}
                  onChange={setPaymentMode}
                  bankName={bankName}
                  onBankNameChange={setBankName}
                />
                
                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-sm font-medium flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-600" />
                    Notes
                  </Label>
                  <Textarea 
                    id="notes" 
                    name="notes" 
                    rows={3} 
                    defaultValue={editExpense?.notes || ''} 
                    placeholder="Add any additional details..."
                    className="enterprise-input min-h-[80px] resize-none"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-4 mt-4 border-t border-border/50 sticky bottom-0 bg-background pb-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="px-6"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={addExpense.isPending || updateExpense.isPending}
              className="px-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-lg shadow-amber-500/25"
            >
              {addExpense.isPending || updateExpense.isPending 
                ? (editExpense ? "Updating..." : "Adding...") 
                : (editExpense ? "Update Expense" : "Add Expense")}
            </Button>
          </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
