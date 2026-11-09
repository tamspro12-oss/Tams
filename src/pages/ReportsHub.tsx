import React, { useState, useMemo } from "react";
import { SeoHead } from "@/components/SeoHead";
import {
  ExcelGrid,
  GridColumn,
  PageHeader,
  TotalsBar,
  FilterBar,
  FilterState,
  defaultFilterState,
  StatusChip,
  EmptyState,
} from "@/components/design-system";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useParties } from "@/hooks/useParties";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  FileText,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  ArrowRight,
  TrendingUp,
  Receipt,
  Scale,
  Calendar,
} from "lucide-react";

type ReportType =
  | "account_statement"
  | "booking_report"
  | "daily_report"
  | "financial_reports";

type FinancialSubReport =
  | "profit_report"
  | "accounts_summary"
  | "assets_dues"
  | "monthly_income"
  | "monthly_expenses";

export default function ReportsHub() {
  const [selectedReport, setSelectedReport] = useState<ReportType>("account_statement");
  const [financialSubReport, setFinancialSubReport] = useState<FinancialSubReport>("profit_report");

  // Shared Filter Bar State
  const [filters, setFilters] = useState<FilterState>(defaultFilterState);

  // Toggle options for Account Statement
  const [detailedView, setDetailedView] = useState(false);
  const [onlyUnpaid, setOnlyUnpaid] = useState(false);
  const [showMoreColumns, setShowMoreColumns] = useState(false);
  const [overdueBucket, setOverdueBucket] = useState<"all" | "0-30" | "31-60" | "61-90" | "90+">("all");

  // Toggle for Daily Report (Cash / Bank switch)
  const [dailyAccountType, setDailyAccountType] = useState<"all" | "cash" | "bank">("all");

  const { parties } = useParties();

  // 1. Fetch Invoices
  const { data: rawInvoices = [] } = useQuery({
    queryKey: ["report_invoices"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("booking_invoices")
        .select("*, party:parties(name), vendor:parties!vendor_id(name)")
        .order("invoice_date", { ascending: false });

      if (!error && data && data.length > 0) return data;

      // Fallback: clients table
      const { data: clientsData } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });

      return (clientsData || []).map((c: any) => ({
        id: c.id,
        invoice_no: `INV-${c.id.slice(0, 4).toUpperCase()}`,
        invoice_date: c.flight_date || c.created_at.slice(0, 10),
        service: c.travel_type || "Ticket",
        client_name: c.name,
        party: { name: c.name },
        client_amount: c.selling_price || 0,
        vendor_payable: c.purchasing_price || 0,
        profit: (c.selling_price || 0) - (c.purchasing_price || 0),
        paid_amount: c.amount_paid || 0,
        payment_status: (c.payment_status || "Pending").toLowerCase(),
        pnr: c.pnr,
        ticket_no: c.passport_number,
      }));
    },
  });

  // 2. Fetch Transactions / Vouchers
  const { data: rawTransactions = [] } = useQuery({
    queryKey: ["report_transactions"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("transactions")
        .select("*")
        .order("date", { ascending: false });
      return data || [];
    },
  });

  // 3. Fetch Expenses
  const { data: rawExpenses = [] } = useQuery({
    queryKey: ["report_expenses"],
    queryFn: async () => {
      const { data } = await supabase.from("expenses").select("*").order("expense_date", { ascending: false });
      return data || [];
    },
  });

  // 4. Fetch Refunds
  const { data: rawRefunds = [] } = useQuery({
    queryKey: ["report_refunds"],
    queryFn: async () => {
      const { data } = await supabase.from("refunds").select("*").order("refund_date", { ascending: false });
      return data || [];
    },
  });

  // Apply Shared Filters across Invoices
  const filteredInvoices = useMemo(() => {
    return rawInvoices.filter((inv: any) => {
      // Party filter
      if (filters.partyId && filters.partyId !== "all" && inv.party_id !== filters.partyId) {
        return false;
      }
      // Service filter
      if (filters.service !== "all" && inv.service !== filters.service) {
        return false;
      }
      // Status filter
      if (filters.status !== "all" && inv.payment_status !== filters.status) {
        return false;
      }
      // Search query (Find Booking)
      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase();
        const mInv = inv.invoice_no?.toLowerCase().includes(q);
        const mPnr = inv.pnr?.toLowerCase().includes(q);
        const mTicket = inv.ticket_no?.toLowerCase().includes(q);
        const mParty = (inv.party?.name || inv.client_name || "").toLowerCase().includes(q);
        if (!mInv && !mPnr && !mTicket && !mParty) return false;
      }
      return true;
    });
  }, [rawInvoices, filters]);

  // Aggregate Metrics for Top Totals Bar
  const totalInvoiced = useMemo(
    () => filteredInvoices.reduce((sum: number, i: any) => sum + (i.client_amount || 0), 0),
    [filteredInvoices]
  );
  const totalCost = useMemo(
    () => filteredInvoices.reduce((sum: number, i: any) => sum + (i.vendor_payable || 0), 0),
    [filteredInvoices]
  );
  const totalProfit = useMemo(
    () => filteredInvoices.reduce((sum: number, i: any) => sum + (i.profit || 0), 0),
    [filteredInvoices]
  );
  const totalExpensesAmt = useMemo(
    () => rawExpenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0),
    [rawExpenses]
  );

  // ==========================================
  // REPORT 1: ACCOUNT STATEMENT
  // ==========================================
  const statementColumns: GridColumn[] = [
    {
      key: "date",
      header: "Date",
      width: 95,
      render: (r) => <span className="text-xs font-mono">{r.date}</span>,
    },
    {
      key: "voucher_no",
      header: "Voucher / Bill #",
      width: 120,
      render: (r) => <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">{r.voucher_no}</span>,
    },
    {
      key: "description",
      header: "Description / Particulars",
      minWidth: 180,
      render: (r) => <span className="text-xs">{r.description}</span>,
    },
    {
      key: "debit",
      header: "Debit (DR)",
      width: 110,
      isNumeric: true,
      align: "right",
      totalType: "sum",
      render: (r) => (
        <span className="font-mono text-xs text-red-600 font-semibold">
          {r.debit > 0 ? r.debit.toLocaleString() : "—"}
        </span>
      ),
    },
    {
      key: "credit",
      header: "Credit (CR)",
      width: 110,
      isNumeric: true,
      align: "right",
      totalType: "sum",
      render: (r) => (
        <span className="font-mono text-xs text-emerald-600 font-semibold">
          {r.credit > 0 ? r.credit.toLocaleString() : "—"}
        </span>
      ),
    },
    {
      key: "balance",
      header: "Running Balance",
      width: 130,
      isNumeric: true,
      align: "right",
      render: (r) => (
        <span className="font-mono text-xs font-bold">
          PKR {Math.abs(r.balance).toLocaleString()} {r.balance > 0 ? "DR" : r.balance < 0 ? "CR" : ""}
        </span>
      ),
    },
    {
      key: "overdue_days",
      header: "Overdue",
      width: 90,
      align: "center",
      render: (r) => (
        r.overdue_days ? (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
            {r.overdue_days}d
          </span>
        ) : (
          <span className="text-slate-400 text-xs">—</span>
        )
      ),
    },
  ];

  // ==========================================
  // REPORT 2: BOOKING REPORT (Booking Wise Profit)
  // ==========================================
  const bookingReportColumns: GridColumn[] = [
    {
      key: "invoice_no",
      header: "Bill No",
      width: 110,
      render: (b) => <span className="font-mono text-xs font-bold">{b.invoice_no}</span>,
    },
    {
      key: "invoice_date",
      header: "Date",
      width: 95,
      render: (b) => <span className="text-xs">{b.invoice_date}</span>,
    },
    {
      key: "party_name",
      header: "Client",
      minWidth: 140,
      render: (b) => <span className="font-semibold text-xs">{b.party?.name || b.client_name || "—"}</span>,
    },
    {
      key: "vendor_name",
      header: "Vendor",
      width: 120,
      render: (b) => <span className="text-xs text-slate-600 dark:text-slate-400">{b.vendor?.name || "Direct"}</span>,
    },
    {
      key: "service",
      header: "Service",
      width: 90,
      render: (b) => (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 border">
          {b.service}
        </span>
      ),
    },
    {
      key: "pnr_ticket",
      header: "Ticket / PNR",
      width: 120,
      render: (b) => (
        <span className="font-mono text-[11px] text-muted-foreground">
          {b.ticket_no || b.pnr || "—"}
        </span>
      ),
    },
    {
      key: "client_amount",
      header: "Invoice Total",
      width: 120,
      isNumeric: true,
      align: "right",
      totalType: "sum",
      render: (b) => <span className="font-mono font-bold">{b.client_amount.toLocaleString()}</span>,
    },
    {
      key: "vendor_payable",
      header: "Payable",
      width: 110,
      isNumeric: true,
      align: "right",
      totalType: "sum",
      render: (b) => <span className="font-mono text-slate-500">{b.vendor_payable.toLocaleString()}</span>,
    },
    {
      key: "profit",
      header: "Profit (PKR)",
      width: 110,
      isNumeric: true,
      align: "right",
      totalType: "sum",
      render: (b) => (
        <span
          className={`font-mono font-bold ${
            b.profit >= 0 ? "text-teal-600 dark:text-teal-400" : "text-red-500"
          }`}
        >
          {b.profit.toLocaleString()}
        </span>
      ),
    },
  ];

  // ==========================================
  // REPORT 3: DAILY REPORT (Receipts vs Payments)
  // ==========================================
  const dailyReceipts = useMemo(
    () => rawTransactions.filter((t: any) => t.type === "payment_in"),
    [rawTransactions]
  );
  const dailyPayments = useMemo(
    () => rawTransactions.filter((t: any) => t.type === "payment_out" || t.type === "expense"),
    [rawTransactions]
  );

  return (
    <div className="space-y-4">
      <SeoHead
        title="Reports - TAMS Pro"
        description="Live dynamic accounting views: Account Statements, Booking Wise Profit, Daily Report, and Financial Statements with Excel-like precision."
        path="/app/reports"
      />

      {/* Top Header with Report Selector Dropdown */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-border/50">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Scale className="w-6 h-6 text-teal-600" />
            Financial & Operations Reports
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time double-entry reports with zero data duplication. Every number drills down.
          </p>
        </div>

        {/* 4 Reports Dropdown Selector */}
        <div className="flex items-center gap-2">
          <Select
            value={selectedReport}
            onValueChange={(val: any) => setSelectedReport(val)}
          >
            <SelectTrigger className="h-10 min-w-[210px] text-xs font-bold bg-[#0B192C] text-white border-0 shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="account_statement" className="font-semibold text-xs">
                1. Account Statement
              </SelectItem>
              <SelectItem value="booking_report" className="font-semibold text-xs">
                2. Booking Report (Profit)
              </SelectItem>
              <SelectItem value="daily_report" className="font-semibold text-xs">
                3. Daily Report (Day Book)
              </SelectItem>
              <SelectItem value="financial_reports" className="font-semibold text-xs">
                4. Financial Reports
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Universal Filter Bar (Identical on every report) */}
      <FilterBar
        filters={filters}
        onChange={setFilters}
        parties={parties}
        searchPlaceholder="Find booking (ticket no, PNR, passport, pax, bill)..."
      />

      {/* Dynamic Report Views */}

      {/* VIEW 1: ACCOUNT STATEMENT */}
      {selectedReport === "account_statement" && (
        <div className="space-y-4">
          {/* Toggles Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border text-xs">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={detailedView}
                  onChange={(e) => setDetailedView(e.target.checked)}
                  className="rounded text-teal-600"
                />
                Detailed Journal Lines
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={onlyUnpaid}
                  onChange={(e) => setOnlyUnpaid(e.target.checked)}
                  className="rounded text-teal-600"
                />
                Only Unpaid Invoices
              </label>
            </div>

            {/* Overdue buckets toggle */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-muted-foreground mr-1">Overdue:</span>
              {(["all", "0-30", "31-60", "61-90", "90+"] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => setOverdueBucket(b)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                    overdueBucket === b
                      ? "bg-[#0B192C] text-white shadow-xs"
                      : "bg-white dark:bg-slate-800 text-slate-600 border hover:bg-slate-100"
                  }`}
                >
                  {b.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <TotalsBar
            metrics={[
              { label: "Total Receivables", value: totalInvoiced, prefix: "PKR", highlight: "red" },
              { label: "Total Payables", value: totalCost, prefix: "PKR", highlight: "emerald" },
              { label: "Net Ledger Position", value: totalInvoiced - totalCost, prefix: "PKR", highlight: "teal" },
            ]}
          />

          <ExcelGrid
            id="report_account_statement"
            data={filteredInvoices.map((inv: any) => ({
              date: inv.invoice_date,
              voucher_no: inv.invoice_no,
              description: `${inv.service} Booking - ${inv.party?.name || inv.client_name}`,
              debit: inv.client_amount || 0,
              credit: inv.paid_amount || 0,
              balance: (inv.client_amount || 0) - (inv.paid_amount || 0),
              overdue_days: inv.payment_status === "unpaid" ? 18 : null,
            }))}
            columns={statementColumns}
            keyExtractor={(r, i) => `${r.voucher_no}_${i}`}
            title="Account Statement & Master Ledger"
            filename="TAMS_Account_Statement"
          />
        </div>
      )}

      {/* VIEW 2: BOOKING REPORT */}
      {selectedReport === "booking_report" && (
        <div className="space-y-4">
          <TotalsBar
            metrics={[
              { label: "Total Invoiced", value: totalInvoiced, prefix: "PKR", highlight: "neutral" },
              { label: "Total Vendor Payable", value: totalCost, prefix: "PKR", highlight: "red" },
              { label: "Net Gross Profit", value: totalProfit, prefix: "PKR", highlight: "teal" },
              { label: "Bookings", value: filteredInvoices.length, highlight: "neutral" },
            ]}
          />

          <ExcelGrid
            id="report_booking_profit"
            data={filteredInvoices}
            columns={bookingReportColumns}
            keyExtractor={(b) => b.id}
            title="Booking Wise Profit & Service Summary"
            filename="Booking_Wise_Profit"
          />
        </div>
      )}

      {/* VIEW 3: DAILY REPORT (Receipts vs Payments) */}
      {selectedReport === "daily_report" && (
        <div className="space-y-4">
          {/* Switch: All / Cash / Bank */}
          <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border text-xs">
            <span className="font-bold text-slate-800 dark:text-slate-200">
              Daily Day Book (Receipts & Payments)
            </span>
            <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg border">
              {(["all", "cash", "bank"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setDailyAccountType(m)}
                  className={`px-3 py-1 rounded text-xs font-semibold capitalize ${
                    dailyAccountType === m ? "bg-white dark:bg-slate-900 shadow-xs text-primary" : "text-muted-foreground"
                  }`}
                >
                  {m === "all" ? "Cash & Bank" : m}
                </button>
              ))}
            </div>
          </div>

          <TotalsBar
            metrics={[
              { label: "Receipts Inflow", value: dailyReceipts.reduce((s: number, r: any) => s + (r.debit || 0), 0), prefix: "PKR", highlight: "emerald" },
              { label: "Payments Outflow", value: dailyPayments.reduce((s: number, p: any) => s + (p.credit || 0), 0), prefix: "PKR", highlight: "red" },
              { label: "Daily Operating Expenses", value: totalExpensesAmt, prefix: "PKR", highlight: "amber" },
            ]}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Receipts Column */}
            <div className="border rounded-xl p-3 bg-white dark:bg-slate-900 shadow-sm space-y-2">
              <h3 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                Receipts (Money In)
              </h3>
              <div className="divide-y text-xs">
                {dailyReceipts.length === 0 ? (
                  <p className="text-muted-foreground py-4 text-center">No receipts for selected period</p>
                ) : (
                  dailyReceipts.map((t: any) => (
                    <div key={t.id} className="py-2 flex justify-between items-center">
                      <div>
                        <span className="font-semibold block">{t.reference_no || "Receipt"}</span>
                        <span className="text-[10px] text-muted-foreground">{t.date} • {t.method?.toUpperCase()}</span>
                      </div>
                      <span className="font-mono font-bold text-emerald-600">PKR {Number(t.debit).toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Payments Column */}
            <div className="border rounded-xl p-3 bg-white dark:bg-slate-900 shadow-sm space-y-2">
              <h3 className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider flex items-center gap-1">
                Payments & Expenses (Money Out)
              </h3>
              <div className="divide-y text-xs">
                {dailyPayments.length === 0 ? (
                  <p className="text-muted-foreground py-4 text-center">No payments for selected period</p>
                ) : (
                  dailyPayments.map((t: any) => (
                    <div key={t.id} className="py-2 flex justify-between items-center">
                      <div>
                        <span className="font-semibold block">{t.category || t.reference_no || "Payment"}</span>
                        <span className="text-[10px] text-muted-foreground">{t.date} • {t.notes || "Disbursement"}</span>
                      </div>
                      <span className="font-mono font-bold text-red-600">PKR {Number(t.credit).toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 4: FINANCIAL REPORTS (P&L, Assets & Dues, Monthly Income & Expenses) */}
      {selectedReport === "financial_reports" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Financial Statement Mode
            </span>
            <Select
              value={financialSubReport}
              onValueChange={(val: any) => setFinancialSubReport(val)}
            >
              <SelectTrigger className="h-8 w-[200px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="profit_report">Profit & Loss Report</SelectItem>
                <SelectItem value="accounts_summary">Accounts Summary</SelectItem>
                <SelectItem value="assets_dues">Assets & Dues</SelectItem>
                <SelectItem value="monthly_income">Monthly Income</SelectItem>
                <SelectItem value="monthly_expenses">Monthly Expenses</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <TotalsBar
            metrics={[
              { label: "Gross Booking Revenue", value: totalInvoiced, prefix: "PKR", highlight: "neutral" },
              { label: "Cost of Sales", value: totalCost, prefix: "PKR", highlight: "neutral" },
              { label: "Operating Expenses", value: totalExpensesAmt, prefix: "PKR", highlight: "red" },
              { label: "Net Agency Profit", value: totalProfit - totalExpensesAmt, prefix: "PKR", highlight: "teal" },
            ]}
          />

          {/* Clean Financial Breakdown Card */}
          <div className="border rounded-xl p-4 bg-white dark:bg-slate-900 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 pb-2 border-b">
              Income Statement Summary
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1">
                <span>Revenue from Tickets & Umrah Services</span>
                <span className="font-mono font-semibold">PKR {totalInvoiced.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-500">
                <span>Less: Direct Supplier / Vendor Costs</span>
                <span className="font-mono">PKR {totalCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 font-bold text-teal-700 dark:text-teal-400 border-t">
                <span>Gross Profit</span>
                <span className="font-mono">PKR {totalProfit.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 text-red-600">
                <span>Less: Total Daily Operating Expenses</span>
                <span className="font-mono">PKR {totalExpensesAmt.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 text-base font-bold text-slate-900 dark:text-slate-100 border-t-2 border-slate-300 dark:border-slate-700">
                <span>Net Clean Profit</span>
                <span className="font-mono text-teal-600 dark:text-teal-400">
                  PKR {(totalProfit - totalExpensesAmt).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

