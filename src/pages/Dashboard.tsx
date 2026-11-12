import { Button } from "@/components/ui/button";
import {
  Calendar,
  Banknote,
  Plane,
  RefreshCw,
  Wallet,
  FileText,
  UserPlus,
  Receipt,
  AlertCircle,
  ArrowRight,
  Bell,
  Calculator,
  CheckCircle2,
  Info,
  TrendingUp,
  Clock,
  Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useParties } from "@/hooks/useParties";
import { useAccounts } from "@/hooks/useUnifiedTransactions";
import { useUnifiedAlerts } from "@/hooks/useUnifiedAlerts";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRealtimeMultiTable } from "@/hooks/useRealtimeTable";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useAgency } from "@/hooks/useAgency";
import { getInvoiceOverdueInfo } from "@/lib/overdueUtils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { toast } from "sonner";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { DashboardSkeleton } from "@/components/SkeletonLoaders";
import { CopyValue } from "@/components/ui/CopyValue";

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: agency } = useAgency();
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());

  // 1. Unified Parties for Client & Vendor Dues (100% parity with Clients & Vendors page)
  const { parties = [], isLoading: loadingParties } = useParties();

  const totalClientsPending = useMemo(() => {
    return parties
      .filter((p) => p.current_balance > 0)
      .reduce((sum, p) => sum + p.current_balance, 0);
  }, [parties]);

  const vendorPayables = useMemo(() => {
    return parties
      .filter((p) => p.current_balance < 0)
      .reduce((sum, p) => sum + Math.abs(p.current_balance), 0);
  }, [parties]);

  // 2. Accounts for Cash & Bank Position (100% parity with Payment Vouchers / Accounts)
  const { accounts = [], isLoading: loadingAccounts } = useAccounts();

  const cashAndBankTotal = useMemo(() => {
    return accounts.reduce(
      (sum, acc) => sum + (Number(acc.current_balance) || 0),
      0
    );
  }, [accounts]);

  // 3. Booking Invoices for Profit, Today's Bookings & Overdue Invoices
  const { data: rawInvoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ["dashboard_invoices", agency?.id],
    queryFn: async () => {
      let query = (supabase as any)
        .from("booking_invoices")
        .select("*, party:parties!party_id(name)")
        .order("invoice_date", { ascending: false });

      if (agency?.id) {
        query = query.eq("agency_id", agency.id);
      }

      const { data, error } = await query;

      if (!error && data && data.length > 0) return data;

      // Fallback: clients table
      let clientQuery = supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });

      if (agency?.id) {
        clientQuery = clientQuery.eq("agency_id", agency.id);
      }

      const { data: clientsData } = await clientQuery;

      return (clientsData || []).map((c: any) => ({
        id: c.id,
        invoice_no: `INV-${c.id.slice(0, 4).toUpperCase()}`,
        invoice_date: c.flight_date || (c.created_at ? c.created_at.slice(0, 10) : ""),
        client_amount: c.selling_price || 0,
        vendor_payable: c.purchasing_price || 0,
        profit: (c.selling_price || 0) - (c.purchasing_price || 0),
        paid_amount: c.amount_paid || 0,
        payment_status: (c.payment_status || "Pending").toLowerCase(),
        remaining_payment_date: c.remaining_payment_date,
        more_details: { remaining_due_date: c.remaining_payment_date },
      }));
    },
  });

  // Profit this month: strictly filters by invoice_date matching selectedMonth
  const profitThisMonth = useMemo(() => {
    const monthPrefix = format(selectedMonth, "yyyy-MM");
    return rawInvoices
      .filter((inv: any) => {
        const d = inv.invoice_date || "";
        return d.startsWith(monthPrefix);
      })
      .reduce((sum: number, inv: any) => {
        const profit =
          inv.profit !== undefined && inv.profit !== null
            ? Number(inv.profit)
            : (Number(inv.client_amount) || 0) - (Number(inv.vendor_payable) || 0);
        return sum + (profit || 0);
      }, 0);
  }, [rawInvoices, selectedMonth]);

  // Today's Bookings: invoices dated today
  const todayBookingsCount = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    return rawInvoices.filter((inv: any) => (inv.invoice_date || "") === todayStr).length;
  }, [rawInvoices]);

  // Overdue Invoices: shared Remaining Due Date logic with Reports and Notifications
  const overdueInvoicesCount = useMemo(() => {
    return rawInvoices.filter((inv: any) => {
      const { isOverdue } = getInvoiceOverdueInfo(inv);
      return isOverdue;
    }).length;
  }, [rawInvoices]);

  // 4. Unified Alerts for Notification Center
  const {
    activeAlerts,
    unreadCount,
    markAsDone,
    markAsRead,
  } = useUnifiedAlerts();

  const topDashboardAlerts = useMemo(() => {
    const unread = activeAlerts.filter((a) => !a.isRead);
    if (unread.length >= 3) return unread.slice(0, 3);
    return activeAlerts.slice(0, 3);
  }, [activeAlerts]);

  // Pull-to-refresh
  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["parties"] }),
      queryClient.invalidateQueries({ queryKey: ["accounts_with_balances"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard_invoices"] }),
      queryClient.invalidateQueries({ queryKey: ["unified_portal_alerts"] }),
    ]);
    toast.success("Dashboard refreshed");
  };

  const { containerRef, isPulling, isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  // Real-time multi-table sync
  useRealtimeMultiTable({
    channelPrefix: "dashboard-live-sync",
    enabled: true,
    subscriptions: [
      { table: "booking_invoices", callback: () => queryClient.invalidateQueries({ queryKey: ["dashboard_invoices"] }) },
      { table: "parties", callback: () => queryClient.invalidateQueries({ queryKey: ["parties"] }) },
      { table: "accounts", callback: () => queryClient.invalidateQueries({ queryKey: ["accounts_with_balances"] }) },
      { table: "payment_vouchers", callback: () => queryClient.invalidateQueries({ queryKey: ["dashboard_invoices"] }) },
      { table: "expenses", callback: () => queryClient.invalidateQueries({ queryKey: ["accounts_with_balances"] }) },
    ],
  });

  const formatCurrency = (val: number) => {
    const num = Number(val) || 0;
    if (num === 0) return "Rs 0";
    if (num >= 1000) {
      return `Rs ${(num / 1000).toFixed(0)}K`;
    }
    return `Rs ${Math.round(num).toLocaleString()}`;
  };

  const isLoading = loadingParties || loadingAccounts || loadingInvoices;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div ref={containerRef} className="relative h-full overflow-auto">
      {/* Pull-to-refresh indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-center transition-all duration-200 ease-out z-20 pointer-events-none"
        style={{
          transform: `translateY(${Math.max(0, pullDistance - 80)}px)`,
          opacity: Math.min(pullDistance / 80, 1),
        }}
      >
        <div className="bg-primary text-primary-foreground rounded-full p-2 shadow-lg">
          <RefreshCw
            className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`}
            style={{
              transform: `rotate(${pullDistance * 3.6}deg)`,
            }}
          />
        </div>
      </div>

      {/* Main Dashboard Container: Exact vertical space-y-8 hierarchy */}
      <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
        {/* 1. DASHBOARD HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white font-heading tracking-tight">
              Dashboard
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
              Welcome back to <span className="font-semibold text-slate-800 dark:text-slate-200">{agency?.name || "Your Agency"}</span>! Here's your operations and performance overview
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 font-medium shadow-xs bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50"
                >
                  <Calendar className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" />
                  {format(selectedMonth, 'MMMM yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarComponent
                  mode="single"
                  selected={selectedMonth}
                  onSelect={(date) => date && setSelectedMonth(date)}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* 2. CANONICAL 6 KPI METRIC CARDS (Part G7: Every card drills down) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* Card 1: CASH & BANK */}
          <div
            onClick={() => navigate("/app/sales-expenses?tab=payment-vouchers")}
            className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs p-4 flex flex-col justify-between transition-all duration-200 hover:shadow-md hover:border-teal-500/50 cursor-pointer group"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase truncate">
                Cash & Bank
              </span>
              <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400 flex items-center justify-center shrink-0">
                <Wallet className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                <CopyValue isAmount={true} value={cashAndBankTotal} displayValue={formatCurrency(cashAndBankTotal)} label="cash & bank total" />
              </p>
              <span className="text-[10px] text-teal-600 dark:text-teal-400 font-medium group-hover:underline">
                View Vouchers →
              </span>
            </div>
          </div>

          {/* Card 2: CLIENT DUES */}
          <div
            onClick={() => navigate("/app/clients-vendors?balance=has_dues")}
            className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs p-4 flex flex-col justify-between transition-all duration-200 hover:shadow-md hover:border-amber-500/50 cursor-pointer group"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase truncate">
                Client Dues
              </span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Banknote className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-amber-600 dark:text-amber-400 tabular-nums">
                <CopyValue isAmount={true} value={totalClientsPending} displayValue={formatCurrency(totalClientsPending)} label="client dues" />
              </p>
              <span className="text-[10px] text-amber-600 font-medium group-hover:underline">
                View Clients →
              </span>
            </div>
          </div>

          {/* Card 3: VENDOR DUES */}
          <div
            onClick={() => navigate("/app/clients-vendors?type=vendor")}
            className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs p-4 flex flex-col justify-between transition-all duration-200 hover:shadow-md hover:border-rose-500/50 cursor-pointer group"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase truncate">
                Vendor Dues
              </span>
              <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Receipt className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-rose-600 dark:text-rose-400 tabular-nums">
                <CopyValue isAmount={true} value={vendorPayables} displayValue={formatCurrency(vendorPayables)} label="vendor dues" />
              </p>
              <span className="text-[10px] text-rose-600 font-medium group-hover:underline">
                View Vendors →
              </span>
            </div>
          </div>

          {/* Card 4: PROFIT THIS MONTH */}
          <div
            onClick={() => navigate(`/app/reports?tab=booking-report&month=${format(selectedMonth, 'yyyy-MM')}`)}
            className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs p-4 flex flex-col justify-between transition-all duration-200 hover:shadow-md hover:border-emerald-500/50 cursor-pointer group"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase truncate">
                Profit (Month)
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
                <CopyValue isAmount={true} value={profitThisMonth} displayValue={formatCurrency(profitThisMonth)} label="profit" />
              </p>
              <span className="text-[10px] text-emerald-600 font-medium group-hover:underline">
                Reports P&L →
              </span>
            </div>
          </div>

          {/* Card 5: TODAY'S BOOKINGS */}
          <div
            onClick={() => navigate("/app/sales-expenses?tab=booking-invoice&date=today")}
            className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs p-4 flex flex-col justify-between transition-all duration-200 hover:shadow-md hover:border-blue-500/50 cursor-pointer group"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase truncate">
                Today's Bookings
              </span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Calendar className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                {todayBookingsCount}
              </p>
              <span className="text-[10px] text-blue-600 font-medium group-hover:underline">
                Booking Invoices →
              </span>
            </div>
          </div>

          {/* Card 6: OVERDUE INVOICES */}
          <div
            onClick={() => navigate("/app/reports?tab=account-statement&overdue=all&unpaid=1")}
            className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs p-4 flex flex-col justify-between transition-all duration-200 hover:shadow-md hover:border-red-500/50 cursor-pointer group"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase truncate">
                Overdue Invoices
              </span>
              <div className="w-7 h-7 rounded-lg bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400 flex items-center justify-center shrink-0">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-red-600 dark:text-red-400 tabular-nums">
                {overdueInvoicesCount}
              </p>
              <span className="text-[10px] text-red-600 font-medium group-hover:underline">
                Aging Statements →
              </span>
            </div>
          </div>
        </div>

        {/* 3. QUICK ACTION BUTTONS (3 + 3 Grid: Premium Shape, Gradient Icon Badges, Distinct Accents) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Action 1: Create Booking - Blue Accent */}
          <button
            type="button"
            onClick={() => navigate("/app/sales-expenses?tab=booking-invoice&new=1")}
            className="h-20 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500/50 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-3.5 group cursor-pointer text-left w-full"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/25 transition-transform duration-200 group-hover:scale-105">
              <Plane className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors block truncate">
                Create Booking
              </span>
              <span className="text-xs text-muted-foreground font-normal truncate block mt-0.5">
                New client reservation & tickets
              </span>
            </div>
          </button>

          {/* Action 2: Umrah Calculator - Green/Emerald Accent */}
          <button
            type="button"
            onClick={() => navigate("/app/umrah-calculator")}
            className="h-20 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-500/50 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-3.5 group cursor-pointer text-left w-full"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/25 transition-transform duration-200 group-hover:scale-105">
              <Calculator className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors block truncate">
                Umrah Calculator
              </span>
              <span className="text-xs text-muted-foreground font-normal truncate block mt-0.5">
                Package costing & quotes
              </span>
            </div>
          </button>

          {/* Action 3: Add Payment - Purple Accent */}
          <button
            type="button"
            onClick={() => navigate("/app/sales-expenses?tab=payment-vouchers&new=1")}
            className="h-20 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md hover:border-purple-400 dark:hover:border-purple-500/50 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-3.5 group cursor-pointer text-left w-full"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-purple-500/25 transition-transform duration-200 group-hover:scale-105">
              <Wallet className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors block truncate">
                Add Payment
              </span>
              <span className="text-xs text-muted-foreground font-normal truncate block mt-0.5">
                Record cash & bank entries
              </span>
            </div>
          </button>

          {/* Action 4: Add Quotation - Orange Accent */}
          <button
            type="button"
            onClick={() => navigate("/app/leads-quotes?tab=quotations&new=1")}
            className="h-20 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md hover:border-orange-400 dark:hover:border-orange-500/50 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-3.5 group cursor-pointer text-left w-full"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-orange-500/25 transition-transform duration-200 group-hover:scale-105">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors block truncate">
                Add Quotation
              </span>
              <span className="text-xs text-muted-foreground font-normal truncate block mt-0.5">
                Client & B2B price proposals
              </span>
            </div>
          </button>

          {/* Action 5: New Client Query - Teal/Cyan Accent */}
          <button
            type="button"
            onClick={() => navigate("/app/leads-quotes?tab=queries&new=1")}
            className="h-20 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md hover:border-teal-400 dark:hover:border-teal-500/50 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-3.5 group cursor-pointer text-left w-full"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-teal-500/25 transition-transform duration-200 group-hover:scale-105">
              <UserPlus className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors block truncate">
                New Client Query
              </span>
              <span className="text-xs text-muted-foreground font-normal truncate block mt-0.5">
                Inbound lead & enquiry
              </span>
            </div>
          </button>

          {/* Action 6: Add Expense / Bill - Red Accent */}
          <button
            type="button"
            onClick={() => navigate("/app/sales-expenses?tab=expenses&new=1")}
            className="h-20 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md hover:border-rose-400 dark:hover:border-rose-500/50 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-3.5 group cursor-pointer text-left w-full"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-rose-500/25 transition-transform duration-200 group-hover:scale-105">
              <Receipt className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors block truncate">
                Add Expense / Bill
              </span>
              <span className="text-xs text-muted-foreground font-normal truncate block mt-0.5">
                Daily operational expense
              </span>
            </div>
          </button>
        </div>

        {/* 4. NOTIFICATIONS CENTER (Latest 3 unread items, with live action buttons & instant badge update) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          {/* Section Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Notifications
                </h2>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800">
                    {unreadCount} new
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate("/app/notifications")}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 bg-indigo-50/60 hover:bg-indigo-50 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/70 px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <span>View All Notifications</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Notification List Body: top 3 active items with Mark Done & Action buttons */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {topDashboardAlerts.length === 0 ? (
              <div className="py-12 px-6 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3 border border-slate-100 dark:border-slate-700">
                  <Bell className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  No notifications right now
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                  All client collections, vendor payables, and operational alerts are up to date.
                </p>
              </div>
            ) : (
              topDashboardAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`px-6 py-4 flex items-start justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors border-l-4 ${alert.priority === "overdue"
                    ? "border-l-red-500"
                    : alert.priority === "due_today"
                      ? "border-l-amber-500"
                      : alert.priority === "upcoming"
                        ? "border-l-blue-500"
                        : "border-l-slate-300"
                    }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="shrink-0 mt-0.5">
                      {alert.priority === "overdue" ? (
                        <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400 flex items-center justify-center">
                          <Clock className="w-4 h-4" />
                        </div>
                      ) : alert.priority === "due_today" ? (
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 flex items-center justify-center">
                          <AlertCircle className="w-4 h-4" />
                        </div>
                      ) : alert.priority === "upcoming" ? (
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 flex items-center justify-center">
                          <Plane className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300 flex items-center justify-center">
                          <Info className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm text-slate-900 dark:text-slate-100 ${!alert.isRead ? "font-bold" : "font-medium"}`}>
                        {alert.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                        {alert.description}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                        {alert.invoiceNo && (
                          <span className="flex items-center gap-1 font-mono">
                            Inv: <CopyValue value={alert.invoiceNo} label="invoice number" className="text-slate-600 dark:text-slate-300 font-bold" />
                          </span>
                        )}
                        {alert.pnr && (
                          <span className="flex items-center gap-1 font-mono">
                            PNR: <CopyValue value={alert.pnr} label="PNR" className="text-teal-600 dark:text-teal-400 font-bold" />
                          </span>
                        )}
                        {(alert.clientName || alert.vendorName) && (
                          <span className="truncate max-w-[150px] font-medium text-slate-600 dark:text-slate-300">
                            {alert.clientName || alert.vendorName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                    {alert.mainAction && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          markAsRead(alert.id);
                          if (alert.mainAction?.url) {
                            navigate(alert.mainAction.url);
                          } else if (alert.mainAction?.modalType === "payment_voucher") {
                            navigate("/app/sales-expenses?tab=payment-vouchers&new=1");
                          } else if (alert.mainAction?.modalType === "booking_invoice") {
                            navigate("/app/sales-expenses?tab=booking-invoice&new=1");
                          } else if (alert.mainAction?.modalType === "expense") {
                            navigate("/app/sales-expenses?tab=expenses&new=1");
                          }
                        }}
                        className="h-7 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 border-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                      >
                        {alert.mainAction.label}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        markAsDone(alert.id);
                        toast.success("Alert marked as completed");
                      }}
                      className="h-7 text-xs text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    >
                      <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                      Mark Done
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
