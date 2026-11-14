import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";
import {
  ExcelGrid,
  GridColumn,
  TotalsBar,
  FilterBar,
  FilterState,
  defaultFilterState,
  EmptyState,
} from "@/components/design-system";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useParties, type Party } from "@/hooks/useParties";
import { useAccounts, type AccountItem } from "@/hooks/useUnifiedTransactions";
import { useQuotations } from "@/hooks/useQuotations";
import { useAgency } from "@/hooks/useAgency";
import { ReportExportDialog } from "@/components/reports/ReportExportDialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CopyValue } from "@/components/ui/CopyValue";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { getInvoiceOverdueInfo } from "@/lib/overdueUtils";
import {
  isInvoiceVoidedOrRefunded,
  computeFinancialMetrics,
  getKarachiTodayNoon,
  getKarachiYmd,
  invalidateAllFinancialQueries,
} from "@/lib/accountingEngine";
import { useRealtimeMultiTable } from "@/hooks/useRealtimeTable";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TrendingUp,
  Scale,
  Calendar,
  FileText,
  Wallet,
  Building2,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  DollarSign,
  ArrowRight,
  Layers,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
  AreaChart,
  Area,
} from "recharts";

type ReportTab =
  | "daily-report"
  | "account-statement"
  | "booking-report"
  | "financial-reports";

type FinancialSubReport =
  | "pnl"
  | "accounts_summary"
  | "assets_dues"
  | "monthly_income"
  | "monthly_expenses";

