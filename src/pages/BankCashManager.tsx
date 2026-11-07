import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Banknote, Plus, Wallet, ArrowUpRight, ArrowDownLeft, Pencil, Trash2, Settings, CreditCard, ArrowRightLeft } from "lucide-react";
import { useExpenses, useClients, useVendors } from "@/hooks/useStorage";
import { useB2BLedger } from "@/hooks/useB2BLedger";
import { useAllClientPaymentHistoryLocal, useAllVendorPaymentHistoryLocal } from "@/hooks/useLocalPaymentHistory";
import { useCashBankEntries } from "@/hooks/useCashBankEntries";
import { useAgencyBanks, COMMON_BANKS } from "@/hooks/useAgencyBanks";
import { format, parseISO, isWithinInterval } from "date-fns";
import { useLocation } from "react-router-dom";
import { DateFilter, DatePresetFilterValue, isDateWithinPreset } from "@/components/DateFilter";

export default function BankCashManager() {
  const { expenses } = useExpenses();
  const { clients } = useClients();
  const { vendors } = useVendors();
  const location = useLocation();
  const [dateFilter, setDateFilter] = useState<DatePresetFilterValue>({
    preset: "this_month",
  });
  
  // Get all client and vendor IDs
  const clientIds = useMemo(() => (clients || []).map((c: any) => c.id), [clients]);
  const vendorIds = useMemo(() => (vendors || []).map((v: any) => v.id), [vendors]);
  
  // Fetch all payment histories
  const { data: clientPayments = [] } = useAllClientPaymentHistoryLocal(clientIds);
  const { data: vendorPayments = [] } = useAllVendorPaymentHistoryLocal(vendorIds);
  const { ledgerEntries: b2bLedger = [] } = useB2BLedger();
  
  // Manual entries
  const { entries: manualEntries, addEntry, deleteEntry } = useCashBankEntries();
  const { banks: agencyBanks, allBankNames, addBank, deleteBank } = useAgencyBanks();

  // Filter function for date range using shared DateFilter (defaults to This Month)
  const isInDateRange = (dateStr: string | undefined) => {
    if (!dateStr) return false;
    return isDateWithinPreset(dateStr, dateFilter.preset, dateFilter.customFrom, dateFilter.customTo);
  };
  
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [showTransactions, setShowTransactions] = useState(false);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showAddBank, setShowAddBank] = useState(false);
  const [entryType, setEntryType] = useState<'cash_in' | 'cash_out' | 'bank_in' | 'bank_out'>('cash_in');
  const [entryCategory, setEntryCategory] = useState<string>('');
  const [entryDescription, setEntryDescription] = useState<string>('');

  // Handle direct navigation to open Add Entry form (e.g. from Dashboard quick action)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (location.state?.openAddEntry || params.get("action") === "new-entry" || params.get("action") === "add-entry") {
      setEntryCategory('');
      setEntryDescription('');
      setShowAddEntry(true);
      window.history.replaceState({}, document.title, location.pathname + (params.get("tab") ? `?tab=${params.get("tab")}` : ""));
    }
  }, [location.state, location.search, location.pathname]);

  // Calculate cash totals from all sources (filtered by date)
  const cashSummary = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;

    // Client payments (incoming - cash)
    (clientPayments || []).forEach((p: any) => {
      if (!isInDateRange(p.payment_date)) return;
      if (!p.payment_mode || p.payment_mode === "cash") {
        if (p.payment_amount > 0) totalIn += p.payment_amount;
        else totalOut += Math.abs(p.payment_amount);
      }
    });

    // Vendor payments (outgoing - cash)
    (vendorPayments || []).forEach((p: any) => {
      if (!isInDateRange(p.payment_date)) return;
      if (!p.payment_mode || p.payment_mode === "cash") {
        if (p.payment_amount > 0) totalOut += p.payment_amount;
        else totalIn += Math.abs(p.payment_amount);
      }
    });

    // B2B Ledger (cash)
    (b2bLedger || []).forEach((l: any) => {
      if (!isInDateRange(l.entry_date)) return;
      if (!l.payment_mode || l.payment_mode === "cash") {
        if (l.entry_type === "payment") totalIn += l.amount;
        else if (l.entry_type === "credit") totalOut += l.amount;
      }
    });

    // Expenses (outgoing - cash)
    (expenses || []).forEach((e: any) => {
      if (!isInDateRange(e.expense_date)) return;
      if (!e.payment_mode || e.payment_mode === "cash") {
        if (!e.is_recurring || e.recurring_parent_id) {
          totalOut += Number(e.amount) || 0;
        }
      }
    });

    // Manual cash entries
    (manualEntries || []).forEach((e: any) => {
      if (!isInDateRange(e.entry_date)) return;
      if (e.entry_type === 'cash_in') totalIn += Number(e.amount) || 0;
      else if (e.entry_type === 'cash_out') totalOut += Number(e.amount) || 0;
    });

    return { totalIn, totalOut, balance: totalIn - totalOut };
  }, [clientPayments, vendorPayments, b2bLedger, expenses, manualEntries, dateFilter]);

  // Calculate bank totals by bank name (filtered by date)
  const bankSummary = useMemo(() => {
    const banks: Record<string, { totalIn: number; totalOut: number; balance: number; openingBalance: number }> = {};

    // Initialize with agency banks
    (agencyBanks || []).forEach((bank: any) => {
      banks[bank.bank_name] = { 
        totalIn: 0, 
        totalOut: 0, 
        balance: Number(bank.opening_balance) || 0,
        openingBalance: Number(bank.opening_balance) || 0
      };
    });

    // Client payments (incoming - bank)
    (clientPayments || []).forEach((p: any) => {
      if (!isInDateRange(p.payment_date)) return;
      if (p.payment_mode === "bank" && p.bank_name) {
        const bankName = p.bank_name;
        if (!banks[bankName]) banks[bankName] = { totalIn: 0, totalOut: 0, balance: 0, openingBalance: 0 };
        if (p.payment_amount > 0) banks[bankName].totalIn += p.payment_amount;
        else banks[bankName].totalOut += Math.abs(p.payment_amount);
      }
    });

    // Vendor payments (outgoing - bank)
    (vendorPayments || []).forEach((p: any) => {
      if (!isInDateRange(p.payment_date)) return;
      if (p.payment_mode === "bank" && p.bank_name) {
        const bankName = p.bank_name;
        if (!banks[bankName]) banks[bankName] = { totalIn: 0, totalOut: 0, balance: 0, openingBalance: 0 };
        if (p.payment_amount > 0) banks[bankName].totalOut += p.payment_amount;
        else banks[bankName].totalIn += Math.abs(p.payment_amount);
      }
    });

    // B2B Ledger (bank)
    (b2bLedger || []).forEach((l: any) => {
      if (!isInDateRange(l.entry_date)) return;
      if (l.payment_mode === "bank" && l.bank_name) {
        const bankName = l.bank_name;
        if (!banks[bankName]) banks[bankName] = { totalIn: 0, totalOut: 0, balance: 0, openingBalance: 0 };
        if (l.entry_type === "payment") banks[bankName].totalIn += l.amount;
        else if (l.entry_type === "credit") banks[bankName].totalOut += l.amount;
      }
    });

    // Expenses (outgoing - bank)
    (expenses || []).forEach((e: any) => {
      if (!isInDateRange(e.expense_date)) return;
      if (e.payment_mode === "bank" && e.bank_name) {
        if (!e.is_recurring || e.recurring_parent_id) {
          const bankName = e.bank_name;
          if (!banks[bankName]) banks[bankName] = { totalIn: 0, totalOut: 0, balance: 0, openingBalance: 0 };
          banks[bankName].totalOut += Number(e.amount) || 0;
        }
      }
    });

    // Manual bank entries
    (manualEntries || []).forEach((e: any) => {
      if (!isInDateRange(e.entry_date)) return;
      if ((e.entry_type === 'bank_in' || e.entry_type === 'bank_out') && e.bank_name) {
        const bankName = e.bank_name;
        if (!banks[bankName]) banks[bankName] = { totalIn: 0, totalOut: 0, balance: 0, openingBalance: 0 };
        if (e.entry_type === 'bank_in') banks[bankName].totalIn += Number(e.amount) || 0;
        else banks[bankName].totalOut += Number(e.amount) || 0;
      }
    });

    // Calculate balances
    Object.keys(banks).forEach(bank => {
      banks[bank].balance = banks[bank].openingBalance + banks[bank].totalIn - banks[bank].totalOut;
    });

    return banks;
  }, [clientPayments, vendorPayments, b2bLedger, expenses, manualEntries, agencyBanks, dateFilter]);

  // Get all transactions for a specific bank or cash (filtered by date)
  const getTransactions = (bankName: string | null) => {
    const transactions: any[] = [];
    const isCash = bankName === null;

    // Client payments
    (clientPayments || []).forEach((p: any) => {
      if (!isInDateRange(p.payment_date)) return;
      const matches = isCash 
        ? (!p.payment_mode || p.payment_mode === "cash")
        : (p.payment_mode === "bank" && p.bank_name === bankName);
      
      if (matches) {
        transactions.push({
          id: p.id,
          date: p.payment_date,
          type: "Client Payment",
          description: p.notes || "Client payment received",
          amount: p.payment_amount,
          direction: p.payment_amount >= 0 ? "in" : "out",
          source: "client",
        });
      }
    });

    // Vendor payments
    (vendorPayments || []).forEach((p: any) => {
      if (!isInDateRange(p.payment_date)) return;
      const matches = isCash 
        ? (!p.payment_mode || p.payment_mode === "cash")
        : (p.payment_mode === "bank" && p.bank_name === bankName);
      
      if (matches) {
        transactions.push({
          id: p.id,
          date: p.payment_date,
          type: "Vendor Payment",
          description: p.notes || "Payment to vendor",
          amount: -Math.abs(p.payment_amount),
          direction: "out",
          source: "vendor",
        });
      }
    });

    // B2B Ledger
    (b2bLedger || []).forEach((l: any) => {
      if (!isInDateRange(l.entry_date)) return;
      const matches = isCash 
        ? (!l.payment_mode || l.payment_mode === "cash")
        : (l.payment_mode === "bank" && l.bank_name === bankName);
      
      if (matches) {
        transactions.push({
          id: l.id,
          date: l.entry_date,
          type: "B2B " + (l.entry_type === "payment" ? "Received" : "Paid"),
          description: l.remarks || `B2B ${l.entry_type}`,
          amount: l.entry_type === "payment" ? l.amount : -l.amount,
          direction: l.entry_type === "payment" ? "in" : "out",
          source: "b2b",
        });
      }
    });

    // Expenses
    (expenses || []).forEach((e: any) => {
      if (e.is_recurring && !e.recurring_parent_id) return;
      if (!isInDateRange(e.expense_date)) return;
      
      const matches = isCash 
        ? (!e.payment_mode || e.payment_mode === "cash")
        : (e.payment_mode === "bank" && e.bank_name === bankName);
      
      if (matches) {
        transactions.push({
          id: e.id,
          date: e.expense_date,
          type: "Expense",
          description: e.expense_type + (e.notes ? `: ${e.notes}` : ""),
          amount: -(Number(e.amount) || 0),
          direction: "out",
          source: "expense",
        });
      }
    });

    // Manual entries
    (manualEntries || []).forEach((e: any) => {
      if (!isInDateRange(e.entry_date)) return;
      const isCashEntry = e.entry_type === 'cash_in' || e.entry_type === 'cash_out';
      const isBankEntry = e.entry_type === 'bank_in' || e.entry_type === 'bank_out';
      
      const matches = isCash 
        ? isCashEntry
        : (isBankEntry && e.bank_name === bankName);
      
      if (matches) {
        const isIncoming = e.entry_type === 'cash_in' || e.entry_type === 'bank_in';
        transactions.push({
          id: e.id,
          date: e.entry_date,
          type: `Manual ${isIncoming ? 'Receipt' : 'Payment'}`,
          description: e.description || e.category || "Manual entry",
          amount: isIncoming ? Number(e.amount) : -Number(e.amount),
          direction: isIncoming ? "in" : "out",
          source: "manual",
          canDelete: true,
        });
      }
    });

    // Sort by date descending
    return transactions.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  };

  // Total across all accounts
  const grandTotal = useMemo(() => {
    let total = cashSummary.balance;
    Object.values(bankSummary).forEach(b => total += b.balance);
    return total;
  }, [cashSummary, bankSummary]);

  // Active banks (with transactions or opening balance)
  const activeBanks = useMemo(() => {
    return Object.entries(bankSummary)
      .filter(([_, data]) => data.totalIn > 0 || data.totalOut > 0 || data.openingBalance > 0)
      .sort((a, b) => b[1].balance - a[1].balance);
  }, [bankSummary]);

  // Handle add entry form
  const handleAddEntry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const isBankEntry = entryType === 'bank_in' || entryType === 'bank_out';
    
    await addEntry.mutateAsync({
      entry_date: formData.get('entry_date') as string,
      entry_type: entryType,
      amount: parseFloat(formData.get('amount') as string),
      payment_mode: isBankEntry ? 'bank' : 'cash',
      bank_name: isBankEntry ? formData.get('bank_name') as string : null,
      category: formData.get('category') as string || null,
      description: formData.get('description') as string || null,
      reference_number: formData.get('reference_number') as string || null,
    });
    
    setShowAddEntry(false);
  };

  // Handle add bank form
  const handleAddBank = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    await addBank.mutateAsync({
      bank_name: formData.get('bank_name') as string,
      account_number: formData.get('account_number') as string || null,
      account_title: formData.get('account_title') as string || null,
      branch_name: formData.get('branch_name') as string || null,
      is_active: true,
      opening_balance: parseFloat(formData.get('opening_balance') as string) || 0,
    });
    
    setShowAddBank(false);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Wallet className="w-7 h-7 text-primary" />
            Bank & Cash Manager
          </h1>
          <p className="text-muted-foreground mt-1">Track all cash and bank transactions across your agency</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateFilter
            value={dateFilter}
            onChange={setDateFilter}
            className="h-9"
          />
          <Button
            onClick={() => {
              setEntryCategory('');
              setEntryDescription('');
              setShowAddEntry(true);
            }}
            className="h-9 gap-1.5"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Entry
          </Button>
        </div>
      </div>

      {/* Grand Total Card */}
      <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Total Balance (All Accounts)</p>
              <p className={`text-3xl sm:text-4xl font-bold ${grandTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ₨ {grandTotal.toLocaleString()}
              </p>
            </div>
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Wallet className="w-8 h-8 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Cash vs Bank */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="cash" className="gap-1.5">
            <Banknote className="w-4 h-4 hidden sm:inline" />
            Cash
          </TabsTrigger>
          <TabsTrigger value="bank" className="gap-1.5">
            <Building2 className="w-4 h-4 hidden sm:inline" />
            Banks
          </TabsTrigger>
          <TabsTrigger value="manage" className="gap-1.5">
            <Settings className="w-4 h-4 hidden sm:inline" />
            Manage
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Cash Summary Card */}
            <Card className="cursor-pointer hover:shadow-lg transition-shadow border-green-500/20" onClick={() => { setSelectedBank(null); setShowTransactions(true); }}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <Banknote className="w-5 h-5 text-green-600" />
                  </div>
                  Cash Account
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <ArrowDownLeft className="w-3 h-3 text-green-500" /> Total In
                    </span>
                    <span className="font-semibold text-green-600">₨ {cashSummary.totalIn.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <ArrowUpRight className="w-3 h-3 text-red-500" /> Total Out
                    </span>
                    <span className="font-semibold text-red-600">₨ {cashSummary.totalOut.toLocaleString()}</span>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Balance</span>
                      <span className={`text-xl font-bold ${cashSummary.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ₨ {cashSummary.balance.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bank Summary Card */}
            <Card className="border-blue-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-blue-600" />
                  </div>
                  Bank Accounts
                </CardTitle>
                <CardDescription>{activeBanks.length} active banks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {activeBanks.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No bank transactions yet</p>
                  ) : (
                    activeBanks.slice(0, 5).map(([bankName, data]) => (
                      <div 
                        key={bankName} 
                        className="flex justify-between items-center p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => { setSelectedBank(bankName); setShowTransactions(true); }}
                      >
                        <span className="text-sm font-medium">{bankName}</span>
                        <span className={`font-semibold ${data.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ₨ {data.balance.toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Cash Tab */}
        <TabsContent value="cash" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Cash Transactions</h2>
            <Button size="sm" onClick={() => { setEntryType('cash_in'); setShowAddEntry(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Cash Entry
            </Button>
          </div>
          
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-green-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <ArrowDownLeft className="w-4 h-4 text-green-500" />
                  Cash In
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">₨ {cashSummary.totalIn.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="border-red-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-red-500" />
                  Cash Out
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">₨ {cashSummary.totalOut.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Cash Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${cashSummary.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ₨ {cashSummary.balance.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Cash Transactions Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">All Cash Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <TransactionTable transactions={getTransactions(null)} onDelete={(id) => deleteEntry.mutate(id)} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bank Tab */}
        <TabsContent value="bank" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Bank Accounts</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowAddBank(true)}>
                <Building2 className="w-4 h-4 mr-2" />
                Add Bank
              </Button>
              <Button size="sm" onClick={() => { setEntryType('bank_in'); setShowAddEntry(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Bank Entry
              </Button>
            </div>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeBanks.map(([bankName, data]) => (
              <Card 
                key={bankName} 
                className="cursor-pointer hover:shadow-lg transition-shadow border-blue-500/20"
                onClick={() => { setSelectedBank(bankName); setShowTransactions(true); }}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    {bankName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data.openingBalance > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Opening:</span>
                        <span className="text-blue-600">₨ {data.openingBalance.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">In:</span>
                      <span className="text-green-600">₨ {data.totalIn.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Out:</span>
                      <span className="text-red-600">₨ {data.totalOut.toLocaleString()}</span>
                    </div>
                    <div className="pt-2 border-t">
                      <div className="flex justify-between">
                        <span className="font-medium">Balance:</span>
                        <span className={`font-bold ${data.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ₨ {data.balance.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {activeBanks.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No bank accounts set up.</p>
                <p className="text-sm">Click "Add Bank" to add your first bank account.</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Manage Tab */}
        <TabsContent value="manage" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Manage Bank Accounts</h2>
            <Button size="sm" onClick={() => setShowAddBank(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Bank Account
            </Button>
          </div>
          
          <Card>
            <CardContent className="pt-6">
              {agencyBanks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No bank accounts configured.</p>
                  <p className="text-sm">Add your agency's bank accounts to track transactions.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bank Name</TableHead>
                      <TableHead>Account Number</TableHead>
                      <TableHead>Account Title</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Opening Balance</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agencyBanks.map((bank: any) => (
                      <TableRow key={bank.id}>
                        <TableCell className="font-medium">{bank.bank_name}</TableCell>
                        <TableCell>{bank.account_number || "-"}</TableCell>
                        <TableCell>{bank.account_title || "-"}</TableCell>
                        <TableCell>{bank.branch_name || "-"}</TableCell>
                        <TableCell>₨ {(bank.opening_balance || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => {
                              if (confirm('Delete this bank account?')) {
                                deleteBank.mutate(bank.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Transaction Details Dialog */}
      <Dialog open={showTransactions} onOpenChange={setShowTransactions}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedBank === null ? (
                <>
                  <Banknote className="w-5 h-5 text-green-600" />
                  Cash Transactions
                </>
              ) : (
                <>
                  <Building2 className="w-5 h-5 text-blue-600" />
                  {selectedBank} Transactions
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              All {selectedBank === null ? 'cash' : selectedBank} transactions
            </DialogDescription>
          </DialogHeader>
          <TransactionTable 
            transactions={getTransactions(selectedBank)} 
            onDelete={(id) => deleteEntry.mutate(id)}
          />
        </DialogContent>
      </Dialog>

      {/* Add Entry Dialog */}
      <Dialog open={showAddEntry} onOpenChange={setShowAddEntry}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Add {entryType.includes('cash') ? 'Cash' : 'Bank'} Entry
            </DialogTitle>
            <DialogDescription>
              Record a manual {entryType.includes('in') ? 'receipt' : 'payment'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleAddEntry} className="space-y-4">
            <div className="space-y-2">
              <Label>Entry Type</Label>
              <Select value={entryType} onValueChange={(v: any) => setEntryType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash_in">
                    <span className="flex items-center gap-2">
                      <ArrowDownLeft className="w-4 h-4 text-green-500" />
                      Cash In (Receipt)
                    </span>
                  </SelectItem>
                  <SelectItem value="cash_out">
                    <span className="flex items-center gap-2">
                      <ArrowUpRight className="w-4 h-4 text-red-500" />
                      Cash Out (Payment)
                    </span>
                  </SelectItem>
                  <SelectItem value="bank_in">
                    <span className="flex items-center gap-2">
                      <ArrowDownLeft className="w-4 h-4 text-green-500" />
                      Bank In (Deposit)
                    </span>
                  </SelectItem>
                  <SelectItem value="bank_out">
                    <span className="flex items-center gap-2">
                      <ArrowUpRight className="w-4 h-4 text-red-500" />
                      Bank Out (Withdrawal)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="entry_date">Date *</Label>
                <Input
                  id="entry_date"
                  name="entry_date"
                  type="date"
                  defaultValue={format(new Date(), 'yyyy-MM-dd')}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (₨) *</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            {(entryType === 'bank_in' || entryType === 'bank_out') && (
              <div className="space-y-2">
                <Label htmlFor="bank_name">Bank *</Label>
                {agencyBanks.length === 0 ? (
                  <div className="p-3 border border-dashed rounded-lg bg-muted/30 text-center">
                    <p className="text-sm text-muted-foreground mb-2">No banks added yet</p>
                    <Button type="button" size="sm" variant="outline" onClick={() => { setShowAddEntry(false); setShowAddBank(true); }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Bank First
                    </Button>
                  </div>
                ) : (
                  <Select name="bank_name" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {agencyBanks.map((bank: any) => (
                        <SelectItem key={bank.id} value={bank.bank_name}>
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-blue-600" />
                            {bank.bank_name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                name="category"
                value={entryCategory}
                onChange={(e) => setEntryCategory(e.target.value)}
                placeholder="e.g., Office Supplies, Salary, etc."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={entryDescription}
                onChange={(e) => setEntryDescription(e.target.value)}
                placeholder="Additional details..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference_number">Reference Number</Label>
              <Input
                id="reference_number"
                name="reference_number"
                placeholder="e.g., Receipt #, Cheque #"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddEntry(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addEntry.isPending}>
                {addEntry.isPending ? "Saving..." : "Save Entry"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Bank Dialog */}
      <Dialog open={showAddBank} onOpenChange={setShowAddBank}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              Add Bank Account
            </DialogTitle>
            <DialogDescription>
              Add a new bank account to track transactions
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleAddBank} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bank_name">Bank Name *</Label>
              <Input
                id="bank_name"
                name="bank_name"
                placeholder="e.g., HBL, UBL, Meezan Bank"
                required
              />
              <p className="text-xs text-muted-foreground">
                Enter your bank name. This will be available in all payment forms.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_number">Account Number</Label>
              <Input
                id="account_number"
                name="account_number"
                placeholder="e.g., 1234567890"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_title">Account Title</Label>
              <Input
                id="account_title"
                name="account_title"
                placeholder="e.g., Company Name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="branch_name">Branch Name</Label>
              <Input
                id="branch_name"
                name="branch_name"
                placeholder="e.g., Main Branch"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="opening_balance">Opening Balance (₨)</Label>
              <Input
                id="opening_balance"
                name="opening_balance"
                type="number"
                step="0.01"
                defaultValue="0"
                placeholder="0.00"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddBank(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addBank.isPending}>
                {addBank.isPending ? "Saving..." : "Add Bank"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Transaction Table Component
function TransactionTable({ transactions, onDelete }: { transactions: any[]; onDelete?: (id: string) => void }) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No transactions found
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            {onDelete && <TableHead className="w-10"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((t, idx) => (
            <TableRow key={t.id || idx}>
              <TableCell className="whitespace-nowrap">
                {t.date ? format(parseISO(t.date), "MMM dd, yyyy") : "-"}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {t.type}
                </Badge>
              </TableCell>
              <TableCell className="max-w-xs truncate">{t.description}</TableCell>
              <TableCell className="text-right font-semibold">
                <span className={t.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {t.amount >= 0 ? '+' : ''}₨ {t.amount.toLocaleString()}
                </span>
              </TableCell>
              {onDelete && (
                <TableCell>
                  {t.canDelete && (
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => onDelete(t.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
