import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search,
  Download,
  Filter,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Scale,
  RotateCcw,
  Plus,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  Eye,
  CheckCircle,
  Calendar,
  Wallet,
  Building2,
  Users,
} from "lucide-react";
import { useAgencyLedger, useAccounts, useTransactionMutations, TransactionItem } from "@/hooks/useUnifiedTransactions";
import { useClients, useVendors } from "@/hooks/useStorage";
import { useB2BAgents } from "@/hooks/useB2BAgents";
import { useAgency } from "@/hooks/useAgency";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AgencyLedgerTabProps {
  onOpenAddEntry?: () => void;
  onOpenPartyCard?: (partyId: string, partyType: "client" | "agent" | "vendor") => void;
}

export function AgencyLedgerTab({ onOpenAddEntry, onOpenPartyCard }: AgencyLedgerTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilterPreset, setDateFilterPreset] = useState<"all" | "this_month" | "last_month" | "today">("this_month");
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedPartyFilter, setSelectedPartyFilter] = useState<string>("all");
  const [includeReversed, setIncludeReversed] = useState<boolean>(true);
  const [txToReverse, setTxToReverse] = useState<TransactionItem | null>(null);
  const [reversalReason, setReversalReason] = useState<string>("");

  const { accounts } = useAccounts();
  const { clients } = useClients();
  const { agents } = useB2BAgents();
  const { vendors } = useVendors();
  const { data: agency } = useAgency();
  const { reverseTransaction } = useTransactionMutations();

  // Date range calculation
  const dateRange = useMemo(() => {
    const now = new Date();
    if (dateFilterPreset === "today") {
      const todayStr = format(now, "yyyy-MM-dd");
      return { start: todayStr, end: todayStr };
    }
    if (dateFilterPreset === "this_month") {
      return {
        start: format(startOfMonth(now), "yyyy-MM-dd"),
        end: format(endOfMonth(now), "yyyy-MM-dd"),
      };
    }
    if (dateFilterPreset === "last_month") {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return {
        start: format(startOfMonth(lastMonth), "yyyy-MM-dd"),
        end: format(endOfMonth(lastMonth), "yyyy-MM-dd"),
      };
    }
    return { start: undefined, end: undefined };
  }, [dateFilterPreset]);

  // Fetch unified agency transactions
  const { data: transactions = [], isLoading } = useAgencyLedger({
    startDate: dateRange.start,
    endDate: dateRange.end,
    accountId: selectedAccount,
    type: selectedType,
    includeReversed,
  });

  // Calculate Summary strip: total balance, receivable, payable, this month in/out
  const summaryStrip = useMemo(() => {
    // Total balance in cash & banks
    const totalCashBankBalance = accounts.reduce((sum, a) => sum + (a.current_balance || 0), 0);

    // Total receivables from clients
    const clientReceivables = (clients || []).reduce((sum, c) => {
      const sp = Number(c.selling_price) || 0;
      const pd = Number(c.amount_paid) || 0;
      return sum + Math.max(0, sp - pd);
    }, 0);

    // Total payables to vendors
    const vendorPayables = (vendors || []).reduce((sum, v) => {
      const tp = Number(v.totalPayable) || Number(v.purchasing_price) || 0;
      const pd = Number(v.amount_paid) || 0;
      return sum + Math.max(0, tp - pd);
    }, 0);

    // This month In / Out across transactions
    let monthIn = 0;
    let monthOut = 0;
    (transactions || []).forEach((t) => {
      if (!t.is_reversed) {
        if (t.type === "payment_in") monthIn += Number(t.debit) || 0;
        else if (t.type === "payment_out" || t.type === "expense" || t.type === "refund") {
          monthOut += Number(t.credit) || 0;
        }
      }
    });

    return {
      totalBalance: totalCashBankBalance,
      receivable: clientReceivables,
      payable: vendorPayables,
      monthIn,
      monthOut,
    };
  }, [accounts, clients, vendors, transactions]);

  // Filter transactions by search query and party
  const filteredTransactions = useMemo(() => {
    return (transactions || []).filter((tx) => {
      if (selectedPartyFilter !== "all" && tx.party_type !== selectedPartyFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const partyName = (tx.party_name || "").toLowerCase();
        const pnr = (tx.booking_ref || tx.reference_no || "").toLowerCase();
        const notes = (tx.notes || "").toLowerCase();
        const cat = (tx.category || "").toLowerCase();
        const acc = (tx.account_name || "").toLowerCase();
        return partyName.includes(q) || pnr.includes(q) || notes.includes(q) || cat.includes(q) || acc.includes(q);
      }
      return true;
    });
  }, [transactions, searchQuery, selectedPartyFilter]);

  // Handle Soft Reversal
  const handleConfirmReversal = async () => {
    if (!txToReverse) return;
    try {
      await reverseTransaction.mutateAsync({
        transactionId: txToReverse.id,
        reason: reversalReason.trim() || "Transaction voided by user",
      });
      setTxToReverse(null);
      setReversalReason("");
    } catch (e) {
      console.error(e);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    try {
      const rows = filteredTransactions.map((tx) => ({
        Date: tx.date,
        Type: tx.type.toUpperCase(),
        Reference: tx.reference_no || tx.booking_ref || "-",
        Party: tx.party_name || "-",
        Account: tx.account_name || "Cash",
        "Debit (In)": tx.debit || 0,
        "Credit (Out)": tx.credit || 0,
        "Running Balance": tx.running_balance || 0,
        Notes: tx.notes || "",
        Status: tx.is_reversed ? "REVERSED" : "ACTIVE",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Agency Ledger");
      XLSX.writeFile(wb, `Agency_Ledger_${format(new Date(), "yyyyMMdd")}.xlsx`);
      toast.success("Ledger exported to Excel");
    } catch (err: any) {
      toast.error("Export failed: " + err.message);
    }
  };

  // Export to PDF
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF("landscape", "mm", "a4");
      doc.setFontSize(16);
      doc.text(agency?.agency_name || "TAMS Pro Agency", 14, 15);
      doc.setFontSize(11);
      doc.text("Agency-Wide Financial Ledger", 14, 22);
      doc.setFontSize(9);
      doc.text(`Generated: ${format(new Date(), "PPpp")}`, 14, 28);

      const tableData = filteredTransactions.map((tx) => [
        tx.date,
        tx.type.toUpperCase(),
        tx.reference_no || tx.booking_ref || "-",
        tx.party_name || "-",
        tx.account_name || "Cash",
        tx.debit ? `PKR ${tx.debit.toLocaleString()}` : "-",
        tx.credit ? `PKR ${tx.credit.toLocaleString()}` : "-",
        tx.running_balance !== undefined ? `PKR ${tx.running_balance.toLocaleString()}` : "-",
        tx.notes || "",
      ]);

      autoTable(doc, {
        head: [["Date", "Type", "Ref/PNR", "Party", "Account", "Debit (In)", "Credit (Out)", "Balance", "Notes"]],
        body: tableData,
        startY: 32,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
      });

      doc.save(`Agency_Ledger_${format(new Date(), "yyyyMMdd")}.pdf`);
      toast.success("Ledger exported to PDF");
    } catch (err: any) {
      toast.error("Export failed: " + err.message);
    }
  };

  const getTypeBadge = (type: string, isReversed: boolean) => {
    if (isReversed) {
      return (
        <Badge variant="outline" className="text-[10px] bg-muted line-through text-muted-foreground border-border">
          {type} (Void)
        </Badge>
      );
    }
    switch (type) {
      case "payment_in":
        return <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-700">Receipt In</Badge>;
      case "payment_out":
        return <Badge className="text-[10px] bg-blue-600 hover:bg-blue-700">Payment Out</Badge>;
      case "charge":
        return <Badge className="text-[10px] bg-purple-600 hover:bg-purple-700">Booking Charge</Badge>;
      case "expense":
        return <Badge className="text-[10px] bg-red-600 hover:bg-red-700">Expense</Badge>;
      case "refund":
        return <Badge className="text-[10px] bg-amber-600 hover:bg-amber-700">Refund</Badge>;
      case "transfer":
        return <Badge className="text-[10px] bg-indigo-600 hover:bg-indigo-700">Transfer</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-2.5">
      {/* 1. Small Summary Strip On Top */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-2.5">
        <Card className="bg-gradient-to-br from-emerald-500/10 via-background to-background border-emerald-500/20 shadow-xs">
          <CardContent className="p-2.5 sm:p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Total Cash & Bank</p>
              <h3 className="text-sm sm:text-base font-bold text-foreground">
                PKR {summaryStrip.totalBalance.toLocaleString()}
              </h3>
            </div>
            <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600">
              <Wallet className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 via-background to-background border-blue-500/20 shadow-xs">
          <CardContent className="p-2.5 sm:p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Total Receivables</p>
              <h3 className="text-sm sm:text-base font-bold text-blue-600">
                PKR {summaryStrip.receivable.toLocaleString()}
              </h3>
            </div>
            <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 via-background to-background border-amber-500/20 shadow-xs">
          <CardContent className="p-2.5 sm:p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Total Payables</p>
              <h3 className="text-sm sm:text-base font-bold text-amber-600">
                PKR {summaryStrip.payable.toLocaleString()}
              </h3>
            </div>
            <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-600">
              <TrendingDown className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 via-background to-background border-purple-500/20 shadow-xs">
          <CardContent className="p-2.5 sm:p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Period Receipts / Out</p>
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <span className="text-emerald-600">+{summaryStrip.monthIn.toLocaleString()}</span>
                <span className="text-muted-foreground">/</span>
                <span className="text-red-500">-{summaryStrip.monthOut.toLocaleString()}</span>
              </div>
            </div>
            <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-600">
              <Scale className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. Main Ledger Card with Compact Toolbar & Table */}
      <Card className="shadow-xs border-border/80">
        <div className="p-2.5 sm:p-3 border-b space-y-2">
          {/* Compact Toolbar Row:
              [ Search party, PNR, note... ] [ This Month ▾ ] [ All Parties ▾ ] [ All Types ▾ ] [ All Accounts ▾ ] ........ [ Excel ] [ PDF ] [ Add Payment ] */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row flex-wrap xl:flex-nowrap items-stretch sm:items-center gap-2 flex-1 min-w-0">
              {/* Search */}
              <div className="relative w-full sm:w-48 xl:w-56 shrink-0">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Search party, PNR, note..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 text-xs pl-8"
                />
              </div>

              {/* Filters in 2-column grid on mobile, row on tablet/desktop */}
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap xl:flex-nowrap items-center gap-2 flex-1 min-w-0">
                {/* Date Preset */}
                <Select value={dateFilterPreset} onValueChange={(val: any) => setDateFilterPreset(val)}>
                  <SelectTrigger className="h-8 text-xs w-full sm:w-28 xl:w-32">
                    <SelectValue placeholder="Period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="this_month">This Month</SelectItem>
                    <SelectItem value="last_month">Last Month</SelectItem>
                    <SelectItem value="all">All Dates</SelectItem>
                  </SelectContent>
                </Select>

                {/* Party Scope */}
                <Select value={selectedPartyFilter} onValueChange={setSelectedPartyFilter}>
                  <SelectTrigger className="h-8 text-xs w-full sm:w-28 xl:w-32">
                    <SelectValue placeholder="Party" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Parties</SelectItem>
                    <SelectItem value="client">Direct Clients</SelectItem>
                    <SelectItem value="agent">B2B Agents</SelectItem>
                    <SelectItem value="vendor">Vendors</SelectItem>
                  </SelectContent>
                </Select>

                {/* Type */}
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="h-8 text-xs w-full sm:w-28 xl:w-32">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="payment_in">Payment In</SelectItem>
                    <SelectItem value="payment_out">Payment Out</SelectItem>
                    <SelectItem value="charge">Charge</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="refund">Refund</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                  </SelectContent>
                </Select>

                {/* Account */}
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger className="h-8 text-xs w-full sm:w-32 xl:w-36">
                    <SelectValue placeholder="Account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Buttons right-aligned */}
            <div className="flex items-center justify-end gap-1.5 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="h-8 text-xs gap-1.5 px-2.5"
                disabled={filteredTransactions.length === 0}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Excel</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                className="h-8 text-xs gap-1.5 px-2.5"
                disabled={filteredTransactions.length === 0}
              >
                <FileText className="w-3.5 h-3.5 text-red-600" />
                <span>PDF</span>
              </Button>
              {onOpenAddEntry && (
                <Button
                  size="sm"
                  onClick={onOpenAddEntry}
                  className="h-8 text-xs gap-1 bg-primary text-primary-foreground font-semibold px-3"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Payment</span>
                </Button>
              )}
            </div>
          </div>

          {/* Show voided / reversed transactions checkbox directly under toolbar, small, no extra spacing */}
          <div className="flex items-center text-[11px] text-muted-foreground pt-0.5">
            <label className="flex items-center gap-1.5 cursor-pointer select-none hover:text-foreground transition-colors">
              <input
                type="checkbox"
                checked={includeReversed}
                onChange={(e) => setIncludeReversed(e.target.checked)}
                className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5"
              />
              <span>Show voided / reversed transactions</span>
            </label>
          </div>
        </div>

        {/* Ledger Table */}
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
              <tr>
                <th className="py-2 px-2.5 text-left whitespace-nowrap">Date</th>
                <th className="py-2 px-2.5 text-left whitespace-nowrap">Ref / PNR</th>
                <th className="py-2 px-2.5 text-left whitespace-nowrap">Type</th>
                <th className="py-2 px-2.5 text-left whitespace-nowrap">Party Name</th>
                <th className="py-2 px-2.5 text-left whitespace-nowrap">Account</th>
                <th className="py-2 px-2.5 text-right whitespace-nowrap">Debit (In)</th>
                <th className="py-2 px-2.5 text-right whitespace-nowrap">Credit (Out)</th>
                <th className="py-2 px-2.5 text-right whitespace-nowrap">Running Balance</th>
                <th className="py-2 px-2.5 text-left">Notes</th>
                <th className="py-2 px-2.5 text-center w-14">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className={cn(
                      "hover:bg-muted/30 transition-colors",
                      tx.is_reversed && "opacity-50 bg-muted/20"
                    )}
                  >
                    <td className="py-2 px-2.5 text-muted-foreground whitespace-nowrap font-mono">
                      {tx.date}
                    </td>
                    <td className="py-2 px-2.5 font-mono font-medium text-primary whitespace-nowrap">
                      {tx.booking_ref || tx.reference_no || "-"}
                    </td>
                    <td className="py-2 px-2.5 whitespace-nowrap">
                      {getTypeBadge(tx.type, tx.is_reversed || false)}
                    </td>
                    <td className="py-2 px-2.5 font-semibold text-foreground">
                      {tx.party_id && tx.party_type ? (
                        <button
                          type="button"
                          onClick={() => onOpenPartyCard && onOpenPartyCard(tx.party_id!, tx.party_type!)}
                          className="text-left font-bold hover:underline hover:text-primary transition-colors cursor-pointer"
                          title="Click to open this party's booking card"
                        >
                          {tx.party_name || "View Party"}
                        </button>
                      ) : (
                        tx.party_name || "-"
                      )}
                    </td>
                    <td className="py-2 px-2.5 text-muted-foreground whitespace-nowrap">
                      {tx.account_name || "Cash"}
                    </td>
                    <td className="py-2 px-2.5 text-right font-medium text-emerald-600 whitespace-nowrap">
                      {tx.debit > 0 ? `PKR ${tx.debit.toLocaleString()}` : "-"}
                    </td>
                    <td className="py-2 px-2.5 text-right font-medium text-red-500 whitespace-nowrap">
                      {tx.credit > 0 ? `PKR ${tx.credit.toLocaleString()}` : "-"}
                    </td>
                    <td className="py-2 px-2.5 text-right font-bold font-mono whitespace-nowrap">
                      {tx.running_balance !== undefined ? `PKR ${tx.running_balance.toLocaleString()}` : "-"}
                    </td>
                    <td className="py-2 px-2.5 text-muted-foreground max-w-xs truncate" title={tx.notes || ""}>
                      {tx.notes || "-"}
                    </td>
                    <td className="py-2 px-2.5 text-center">
                      {!tx.is_reversed ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setTxToReverse(tx)}
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          title="Void / Reverse entry"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">Void</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-muted-foreground italic">
                    No transactions found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Reversal Confirmation Dialog */}
      <AlertDialog open={!!txToReverse} onOpenChange={(open) => !open && setTxToReverse(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <RotateCcw className="w-5 h-5" />
              Reverse / Void Transaction?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs space-y-2">
              <p>
                In compliance with strict accounting standards, transactions are never deleted. A reversing
                entry will be posted to offset the original amount of{" "}
                <span className="font-bold text-foreground">
                  PKR {txToReverse ? (txToReverse.debit || txToReverse.credit).toLocaleString() : 0}
                </span>.
              </p>
              <div className="pt-2">
                <Label className="text-xs font-medium text-foreground">Reason for Reversal:</Label>
                <Input
                  placeholder="e.g. Mistyped amount, cancelled ticket, duplicate entry"
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmReversal}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Confirm Reversal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