export default function ReportsHub() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab from URL (default to Daily Report: daily-report)
  const currentTab = (searchParams.get("tab") as ReportTab) || "daily-report";

  const handleTabChange = (val: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", val);
    setSearchParams(next, { replace: true });
  };

  // Financial Sub-report Mode from URL (default: pnl)
  const modeParam = searchParams.get("mode");
  const financialSubReport: FinancialSubReport = useMemo(() => {
    if (!modeParam) return "pnl";
    if (modeParam === "pnl" || modeParam === "profit_report" || modeParam === "profit") return "pnl";
    if (modeParam === "accounts" || modeParam === "accounts_summary") return "accounts_summary";
    if (modeParam === "assets" || modeParam === "assets_dues") return "assets_dues";
    if (modeParam === "monthly_income" || modeParam === "income") return "monthly_income";
    if (modeParam === "monthly_expenses" || modeParam === "expenses") return "monthly_expenses";
    return "pnl";
  }, [modeParam]);

  const handleFinancialModeChange = (mode: FinancialSubReport) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", "financial-reports");
    next.set("mode", mode);
    setSearchParams(next, { replace: true });
  };

  // Drilldown Modal State
  const [drilldownModal, setDrilldownModal] = useState<{
    open: boolean;
    title: string;
    subtitle?: string;
    totalAmount?: number;
    items: Array<{
      id: string;
      date: string;
      reference: string;
      title: string;
      type: string;
      amount: number;
      secondaryAmount?: number;
      badgeVariant?: "emerald" | "red" | "blue" | "purple" | "neutral";
    }>;
  }>({
    open: false,
    title: "",
    items: [],
  });

  const openDrilldown = useCallback(
    (config: {
      title: string;
      subtitle?: string;
      totalAmount?: number;
      items: Array<{
        id: string;
        date: string;
        reference: string;
        title: string;
        type: string;
        amount: number;
        secondaryAmount?: number;
        badgeVariant?: "emerald" | "red" | "blue" | "purple" | "neutral";
      }>;
    }) => {
      setDrilldownModal({
        open: true,
        title: config.title,
        subtitle: config.subtitle,
        totalAmount: config.totalAmount,
        items: config.items,
      });
    },
    []
  );

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

  const { parties = [], isLoading: loadingParties } = useParties();
  const { accounts = [], isLoading: loadingAccounts } = useAccounts();
  const { data: agency } = useAgency();
  const queryClient = useQueryClient();

  useRealtimeMultiTable({
    channelPrefix: "reports-hub-realtime",
    enabled: !!agency?.id,
    subscriptions: [
      {
        table: "booking_invoices",
        filter: agency?.id ? `agency_id=eq.${agency.id}` : undefined,
        callback: () => invalidateAllFinancialQueries(queryClient, agency?.id),
      },
      {
        table: "payment_vouchers",
        filter: agency?.id ? `agency_id=eq.${agency.id}` : undefined,
        callback: () => invalidateAllFinancialQueries(queryClient, agency?.id),
      },
      {
        table: "expenses",
        filter: agency?.id ? `agency_id=eq.${agency.id}` : undefined,
        callback: () => invalidateAllFinancialQueries(queryClient, agency?.id),
      },
      {
        table: "refunds",
        filter: agency?.id ? `agency_id=eq.${agency.id}` : undefined,
        callback: () => invalidateAllFinancialQueries(queryClient, agency?.id),
      },
      {
        table: "transactions",
        filter: agency?.id ? `agency_id=eq.${agency.id}` : undefined,
        callback: () => invalidateAllFinancialQueries(queryClient, agency?.id),
      },
      {
        table: "accounts",
        filter: agency?.id ? `agency_id=eq.${agency.id}` : undefined,
        callback: () => invalidateAllFinancialQueries(queryClient, agency?.id),
      },
      {
        table: "parties",
        filter: agency?.id ? `agency_id=eq.${agency.id}` : undefined,
        callback: () => invalidateAllFinancialQueries(queryClient, agency?.id),
      },
    ],
  });

  // Shared Report Export PDF Dialog State
  const [exportDialogOpen, setExportDialogOpen] = useState<boolean>(false);

  // 1. Fetch Invoices
  const { data: rawInvoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ["report_invoices", agency?.id],
    enabled: !!agency?.id,
    queryFn: async () => {
      if (!agency?.id) return [];

      const { data, error } = await (supabase as any)
        .from("booking_invoices")
        .select("*, party:parties!party_id(name), vendor:parties!vendor_id(name)")
        .eq("agency_id", agency.id)
        .order("invoice_date", { ascending: false });

      if (!error && data && data.length > 0) return data;

      // Fallback: clients table (only when booking_invoices has zero rows)
      const { data: clientsData } = await supabase
        .from("clients")
        .select("*")
        .eq("agency_id", agency.id)
        .order("created_at", { ascending: false });

      return (clientsData || []).map((c: any) => ({
        id: c.id,
        invoice_no: `INV-${c.id.slice(0, 4).toUpperCase()}`,
        invoice_date: c.flight_date || (c.created_at ? getKarachiYmd(c.created_at) : ""),
        created_at: c.created_at,
        service: c.travel_type || "Ticket",
        client_name: c.name,
        party: { name: c.name },
        client_amount: c.selling_price || 0,
        vendor_payable: c.purchasing_price || 0,
        profit: (c.selling_price || 0) - (c.purchasing_price || 0),
        paid_amount: c.amount_paid || 0,
        payment_status: (c.payment_status || "Pending").toLowerCase(),
        is_void: ["void", "refunded", "cancelled"].includes((c.payment_status || "").toLowerCase()),
        pnr: c.pnr,
        ticket_no: c.passport_number,
        more_details: { remaining_due_date: c.remaining_payment_date },
        remaining_payment_date: c.remaining_payment_date,
      }));
    },
  });

  // 1b. Fetch Payment Vouchers for canonical vendor dues calculation
  const { data: rawVouchers = [] } = useQuery({
    queryKey: ["report_vouchers", agency?.id],
    enabled: !!agency?.id,
    queryFn: async () => {
      if (!agency?.id) return [];
      const { data } = await (supabase as any)
        .from("payment_vouchers")
        .select("*")
        .eq("agency_id", agency.id);
      return data || [];
    },
  });

  // 2. Fetch Transactions / Vouchers
  const { data: rawTransactions = [], isLoading: loadingTransactions } = useQuery({
    queryKey: ["report_transactions", agency?.id],
    enabled: !!agency?.id,
    queryFn: async () => {
      if (!agency?.id) return [];
      const { data } = await (supabase as any)
        .from("transactions")
        .select("*")
        .eq("agency_id", agency.id)
        .order("date", { ascending: false });
      return data || [];
    },
  });

  // 3. Fetch Expenses
  const { data: rawExpenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ["report_expenses", agency?.id],
    enabled: !!agency?.id,
    queryFn: async () => {
      if (!agency?.id) return [];
      const { data } = await supabase
        .from("expenses")
        .select("*")
        .eq("agency_id", agency.id)
        .order("expense_date", { ascending: false });
      return data || [];
    },
  });

  // 4. Fetch Refunds
  const { data: rawRefunds = [], isLoading: loadingRefunds } = useQuery({
    queryKey: ["report_refunds", agency?.id],
    enabled: !!agency?.id,
    queryFn: async () => {
      if (!agency?.id) return [];
      const { data } = await supabase
        .from("refunds")
        .select("*")
        .eq("agency_id", agency.id)
        .order("refund_date", { ascending: false });
      return data || [];
    },
  });

  // Canonical DB financial summary RPC for position reconciliation with Dashboard
  const { data: financialSummaryRpc } = useQuery({
    queryKey: ["agency_financial_summary", agency?.id, "reports_position"],
    enabled: !!agency?.id,
    queryFn: async () => {
      if (!agency?.id) return null;
      const nowAnchor = getKarachiTodayNoon();
      const { data, error } = await (supabase as any).rpc("get_agency_financial_summary", {
        p_period_start: format(startOfMonth(nowAnchor), "yyyy-MM-dd"),
        p_period_end: format(endOfMonth(nowAnchor), "yyyy-MM-dd"),
      });
      if (error) return null;
      return data as Record<string, any> | null;
    },
  });

  // Date check helper adhering to Asia/Karachi calendar date
  const isDateInRange = (dateStr?: string) => {
    if (!dateStr) return true;
    if (filters.dateRange === "all") return true;
    const d = getKarachiYmd(dateStr);
    if (!d) return false;
    const now = getKarachiTodayNoon();

    if (filters.dateRange === "today") {
      const todayStr = getKarachiYmd(now);
      return d === todayStr;
    }
    if (filters.dateRange === "this_month") {
      const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
      return d >= monthStart && d <= monthEnd;
    }
    if (filters.dateRange === "last_month") {
      const lastMonth = subMonths(now, 1);
      const monthStart = format(startOfMonth(lastMonth), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(lastMonth), "yyyy-MM-dd");
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

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return rawExpenses.filter((e: any) => {
      if (!isDateInRange(e.expense_date)) return false;
      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase();
        const mRef = (e.reference_number || "").toLowerCase().includes(q);
        const mType = (e.expense_type || "").toLowerCase().includes(q);
        const mNotes = (e.notes || "").toLowerCase().includes(q);
        if (!mRef && !mType && !mNotes) return false;
      }
      return true;
    });
  }, [rawExpenses, filters]);

  // Filtered Refunds
  const filteredRefunds = useMemo(() => {
    return rawRefunds.filter((r: any) => {
      if (!isDateInRange(r.refund_date)) return false;
      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase();
        const mRef = (r.refund_no || "").toLowerCase().includes(q);
        const mReason = (r.reason || "").toLowerCase().includes(q);
        if (!mRef && !mReason) return false;
      }
      return true;
    });
  }, [rawRefunds, filters]);

  const activeFilteredInvoices = useMemo(
    () => filteredInvoices.filter((inv: any) => !isInvoiceVoidedOrRefunded(inv)),
    [filteredInvoices]
  );

  const statusFilter = filters.status as string;
  const bookingReportInvoices = useMemo(
    () =>
      statusFilter === "void" || statusFilter === "refunded"
        ? filteredInvoices
        : activeFilteredInvoices,
    [filteredInvoices, activeFilteredInvoices, statusFilter]
  );

  // Aggregate Metrics for Top Totals Bar & Financial Statement (voided/refunded bookings excluded)
  const totalInvoiced = useMemo(
    () => activeFilteredInvoices.reduce((sum: number, i: any) => sum + (Number(i.client_amount) || 0), 0),
    [activeFilteredInvoices]
  );
  const totalCost = useMemo(
    () => activeFilteredInvoices.reduce((sum: number, i: any) => sum + (Number(i.vendor_payable) || 0), 0),
    [activeFilteredInvoices]
  );
  const totalProfit = useMemo(
    () =>
      activeFilteredInvoices.reduce(
        (sum: number, i: any) =>
          sum +
          ((Number(i.client_amount) || 0) - (Number(i.vendor_payable) || 0)),
        0
      ),
    [activeFilteredInvoices]
  );
  const totalExpensesAmt = useMemo(
    () => filteredExpenses.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0),
    [filteredExpenses]
  );
  const totalRefundsAmt = useMemo(
    () =>
      filteredRefunds.reduce(
        (sum: number, r: any) =>
          sum + (Number(r.client_refund_amount ?? r.refund_amount ?? r.amount) || 0),
        0
      ),
    [filteredRefunds]
  );
  // Canonical Net Profit = Active Selling Price - Active Vendor Cost - Operating Expenses
  // Voided/refunded bookings are already excluded from activeFilteredInvoices (no double subtraction).
  const netCleanProfit = useMemo(
    () => totalProfit - totalExpensesAmt,
    [totalProfit, totalExpensesAmt]
  );

  const canonicalPosition = useMemo(() => {
    const fallback = computeFinancialMetrics({
      invoices: rawInvoices,
      vouchers: rawVouchers,
      expenses: rawExpenses,
      accounts,
      refunds: rawRefunds,
      periodStartYmd: getKarachiYmd(),
      periodEndYmd: getKarachiYmd(),
    });
    return {
      cashAndBank:
        financialSummaryRpc?.cash_and_bank !== undefined
          ? Number(financialSummaryRpc.cash_and_bank) || 0
          : fallback.cashAndBank,
      clientDues:
        financialSummaryRpc?.client_dues !== undefined
          ? Number(financialSummaryRpc.client_dues) || 0
          : fallback.clientDues,
      vendorDues:
        financialSummaryRpc?.vendor_dues !== undefined
          ? Number(financialSummaryRpc.vendor_dues) || 0
          : fallback.vendorDues,
    };
  }, [rawInvoices, rawVouchers, rawExpenses, accounts, rawRefunds, financialSummaryRpc]);

  const { quotations = [] } = useQuotations();
  const quoteStats = useMemo(() => {
    const totalQuotes = quotations.length;
    const acceptedQuotes = quotations.filter((q) => q.status === "accepted").length;
    const convertedQuotes = quotations.filter((q) => q.converted_booking_id || q.booking_id || q.status === "accepted").length;
    const conversionRate = totalQuotes > 0 ? Math.round((convertedQuotes / totalQuotes) * 100) : 0;
    return { totalQuotes, acceptedQuotes, convertedQuotes, conversionRate };
  }, [quotations]);

  // Helper to compute overdue days adhering to Remaining Due Date logic
  const getOverdueDays = (inv: any): number | null => {
    const { isOverdue, overdueDays } = getInvoiceOverdueInfo(inv);
    return isOverdue ? overdueDays : null;
  };

  // ==========================================
  // REPORT 1: ACCOUNT STATEMENT (Live Master Ledger)
  // ==========================================
  const rawStatementData = useMemo(() => {
    let entries: any[] = [];

    // Filter invoices by date, party, status, search (exclude voided/refunded unless explicitly filtered)
    const matchingInvoices = rawInvoices.filter((inv: any) => {
      if (!isDateInRange(inv.invoice_date)) return false;
      if (
        statusFilter !== "void" &&
        statusFilter !== "refunded" &&
        isInvoiceVoidedOrRefunded(inv)
      ) {
        return false;
      }
      if (filters.partyId && filters.partyId !== "all" && inv.party_id !== filters.partyId) {
        return false;
      }
      if (filters.status !== "all" && inv.payment_status !== filters.status) {
        return false;
      }
      if (onlyUnpaid && (inv.payment_status === "paid" || (Number(inv.client_amount) || 0) - (Number(inv.paid_amount) || 0) <= 0)) {
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
          if (t.is_void) return false;
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
          credit: Number(r.client_refund_amount ?? r.refund_amount ?? r.amount) || 0,
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

  const renderBookingReportExpandedRow = (b: any) => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white dark:bg-slate-900/90 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
      <div>
        <span className="font-semibold text-slate-500 uppercase text-[10px]">Passenger & Travel</span>
        <div className="mt-1 space-y-1">
          <div><span className="text-slate-400">Pax Name:</span> <span className="font-medium text-slate-700 dark:text-slate-200">{b.passenger_name || "—"}</span></div>
          <div><span className="text-slate-400">Sector:</span> <span className="font-medium text-slate-700 dark:text-slate-200">{b.sector || "—"}</span></div>
          <div><span className="text-slate-400">Airline:</span> <span className="font-medium text-slate-700 dark:text-slate-200">{b.airline || "—"}</span></div>
        </div>
      </div>
      <div>
        <span className="font-semibold text-slate-500 uppercase text-[10px]">Document Numbers</span>
        <div className="mt-1 space-y-1">
          <div><span className="text-slate-400">PNR:</span> <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{b.pnr || "—"}</span></div>
          <div><span className="text-slate-400">Ticket #:</span> <span className="font-mono text-slate-700 dark:text-slate-300">{b.ticket_no || "—"}</span></div>
          <div><span className="text-slate-400">Passport:</span> <span className="font-mono text-slate-700 dark:text-slate-300">{b.passport_no || "—"}</span></div>
        </div>
      </div>
      <div>
        <span className="font-semibold text-slate-500 uppercase text-[10px]">Financials & Notes</span>
        <div className="mt-1 space-y-1">
          <div><span className="text-slate-400">Paid Amount:</span> <span className="font-mono font-medium text-emerald-600">PKR {(b.paid_amount || 0).toLocaleString()}</span></div>
          <div><span className="text-slate-400">Balance Due:</span> <span className="font-mono font-medium text-amber-600">PKR {((b.client_amount || 0) - (b.paid_amount || 0)).toLocaleString()}</span></div>
          {b.remarks && <div><span className="text-slate-400">Remarks:</span> <span className="text-slate-600 dark:text-slate-300">{b.remarks}</span></div>}
        </div>
      </div>
    </div>
  );

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

          {/* Switch: All / Cash / Bank + Export PDF Button */}
          <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border text-xs gap-2">
            <span className="font-bold text-slate-800 dark:text-slate-200">
              Daily Day Book (Receipts & Payments)
            </span>
            <div className="flex items-center gap-2">
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExportDialogOpen(true)}
                className="h-8 text-xs gap-1.5 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:text-rose-600 cursor-pointer shadow-xs shrink-0"
              >
                <FileText className="w-3.5 h-3.5 text-rose-600" />
                <span>Export</span>
              </Button>
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
            hideColumnsButton={true}
            hideCopyButton={true}
            exportLabel="Export"
            exportIcon={<FileText className="w-3.5 h-3.5 text-rose-600" />}
            onExportClick={() => setExportDialogOpen(true)}
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
              { label: "Bookings", value: activeFilteredInvoices.length, highlight: "neutral" },
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
            data={bookingReportInvoices}
            columns={bookingReportColumns}
            keyExtractor={(b) => b.id}
            title="Booking Wise Profit & Service Summary"
            filename="Booking_Wise_Profit"
            hideColumnsButton={true}
            hideCopyButton={true}
            hideExportButton={true}
            renderExpandedRow={renderBookingReportExpandedRow}
            exportLabel="Export"
            exportIcon={<FileText className="w-3.5 h-3.5 text-rose-600" />}
            onExportClick={() => setExportDialogOpen(true)}
          />
        </div>
      )}

      {/* TAB 4: FINANCIAL REPORTS */}
      {currentTab === "financial-reports" && (
        <div className="space-y-4">
          {/* Top Filter Bar: Date range & Search filter */}
          <FilterBar
            filters={filters}
            onChange={setFilters}
            showPartyFilter={false}
            showStatusFilter={false}
            showServiceFilter={false}
            showEntryTypeFilter={false}
            searchPlaceholder="Search in accounts, services, categories..."
          />

          {/* 5 Toggle Buttons (Segmented Tabs) + Single Export Button */}
          <div className="flex items-center justify-between gap-2 pb-1">
            <div className="flex-1 overflow-x-auto no-scrollbar">
              <Tabs
                value={financialSubReport}
                onValueChange={(val) => handleFinancialModeChange(val as FinancialSubReport)}
                className="w-full"
              >
                <TabsList className="w-full justify-start overflow-x-auto h-11 p-1 bg-muted/60 border flex flex-nowrap shrink-0">
                  <TabsTrigger
                    value="pnl"
                    className="gap-2 text-xs sm:text-sm font-semibold shrink-0 cursor-pointer whitespace-nowrap data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
                  >
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    1. Profit & Loss Report
                  </TabsTrigger>
                  <TabsTrigger
                    value="accounts_summary"
                    className="gap-2 text-xs sm:text-sm font-semibold shrink-0 cursor-pointer whitespace-nowrap data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
                  >
                    <Wallet className="w-4 h-4 text-blue-600" />
                    2. Accounts Summary
                  </TabsTrigger>
                  <TabsTrigger
                    value="assets_dues"
                    className="gap-2 text-xs sm:text-sm font-semibold shrink-0 cursor-pointer whitespace-nowrap data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
                  >
                    <Scale className="w-4 h-4 text-purple-600" />
                    3. Assets & Dues
                  </TabsTrigger>
                  <TabsTrigger
                    value="monthly_income"
                    className="gap-2 text-xs sm:text-sm font-semibold shrink-0 cursor-pointer whitespace-nowrap data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
                  >
                    <Calendar className="w-4 h-4 text-teal-600" />
                    4. Monthly Income
                  </TabsTrigger>
                  <TabsTrigger
                    value="monthly_expenses"
                    className="gap-2 text-xs sm:text-sm font-semibold shrink-0 cursor-pointer whitespace-nowrap data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
                  >
                    <FileText className="w-4 h-4 text-red-600" />
                    5. Monthly Expenses
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportDialogOpen(true)}
              className="h-10 px-3 text-xs gap-1.5 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:text-rose-600 cursor-pointer shadow-xs shrink-0 mb-0.5"
            >
              <FileText className="w-3.5 h-3.5 text-rose-600" />
              <span>Export</span>
            </Button>
          </div>

          {/* Top Summary Cards: Gross Booking Revenue, Cost of Sales, Operating Expenses, Net Agency Profit */}
          {loadingInvoices || loadingExpenses ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-3.5 rounded-xl border bg-card space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-6 w-28" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Card 1: Gross Booking Revenue */}
              <div
                onClick={() =>
                  openDrilldown({
                    title: "Gross Booking Revenue Breakdown",
                    subtitle: `Active bookings matching selected date range (${activeFilteredInvoices.length} entries)`,
                    totalAmount: totalInvoiced,
                    items: activeFilteredInvoices.map((inv: any) => ({
                      id: inv.id,
                      date: inv.invoice_date || "—",
                      reference: inv.invoice_no || "INV",
                      title: `${inv.service || "Booking"} - ${inv.party?.name || inv.client_name || "Client"}`,
                      type: inv.service || "Ticket",
                      amount: Number(inv.client_amount) || 0,
                      badgeVariant: "emerald",
                    })),
                  })
                }
                className="bg-card hover:bg-accent/40 cursor-pointer transition-all border border-border/80 rounded-xl p-3.5 shadow-xs group"
                title="Click to drill down into bookings"
              >
                <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">Gross Booking Revenue</span>
                  <div className="w-6 h-6 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="font-mono text-base sm:text-lg font-bold text-foreground">
                  PKR {totalInvoiced.toLocaleString()}
                </div>
                <span className="text-[10px] text-emerald-600 font-medium group-hover:underline flex items-center gap-0.5 mt-0.5">
                  View {activeFilteredInvoices.length} bookings →
                </span>
              </div>

              {/* Card 2: Cost of Sales */}
              <div
                onClick={() =>
                  openDrilldown({
                    title: "Cost of Sales (Vendor & Supplier Payables)",
                    subtitle: `Direct costs incurred on active bookings in selected date range`,
                    totalAmount: totalCost,
                    items: activeFilteredInvoices
                      .filter((inv: any) => (Number(inv.vendor_payable) || 0) > 0)
                      .map((inv: any) => ({
                        id: `cost_${inv.id}`,
                        date: inv.invoice_date || "—",
                        reference: inv.invoice_no || "INV",
                        title: `Cost for ${inv.service || "Booking"} - ${inv.vendor?.name || "Supplier"}`,
                        type: "Supplier Cost",
                        amount: Number(inv.vendor_payable) || 0,
                        badgeVariant: "red",
                      })),
                  })
                }
                className="bg-card hover:bg-accent/40 cursor-pointer transition-all border border-border/80 rounded-xl p-3.5 shadow-xs group"
                title="Click to drill down into supplier costs"
              >
                <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">Cost of Sales</span>
                  <div className="w-6 h-6 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center">
                    <ArrowDownRight className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="font-mono text-base sm:text-lg font-bold text-foreground">
                  PKR {totalCost.toLocaleString()}
                </div>
                <span className="text-[10px] text-rose-600 font-medium group-hover:underline flex items-center gap-0.5 mt-0.5">
                  View supplier costs →
                </span>
              </div>

              {/* Card 3: Operating Expenses */}
              <div
                onClick={() =>
                  openDrilldown({
                    title: "Operating Expenses Breakdown",
                    subtitle: `Daily operating expenses recorded in selected date range (${filteredExpenses.length} vouchers)`,
                    totalAmount: totalExpensesAmt,
                    items: filteredExpenses.map((exp: any) => ({
                      id: exp.id,
                      date: exp.expense_date || "—",
                      reference: exp.reference_number || `EXP-${exp.id.slice(0, 4)}`,
                      title: exp.expense_type || exp.notes || "Operating Expense",
                      type: exp.expense_type || "General",
                      amount: Number(exp.amount) || 0,
                      badgeVariant: "red",
                    })),
                  })
                }
                className="bg-card hover:bg-accent/40 cursor-pointer transition-all border border-border/80 rounded-xl p-3.5 shadow-xs group"
                title="Click to drill down into expenses"
              >
                <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">Operating Expenses</span>
                  <div className="w-6 h-6 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
                    <Receipt className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="font-mono text-base sm:text-lg font-bold text-rose-600 dark:text-rose-400">
                  PKR {totalExpensesAmt.toLocaleString()}
                </div>
                <span className="text-[10px] text-amber-600 font-medium group-hover:underline flex items-center gap-0.5 mt-0.5">
                  View {filteredExpenses.length} expense vouchers →
                </span>
              </div>

              {/* Card 4: Net Clean Profit */}
              <div
                onClick={() =>
                  openDrilldown({
                    title: "Net Agency Profit Statement",
                    subtitle: `Clean Net Income = Active Revenue - Supplier Costs - Operating Expenses (voided/refunded bookings excluded)`,
                    totalAmount: netCleanProfit,
                    items: [
                      {
                        id: "summary_rev",
                        date: "Period",
                        reference: "REV",
                        title: "Gross Booking Revenue (Active Bookings)",
                        type: "Revenue (+)",
                        amount: totalInvoiced,
                        badgeVariant: "emerald",
                      },
                      {
                        id: "summary_cogs",
                        date: "Period",
                        reference: "COGS",
                        title: "Less: Supplier Cost of Sales",
                        type: "Direct Cost (-)",
                        amount: totalCost,
                        badgeVariant: "red",
                      },
                      {
                        id: "summary_gp",
                        date: "Period",
                        reference: "GP",
                        title: "Gross Profit",
                        type: "Gross (+)",
                        amount: totalProfit,
                        badgeVariant: "emerald",
                      },
                      {
                        id: "summary_exp",
                        date: "Period",
                        reference: "EXP",
                        title: "Less: Total Operating Expenses",
                        type: "Expense (-)",
                        amount: totalExpensesAmt,
                        badgeVariant: "red",
                      },
                      {
                        id: "summary_net",
                        date: "Period",
                        reference: "NET",
                        title: "Final Net Agency Profit",
                        type: "Net Clean",
                        amount: netCleanProfit,
                        badgeVariant: netCleanProfit >= 0 ? "emerald" : "red",
                      },
                    ],
                  })
                }
                className="bg-card hover:bg-accent/40 cursor-pointer transition-all border border-border/80 rounded-xl p-3.5 shadow-xs group"
                title="Click to view net profit statement"
              >
                <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">Net Agency Profit</span>
                  <div className="w-6 h-6 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-600 flex items-center justify-center">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div
                  className={`font-mono text-base sm:text-lg font-bold ${
                    netCleanProfit >= 0 ? "text-teal-600 dark:text-teal-400" : "text-rose-600"
                  }`}
                >
                  PKR {netCleanProfit.toLocaleString()}
                </div>
                <span className="text-[10px] text-teal-600 font-medium group-hover:underline flex items-center gap-0.5 mt-0.5">
                  View profit statement →
                </span>
              </div>
            </div>
          )}

          {/* VIEW 1: PROFIT & LOSS REPORT */}
          {financialSubReport === "pnl" && (
            <div className="space-y-4">
              {/* Clean Financial Breakdown Card */}
              <div className="border border-border/70 rounded-2xl p-4 sm:p-5 bg-card shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border/70">
                  <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    Income Statement Summary (P&L)
                  </h3>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Double-Entry Verified
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div
                    onClick={() =>
                      openDrilldown({
                        title: "Revenue from Bookings & Services",
                        totalAmount: totalInvoiced,
                        items: activeFilteredInvoices.map((inv: any) => ({
                          id: inv.id,
                          date: inv.invoice_date || "—",
                          reference: inv.invoice_no || "INV",
                          title: `${inv.service || "Booking"} - ${inv.party?.name || inv.client_name || ""}`,
                          type: inv.service || "Ticket",
                          amount: Number(inv.client_amount) || 0,
                          badgeVariant: "emerald",
                        })),
                      })
                    }
                    className="flex justify-between py-1.5 px-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <span className="font-medium text-foreground">Revenue from Bookings & Services</span>
                    <span className="font-mono font-semibold text-foreground">
                      PKR {totalInvoiced.toLocaleString()}
                    </span>
                  </div>

                  <div
                    onClick={() =>
                      openDrilldown({
                        title: "Direct Supplier & Vendor Costs",
                        totalAmount: totalCost,
                        items: activeFilteredInvoices
                          .filter((i: any) => (Number(i.vendor_payable) || 0) > 0)
                          .map((inv: any) => ({
                            id: `c_${inv.id}`,
                            date: inv.invoice_date || "—",
                            reference: inv.invoice_no || "INV",
                            title: `Payable to ${inv.vendor?.name || "Supplier"}`,
                            type: inv.service || "Cost",
                            amount: Number(inv.vendor_payable) || 0,
                            badgeVariant: "red",
                          })),
                      })
                    }
                    className="flex justify-between py-1.5 px-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors text-muted-foreground"
                  >
                    <span>Less: Direct Supplier / Vendor Costs</span>
                    <span className="font-mono text-rose-500">
                      - PKR {totalCost.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between py-2 px-2 font-bold text-teal-700 dark:text-teal-400 border-t border-border/60 bg-teal-50/40 dark:bg-teal-950/20 rounded-lg">
                    <span>Gross Profit</span>
                    <span className="font-mono">PKR {totalProfit.toLocaleString()}</span>
                  </div>

                  <div
                    onClick={() =>
                      openDrilldown({
                        title: "Operating Expenses",
                        totalAmount: totalExpensesAmt,
                        items: filteredExpenses.map((exp: any) => ({
                          id: exp.id,
                          date: exp.expense_date || "—",
                          reference: exp.reference_number || `EXP-${exp.id.slice(0, 4)}`,
                          title: exp.expense_type || exp.notes || "Operating Expense",
                          type: exp.expense_type || "General",
                          amount: Number(exp.amount) || 0,
                          badgeVariant: "red",
                        })),
                      })
                    }
                    className="flex justify-between py-1.5 px-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors text-rose-600 dark:text-rose-400"
                  >
                    <span>Less: Total Operating Expenses</span>
                    <span className="font-mono">- PKR {totalExpensesAmt.toLocaleString()}</span>
                  </div>

                  {totalRefundsAmt > 0 && (
                    <div
                      onClick={() =>
                        openDrilldown({
                          title: "Customer Refunds Issued (Voided / Adjusted)",
                          totalAmount: totalRefundsAmt,
                          items: filteredRefunds.map((r: any) => ({
                            id: r.id,
                            date: r.refund_date || "—",
                            reference: r.refund_no || `RF-${r.id.slice(0, 4)}`,
                            title: r.reason || "Customer Refund",
                            type: "Refund (Excluded)",
                            amount: Number(r.client_refund_amount ?? r.refund_amount ?? r.amount) || 0,
                            badgeVariant: "red",
                          })),
                        })
                      }
                      className="flex justify-between py-1.5 px-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors text-amber-600 dark:text-amber-400"
                    >
                      <span>Refunds Issued (Info — excluded from active revenue)</span>
                      <span className="font-mono">PKR {totalRefundsAmt.toLocaleString()}</span>
                    </div>
                  )}

                  <div className="flex justify-between py-2.5 px-2 text-sm sm:text-base font-bold text-foreground border-t-2 border-border mt-2">
                    <span>Net Clean Profit</span>
                    <span
                      className={`font-mono ${
                        netCleanProfit >= 0 ? "text-teal-600 dark:text-teal-400" : "text-rose-600"
                      }`}
                    >
                      PKR {netCleanProfit.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Service Breakdown Table */}
              <div className="border border-border/70 rounded-2xl p-4 bg-card shadow-sm space-y-3">
                <h4 className="text-xs sm:text-sm font-bold text-foreground flex items-center justify-between">
                  <span>Revenue & Margin Breakdown by Service</span>
                  <span className="text-[11px] text-muted-foreground font-normal">Click any row to drill down</span>
                </h4>

                {activeFilteredInvoices.length === 0 ? (
                  <EmptyState
                    type="filtered"
                    title="No active booking invoices in this period"
                    description="Switch date range to 'All Time' or clear search filters to view records."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/60 text-muted-foreground font-semibold">
                        <tr>
                          <th className="py-2.5 px-3 rounded-l-lg">Service</th>
                          <th className="py-2.5 px-3 text-center">Bookings</th>
                          <th className="py-2.5 px-3 text-right">Gross Revenue</th>
                          <th className="py-2.5 px-3 text-right">Supplier Cost</th>
                          <th className="py-2.5 px-3 text-right">Gross Profit</th>
                          <th className="py-2.5 px-3 rounded-r-lg text-right">Margin %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {Array.from(
                          activeFilteredInvoices.reduce((map: Map<string, any>, inv: any) => {
                            const svc = inv.service || "Ticket";
                            const curr = map.get(svc) || {
                              service: svc,
                              count: 0,
                              revenue: 0,
                              cost: 0,
                              profit: 0,
                              items: [],
                            };
                            curr.count += 1;
                            curr.revenue += Number(inv.client_amount) || 0;
                            curr.cost += Number(inv.vendor_payable) || 0;
                            curr.profit +=
                              (Number(inv.client_amount) || 0) - (Number(inv.vendor_payable) || 0);
                            curr.items.push(inv);
                            map.set(svc, curr);
                            return map;
                          }, new Map())
                        ).map(([svc, row]: [string, any]) => {
                          const margin =
                            row.revenue > 0 ? Math.round((row.profit / row.revenue) * 100) : 0;
                          return (
                            <tr
                              key={svc}
                              onClick={() =>
                                openDrilldown({
                                  title: `${svc} Bookings Breakdown`,
                                  subtitle: `${row.count} bookings totaling PKR ${row.revenue.toLocaleString()}`,
                                  totalAmount: row.revenue,
                                  items: row.items.map((i: any) => ({
                                    id: i.id,
                                    date: i.invoice_date || "—",
                                    reference: i.invoice_no || "INV",
                                    title: i.party?.name || i.client_name || "Client",
                                    type: svc,
                                    amount: Number(i.client_amount) || 0,
                                    badgeVariant: "emerald",
                                  })),
                                })
                              }
                              className="hover:bg-muted/50 cursor-pointer transition-colors"
                            >
                              <td className="py-2.5 px-3 font-semibold text-foreground flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-teal-500" />
                                {svc}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-medium">{row.count}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-semibold">
                                PKR {row.revenue.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                                PKR {row.cost.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-teal-600 dark:text-teal-400">
                                PKR {row.profit.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold">
                                {margin}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW 2: ACCOUNTS SUMMARY */}
          {financialSubReport === "accounts_summary" && (
            <div className="space-y-4">
              {/* Liquidity Top Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-card border rounded-xl p-3 shadow-xs">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Total Liquid Funds
                  </span>
                  <div className="font-mono text-lg font-bold text-foreground mt-1">
                    PKR{" "}
                    {accounts
                      .filter((a) => a.active !== false)
                      .reduce((s, a) => s + (Number(a.current_balance) || 0), 0)
                      .toLocaleString()}
                  </div>
                  <span className="text-[10px] text-muted-foreground">Cash + Bank Accounts</span>
                </div>
                <div className="bg-card border rounded-xl p-3 shadow-xs">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Cash in Hand
                  </span>
                  <div className="font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    PKR{" "}
                    {accounts
                      .filter((a) => a.active !== false && a.type === "cash")
                      .reduce((s, a) => s + (Number(a.current_balance) || 0), 0)
                      .toLocaleString()}
                  </div>
                  <span className="text-[10px] text-muted-foreground">Cash Registers</span>
                </div>
                <div className="bg-card border rounded-xl p-3 shadow-xs">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Bank Accounts
                  </span>
                  <div className="font-mono text-lg font-bold text-blue-600 dark:text-blue-400 mt-1">
                    PKR{" "}
                    {accounts
                      .filter((a) => a.active !== false && a.type === "bank")
                      .reduce((s, a) => s + (Number(a.current_balance) || 0), 0)
                      .toLocaleString()}
                  </div>
                  <span className="text-[10px] text-muted-foreground">Operating Bank Balances</span>
                </div>
                <div className="bg-card border rounded-xl p-3 shadow-xs">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Accounts Monitored
                  </span>
                  <div className="font-mono text-lg font-bold text-foreground mt-1">
                    {accounts.length}
                  </div>
                  <span className="text-[10px] text-muted-foreground">Active in system</span>
                </div>
              </div>

              {/* Accounts Table */}
              <div className="border border-border/70 rounded-2xl p-4 bg-card shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-blue-600" />
                    Accounts Master Balances & Movement
                  </h4>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Click row to view transactions
                  </span>
                </div>

                {accounts.length === 0 ? (
                  <EmptyState
                    type="empty"
                    title="No accounts found"
                    description="Accounts will automatically populate from your database ledger."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/60 text-muted-foreground font-semibold">
                        <tr>
                          <th className="py-2.5 px-3 rounded-l-lg">Account Title</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3 text-right">Opening Bal</th>
                          <th className="py-2.5 px-3 text-right">Period Debit (IN)</th>
                          <th className="py-2.5 px-3 text-right">Period Credit (OUT)</th>
                          <th className="py-2.5 px-3 text-right">Net Movement</th>
                          <th className="py-2.5 px-3 text-right font-bold">Closing Balance</th>
                          <th className="py-2.5 px-3 rounded-r-lg text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {accounts
                          .filter((acc) => {
                            if (!filters.searchQuery.trim()) return true;
                            const q = filters.searchQuery.toLowerCase();
                            return acc.name.toLowerCase().includes(q) || acc.type.toLowerCase().includes(q);
                          })
                          .map((acc) => {
                            const accTx = rawTransactions.filter(
                              (t: any) => t.account_id === acc.id && isDateInRange(t.date)
                            );
                            const debitIn = accTx.reduce(
                              (s: number, t: any) =>
                                s + (Number(t.debit) || (t.type === "payment_in" ? Number(t.amount) : 0)),
                              0
                            );
                            const creditOut = accTx.reduce(
                              (s: number, t: any) =>
                                s +
                                (Number(t.credit) ||
                                  (t.type === "payment_out" || t.type === "expense" ? Number(t.amount) : 0)),
                              0
                            );
                            const netMove = debitIn - creditOut;
                            const opening = Number(acc.opening_balance) || 0;
                            const closing = Number(acc.current_balance) || 0;

                            return (
                              <tr
                                key={acc.id}
                                onClick={() =>
                                  openDrilldown({
                                    title: `${acc.name} (${acc.type.toUpperCase()}) Transactions`,
                                    subtitle: `Closing Balance: PKR ${closing.toLocaleString()}`,
                                    totalAmount: closing,
                                    items: accTx.map((t: any) => ({
                                      id: t.id,
                                      date: t.date || "—",
                                      reference: t.reference_no || `TX-${t.id.slice(0, 4)}`,
                                      title: t.notes || t.category || "Voucher Transaction",
                                      type: t.type || "transaction",
                                      amount: Number(t.debit) || Number(t.credit) || Number(t.amount) || 0,
                                      badgeVariant: t.type === "payment_in" ? "emerald" : "red",
                                    })),
                                  })
                                }
                                className="hover:bg-muted/50 cursor-pointer transition-colors"
                              >
                                <td className="py-2.5 px-3 font-semibold text-foreground flex items-center gap-2">
                                  {acc.type === "bank" ? (
                                    <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                  ) : (
                                    <Wallet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  )}
                                  {acc.name}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                      acc.type === "bank"
                                        ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                                        : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                    }`}
                                  >
                                    {acc.type}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                                  PKR {opening.toLocaleString()}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-emerald-600 font-semibold">
                                  {debitIn > 0 ? `+PKR ${debitIn.toLocaleString()}` : "—"}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-rose-500 font-semibold">
                                  {creditOut > 0 ? `-PKR ${creditOut.toLocaleString()}` : "—"}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-medium">
                                  {netMove !== 0
                                    ? `${netMove > 0 ? "+" : ""}PKR ${netMove.toLocaleString()}`
                                    : "0"}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                                  PKR {closing.toLocaleString()}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 text-[10px] font-semibold text-primary"
                                  >
                                    Drill down →
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW 3: ASSETS & DUES */}
          {financialSubReport === "assets_dues" && (
            <div className="space-y-4">
              {/* Working Capital Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-card border rounded-xl p-3 shadow-xs">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Cash & Bank (Liquid)
                  </span>
                  <div className="font-mono text-lg font-bold text-foreground mt-1">
                    PKR {canonicalPosition.cashAndBank.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-emerald-600 font-medium">Ready Liquidity</span>
                </div>

                <div className="bg-card border rounded-xl p-3 shadow-xs">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Client Receivables (Dues)
                  </span>
                  <div className="font-mono text-lg font-bold text-amber-600 dark:text-amber-400 mt-1">
                    PKR {canonicalPosition.clientDues.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-amber-600 font-medium">Uncollected from clients</span>
                </div>

                <div className="bg-card border rounded-xl p-3 shadow-xs">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Vendor Payables
                  </span>
                  <div className="font-mono text-lg font-bold text-rose-600 dark:text-rose-400 mt-1">
                    PKR {canonicalPosition.vendorDues.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-rose-600 font-medium">Owed to suppliers</span>
                </div>

                <div className="bg-card border rounded-xl p-3 shadow-xs">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Net Working Capital
                  </span>
                  <div className="font-mono text-lg font-bold text-teal-600 dark:text-teal-400 mt-1">
                    PKR{" "}
                    {(
                      canonicalPosition.cashAndBank +
                      canonicalPosition.clientDues -
                      canonicalPosition.vendorDues
                    ).toLocaleString()}
                  </div>
                  <span className="text-[10px] text-muted-foreground">Assets + Dues - Payables</span>
                </div>
              </div>

              {/* Dues Register Table */}
              <div className="border border-border/70 rounded-2xl p-4 bg-card shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2">
                    <Scale className="w-4 h-4 text-purple-600" />
                    Outstanding Parties Register (Receivables & Payables)
                  </h4>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Filter by search box
                  </span>
                </div>

                {parties.filter((p) => (Number(p.current_balance) || 0) !== 0).length === 0 ? (
                  <EmptyState
                    type="empty"
                    title="No outstanding dues"
                    description="All client and vendor balances are currently settled."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/60 text-muted-foreground font-semibold">
                        <tr>
                          <th className="py-2.5 px-3 rounded-l-lg">Party Name</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Contact</th>
                          <th className="py-2.5 px-3 text-right">Balance Due</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3 rounded-r-lg text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {parties
                          .filter((p) => {
                            const bal = Number(p.current_balance) || 0;
                            if (bal === 0) return false;
                            if (!filters.searchQuery.trim()) return true;
                            const q = filters.searchQuery.toLowerCase();
                            return (
                              p.name.toLowerCase().includes(q) ||
                              (p.phone || "").toLowerCase().includes(q) ||
                              (p.code || "").toLowerCase().includes(q)
                            );
                          })
                          .sort((a, b) => Math.abs(b.current_balance) - Math.abs(a.current_balance))
                          .map((p) => {
                            const bal = Number(p.current_balance) || 0;
                            const isClient = p.type !== "vendor" && bal > 0;

                            return (
                              <tr
                                key={p.id}
                                onClick={() =>
                                  navigate(`/app/reports?tab=account-statement&party=${p.id}`)
                                }
                                className="hover:bg-muted/50 cursor-pointer transition-colors"
                              >
                                <td className="py-2.5 px-3 font-semibold text-foreground flex items-center gap-2">
                                  <span
                                    className={`w-2 h-2 rounded-full ${
                                      isClient ? "bg-amber-500" : "bg-rose-500"
                                    }`}
                                  />
                                  {p.name}
                                  {p.code && (
                                    <span className="font-mono text-[10px] text-muted-foreground">
                                      ({p.code})
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                                      isClient
                                        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                        : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                                    }`}
                                  >
                                    {isClient ? "Client" : "Vendor"}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-muted-foreground">
                                  {p.phone || p.whatsapp || "—"}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold">
                                  <span
                                    className={
                                      isClient
                                        ? "text-amber-600 dark:text-amber-400"
                                        : "text-rose-600 dark:text-rose-400"
                                    }
                                  >
                                    PKR {Math.abs(bal).toLocaleString()}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      isClient
                                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200"
                                        : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200"
                                    }`}
                                  >
                                    {isClient ? "Receivable" : "Payable"}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 text-[10px] font-semibold text-primary"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/app/reports?tab=account-statement&party=${p.id}`);
                                    }}
                                  >
                                    Statement →
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW 4: MONTHLY INCOME */}
          {financialSubReport === "monthly_income" && (
            <div className="space-y-4">
              {/* Monthly Income Bar Chart */}
              <div className="border border-border/70 rounded-2xl p-4 bg-card shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-border/60">
                  <h4 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-teal-600" />
                    Month-by-Month Income & Margin Trend
                  </h4>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Filtered by Date Selector
                  </span>
                </div>

                {filteredInvoices.length === 0 ? (
                  <EmptyState
                    type="filtered"
                    title="No income recorded for this period"
                    description="Switch date filter to 'All Time' to view past monthly trends."
                  />
                ) : (
                  <div className="h-72 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={(() => {
                          const monthMap = new Map<string, any>();
                          filteredInvoices.forEach((inv: any) => {
                            const d = inv.invoice_date || "";
                            if (!d) return;
                            const mKey = d.slice(0, 7);
                            let label = mKey;
                            try {
                              const [y, m] = mKey.split("-").map(Number);
                              label = format(new Date(y, m - 1, 1), "MMM yyyy");
                            } catch (e) {}

                            const curr = monthMap.get(mKey) || {
                              monthKey: mKey,
                              month: label,
                              revenue: 0,
                              cost: 0,
                              profit: 0,
                              count: 0,
                            };
                            curr.count += 1;
                            curr.revenue += Number(inv.client_amount) || 0;
                            curr.cost += Number(inv.vendor_payable) || 0;
                            curr.profit +=
                              Number(inv.profit) ||
                              (Number(inv.client_amount) || 0) - (Number(inv.vendor_payable) || 0);
                            monthMap.set(mKey, curr);
                          });
                          return Array.from(monthMap.values()).sort((a, b) =>
                            a.monthKey.localeCompare(b.monthKey)
                          );
                        })()}
                        margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          formatter={(val: any) => [`PKR ${Number(val).toLocaleString()}`, ""]}
                          contentStyle={{
                            borderRadius: "10px",
                            fontSize: "12px",
                            backgroundColor: "rgba(255, 255, 255, 0.95)",
                            borderColor: "#e2e8f0",
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                        <Bar dataKey="revenue" name="Gross Revenue" fill="#0d9488" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="cost" name="Supplier Cost" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="profit" name="Gross Profit" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Monthly Income Table */}
              <div className="border border-border/70 rounded-2xl p-4 bg-card shadow-sm space-y-3">
                <h4 className="text-xs sm:text-sm font-bold text-foreground">
                  Monthly Income & Booking Counts Table
                </h4>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/60 text-muted-foreground font-semibold">
                      <tr>
                        <th className="py-2.5 px-3 rounded-l-lg">Month</th>
                        <th className="py-2.5 px-3 text-center">Invoices</th>
                        <th className="py-2.5 px-3 text-right">Gross Booking Sales</th>
                        <th className="py-2.5 px-3 text-right">Supplier Costs</th>
                        <th className="py-2.5 px-3 text-right">Gross Profit</th>
                        <th className="py-2.5 px-3 rounded-r-lg text-right">Margin %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {(() => {
                        const monthMap = new Map<string, any>();
                        filteredInvoices.forEach((inv: any) => {
                          const d = inv.invoice_date || "";
                          if (!d) return;
                          const mKey = d.slice(0, 7);
                          let label = mKey;
                          try {
                            const [y, m] = mKey.split("-").map(Number);
                            label = format(new Date(y, m - 1, 1), "MMM yyyy");
                          } catch (e) {}

                          const curr = monthMap.get(mKey) || {
                            monthKey: mKey,
                            month: label,
                            revenue: 0,
                            cost: 0,
                            profit: 0,
                            count: 0,
                            items: [],
                          };
                          curr.count += 1;
                          curr.revenue += Number(inv.client_amount) || 0;
                          curr.cost += Number(inv.vendor_payable) || 0;
                          curr.profit +=
                            Number(inv.profit) ||
                            (Number(inv.client_amount) || 0) - (Number(inv.vendor_payable) || 0);
                          curr.items.push(inv);
                          monthMap.set(mKey, curr);
                        });

                        const rows = Array.from(monthMap.values()).sort((a, b) =>
                          b.monthKey.localeCompare(a.monthKey)
                        );

                        if (rows.length === 0) {
                          return (
                            <tr>
                              <td colSpan={6} className="py-6 text-center text-muted-foreground">
                                No booking income records matching active filters
                              </td>
                            </tr>
                          );
                        }

                        return rows.map((r: any) => {
                          const margin =
                            r.revenue > 0 ? Math.round((r.profit / r.revenue) * 100) : 0;
                          return (
                            <tr
                              key={r.monthKey}
                              onClick={() =>
                                openDrilldown({
                                  title: `${r.month} Bookings Drilldown`,
                                  subtitle: `${r.count} bookings totaling PKR ${r.revenue.toLocaleString()}`,
                                  totalAmount: r.revenue,
                                  items: r.items.map((i: any) => ({
                                    id: i.id,
                                    date: i.invoice_date || "—",
                                    reference: i.invoice_no || "INV",
                                    title: i.party?.name || i.client_name || "Client",
                                    type: i.service || "Booking",
                                    amount: Number(i.client_amount) || 0,
                                    badgeVariant: "emerald",
                                  })),
                                })
                              }
                              className="hover:bg-muted/50 cursor-pointer transition-colors"
                            >
                              <td className="py-2.5 px-3 font-semibold text-foreground flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-teal-600" />
                                {r.month}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-medium">{r.count}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-semibold">
                                PKR {r.revenue.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                                PKR {r.cost.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-teal-600 dark:text-teal-400">
                                PKR {r.profit.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold">
                                {margin}%
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 5: MONTHLY EXPENSES */}
          {financialSubReport === "monthly_expenses" && (
            <div className="space-y-4">
              {/* Monthly Expenses Chart */}
              <div className="border border-border/70 rounded-2xl p-4 bg-card shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-border/60">
                  <h4 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2">
                    <FileText className="w-4 h-4 text-rose-600" />
                    Operating Expenses by Category & Month
                  </h4>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Filtered by Date Selector
                  </span>
                </div>

                {filteredExpenses.length === 0 ? (
                  <EmptyState
                    type="filtered"
                    title="No expenses recorded for this period"
                    description="Switch date filter to 'All Time' or add operating expenses to view trends."
                  />
                ) : (
                  <div className="h-72 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={(() => {
                          const catMap = new Map<string, any>();
                          filteredExpenses.forEach((exp: any) => {
                            const cat = exp.expense_type || "Operating Expense";
                            const curr = catMap.get(cat) || {
                              category: cat,
                              amount: 0,
                              count: 0,
                            };
                            curr.count += 1;
                            curr.amount += Number(exp.amount) || 0;
                            catMap.set(cat, curr);
                          });
                          return Array.from(catMap.values()).sort((a, b) => b.amount - a.amount);
                        })()}
                        margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="category" tick={{ fontSize: 10 }} />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          formatter={(val: any) => [`PKR ${Number(val).toLocaleString()}`, "Amount"]}
                          contentStyle={{
                            borderRadius: "10px",
                            fontSize: "12px",
                            backgroundColor: "rgba(255, 255, 255, 0.95)",
                            borderColor: "#e2e8f0",
                          }}
                        />
                        <Bar dataKey="amount" name="Expense Amount" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Monthly Expenses Breakdown Table */}
              <div className="border border-border/70 rounded-2xl p-4 bg-card shadow-sm space-y-3">
                <h4 className="text-xs sm:text-sm font-bold text-foreground">
                  Expenses by Category Breakdown
                </h4>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/60 text-muted-foreground font-semibold">
                      <tr>
                        <th className="py-2.5 px-3 rounded-l-lg">Expense Category</th>
                        <th className="py-2.5 px-3 text-center">Vouchers Count</th>
                        <th className="py-2.5 px-3 text-right">Total Spent</th>
                        <th className="py-2.5 px-3 rounded-r-lg text-right">% of Operating Expenses</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {(() => {
                        const catMap = new Map<string, any>();
                        filteredExpenses.forEach((exp: any) => {
                          const cat = exp.expense_type || "Operating Expense";
                          const curr = catMap.get(cat) || {
                            category: cat,
                            count: 0,
                            amount: 0,
                            items: [],
                          };
                          curr.count += 1;
                          curr.amount += Number(exp.amount) || 0;
                          curr.items.push(exp);
                          catMap.set(cat, curr);
                        });

                        const totalAllExp = filteredExpenses.reduce(
                          (s, e) => s + (Number(e.amount) || 0),
                          0
                        );
                        const rows = Array.from(catMap.values()).sort((a, b) => b.amount - a.amount);

                        if (rows.length === 0) {
                          return (
                            <tr>
                              <td colSpan={4} className="py-6 text-center text-muted-foreground">
                                No expenses matching active filters
                              </td>
                            </tr>
                          );
                        }

                        return rows.map((r: any) => {
                          const pct =
                            totalAllExp > 0 ? Math.round((r.amount / totalAllExp) * 100) : 0;
                          return (
                            <tr
                              key={r.category}
                              onClick={() =>
                                openDrilldown({
                                  title: `${r.category} Expenses Breakdown`,
                                  subtitle: `${r.count} expense vouchers totaling PKR ${r.amount.toLocaleString()}`,
                                  totalAmount: r.amount,
                                  items: r.items.map((e: any) => ({
                                    id: e.id,
                                    date: e.expense_date || "—",
                                    reference: e.reference_number || `EXP-${e.id.slice(0, 4)}`,
                                    title: e.notes || e.expense_type || "Expense",
                                    type: r.category,
                                    amount: Number(e.amount) || 0,
                                    badgeVariant: "red",
                                  })),
                                })
                              }
                              className="hover:bg-muted/50 cursor-pointer transition-colors"
                            >
                              <td className="py-2.5 px-3 font-semibold text-foreground flex items-center gap-1.5">
                                <Receipt className="w-3.5 h-3.5 text-rose-500" />
                                {r.category}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-medium">{r.count}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                                PKR {r.amount.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-semibold">
                                {pct}%
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Universal Drilldown Dialog */}
      <Dialog
        open={drilldownModal.open}
        onOpenChange={(open) => setDrilldownModal((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-4 sm:p-6">
          <DialogHeader className="pb-2 border-b border-border/70 shrink-0">
            <DialogTitle className="text-sm sm:text-base font-bold flex items-center justify-between gap-2">
              <span className="truncate">{drilldownModal.title}</span>
              {drilldownModal.totalAmount !== undefined && (
                <span className="font-mono text-xs sm:text-sm font-bold text-teal-600 dark:text-teal-400 shrink-0">
                  Total: PKR {drilldownModal.totalAmount.toLocaleString()}
                </span>
              )}
            </DialogTitle>
            {drilldownModal.subtitle && (
              <p className="text-xs text-muted-foreground">{drilldownModal.subtitle}</p>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto divide-y divide-border/60 py-2">
            {drilldownModal.items.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No detailed items found
              </p>
            ) : (
              drilldownModal.items.map((item) => (
                <div
                  key={item.id}
                  className="py-2.5 px-2 flex items-center justify-between gap-3 text-xs hover:bg-muted/40 rounded-lg transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-foreground">
                        {item.reference}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {item.date}
                      </span>
                    </div>
                    <p className="font-medium text-slate-700 dark:text-slate-300 truncate mt-0.5">
                      {item.title}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`font-mono font-bold block ${
                        item.badgeVariant === "red"
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      PKR {item.amount.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-muted-foreground capitalize">
                      {item.type}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Shared Report Export PDF Dialog */}
      <ReportExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        reportTab={currentTab}
        agency={agency || undefined}
        parties={parties}
        accounts={accounts}
        rawInvoices={rawInvoices}
        rawExpenses={rawExpenses}
        rawTransactions={rawTransactions}
        rawStatementData={rawStatementData}
        financialSubReport={financialSubReport}
        initialDateRange={filters.dateRange}
        initialStartDate={filters.startDate}
        initialEndDate={filters.endDate}
        initialPartyId={filters.partyId}
        initialDetailedView={detailedView}
        initialOnlyUnpaid={onlyUnpaid}
        initialOverdueBucket={overdueBucket}
        quotationSummary={quoteStats}
      />
    </div>
  );
}
