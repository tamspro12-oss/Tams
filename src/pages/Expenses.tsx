import { useMemo, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Search, Pencil, Download, FileDown, ChevronDown, RefreshCw, Banknote, Building2 } from "lucide-react";
import { AddExpenseDialog } from "@/components/AddExpenseDialog";
import { useExpenses } from "@/hooks/useStorage";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO, isWithinInterval } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DateFilterSelector } from "@/components/DateFilterSelector";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { exportExpensesReport } from "@/lib/pdfExport";
import { DateRangePicker } from "@/components/DateRangePicker";
import { DateRange } from "react-day-picker";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ExpenseTableSkeleton } from "@/components/SkeletonLoaders";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PermissionGate } from "@/components/PermissionGate";
import { Badge } from "@/components/ui/badge";
import { RecurringExpenseSection } from "@/components/RecurringExpenseSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Expenses() {
  const location = useLocation();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportDateRange, setExportDateRange] = useState<DateRange | undefined>(undefined);
  const { expenses, isLoading, deleteExpense } = useExpenses();
  const { filter } = useDateFilter();
  const { toast: toastHook } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (location.state?.openAddExpense || params.get("action") === "new") {
      setShowAddDialog(true);
      window.history.replaceState({}, document.title, location.pathname + (params.get("tab") ? `?tab=${params.get("tab")}` : ""));
    }
  }, [location.state, location.search, location.pathname]);

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['expenses'] });
    toast.success("Expenses refreshed");
  };

  const { containerRef, isPulling, isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  const filteredExpenses = useMemo(() => {
    let filtered = Array.isArray(expenses) ? expenses : [];
    filtered = filtered.filter((e: any) => !e.is_recurring || e.recurring_parent_id);
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((e: any) => 
        e.expense_type?.toLowerCase().includes(q) || 
        e.notes?.toLowerCase().includes(q)
      );
    }
    
    if (filter.startDate && filter.endDate) {
      filtered = filtered.filter((e: any) => {
        if (!e.expense_date) return false;
        const expenseDate = parseISO(e.expense_date);
        return isWithinInterval(expenseDate, { start: filter.startDate!, end: filter.endDate! });
      });
    }
    
    return filtered;
  }, [expenses, searchQuery, filter]);

  const handleExportExpenses = async () => {
    setIsExporting(true);
    try {
      await exportExpensesReport(expenses, exportDateRange?.from || null, exportDateRange?.to || null);
      toastHook({ title: "Export complete", description: "Expenses report downloaded" });
    } catch (error) {
      toastHook({ title: "Export failed", description: "There was an error exporting the report", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const stats = useMemo(() => {
    const total = filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const count = filteredExpenses.length;
    const avgExpense = count > 0 ? total / count : 0;
    return { total, count, avgExpense };
  }, [filteredExpenses]);

  return (
    <div ref={containerRef} className="relative h-full overflow-auto">
      <div 
        className="absolute top-0 left-0 right-0 flex items-center justify-center transition-all duration-200 ease-out z-50"
        style={{ transform: `translateY(${Math.max(0, pullDistance - 80)}px)`, opacity: Math.min(pullDistance / 80, 1) }}
      >
        <div className="bg-primary text-primary-foreground rounded-full p-2 shadow-lg">
          <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} style={{ transform: `rotate(${pullDistance * 3.6}deg)` }} />
        </div>
      </div>

      <div className="space-y-2 sm:space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Expense Tracker</h1>
            <p className="text-muted-foreground mt-1">Track and manage agency expenses</p>
          </div>
          <div className="flex gap-2">
            <DateFilterSelector />
            <PermissionGate module="expenses" action="write">
              <Button onClick={() => setShowAddDialog(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Add Expense
              </Button>
            </PermissionGate>
          </div>
        </div>

        <Tabs defaultValue="one-time" className="space-y-4">
          <TabsList>
            <TabsTrigger value="one-time">One-Time Expenses</TabsTrigger>
            <TabsTrigger value="recurring">Recurring Expenses</TabsTrigger>
          </TabsList>

          <TabsContent value="one-time" className="space-y-4">
            <div className="grid gap-1.5 sm:gap-3 grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="pb-1 sm:pb-2 p-2 sm:p-4">
                  <CardTitle className="text-xs sm:text-sm font-medium">Total Expenses</CardTitle>
                </CardHeader>
                <CardContent className="p-2 sm:p-4 pt-0">
                  <div className="text-base sm:text-xl font-bold text-destructive">₨ {stats.total.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">{stats.count} transactions</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1 sm:pb-2 p-2 sm:p-4">
                  <CardTitle className="text-xs sm:text-sm font-medium">Expense Count</CardTitle>
                </CardHeader>
                <CardContent className="p-2 sm:p-4 pt-0">
                  <div className="text-base sm:text-xl font-bold">{stats.count}</div>
                  <p className="text-xs text-muted-foreground">Total records</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1 sm:pb-2 p-2 sm:p-4">
                  <CardTitle className="text-xs sm:text-sm font-medium">Average</CardTitle>
                </CardHeader>
                <CardContent className="p-2 sm:p-4 pt-0">
                  <div className="text-base sm:text-xl font-bold">₨ {Math.round(stats.avgExpense).toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Per expense</p>
                </CardContent>
              </Card>
            </div>

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input placeholder="Search by type or notes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>

            {isLoading ? (
              <ExpenseTableSkeleton />
            ) : filteredExpenses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No expenses recorded. Click "Add Expense" to get started.</div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Expense Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Payment Mode</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>{expense.expense_date ? format(new Date(expense.expense_date), "MMM dd, yyyy") : "-"}</TableCell>
                        <TableCell className="font-medium">{expense.expense_type}</TableCell>
                        <TableCell>₨ {Number(expense.amount).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {expense.payment_mode === "bank" ? (
                              <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{expense.bank_name || "Bank"}</span>
                            ) : (
                              <span className="flex items-center gap-1"><Banknote className="w-3 h-3" />Cash</span>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{expense.notes || "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <PermissionGate module="expenses" action="write">
                              <Button size="sm" variant="ghost" onClick={() => { setEditingExpense(expense); setShowAddDialog(true); }}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                            </PermissionGate>
                            <PermissionGate module="expenses" action="delete">
                              <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete this expense?")) deleteExpense.mutate(expense.id); }}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </PermissionGate>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="recurring" className="space-y-4">
            <RecurringExpenseSection />
          </TabsContent>
        </Tabs>

        <AddExpenseDialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) setEditingExpense(null); }} editExpense={editingExpense} />
      </div>
    </div>
  );
}
