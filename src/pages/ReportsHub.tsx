import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";
import {
  ExcelGrid,
  GridColumn,
  TotalsBar,
  FilterBar,
  FilterState,
  defaultFilterState,
} from "@/components/design-system";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useParties } from "@/hooks/useParties";
import { useQuotations } from "@/hooks/useQuotations";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CopyValue } from "@/components/ui/CopyValue";
import { format, startOfMonth, endOfMonth } from "date-fns";
import {
  TrendingUp,
  Scale,
  Calendar,
  FileText,
} from "lucide-react";

type ReportTab =
  | "daily-report"
  | "account-statement"
  | "booking-report"
  | "financial-reports";

type FinancialSubReport =
  | "profit_report"
  | "accounts_summary"
  | "assets_dues"
  | "monthly_income"
  | "monthly_expenses";

export default function ReportsHub() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab from URL (default to Daily Report: daily-report)
  const currentTab = (searchParams.get("tab") as ReportTab) || "daily-report";

  const handleTabChange = (val: string) => {
    setSearchParams({ tab: val }, { replace: true });
  };

  const [financialSubReport, setFinancialSubReport] = useState<FinancialSubReport>("profit_report");

  // Shared Filter Bar State (date filter preserved across tab switching)
  const [filters, setFilters] = useState<FilterState>(defaultFilterState);

  // Toggle options for Account Statement
  const [detailedView, setDetailedView] = useState(false);
  const [onlyUnpaid, setOnlyUnpaid] = useState(searchParams.get("unpaid") === "1");
  const [overdueBucket, setOverdueBucket] = useState<"none" | "all" | "0-30" | "31-60" | "61-90" | "90+">(
    searchParams.get("overdue") === "all" ? "all" : "none"
  );

  // Sync searchParams on mount or change
  useEffect(() => {
    const monthParam = searchParams.get("month");
    if (monthParam) {
      try {
        const [y, m] = monthParam.split("-").map(Number);
        const start = new Date(y, m - 1, 1);
        const end = endOfMonth(start);
        setFilters((prev) => ({
          ...prev,
          dateRange: "custom",
          startDate: format(start, "yyyy-MM-dd"),
          endDate: format(end, "yyyy-MM-dd"),
        }));
      } catch (e) {
        console.warn("Could not parse month param:", e);
      }
    }

    if (searchParams.get("overdue") === "all") {
      setOverdueBucket("all");
      setOnlyUnpaid(true);
    }
  }, [searchParams]);

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

  // Date check helper adhering to shared date filter
  const isDateInRange = (dateStr?: string) => {
    if (!dateStr) return true;
    if (filters.dateRange === "all") return true;
    const d = dateStr.slice(0, 10);
    const now = new Date();

    if (filters.dateRange === "today") {
      const todayStr = format(now, "yyyy-MM-dd");
      return d === todayStr;
    }
    if (filters.dateRange === "this_month") {
      const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
      return d >= monthStart && d <= monthEnd;
    }
    if (filters.dateRange === "custom") {
      if (filters.startDate && d < filters.startDate) return false;
      if (filters.endDate && d > filters.endDate) return false;
      return true;
    }
    return true;
  };

  // Apply Shared Filters across Invoices
  const filteredInvoices = useMemo(() => {
    return rawInvoices.filter((inv: any) => {
      // Date filter
      if (!isDateInRange(inv.invoice_date)) return false;

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
  const { quotations = [] } = useQuotations();
  const quoteStats = useMemo(() => {
    const totalQuotes = quotations.length;
    const acceptedQuotes = quotations.filter((q) => q.status === "accepted").length;
    const convertedQuotes = quotations.filter((q) => q.converted_booking_id || q.booking_id || q.status === "accepted").length;
    const conversionRate = totalQuotes > 0 ? Math.round((convertedQuotes / totalQuotes) * 100) : 0;
    return { totalQuotes, acceptedQuotes, convertedQuotes, conversionRate };
  }, [quotations]);

  const totalExpensesAmt = useMemo(
    () => rawExpenses.filter((e: any) => isDateInRange(e.expense_date)).reduce((sum: number, e: any) => sum + (e.amount || 0), 0),
    [rawExpenses, filters]
  );

  // Helper to compute overdue days adhering to Remaining Due Date logic
  const getOverdueDays = (inv: any): number | null => {
    const isPaid = inv.payment_status === "paid" || ((Number(inv.client_amount) || 0) <= (Number(inv.paid_amount) || 0));
    if (isPaid) return null;

    const now = new Date();
    const todayStr = format(now, "yyyy-MM-dd");
    const dueDate = inv.more_details?.remaining_due_date || inv.remaining_payment_date || inv.invoice_date || todayStr;

    if (dueDate < todayStr) {
      const diffTime = now.getTime() - new Date(dueDate).getTime();
      return Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    }
    return null;
  };

  // ==========================================
  // REPORT 1: ACCOUNT STATEMENT (Live Master Ledger)
  // ==========================================
  const rawStatementData = useMemo(() => {
    let entries: any[] = [];

    // Filter invoices by date, party, status, search
    const matchingInvoices = rawInvoices.filter((inv: any) => {
      if (!isDateInRange(inv.invoice_date)) return false;
      if (filters.partyId && filters.partyId !== "all" && inv.party_id !== filters.partyId) {
        return false;
      }
      if (filters.status !== "all" && inv.payment_status !== filters.status) {
        return false;
      }
      if (onlyUnpaid && inv.payment_status === "paid") {
        return false;
      }
      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase();
        const mInv = inv.invoice_no?.toLowerCase().includes(q);
        const mPnr = inv.pnr?.toLowerCase().includes(q);
        const mTicket = inv.ticket_no?.toLowerCase().includes(q);
        const mParty = (inv.party?.name || inv.client_name || "").toLowerCase().includes(q);
        const mDesc = `${inv.service} Booking`.toLowerCase().includes(q);
        if (!mInv && !mPnr && !mTicket && !mParty && !mDesc) return false;
      }
      return true;
    });

    if (!detailedView) {
      entries = matchingInvoices.map((inv: any) => ({
        id: inv.id,
        date: inv.invoice_date,
        voucher_no: inv.invoice_no,
        description: `${inv.service || "Ticket"} Booking - ${inv.party?.name || inv.client_name || ""}`,
        service: inv.service || "Ticket",
        entry: "Sale",
        debit: inv.client_amount || 0,
        credit: inv.paid_amount || 0,
        overdue_days: getOverdueDays(inv),
      }));
    } else {
      // Invoices
      const invEntries = matchingInvoices.map((inv: any) => ({
        id: `inv_${inv.id}`,
        date: inv.invoice_date,
        voucher_no: inv.invoice_no,
        description: `${inv.service || "Ticket"} Booking - ${inv.party?.name || inv.client_name || ""}`,
        service: inv.service || "Ticket",
        entry: "Sale",
        debit: inv.client_amount || 0,
        credit: 0,
        overdue_days: getOverdueDays(inv),
      }));

      // Transactions (Receipts & Payments)
      const txEntries = (rawTransactions || [])
        .filter((t: any) => {
          if (!isDateInRange(t.date)) return false;
          if (filters.partyId && filters.partyId !== "all" && t.party_id !== filters.partyId) {
            return false;
          }
          if (filters.searchQuery.trim()) {
            const q = filters.searchQuery.toLowerCase();
            const mRef = t.reference_no?.toLowerCase().includes(q);
            const mNotes = t.notes?.toLowerCase().includes(q);
            const mCat = t.category?.toLowerCase().includes(q);
            if (!mRef && !mNotes && !mCat) return false;
          }
          return true;
        })
        .map((t: any) => {
          const isReceipt = t.type === "payment_in";
          const isExp = t.type === "expense";
          const isRef = t.type === "refund";

          let entryType = "Payment";
          if (isExp) entryType = "Expense";
          else if (isRef) entryType = "Refund";
          else if (t.type === "void") entryType = "Void";
          else if (t.type === "transfer") entryType = "Transfer";

          let debitVal = 0;
          let creditVal = 0;
          if (isReceipt) {
            creditVal = Number(t.debit) || Number(t.amount) || 0;
          } else {
            debitVal = Number(t.credit) || Number(t.amount) || 0;
          }

          return {
            id: `tx_${t.id}`,
            date: t.date,
            voucher_no: t.reference_no || `PV-${t.id.slice(0, 4).toUpperCase()}`,
            description: t.notes || t.category || `${entryType} Voucher`,
            service: "Other",
            entry: entryType,
            debit: debitVal,
            credit: creditVal,
            overdue_days: null,
          };
        });

      // Operating Expenses
      const expEntries = (rawExpenses || [])
        .filter((e: any) => {
          if (!isDateInRange(e.expense_date)) return false;
          if (filters.searchQuery.trim()) {
            const q = filters.searchQuery.toLowerCase();
            const mRef = e.reference_number?.toLowerCase().includes(q);
            const mType = e.expense_type?.toLowerCase().includes(q);
            const mNotes = e.notes?.toLowerCase().includes(q);
            if (!mRef && !mType && !mNotes) return false;
          }
          return true;
        })
        .map((e: any) => ({
          id: `exp_${e.id}`,
          date: e.expense_date,
          voucher_no: e.reference_number || `EXP-${e.id.slice(0, 4).toUpperCase()}`,
          description: `Expense: ${e.expense_type || e.notes || "Operating Expense"}`,
          service: "Other",
          entry: "Expense",
          debit: Number(e.amount) || 0,
          credit: 0,
          overdue_days: null,
        }));

      // Customer Refunds
      const refEntries = (rawRefunds || [])
        .filter((r: any) => {
          if (!isDateInRange(r.refund_date)) return false;
          if (filters.searchQuery.trim()) {
            const q = filters.searchQuery.toLowerCase();
            const mRef = r.refund_no?.toLowerCase().includes(q);
            const mReason = r.reason?.toLowerCase().includes(q);
            if (!mRef && !mReason) return false;
          }
          return true;
        })
        .map((r: any) => ({
          id: `ref_${r.id}`,
          date: r.refund_date,
          voucher_no: r.refund_no || `REF-${r.id.slice(0, 4).toUpperCase()}`,
          description: `Refund: ${r.reason || "Ticket Refund"}`,
          service: "Ticket",
          entry: "Refund",
          debit: 0,
          credit: Number(r.refund_amount) || 0,
          overdue_days: null,
        }));

      entries = [...invEntries, ...txEntries, ...expEntries, ...refEntries];
    }

    // Apply Overdue filter
    if (overdueBucket !== "none") {
      entries = entries.filter((r) => {
        if (!r.overdue_days) return false;
        if (overdueBucket === "all") return r.overdue_days > 0;
        if (overdueBucket === "0-30") return r.overdue_days <= 30;
        if (overdueBucket === "31-60") return r.overdue_days > 30 && r.overdue_days <= 60;
        if (overdueBucket === "61-90") return r.overdue_days > 60 && r.overdue_days <= 90;
        if (overdueBucket === "90+") return r.overdue_days > 90;
        return true;
      });
    }

    // Sort by Date
    entries.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

    // Calculate live running balance
    let running = 0;
    return entries.map((r) => {
      running = running + (r.debit || 0) - (r.credit || 0);
      return {
        ...r,
        balance: running,
      };
    });
  }, [rawInvoices, rawTransactions, rawExpenses, rawRefunds, filters, detailedView, onlyUnpaid, overdueBucket]);

  // Live state for rows after header filters are applied in ExcelGrid
  const [activeStatementRows, setActiveStatementRows] = useState<any[]>(rawStatementData);

  useEffect(() => {
    setActiveStatementRows(rawStatementData);
  }, [rawStatementData]);

  const handleStatementFilteredDataChange = useCallback((rows: any[]) => {
    setActiveStatementRows(rows);
  }, []);

  // Summary card metrics that update reactively when column header filters change
  const statementReceivables = useMemo(
    () => (activeStatementRows || []).reduce((sum, r) => sum + (r.debit || 0), 0),
    [activeStatementRows]
  );
  const statementPayables = useMemo(
    () => (activeStatementRows || []).reduce((sum, r) => sum + (r.credit || 0), 0),
    [activeStatementRows]
  );
  const statementNet = statementReceivables - statementPayables;

  // Account Statement Columns:
  // Date | Voucher / Bill # | Description / Particulars | Entry | Debit (DR) | Credit (CR) | Running Balance | Overdue
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
      width: 140,
      render: (r) => (
        <CopyValue
          value={r.voucher_no}
          label="voucher number"
          className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200"
        />
      ),
    },
    {
      key: "description",
      header: "Description / Particulars",
      minWidth: 200,
      filterType: "checkbox",
      filterOptions: ["Ticket", "Umrah", "Visa", "Hotel", "Insurance", "Other"],
      filterMatchFn: (row: any, selected: string[]) => {
        const desc = (row.description || "").toLowerCase();
        const srv = (row.service || "").toLowerCase();
        return selected.some((s) => desc.includes(s.toLowerCase()) || srv === s.toLowerCase());
      },
      render: (r) => <span className="text-xs">{r.description}</span>,
    },
    {
      key: "entry",
      header: "Entry",
      width: 110,
      align: "center",
      sortable: true,
      filterType: "checkbox",
      filterOptions: ["Sale", "Payment", "Refund", "Expense", "Void", "Transfer"],
      filterMatchFn: (row: any, selected: string[]) => {
        return selected.some((s) => (row.entry || "").toLowerCase() === s.toLowerCase());
      },
      render: (r) => {
        const entry = r.entry || "Sale";
        let badgeClass = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300";
        if (entry.toLowerCase() === "payment") {
          badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300";
        } else if (entry.toLowerCase() === "refund") {
          badgeClass = "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300";
        } else if (entry.toLowerCase() === "expense") {
          badgeClass = "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300";
        } else if (entry.toLowerCase() === "void" || entry.toLowerCase() === "transfer") {
          badgeClass = "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300";
        }
        return (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}`}>
            {entry}
          </span>
        );
      },
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
      width: 120,
      render: (b) => (
        <CopyValue
          value={b.invoice_no}
          label="bill number"
          className="font-mono text-xs font-bold"
        />
      ),
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
    () =>
      rawTransactions.filter((t: any) => {
        if (!isDateInRange(t.date)) return false;
        if (dailyAccountType === "cash" && t.method !== "cash") return false;
        if (dailyAccountType === "bank" && t.method !== "bank") return false;
        return t.type === "payment_in";
      }),
    [rawTransactions, filters, dailyAccountType]
  );

  const dailyPayments = useMemo(
    () =>
      rawTransactions.filter((t: any) => {
        if (!isDateInRange(t.date)) return false;
        if (dailyAccountType === "cash" && t.method !== "cash") return false;
        if (dailyAccountType === "bank" && t.method !== "bank") return false;
        return t.type === "payment_out" || t.type === "expense";
      }),
    [rawTransactions, filters, dailyAccountType]
  );

  return (
    <div className="space-y-4">
      <SeoHead
        title="Reports - TAMS Pro"
        description="Live dynamic accounting views: Account Statements, Booking Wise Profit, Daily Report, and Financial Statements with Excel-like precision."
        path="/app/reports"
      />

      {/* Top Header */}
      <div className="pb-2 border-b border-border/50">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Scale className="w-6 h-6 text-teal-600" />
          Financial & Operations Reports
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Real-time double-entry reports with zero data duplication. Every number drills down.
        </p>
      </div>

      {/* 4 Canonical Sub-Tabs: Styled exactly like tabs in Sales & Expenses */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md pb-2 pt-1 border-b border-border/50">
        <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto h-11 p-1 bg-muted/60 border">
            <TabsTrigger
              value="daily-report"
              className="gap-2 text-xs sm:text-sm font-semibold shrink-0 cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-emerald-600" />
              1. Daily Report (Day Book)
            </TabsTrigger>
            <TabsTrigger
              value="account-statement"
              className="gap-2 text-xs sm:text-sm font-semibold shrink-0 cursor-pointer"
            >
              <FileText className="w-4 h-4 text-blue-600" />
              2. Account Statement
            </TabsTrigger>
            <TabsTrigger
              value="booking-report"
              className="gap-2 text-xs sm:text-sm font-semibold shrink-0 cursor-pointer"
            >
              <TrendingUp className="w-4 h-4 text-teal-600" />
              3. Booking Report (Profit)
            </TabsTrigger>
            <TabsTrigger
              value="financial-reports"
              className="gap-2 text-xs sm:text-sm font-semibold shrink-0 cursor-pointer"
            >
              <Scale className="w-4 h-4 text-purple-600" />
              4. Financial Reports
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* TAB 1: DAILY REPORT (Day Book) */}
      {currentTab === "daily-report" && (
        <div className="space-y-4">
          {/* Daily Report Filter: Date filter only */}
          <FilterBar
            filters={filters}
            onChange={setFilters}
            showPartyFilter={false}
            showEntryTypeFilter={false}
            showServiceFilter={false}
            showStatusFilter={false}
          />

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
                  className={`px-3 py-1 rounded text-xs font-semibold capitalize cursor-pointer transition-all ${
                    dailyAccountType === m
                      ? "bg-white dark:bg-slate-900 shadow-xs text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "all" ? "Cash & Bank" : m}
                </button>
              ))}
            </div>
          </div>

          <TotalsBar
            metrics={[
              {
                label: "Receipts Inflow",
                value: dailyReceipts.reduce((s: number, r: any) => s + (Number(r.debit) || Number(r.amount) || 0), 0),
                prefix: "PKR",
                highlight: "emerald",
              },
              {
                label: "Payments Outflow",
                value: dailyPayments.reduce((s: number, p: any) => s + (Number(p.credit) || Number(p.amount) || 0), 0),
                prefix: "PKR",
                highlight: "red",
              },
              {
                label: "Daily Operating Expenses",
                value: totalExpensesAmt,
                prefix: "PKR",
                highlight: "amber",
              },
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
                      <span className="font-mono font-bold text-emerald-600">PKR {Number(t.debit || t.amount || 0).toLocaleString()}</span>
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
                      <span className="font-mono font-bold text-red-600">PKR {Number(t.credit || t.amount || 0).toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ACCOUNT STATEMENT */}
      {currentTab === "account-statement" && (
        <div className="space-y-4">
          {/* Account Statement Filter Bar: All Entries and All Services removed; search bar, date, parties, status kept */}
          <FilterBar
            filters={filters}
            onChange={setFilters}
            parties={parties}
            showPartyFilter={true}
            showStatusFilter={true}
            showEntryTypeFilter={false}
            showServiceFilter={false}
            searchPlaceholder="Find in statement (voucher #, particular, party)..."
          />

          {/* Toggles Bar: Detailed Journal Lines, Only Unpaid Invoices, Overdue buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border text-xs">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer font-medium select-none">
                <input
                  type="checkbox"
                  checked={detailedView}
                  onChange={(e) => setDetailedView(e.target.checked)}
                  className="rounded text-teal-600 cursor-pointer"
                />
                Detailed Journal Lines
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer font-medium select-none">
                <input
                  type="checkbox"
                  checked={onlyUnpaid}
                  onChange={(e) => setOnlyUnpaid(e.target.checked)}
                  className="rounded text-teal-600 cursor-pointer"
                />
                Only Unpaid Invoices
              </label>
            </div>

            {/* Overdue buckets toggle */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-muted-foreground mr-1">Overdue:</span>
              {(["none", "all", "0-30", "31-60", "61-90", "90+"] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => setOverdueBucket(b)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                    overdueBucket === b
                      ? "bg-[#0B192C] text-white shadow-xs"
                      : "bg-white dark:bg-slate-800 text-slate-600 border hover:bg-slate-100"
                  }`}
                >
                  {b === "none" ? "ALL" : b === "all" ? "ALL OVERDUE" : b.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Summary Cards: Automatically updated by header filters via onFilteredDataChange */}
          <TotalsBar
            metrics={[
              { label: "Total Receivables", value: statementReceivables, prefix: "PKR", highlight: "red" },
              { label: "Total Payables", value: statementPayables, prefix: "PKR", highlight: "emerald" },
              { label: "Net Ledger Position", value: statementNet, prefix: "PKR", highlight: "teal" },
            ]}
          />

          {/* Excel Table View with Entry column, service header funnel checklist, CopyValue, and TOTAL row */}
          <ExcelGrid
            id="report_account_statement"
            data={rawStatementData}
            columns={statementColumns}
            keyExtractor={(r, i) => `${r.voucher_no || r.id}_${i}`}
            onFilteredDataChange={handleStatementFilteredDataChange}
            title="Account Statement & Master Ledger"
            filename="TAMS_Account_Statement"
          />
        </div>
      )}

      {/* TAB 3: BOOKING REPORT (Profit) */}
      {currentTab === "booking-report" && (
        <div className="space-y-4">
          <FilterBar
            filters={filters}
            onChange={setFilters}
            parties={parties}
            showPartyFilter={true}
            showStatusFilter={true}
            showServiceFilter={true}
            showEntryTypeFilter={false}
            searchPlaceholder="Find booking (ticket no, PNR, passport, pax, bill)..."
          />

          <TotalsBar
            metrics={[
              { label: "Total Invoiced", value: totalInvoiced, prefix: "PKR", highlight: "neutral" },
              { label: "Total Vendor Payable", value: totalCost, prefix: "PKR", highlight: "red" },
              { label: "Net Gross Profit", value: totalProfit, prefix: "PKR", highlight: "teal" },
              { label: "Bookings", value: filteredInvoices.length, highlight: "neutral" },
            ]}
          />

          <div className="flex flex-wrap items-center justify-between text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border text-slate-600 dark:text-slate-300 gap-2">
            <span className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <span>📋</span> Quotation Conversion Pipeline:
            </span>
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <span>Total Quotations: <strong className="text-slate-900 dark:text-white">{quoteStats.totalQuotes}</strong></span>
              <span>Accepted: <strong className="text-emerald-600">{quoteStats.acceptedQuotes}</strong></span>
              <span>Converted to Invoices: <strong className="text-teal-600">{quoteStats.convertedQuotes}</strong></span>
              <span>Conversion Rate: <strong className="text-blue-600 font-bold">{quoteStats.conversionRate}%</strong></span>
            </div>
          </div>

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

      {/* TAB 4: FINANCIAL REPORTS */}
      {currentTab === "financial-reports" && (
        <div className="space-y-4">
          <FilterBar
            filters={filters}
            onChange={setFilters}
            showPartyFilter={false}
            showStatusFilter={false}
            showServiceFilter={false}
            showEntryTypeFilter={false}
          />

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
