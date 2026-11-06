import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Banknote,
  Plane,
  TrendingUp,
  RefreshCw,
  Building2,
  Wallet,
  FileText,
  UserPlus,
  Receipt,
  AlertCircle,
  ArrowRight,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TopVendorsWidget } from "@/components/TopVendorsWidget";
import { useClients, useBookings, useExpenses, useVendors, useQueries } from "@/hooks/useStorage";
import { useB2BBookings } from "@/hooks/useB2BBookings";
import { useB2BAgents } from "@/hooks/useB2BAgents";
import { useActionableAlerts } from "@/hooks/useActionableAlerts";
import { useMemo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { format, startOfDay, startOfMonth, endOfMonth } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { toast } from "sonner";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { DashboardSkeleton } from "@/components/SkeletonLoaders";

// Dynamic dialogs for frictionless dashboard workflows
import { AddClientDialog } from "@/components/AddClientDialog";
import { AddExpenseDialog } from "@/components/AddExpenseDialog";
import { QuickPaymentDialog } from "@/components/QuickPaymentDialog";
import { ClientPaymentDialog } from "@/components/ClientPaymentDialog";
import { VendorPaymentDialog } from "@/components/VendorPaymentDialog";

export default function Dashboard() {
  const navigate = useNavigate();
  const { clients = [], isLoading: loadingClients } = useClients();
  const { bookings = [], isLoading: loadingBookings } = useBookings();
  const { expenses = [], isLoading: loadingExpenses } = useExpenses();
  const { vendors = [], isLoading: loadingVendors } = useVendors();
  const { queries = [], isLoading: loadingQueries } = useQueries();
  const { bookings: b2bBookings = [], isLoading: loadingB2BBookings } = useB2BBookings();
  const { agents: b2bAgents = [], isLoading: loadingB2BAgents } = useB2BAgents();
  const queryClient = useQueryClient();

  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());

  // Quick Action Modal states
  const [isAddBookingOpen, setIsAddBookingOpen] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isQuickPaymentOpen, setIsQuickPaymentOpen] = useState(false);
  const [quickPaymentTab, setQuickPaymentTab] = useState<'client' | 'vendor'>('client');
  const [selectedClientForPayment, setSelectedClientForPayment] = useState<any>(null);
  const [selectedVendorForPayment, setSelectedVendorForPayment] = useState<any>(null);

  // Centralized actionable alerts for slim banner & top navbar bell
  const { urgentCount, summaryText } = useActionableAlerts();

  // Pull-to-refresh functionality
  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['clients'] }),
      queryClient.invalidateQueries({ queryKey: ['bookings'] }),
      queryClient.invalidateQueries({ queryKey: ['expenses'] }),
      queryClient.invalidateQueries({ queryKey: ['vendors'] }),
      queryClient.invalidateQueries({ queryKey: ['queries'] }),
      queryClient.invalidateQueries({ queryKey: ['b2b_bookings'] }),
      queryClient.invalidateQueries({ queryKey: ['b2b_agents'] }),
    ]);
    toast.success("Dashboard refreshed");
  };

  const { containerRef, isPulling, isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  // Real-time sync
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        queryClient.invalidateQueries({ queryKey: ['clients'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        queryClient.invalidateQueries({ queryKey: ['bookings'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
        queryClient.invalidateQueries({ queryKey: ['expenses'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendors' }, () => {
        queryClient.invalidateQueries({ queryKey: ['vendors'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queries' }, () => {
        queryClient.invalidateQueries({ queryKey: ['queries'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'b2b_bookings' }, () => {
        queryClient.invalidateQueries({ queryKey: ['b2b_bookings'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'b2b_agents' }, () => {
        queryClient.invalidateQueries({ queryKey: ['b2b_agents'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Aggregate stats: B2C + B2B combined by default
  const stats = useMemo(() => {
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);

    // B2C Pending Payments across all time
    const b2cPendingPayments = clients
      .filter((c: any) => {
        const total = Number(c.selling_price) || 0;
        const paid = Number(c.amount_paid) || 0;
        return paid < total;
      })
      .reduce((sum: number, c: any) => {
        const total = Number(c.selling_price) || 0;
        const paid = Number(c.amount_paid) || 0;
        return sum + (total - paid);
      }, 0);

    // Monthly bookings - clients with flight_date in selected month
    const monthlyClients = clients.filter((c: any) => {
      if (!c.flight_date) return false;
      const flightDate = new Date(c.flight_date);
      return flightDate >= monthStart && flightDate <= monthEnd;
    });

    const b2cMonthlyBookings = monthlyClients.length;

    // Monthly revenue
    const b2cMonthlyRevenue = monthlyClients.reduce((sum: number, c: any) => {
      return sum + (Number(c.amount_paid) || 0);
    }, 0);

    // Monthly vendor costs
    const b2cMonthlyVendorCosts = monthlyClients.reduce((sum: number, c: any) => {
      return sum + (Number(c.purchasing_price) || 0);
    }, 0);

    // Monthly operating expenses
    const monthlyExpenses = expenses
      .filter((e: any) => {
        const date = new Date(e.expense_date);
        return date >= monthStart && date <= monthEnd;
      })
      .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);

    // Total vendor payables across all time
    const vendorPayables = vendors.reduce((sum: number, v: any) => {
      const vendorClients = clients.filter((c: any) => c.vendor_id === v.id);
      const fromBookingsTotal = vendorClients.reduce((s: number, c: any) => s + (Number(c.purchasing_price) || 0), 0);
      const vendorDirectAmount = Number(v.payment_amount) || 0;
      const totalPayable = fromBookingsTotal + vendorDirectAmount;
      const paid = Number(v.amount_paid) || 0;
      return sum + (totalPayable - paid);
    }, 0);

    // B2B Stats for current month
    const b2bMonthlyBookings = b2bBookings.filter((b: any) => {
      if (!b.created_at) return false;
      const bookingDate = new Date(b.created_at);
      return bookingDate >= monthStart && bookingDate <= monthEnd;
    });

    const b2bBookingsCount = b2bMonthlyBookings.length;
    const b2bTotalSales = b2bMonthlyBookings.reduce((sum: number, b: any) => sum + (Number(b.selling_price) || 0), 0);
    const b2bTotalProfit = b2bMonthlyBookings.reduce((sum: number, b: any) => sum + (Number(b.profit) || 0), 0);
    const b2bVendorCosts = b2bMonthlyBookings.reduce((sum: number, b: any) => sum + (Number(b.purchasing_price) || 0), 0);

    // Combined stats: Aggregated B2C + B2B by default
    const combinedBookings = b2cMonthlyBookings + b2bBookingsCount;
    const combinedRevenue = b2cMonthlyRevenue + b2bTotalSales;
    const combinedVendorCosts = b2cMonthlyVendorCosts + b2bVendorCosts;
    const combinedProfit = (b2cMonthlyRevenue - b2cMonthlyVendorCosts - monthlyExpenses) + b2bTotalProfit;

    const monthlyProfit = combinedProfit;
    const profitMargin = combinedRevenue > 0 ? ((monthlyProfit / combinedRevenue) * 100).toFixed(1) : '0.0';

    return {
      totalBookingsCount: clients.length + b2bBookings.length,
      pendingPayments: b2cPendingPayments,
      vendorPayables,
      monthlyBookings: combinedBookings,
      monthlyRevenue: combinedRevenue,
      monthlyVendorCosts: combinedVendorCosts,
      monthlyExpenses,
      monthlyProfit,
      profitMargin,
      pendingPaymentCount: clients.filter((c: any) => {
        const total = Number(c.selling_price) || 0;
        const paid = Number(c.amount_paid) || 0;
        return paid < total;
      }).length,
      // B2B breakdown
      b2bBookingsCount,
      b2bTotalSales,
      b2bTotalProfit,
      b2bAgentsCount: b2bAgents.length,
    };
  }, [clients, bookings, expenses, vendors, selectedMonth, b2bBookings, b2bAgents]);

  // Clients with remaining payments due today
  const clientsWithPaymentDueToday = useMemo(() => {
    const today = startOfDay(new Date());

    return clients
      .filter((c: any) => {
        const total = Number(c.selling_price) || 0;
        const paid = Number(c.amount_paid) || 0;
        const hasRemainingPayment = paid < total;

        if (!c.remaining_payment_date || !hasRemainingPayment) return false;

        const paymentDate = startOfDay(new Date(c.remaining_payment_date));
        return paymentDate.getTime() === today.getTime();
      })
      .sort((a: any, b: any) => {
        const remainingA = (Number(a.selling_price) || 0) - (Number(a.amount_paid) || 0);
        const remainingB = (Number(b.selling_price) || 0) - (Number(b.amount_paid) || 0);
        return remainingB - remainingA;
      });
  }, [clients]);

  const isLoading =
    loadingClients ||
    loadingBookings ||
    loadingExpenses ||
    loadingVendors ||
    loadingQueries ||
    loadingB2BBookings ||
    loadingB2BAgents;

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

      <div className="space-y-3 sm:space-y-4 animate-fade-in max-w-7xl mx-auto">
        {/* 1. HEADER: Clean, streamlined without B2B toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground font-heading tracking-tight">
              Dashboard
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
              Welcome back! Here's your agency performance & daily operations overview
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 font-medium shadow-2xs">
                  <Calendar className="w-4 h-4 mr-2 text-primary" />
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

            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
              title="Refresh Dashboard"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* 2. QUICK ACTIONS BAR: High-priority daily workflow triggers */}
        <div className="bg-card/90 backdrop-blur-xs border border-border/70 rounded-xl p-2 sm:p-2.5 shadow-xs">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 w-full">
            {/* Action 1: + Create Booking */}
            <Button
              onClick={() => setIsAddBookingOpen(true)}
              className="col-span-2 sm:col-span-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs gap-2 h-9 sm:h-10 text-xs sm:text-sm active:scale-98 transition-all"
            >
              <Plane className="w-4 h-4 shrink-0" />
              <span>+ Create Booking</span>
            </Button>

            {/* Action 2: + Add Payment */}
            <Button
              variant="outline"
              onClick={() => {
                setQuickPaymentTab('client');
                setIsQuickPaymentOpen(true);
              }}
              className="bg-background hover:bg-muted/80 border-border/80 font-medium gap-2 h-9 sm:h-10 text-xs sm:text-sm active:scale-98 transition-all"
            >
              <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>+ Add Payment</span>
            </Button>

            {/* Action 3: + Add Quotation */}
            <Button
              variant="outline"
              onClick={() => navigate("/app/leads-quotes/quotations/new")}
              className="bg-background hover:bg-muted/80 border-border/80 font-medium gap-2 h-9 sm:h-10 text-xs sm:text-sm active:scale-98 transition-all"
            >
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>+ Add Quotation</span>
            </Button>

            {/* Action 4: + New Client Query */}
            <Button
              variant="outline"
              onClick={() => navigate("/app/leads-quotes/queries/new")}
              className="bg-background hover:bg-muted/80 border-border/80 font-medium gap-2 h-9 sm:h-10 text-xs sm:text-sm active:scale-98 transition-all"
            >
              <UserPlus className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
              <span>+ New Client Query</span>
            </Button>

            {/* Action 5: + Add Expense / Vendor Bill */}
            <Button
              variant="outline"
              onClick={() => setIsAddExpenseOpen(true)}
              className="col-span-2 sm:col-span-1 lg:col-span-1 bg-background hover:bg-muted/80 border-border/80 font-medium gap-2 h-9 sm:h-10 text-xs sm:text-sm active:scale-98 transition-all"
            >
              <Receipt className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>+ Add Expense / Bill</span>
            </Button>
          </div>
        </div>

        {/* 4. CONDITIONAL "TODAY'S ACTIONABLE ALERTS" SLIM BANNER */}
        {/* Hidden completely if urgentCount === 0 */}
        {urgentCount > 0 && (
          <div className="flex items-center justify-between gap-3 px-3.5 py-2 sm:py-2.5 rounded-xl border border-amber-300/70 dark:border-amber-700/60 bg-amber-50/80 dark:bg-amber-950/30 text-foreground shadow-xs animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-wrap sm:flex-nowrap">
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 shrink-0">
                  Today's Actionable Alerts:
                </span>
                <span className="text-xs sm:text-sm font-medium text-foreground/90 truncate">
                  {summaryText}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/app/notifications")}
              className="h-7 px-2.5 text-xs font-semibold text-amber-900 dark:text-amber-200 hover:bg-amber-500/20 shrink-0 gap-1"
            >
              <span>View Details</span>
              <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
        )}

        {/* 5. ROW 1: PRIMARY FINANCIAL & BOOKINGS KPI CARDS (4 Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <StatCard
            title="Total Bookings (B2C + B2B)"
            value={stats.totalBookingsCount}
            icon={Calendar}
            variant="accent"
          />
          <StatCard
            title="Clients Pending Payment"
            value={`₨ ${(stats.pendingPayments / 1000).toFixed(0)}K`}
            icon={Banknote}
            variant="warning"
          />
          <StatCard
            title="Vendors Pending Payment"
            value={`₨ ${(stats.vendorPayables / 1000).toFixed(0)}K`}
            icon={Banknote}
            variant="warning"
          />
          <StatCard
            title={`Net Profit (${format(selectedMonth, 'MMM')})`}
            value={`₨ ${(stats.monthlyProfit / 1000).toFixed(0)}K`}
            icon={TrendingUp}
            variant={stats.monthlyProfit >= 0 ? "success" : "warning"}
          />
        </div>

        {/* 5. ROW 2: B2B SUMMARY (Compact Horizontal Strip) */}
        <Card className="border-purple-200/80 dark:border-purple-800/60 bg-gradient-to-r from-purple-50/60 via-purple-50/30 to-blue-50/40 dark:from-purple-950/20 dark:via-purple-950/10 dark:to-blue-950/20 shadow-xs">
          <div className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2.5 border-b border-purple-100 dark:border-purple-900/50">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <h3 className="text-sm font-bold text-foreground">
                  B2B Summary ({format(selectedMonth, 'MMMM yyyy')})
                </h3>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Wholesale agency & partner ledger breakdown
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-2.5">
              <div>
                <p className="text-[11px] sm:text-xs text-muted-foreground font-medium">B2B Agents</p>
                <p className="text-base sm:text-lg font-bold text-purple-600 dark:text-purple-400">
                  {stats.b2bAgentsCount}
                </p>
              </div>
              <div>
                <p className="text-[11px] sm:text-xs text-muted-foreground font-medium">B2B Bookings</p>
                <p className="text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400">
                  {stats.b2bBookingsCount}
                </p>
              </div>
              <div>
                <p className="text-[11px] sm:text-xs text-muted-foreground font-medium">B2B Sales</p>
                <p className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  ₨ {(stats.b2bTotalSales / 1000).toFixed(0)}K
                </p>
              </div>
              <div>
                <p className="text-[11px] sm:text-xs text-muted-foreground font-medium">B2B Profit</p>
                <p className="text-base sm:text-lg font-bold text-amber-600 dark:text-amber-400">
                  ₨ {(stats.b2bTotalProfit / 1000).toFixed(0)}K
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* 5. ROW 3: FINANCIALS & PAYABLES (Clean 3-Column Grid Above The Fold) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 items-stretch">
          {/* Card 1: Monthly Financial Summary */}
          <Card className="h-full flex flex-col justify-between">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-accent" />
                {format(selectedMonth, 'MMMM yyyy')} Financial Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5 flex-1 flex flex-col justify-between">
              <div className="space-y-2.5">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Total Bookings</span>
                  <span className="font-semibold">{stats.monthlyBookings}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Revenue Collected</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    ₨ {(stats.monthlyRevenue / 1000).toFixed(0)}K
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Vendor Service Costs</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    ₨ {(stats.monthlyVendorCosts / 1000).toFixed(0)}K
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Operating Expenses</span>
                  <span className="font-semibold text-destructive">
                    ₨ {(stats.monthlyExpenses / 1000).toFixed(0)}K
                  </span>
                </div>
              </div>
              <div className="pt-2.5 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold">Net Profit</span>
                  <span
                    className={`font-bold text-lg ${
                      stats.monthlyProfit >= 0 ? 'text-primary' : 'text-destructive'
                    }`}
                  >
                    ₨ {(stats.monthlyProfit / 1000).toFixed(0)}K
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Profit Margin: {stats.profitMargin}%
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Client Today Remaining Alert */}
          <Card className="h-full flex flex-col justify-between">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Banknote className="w-5 h-5 text-destructive" />
                  Client Today Remaining Alert
                </CardTitle>
                {clientsWithPaymentDueToday.length > 0 && (
                  <Badge variant="destructive" className="text-xs h-5 px-1.5 font-bold">
                    {clientsWithPaymentDueToday.length} Due
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between">
              {clientsWithPaymentDueToday.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                  <Banknote className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm font-medium">No pending payments due today</p>
                  <p className="text-xs mt-1 text-muted-foreground/80">All scheduled collections are up to date</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 text-xs gap-1.5 h-8 border-dashed"
                    onClick={() => {
                      setQuickPaymentTab('client');
                      setIsQuickPaymentOpen(true);
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + Receive Payment
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                  {clientsWithPaymentDueToday.map((client: any) => {
                    const total = Number(client.selling_price) || 0;
                    const paid = Number(client.amount_paid) || 0;
                    const remaining = total - paid;

                    return (
                      <div
                        key={client.id}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{client.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Amount Due: ₨ {remaining.toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <p className="font-bold text-destructive text-sm">
                              ₨ {remaining.toFixed(0)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">Due Today</p>
                          </div>
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2"
                            onClick={() => setSelectedClientForPayment(client)}
                          >
                            Receive
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 3: Top Vendor Payables */}
          <TopVendorsWidget
            onPayVendor={() => {
              setQuickPaymentTab('vendor');
              setIsQuickPaymentOpen(true);
            }}
          />
        </div>
      </div>

      {/* Dynamic Action Modals */}
      <AddClientDialog
        open={isAddBookingOpen}
        onOpenChange={setIsAddBookingOpen}
      />

      <AddExpenseDialog
        open={isAddExpenseOpen}
        onOpenChange={setIsAddExpenseOpen}
      />

      <QuickPaymentDialog
        open={isQuickPaymentOpen}
        onOpenChange={setIsQuickPaymentOpen}
        defaultTab={quickPaymentTab}
        onSelectClient={(client) => setSelectedClientForPayment(client)}
        onSelectVendor={(vendor) => setSelectedVendorForPayment(vendor)}
      />

      {selectedClientForPayment && (
        <ClientPaymentDialog
          client={selectedClientForPayment}
          open={!!selectedClientForPayment}
          onOpenChange={(open) => !open && setSelectedClientForPayment(null)}
        />
      )}

      {selectedVendorForPayment && (
        <VendorPaymentDialog
          vendor={selectedVendorForPayment}
          open={!!selectedVendorForPayment}
          onOpenChange={(open) => !open && setSelectedVendorForPayment(null)}
        />
      )}
    </div>
  );
}
