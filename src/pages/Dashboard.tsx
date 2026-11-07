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
} from "lucide-react";
import { useClients, useExpenses, useVendors, useQueries } from "@/hooks/useStorage";
import { useB2BBookings } from "@/hooks/useB2BBookings";
import { useB2BAgents } from "@/hooks/useB2BAgents";
import { useB2BLedger } from "@/hooks/useB2BLedger";
import { useNotifications } from "@/hooks/useNotifications";
import { useMemo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRealtimeMultiTable } from "@/hooks/useRealtimeTable";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
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

interface DashboardNotificationItem {
  id: string;
  title: string;
  description: string;
  type: "info" | "warning" | "success";
  timestamp: string;
  rawDate: number;
  isRead: boolean;
  link?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

function getRelativeTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "Recently";
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return "Recently";
    const diffMs = Date.now() - d.getTime();
    if (diffMs < 0) return "Upcoming";
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return format(d, "MMM d");
  } catch {
    return "Recently";
  }
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { clients = [], isLoading: loadingClients } = useClients();
  const { expenses = [], isLoading: loadingExpenses } = useExpenses();
  const { vendors = [], isLoading: loadingVendors } = useVendors();
  const { queries = [], isLoading: loadingQueries } = useQueries();
  const { bookings: b2bBookings = [], isLoading: loadingB2BBookings } = useB2BBookings();
  const { agents: b2bAgents = [], isLoading: loadingB2BAgents } = useB2BAgents();
  const { ledgerEntries: b2bLedger = [], isLoading: loadingB2BLedger } = useB2BLedger();
  const {
    notifications = [],
    unreadNotifications = [],
    unreadCount = 0,
    markAsRead,
  } = useNotifications();

  const queryClient = useQueryClient();

  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());

  // Quick Action Modal states
  const [isAddBookingOpen, setIsAddBookingOpen] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isQuickPaymentOpen, setIsQuickPaymentOpen] = useState(false);
  const [quickPaymentTab, setQuickPaymentTab] = useState<'client' | 'vendor'>('client');
  const [selectedClientForPayment, setSelectedClientForPayment] = useState<any>(null);
  const [selectedVendorForPayment, setSelectedVendorForPayment] = useState<any>(null);

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
      queryClient.invalidateQueries({ queryKey: ['b2b_ledger'] }),
      queryClient.invalidateQueries({ queryKey: ['agency_notifications'] }),
    ]);
    toast.success("Dashboard refreshed");
  };

  const { containerRef, isPulling, isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  // Real-time sync for all dashboard-relevant tables
  useRealtimeMultiTable({
    channelPrefix: "dashboard-changes",
    enabled: true,
    subscriptions: [
      { table: "clients", callback: () => queryClient.invalidateQueries({ queryKey: ["clients"] }) },
      { table: "bookings", callback: () => queryClient.invalidateQueries({ queryKey: ["bookings"] }) },
      { table: "expenses", callback: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }) },
      { table: "vendors", callback: () => queryClient.invalidateQueries({ queryKey: ["vendors"] }) },
      { table: "queries", callback: () => queryClient.invalidateQueries({ queryKey: ["queries"] }) },
      { table: "b2b_bookings", callback: () => queryClient.invalidateQueries({ queryKey: ["b2b_bookings"] }) },
      { table: "b2b_agents", callback: () => queryClient.invalidateQueries({ queryKey: ["b2b_agents"] }) },
      { table: "b2b_ledger", callback: () => queryClient.invalidateQueries({ queryKey: ["b2b_ledger"] }) },
    ],
  });

  // Aggregate stats: Strictly B2C + B2B combined
  const totalBookingsCount = clients.length + b2bBookings.length;

  // B2C Pending Payments across all time
  const b2cPendingPayments = useMemo(() => {
    return clients
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
  }, [clients]);

  // B2B Pending Client Receivables across all time
  const b2bPendingReceivables = useMemo(() => {
    if (b2bLedger.length > 0) {
      const agentBalances = new Map<string, number>();
      b2bLedger.forEach((entry: any) => {
        if (!entry.agent_id) return;
        const current = agentBalances.get(entry.agent_id) || 0;
        const amt = Number(entry.amount) || 0;
        if (entry.entry_type === 'debit') {
          agentBalances.set(entry.agent_id, current + amt);
        } else if (entry.entry_type === 'credit') {
          agentBalances.set(entry.agent_id, current - amt);
        }
      });

      let totalPending = 0;
      agentBalances.forEach((balance) => {
        if (balance > 0) {
          totalPending += balance;
        }
      });
      return totalPending;
    }

    // Fallback from B2B bookings if no ledger entries exist
    return b2bBookings
      .filter((b: any) => b.payment_status !== 'paid')
      .reduce((sum: number, b: any) => {
        const selling = Number(b.selling_price) || 0;
        const comm = Number(b.commission_amount) || 0;
        return sum + Math.max(0, selling - comm);
      }, 0);
  }, [b2bLedger, b2bBookings]);

  // Combined Clients Pending Receivables (B2B + B2C)
  const totalClientsPending = b2cPendingPayments + b2bPendingReceivables;

  // Total Vendor Payables across all time
  const vendorPayables = useMemo(() => {
    return vendors.reduce((sum: number, v: any) => {
      const vendorClients = clients.filter((c: any) => c.vendor_id === v.id);
      const fromBookingsTotal = vendorClients.reduce((s: number, c: any) => s + (Number(c.purchasing_price) || 0), 0);
      const vendorDirectAmount = Number(v.payment_amount) || 0;
      const totalPayable = fromBookingsTotal + vendorDirectAmount;
      const paid = Number(v.amount_paid) || 0;
      return sum + Math.max(0, totalPayable - paid);
    }, 0);
  }, [vendors, clients]);

  // Currency Formatter: Rs format matching tabular spec
  const formatCurrency = (val: number) => {
    const num = Number(val) || 0;
    if (num === 0) return "Rs 0";
    if (num >= 1000) {
      return `Rs ${(num / 1000).toFixed(0)}K`;
    }
    return `Rs ${Math.round(num).toLocaleString()}`;
  };

  // Recent notifications list combining database notifications and live operational events
  const recentNotifications = useMemo<DashboardNotificationItem[]>(() => {
    const list: DashboardNotificationItem[] = [];

    // 1. Notifications from database notifications table
    (notifications || []).forEach((notif) => {
      let type: "info" | "warning" | "success" = "info";
      const cat = (notif.category || "").toLowerCase();
      const titleLower = (notif.title || "").toLowerCase();

      if (
        cat.includes("payment") ||
        cat.includes("overdue") ||
        cat.includes("due") ||
        titleLower.includes("pending") ||
        titleLower.includes("alert")
      ) {
        type = "warning";
      } else if (
        cat.includes("booking") ||
        cat.includes("confirm") ||
        cat.includes("voucher") ||
        titleLower.includes("received") ||
        titleLower.includes("confirmed")
      ) {
        type = "success";
      }

      list.push({
        id: notif.id,
        title: notif.title,
        description: notif.message,
        type,
        timestamp: getRelativeTime(notif.created_at),
        rawDate: notif.created_at ? new Date(notif.created_at).getTime() : 0,
        isRead: notif.is_read,
        link: notif.link || undefined,
        action: notif.link
          ? {
              label: "View Details",
              onClick: () => navigate(notif.link!),
            }
          : undefined,
      });
    });

    // 2. High-priority real-time operational notifications
    // A. Pending client payment reminders
    const pendingClients = clients
      .filter((c: any) => {
        const total = Number(c.selling_price) || 0;
        const paid = Number(c.amount_paid) || 0;
        return paid < total;
      })
      .sort((a: any, b: any) => {
        if (a.remaining_payment_date && !b.remaining_payment_date) return -1;
        if (!a.remaining_payment_date && b.remaining_payment_date) return 1;
        const remA = (Number(a.selling_price) || 0) - (Number(a.amount_paid) || 0);
        const remB = (Number(b.selling_price) || 0) - (Number(b.amount_paid) || 0);
        return remB - remA;
      });

    pendingClients.slice(0, 3).forEach((client: any) => {
      const total = Number(client.selling_price) || 0;
      const paid = Number(client.amount_paid) || 0;
      const remaining = total - paid;
      const id = `pending-client-${client.id}`;

      if (!list.some((n) => n.id === id || n.title.includes(client.name))) {
        list.push({
          id,
          title: `Pending Client Payment: ${client.name}`,
          description: `Remaining balance of Rs ${remaining.toLocaleString()} due for booking #${client.pnr || client.destination || String(client.id).slice(0, 6)}`,
          type: "warning",
          timestamp: client.remaining_payment_date ? getRelativeTime(client.remaining_payment_date) : "Action Required",
          rawDate: client.remaining_payment_date ? new Date(client.remaining_payment_date).getTime() : Date.now(),
          isRead: false,
          action: {
            label: "Receive Payment",
            onClick: () => setSelectedClientForPayment(client),
          },
        });
      }
    });

    // B. Vendor payable alerts
    const pendingVendors = vendors
      .map((v: any) => {
        const vendorClients = clients.filter((c: any) => c.vendor_id === v.id);
        const fromBookingsTotal = vendorClients.reduce((s: number, c: any) => s + (Number(c.purchasing_price) || 0), 0);
        const vendorDirectAmount = Number(v.payment_amount) || 0;
        const totalPayable = fromBookingsTotal + vendorDirectAmount;
        const paid = Number(v.amount_paid) || 0;
        const pending = totalPayable - paid;
        return { vendor: v, pending };
      })
      .filter((item) => item.pending > 0)
      .sort((a, b) => b.pending - a.pending);

    pendingVendors.slice(0, 2).forEach(({ vendor, pending }) => {
      const id = `pending-vendor-${vendor.id}`;
      if (!list.some((n) => n.id === id || n.title.includes(vendor.name))) {
        list.push({
          id,
          title: `Vendor Payable Alert: ${vendor.name}`,
          description: `Outstanding payable balance of Rs ${pending.toLocaleString()} on supplier ledger`,
          type: "warning",
          timestamp: "Due Soon",
          rawDate: Date.now() - 3600000,
          isRead: false,
          action: {
            label: "Pay Vendor",
            onClick: () => {
              setQuickPaymentTab('vendor');
              setSelectedVendorForPayment(vendor);
              setIsQuickPaymentOpen(true);
            },
          },
        });
      }
    });

    // C. Recent booking confirmations
    const recentBookings = [...clients].sort((a: any, b: any) => {
      const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tB - tA;
    });

    recentBookings.slice(0, 2).forEach((booking: any) => {
      const id = `recent-booking-${booking.id}`;
      if (!list.some((n) => n.id === id || n.title.includes(booking.name))) {
        list.push({
          id,
          title: `New Booking Confirmed: ${booking.name}`,
          description: `${booking.travel_type || 'Ticket'} booking to ${booking.destination || 'Destination'} (PNR: ${booking.pnr || 'N/A'}) confirmed`,
          type: "success",
          timestamp: getRelativeTime(booking.created_at),
          rawDate: booking.created_at ? new Date(booking.created_at).getTime() : 0,
          isRead: true,
          action: {
            label: "View Booking",
            onClick: () => navigate("/app/bookings?tab=clients"),
          },
        });
      }
    });

    // D. B2B updates
    const recentB2B = [...b2bBookings].sort((a: any, b: any) => {
      const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tB - tA;
    });

    recentB2B.slice(0, 2).forEach((b2b: any) => {
      const id = `b2b-update-${b2b.id}`;
      if (!list.some((n) => n.id === id || n.title.includes(b2b.passenger_name))) {
        list.push({
          id,
          title: `B2B Booking Update: ${b2b.passenger_name}`,
          description: `Partner agency booking to ${b2b.destination || 'Destination'} (PNR: ${b2b.pnr || 'N/A'}) registered`,
          type: "info",
          timestamp: getRelativeTime(b2b.created_at),
          rawDate: b2b.created_at ? new Date(b2b.created_at).getTime() : 0,
          isRead: true,
          action: {
            label: "View B2B",
            onClick: () => navigate("/app/bookings?tab=b2b-agents"),
          },
        });
      }
    });

    // Sort by rawDate descending
    list.sort((a, b) => b.rawDate - a.rawDate);

    return list.slice(0, 10);
  }, [notifications, clients, vendors, b2bBookings, navigate]);

  const unreadCountBadge = useMemo(() => {
    if (unreadCount > 0) return unreadCount;
    return recentNotifications.filter((n) => !n.isRead).length;
  }, [unreadCount, recentNotifications]);

  const isLoading =
    loadingClients ||
    loadingExpenses ||
    loadingVendors ||
    loadingQueries ||
    loadingB2BBookings ||
    loadingB2BAgents ||
    loadingB2BLedger;

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
              Welcome back! Here's your agency performance & daily operations overview
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

        {/* 2. TOP KPI METRIC CARDS (3-Column Row Placed Immediately Below Header) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: TOTAL BOOKINGS */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm p-6 flex items-center justify-between transition-all duration-200 hover:shadow-md">
            <div>
              <p className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                TOTAL BOOKINGS
              </p>
              <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums mt-2">
                {totalBookingsCount.toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Calendar className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2: CLIENTS PENDING PAYMENT */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm p-6 flex items-center justify-between transition-all duration-200 hover:shadow-md">
            <div>
              <p className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                CLIENTS PENDING PAYMENT
              </p>
              <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums mt-2">
                {formatCurrency(totalClientsPending)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Wallet className="w-6 h-6" />
            </div>
          </div>

          {/* Card 3: VENDORS PENDING PAYMENT */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm p-6 flex items-center justify-between transition-all duration-200 hover:shadow-md">
            <div>
              <p className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                VENDORS PENDING PAYMENT
              </p>
              <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums mt-2">
                {formatCurrency(vendorPayables)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 flex items-center justify-center shrink-0">
              <Banknote className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* 3. QUICK ACTION BUTTONS (3 + 3 Grid: Premium Shape, Gradient Icon Badges, Distinct Accents) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Action 1: Create Booking - Blue Accent */}
          <button
            type="button"
            onClick={() => navigate("/app/bookings?tab=clients&action=new", { state: { openAddClient: true } })}
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
            onClick={() => navigate("/app/accounts?tab=bank-cash&action=new-entry", { state: { openAddEntry: true } })}
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
            onClick={() => navigate("/app/leads-quotes/quotations/new")}
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
            onClick={() => navigate("/app/leads-quotes/queries/new")}
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
            onClick={() => navigate("/app/accounts?tab=expenses&action=new", { state: { openAddExpense: true } })}
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

        {/* 4. NOTIFICATIONS CENTER (Full-Width Premium Card Below Quick Action Buttons) */}
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
                {unreadCountBadge > 0 && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800">
                    {unreadCountBadge} new
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

          {/* Notification List Body */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[380px] overflow-y-auto">
            {recentNotifications.length === 0 ? (
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
              recentNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => {
                    if (notif.action) {
                      notif.action.onClick();
                    } else if (notif.link) {
                      navigate(notif.link);
                    }
                    if (!notif.isRead && markAsRead) {
                      markAsRead.mutate(notif.id);
                    }
                  }}
                  className="px-6 py-4 flex items-start justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="shrink-0 mt-0.5">
                      {notif.type === "warning" ? (
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 flex items-center justify-center">
                          <AlertCircle className="w-4 h-4" />
                        </div>
                      ) : notif.type === "success" ? (
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 flex items-center justify-center">
                          <Info className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                        {notif.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                        {notif.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                      {notif.timestamp}
                    </span>
                    {notif.action && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          notif.action!.onClick();
                        }}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 inline-flex items-center gap-1 transition-colors"
                      >
                        <span>{notif.action.label}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Dynamic Action Modals (Preserved Without Breaking Existing Workflows) */}
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
