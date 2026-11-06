import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RefreshCcw, Plus, Calendar, Pencil, CheckCircle2, XCircle } from "lucide-react";
import { useExpenses } from "@/hooks/useStorage";
import { format, addMonths, addQuarters, addYears, isBefore, startOfMonth, endOfMonth, parseISO, isWithinInterval } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { PaymentModeSelect } from "./PaymentModeSelect";

interface RecurringExpense {
  id: string;
  expense_type: string;
  amount: number;
  recurring_frequency: string;
  notes?: string;
  expense_date: string;
  is_recurring: boolean;
}

export function RecurringExpenseSection() {
  const { expenses, addExpense, updateExpense } = useExpenses();
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Filter to get only recurring expense templates
  const recurringTemplates = useMemo(() => {
    return (expenses || []).filter((e: any) => e.is_recurring === true && !e.recurring_parent_id);
  }, [expenses]);

  // Get generated instances for a parent
  const getGeneratedInstances = (parentId: string) => {
    return (expenses || []).filter((e: any) => e.recurring_parent_id === parentId);
  };

  // Calculate next due date based on frequency
  const getNextDueDate = (lastDate: string, frequency: string): Date => {
    const date = parseISO(lastDate);
    switch (frequency) {
      case "monthly":
        return addMonths(date, 1);
      case "quarterly":
        return addQuarters(date, 1);
      case "yearly":
        return addYears(date, 1);
      default:
        return addMonths(date, 1);
    }
  };

  // Generate expenses for current month
  const handleGenerateExpenses = async () => {
    setIsGenerating(true);
    const currentMonth = new Date();
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    let generated = 0;

    try {
      for (const template of recurringTemplates) {
        const instances = getGeneratedInstances(template.id);
        
        // Check if expense already exists for this month
        const existsThisMonth = instances.some((inst: any) => {
          const instDate = parseISO(inst.expense_date);
          return isWithinInterval(instDate, { start: monthStart, end: monthEnd });
        });

        if (!existsThisMonth) {
          // Get the last instance date or use template date
          const lastInstance = instances.sort((a: any, b: any) => 
            new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime()
          )[0];
          
          const lastDate = lastInstance?.expense_date || template.expense_date;
          const nextDue = getNextDueDate(lastDate, template.recurring_frequency);
          
          // Only generate if next due is within or before current month
          if (isBefore(nextDue, monthEnd) || isWithinInterval(nextDue, { start: monthStart, end: monthEnd })) {
            await addExpense.mutateAsync({
              expense_date: format(new Date(), "yyyy-MM-dd"),
              expense_type: template.expense_type,
              amount: template.amount,
              notes: `[Auto-generated] ${template.notes || template.expense_type}`,
              is_recurring: false,
              recurring_parent_id: template.id,
              is_paid: false,
              payment_mode: template.payment_mode || "cash",
              bank_name: template.bank_name || null,
            });
            generated++;
          }
        }
      }

      if (generated > 0) {
        toast({
          title: "Expenses Generated",
          description: `${generated} recurring expense${generated > 1 ? 's' : ''} generated for this month`,
        });
      } else {
        toast({
          title: "No New Expenses",
          description: "All recurring expenses for this month are already generated",
        });
      }
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: "Failed to generate recurring expenses",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Mark expense as paid/unpaid
  const handleTogglePaid = async (expense: any) => {
    try {
      await updateExpense.mutateAsync({
        id: expense.id,
        expense: {
          is_paid: !expense.is_paid,
          paid_date: !expense.is_paid ? format(new Date(), "yyyy-MM-dd") : null,
        }
      });
      toast({
        title: expense.is_paid ? "Marked as Unpaid" : "Marked as Paid",
        description: `${expense.expense_type} status updated`,
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update payment status",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Recurring Templates Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <RefreshCcw className="w-5 h-5" />
                Recurring Expenses
              </CardTitle>
              <CardDescription>
                Manage recurring expense templates that auto-generate monthly entries
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleGenerateExpenses}
                disabled={isGenerating || recurringTemplates.length === 0}
              >
                <Calendar className="w-4 h-4 mr-2" />
                {isGenerating ? "Generating..." : "Generate This Month"}
              </Button>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Recurring
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {recurringTemplates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No recurring expenses set up. Click "Add Recurring" to create one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Expense Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Payment Mode</TableHead>
                  <TableHead>This Month</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recurringTemplates.map((template: any) => {
                  const instances = getGeneratedInstances(template.id);
                  const currentMonth = new Date();
                  const monthStart = startOfMonth(currentMonth);
                  const monthEnd = endOfMonth(currentMonth);
                  
                  const thisMonthInstance = instances.find((inst: any) => {
                    const instDate = parseISO(inst.expense_date);
                    return isWithinInterval(instDate, { start: monthStart, end: monthEnd });
                  });

                  return (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.expense_type}</TableCell>
                      <TableCell>₨ {Number(template.amount).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {template.recurring_frequency}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {template.payment_mode || "cash"}
                          {template.bank_name && ` - ${template.bank_name}`}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {thisMonthInstance ? (
                          <div className="flex items-center gap-2">
                            {thisMonthInstance.is_paid ? (
                              <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Paid
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="bg-orange-500/10 text-orange-600 hover:bg-orange-500/20">
                                <XCircle className="w-3 h-3 mr-1" />
                                Not Paid
                              </Badge>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleTogglePaid(thisMonthInstance)}
                            >
                              {thisMonthInstance.is_paid ? "Mark Unpaid" : "Mark Paid"}
                            </Button>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Not Generated
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingExpense(template);
                            setShowAddDialog(true);
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Recurring Expense Dialog */}
      <RecurringExpenseDialog
        open={showAddDialog}
        onOpenChange={(open) => {
          setShowAddDialog(open);
          if (!open) setEditingExpense(null);
        }}
        editExpense={editingExpense}
      />
    </div>
  );
}

// Dialog for adding/editing recurring expenses
interface RecurringExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editExpense?: any;
}

function RecurringExpenseDialog({ open, onOpenChange, editExpense }: RecurringExpenseDialogProps) {
  const { addExpense, updateExpense } = useExpenses();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMode, setPaymentMode] = useState(editExpense?.payment_mode || "cash");
  const [bankName, setBankName] = useState(editExpense?.bank_name || "");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    
    const expenseData = {
      expense_date: formData.get("startDate") as string,
      expense_type: formData.get("expenseType") as string,
      amount: parseFloat(formData.get("amount") as string),
      notes: formData.get("notes") as string || null,
      is_recurring: true,
      recurring_frequency: formData.get("frequency") as string,
      recurring_parent_id: null,
      is_paid: true, // Templates are marked as paid
      payment_mode: paymentMode,
      bank_name: paymentMode === "bank" ? bankName : null,
    };

    try {
      if (editExpense) {
        await updateExpense.mutateAsync({
          id: editExpense.id,
          expense: expenseData,
        });
        toast({ title: "Recurring expense updated" });
      } else {
        await addExpense.mutateAsync(expenseData);
        toast({ title: "Recurring expense created" });
      }
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save recurring expense",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCcw className="w-5 h-5" />
            {editExpense ? "Edit Recurring Expense" : "Add Recurring Expense"}
          </DialogTitle>
          <DialogDescription>
            Set up an expense that repeats automatically each period
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expenseType">Expense Type *</Label>
              <Input
                id="expenseType"
                name="expenseType"
                defaultValue={editExpense?.expense_type || ""}
                placeholder="e.g., Office Rent"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (PKR) *</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                defaultValue={editExpense?.amount || ""}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency *</Label>
              <Select name="frequency" defaultValue={editExpense?.recurring_frequency || "monthly"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={editExpense?.expense_date || format(new Date(), "yyyy-MM-dd")}
                required
              />
            </div>
          </div>

          <PaymentModeSelect
            value={paymentMode}
            onChange={setPaymentMode}
            bankName={bankName}
            onBankNameChange={setBankName}
          />

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={editExpense?.notes || ""}
              placeholder="Additional details..."
              rows={2}
            />
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : (editExpense ? "Update" : "Create Recurring")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
