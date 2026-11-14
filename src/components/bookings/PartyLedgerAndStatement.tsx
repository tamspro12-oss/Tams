import React, { useState, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText,
  Download,
  Printer,
  DollarSign,
  TrendingUp,
  RotateCcw,
  Plus,
  Scale,
  Calendar,
  Wallet,
  Building2,
  FileSpreadsheet,
  Check,
  RefreshCw,
} from "lucide-react";
import { usePartyStatement, useAccounts, useTransactionMutations, PartyStatementRow } from "@/hooks/useUnifiedTransactions";
import { useAgency } from "@/hooks/useAgency";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { getKarachiYmd, getKarachiTodayNoon } from "@/lib/karachiTime";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LockedDateField, getTodayDateString } from "@/components/ui/LockedDateField";
import { useFormKeyboardNav } from "@/hooks/useFormKeyboardNav";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface PartyLedgerAndStatementProps {
  partyId: string;
  partyType: "client" | "agent" | "vendor";
  partyName: string;
  pnr?: string;
  bookingId?: string;
  defaultSubTab?: "ledger" | "statement" | "payment";
  outstandingBalance?: number;
  onPaymentSuccess?: () => void;
}

export function PartyLedgerAndStatement({
  partyId,
  partyType,
  partyName,
  pnr,
  bookingId,
  defaultSubTab = "ledger",
  outstandingBalance = 0,
  onPaymentSuccess,
}: PartyLedgerAndStatementProps) {
  const [subTab, setSubTab] = useState<"ledger" | "statement" | "payment">(defaultSubTab);
  const [dateFilterPreset, setDateFilterPreset] = useState<"all" | "this_month" | "last_month">("all");
  const [includeReversed, setIncludeReversed] = useState<boolean>(false);

  // Payment Form State
  const paymentFormRef = useRef<HTMLFormElement>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>(
    outstandingBalance > 0 ? outstandingBalance.toString() : ""
  );
  const [paymentDate, setPaymentDate] = useState<string>(() => getTodayDateString());
  const [paymentAccountId, setPaymentAccountId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [paymentRef, setPaymentRef] = useState<string>(pnr ? `PAY-${pnr}` : "");
  const [paymentNotes, setPaymentNotes] = useState<string>("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);

  useFormKeyboardNav({
    containerRef: paymentFormRef,
    enabled: subTab === "payment",
    onSave: () => paymentFormRef.current?.requestSubmit(),
    autoFocusFirst: true,
  });

  const { accounts, cashAccount } = useAccounts();
  const { data: agency } = useAgency();
  const { recordPayment, reverseTransaction } = useTransactionMutations();

  // Initialize account
  React.useEffect(() => {
    if (!paymentAccountId && accounts.length > 0) {
      setPaymentAccountId(accounts[0].id);
    }
  }, [accounts, paymentAccountId]);

  // Compute date range
  const dateRange = useMemo(() => {
    const now = getKarachiTodayNoon();
    if (dateFilterPreset === "this_month") {
      return {
        start: format(startOfMonth(now), "yyyy-MM-dd"),
        end: format(endOfMonth(now), "yyyy-MM-dd"),
      };
    }
    if (dateFilterPreset === "last_month") {
      const lm = subMonths(now, 1);
      return {
        start: format(startOfMonth(lm), "yyyy-MM-dd"),
        end: format(endOfMonth(lm), "yyyy-MM-dd"),
      };
    }
    return { start: undefined, end: undefined };
  }, [dateFilterPreset]);

  // Fetch Party Statement / Ledger rows
  const { data: rawRows = [], isLoading, refetch } = usePartyStatement(partyId, {
    startDate: dateRange.start,
    endDate: dateRange.end,
    includeReversed,
  });

  // Summary statistics
  const summary = useMemo(() => {
    let totDebit = 0; // Charges / Invoices
    let totCredit = 0; // Payments / Receipts
    rawRows.forEach((r) => {
      if (!r.is_reversed) {
        totDebit += Number(r.debit) || 0;
        totCredit += Number(r.credit) || 0;
      }
    });

    const balance = totDebit - totCredit;
    return {
      totDebit,
      totCredit,
      balance,
    };
  }, [rawRows]);

  // Handle Payment Submit
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("You are offline — connect to the internet to record payments.");
      return;
    }
    const num = parseFloat(paymentAmount);
    if (!num || num <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }
    if (!paymentAccountId) {
      toast.error("Please select an account (Cash or Bank)");
      return;
    }

    setIsSubmittingPayment(true);
    try {
      await recordPayment.mutateAsync({
        direction: partyType === "vendor" ? "out" : "in",
        amount: num,
        accountId: paymentAccountId,
        partyId,
        partyType,
        bookingId: bookingId || null,
        date: paymentDate,
        method: paymentMethod,
        referenceNo: paymentRef.trim() || undefined,
        notes: paymentNotes.trim() || `Payment for ${partyName}`,
      });

      setPaymentAmount("");
      setPaymentNotes("");
      setSubTab("ledger");
      onPaymentSuccess?.();
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    try {
      const rows = rawRows.map((r) => ({
        Date: r.date,
        Type: r.type.toUpperCase(),
        Reference: r.booking_ref || r.reference_no || "-",
        Particulars: r.notes || "-",
        Account: r.account_name || r.method || "-",
        "Debit (Charge)": r.debit || 0,
        "Credit (Paid)": r.credit || 0,
        "Running Balance": r.running_balance || 0,
        Status: r.is_reversed ? "REVERSED" : "ACTIVE",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Party Ledger");
      XLSX.writeFile(wb, `${partyName.replace(/\s+/g, "_")}_Ledger.xlsx`);
      toast.success("Ledger exported to Excel");
    } catch (err: any) {
      toast.error("Export failed: " + err.message);
    }
  };

  // Export PDF
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF("portrait", "mm", "a4");
      doc.setFontSize(16);
      doc.text(agency?.agency_name || "TAMS Pro Travel Agency", 14, 16);
      doc.setFontSize(11);
      doc.text(`Party Statement: ${partyName} (${partyType.toUpperCase()})`, 14, 23);
      doc.setFontSize(9);
      doc.text(`Generated: ${format(new Date(), "PPpp")}`, 14, 29);

      // Summary block
      doc.setFontSize(10);
      doc.text(
        `Total Charged: PKR ${summary.totDebit.toLocaleString()}  |  Total Paid: PKR ${summary.totCredit.toLocaleString()}  |  Balance Due: PKR ${summary.balance.toLocaleString()}`,
        14,
        36
      );

      const tableData = rawRows.map((r) => [
        r.date,
        r.booking_ref || r.reference_no || "-",
        r.notes || r.type.toUpperCase(),
        r.account_name || r.method || "-",
        r.debit > 0 ? `PKR ${r.debit.toLocaleString()}` : "-",
        r.credit > 0 ? `PKR ${r.credit.toLocaleString()}` : "-",
        `PKR ${(r.running_balance || 0).toLocaleString()}`,
      ]);

      autoTable(doc, {
        head: [["Date", "Ref/PNR", "Particulars", "Account/Method", "Debit", "Credit", "Balance"]],
        body: tableData,
        startY: 40,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
      });

      doc.save(`${partyName.replace(/\s+/g, "_")}_Statement.pdf`);
      toast.success("Statement exported to PDF");
    } catch (err: any) {
      toast.error("Export failed: " + err.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub-Tabs Navigation */}
      <div className="flex items-center justify-between border-b pb-2">
        <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg border">
          <Button
            variant={subTab === "ledger" ? "default" : "ghost"}
            size="sm"
            onClick={() => setSubTab("ledger")}
            className="h-7 text-xs font-semibold gap-1.5"
          >
            <Scale className="w-3.5 h-3.5" />
            Ledger
          </Button>
          <Button
            variant={subTab === "statement" ? "default" : "ghost"}
            size="sm"
            onClick={() => setSubTab("statement")}
            className="h-7 text-xs font-semibold gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            Statement
          </Button>
          <Button
            variant={subTab === "payment" ? "default" : "ghost"}
            size="sm"
            onClick={() => setSubTab("payment")}
            className={cn(
              "h-7 text-xs font-semibold gap-1.5",
              subTab === "payment" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
            )}
          >
            <DollarSign className="w-3.5 h-3.5" />
            Add Payment
          </Button>
        </div>

        {/* Small Party Balance Pill */}
        <div className="text-right flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">Net Balance:</span>
          <Badge
            variant="outline"
            className={cn(
              "font-mono font-bold text-xs px-2 py-0.5",
              summary.balance > 0
                ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                : summary.balance < 0
                ? "bg-red-500/10 text-red-600 border-red-500/30"
                : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
            )}
          >
            PKR {Math.abs(summary.balance).toLocaleString()}{" "}
            {summary.balance > 0 ? (partyType === "vendor" ? "Payable" : "Due") : summary.balance < 0 ? "Advance" : "Cleared"}
          </Badge>
        </div>
      </div>

      {/* ===================== SUBTAB 1: LEDGER ===================== */}
      {subTab === "ledger" && (
        <div className="space-y-3">
          {/* Action & Filter Strip */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Select value={dateFilterPreset} onValueChange={(val: any) => setDateFilterPreset(val)}>
                <SelectTrigger className="h-8 text-xs w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="last_month">Last Month</SelectItem>
                </SelectContent>
              </Select>

              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeReversed}
                  onChange={(e) => setIncludeReversed(e.target.checked)}
                  className="rounded border-input text-primary h-3.5 w-3.5"
                />
                <span>Show void</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportExcel} className="h-8 text-xs gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Excel</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF} className="h-8 text-xs gap-1.5">
                <FileText className="w-3.5 h-3.5 text-red-600" />
                <span className="hidden sm:inline">PDF</span>
              </Button>
              <Button variant="ghost" size="icon" onClick={() => refetch()} className="h-8 w-8 text-muted-foreground">
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Ledger Table */}
          <Card className="border-border shadow-xs overflow-hidden">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
                  <tr>
                    <th className="p-2.5 text-left whitespace-nowrap">Date</th>
                    <th className="p-2.5 text-left whitespace-nowrap">Ref / PNR</th>
                    <th className="p-2.5 text-left">Description / Particulars</th>
                    <th className="p-2.5 text-left whitespace-nowrap">Account / Method</th>
                    <th className="p-2.5 text-right whitespace-nowrap">Debit (Charge)</th>
                    <th className="p-2.5 text-right whitespace-nowrap">Credit (Paid)</th>
                    <th className="p-2.5 text-right whitespace-nowrap">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {rawRows.length > 0 ? (
                    rawRows.map((r) => (
                      <tr
                        key={r.id}
                        className={cn(
                          "hover:bg-muted/30 transition-colors",
                          r.is_reversed && "opacity-50 line-through bg-muted/20"
                        )}
                      >
                        <td className="p-2.5 text-muted-foreground font-mono whitespace-nowrap">{r.date}</td>
                        <td className="p-2.5 font-mono font-bold text-primary whitespace-nowrap">
                          {r.booking_ref || r.reference_no || "-"}
                        </td>
                        <td className="p-2.5 font-medium max-w-xs truncate">{r.notes || r.type.toUpperCase()}</td>
                        <td className="p-2.5 text-muted-foreground whitespace-nowrap">
                          {r.account_name || r.method || "Cash"}
                        </td>
                        <td className="p-2.5 text-right font-medium text-purple-600 whitespace-nowrap">
                          {r.debit > 0 ? `PKR ${r.debit.toLocaleString()}` : "-"}
                        </td>
                        <td className="p-2.5 text-right font-medium text-emerald-600 whitespace-nowrap">
                          {r.credit > 0 ? `PKR ${r.credit.toLocaleString()}` : "-"}
                        </td>
                        <td className="p-2.5 text-right font-bold font-mono whitespace-nowrap">
                          PKR {(r.running_balance || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-muted-foreground italic">
                        No transactions found for {partyName}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===================== SUBTAB 2: STATEMENT ===================== */}
      {subTab === "statement" && (
        <Card className="border-border shadow-xs overflow-hidden">
          <CardHeader className="py-3 px-4 border-b bg-muted/20 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Account Statement — {partyName}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Official statement of account with running balance and verification summary.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportPDF} className="h-8 text-xs gap-1.5">
                <Download className="w-3.5 h-3.5" />
                Download PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()} className="h-8 text-xs gap-1.5">
                <Printer className="w-3.5 h-3.5" />
                Print
              </Button>
            </div>
          </CardHeader>

          {/* Statement Sheet */}
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border bg-background">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Invoiced / Charged</p>
                <p className="text-base font-bold text-purple-600 mt-0.5">
                  PKR {summary.totDebit.toLocaleString()}
                </p>
              </div>
              <div className="p-3 rounded-lg border bg-background">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Received / Paid</p>
                <p className="text-base font-bold text-emerald-600 mt-0.5">
                  PKR {summary.totCredit.toLocaleString()}
                </p>
              </div>
              <div className="p-3 rounded-lg border bg-primary/5 border-primary/20">
                <p className="text-[10px] uppercase font-bold text-primary">Outstanding Balance</p>
                <p className="text-base font-black text-primary mt-0.5">
                  PKR {summary.balance.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Statement Table */}
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
                  <tr>
                    <th className="p-2.5 text-left">Date</th>
                    <th className="p-2.5 text-left">Ref</th>
                    <th className="p-2.5 text-left">Description</th>
                    <th className="p-2.5 text-right">Debit</th>
                    <th className="p-2.5 text-right">Credit</th>
                    <th className="p-2.5 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {rawRows.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30">
                      <td className="p-2.5 font-mono text-muted-foreground">{r.date}</td>
                      <td className="p-2.5 font-mono text-primary font-bold">{r.booking_ref || r.reference_no || "-"}</td>
                      <td className="p-2.5">{r.notes || r.type}</td>
                      <td className="p-2.5 text-right text-purple-600 font-medium">
                        {r.debit > 0 ? r.debit.toLocaleString() : "-"}
                      </td>
                      <td className="p-2.5 text-right text-emerald-600 font-medium">
                        {r.credit > 0 ? r.credit.toLocaleString() : "-"}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold">
                        PKR {(r.running_balance || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* ===================== SUBTAB 3: ADD PAYMENT ===================== */}
      {subTab === "payment" && (
        <Card className="border-border shadow-xs">
          <CardHeader className="py-3 px-4 border-b bg-emerald-500/5">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <DollarSign className="w-4 h-4" />
              Record Payment for {partyName}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Directly records to the master transactions table and updates this party's live balance.
            </p>
          </CardHeader>
          <CardContent className="p-4">
            <form ref={paymentFormRef} onSubmit={handlePaymentSubmit} className="space-y-4 max-w-lg">
              <div className="grid grid-cols-2 gap-3 items-start">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Amount (PKR) *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-muted-foreground">₨</span>
                    <Input
                      type="number"
                      step="any"
                      min="1"
                      required
                      data-required-positive="true"
                      data-required-message="Amount must be greater than 0"
                      placeholder="0.00"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="pl-7 font-mono font-bold text-base h-10"
                    />
                  </div>
                </div>

                <LockedDateField
                  label="Payment Date"
                  value={paymentDate}
                  onChange={setPaymentDate}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Deposit / Account *</Label>
                  <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select Account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.name} ({acc.type.toUpperCase()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash In Hand</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="card">Card Payment</SelectItem>
                      <SelectItem value="easypaisa">Easypaisa / JazzCash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Reference # / Slip</Label>
                  <Input
                    placeholder="e.g. REC-10294"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Notes / Remarks</Label>
                  <Input
                    placeholder="e.g. Paid in full"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  tabIndex={-1}
                  onClick={() => setSubTab("ledger")}
                  disabled={isSubmittingPayment}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  data-save-button="true"
                  disabled={isSubmittingPayment}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  {isSubmittingPayment ? "Recording..." : "Post Payment to Ledger"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
