import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NameUpdateReminder } from "@/components/NameUpdateReminder";
import {
  Users,
  Calendar,
  Banknote,
  Plane,
  TrendingUp,
  MessageCircle,
  RefreshCw,
  Building2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TopVendorsWidget } from "@/components/TopVendorsWidget";
import { useClients, useBookings, useExpenses, useVendors, useQueries } from "@/hooks/useStorage";
import { useB2BBookings } from "@/hooks/useB2BBookings";
import { useB2BAgents } from "@/hooks/useB2BAgents";
import { useMemo, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { format, isAfter, isBefore, startOfDay, addDays, startOfMonth, endOfMonth } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

import { EmailReminderButton } from "@/components/EmailReminderButton";
import { useAgency } from "@/hooks/useAgency";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { DashboardSkeleton } from "@/components/SkeletonLoaders";

export default function Dashboard() {
  const { clients = [], isLoading: loadingClients } = useClients();
  const { bookings = [], isLoading: loadingBookings } = useBookings();
  const { expenses = [], isLoading: loadingExpenses } = useExpenses();
  const { vendors = [], isLoading: loadingVendors } = useVendors();
  const { queries = [], isLoading: loadingQueries } = useQueries();
  const { bookings: b2bBookings = [], isLoading: loadingB2BBookings } = useB2BBookings();
  const { agents: b2bAgents = [], isLoading: loadingB2BAgents } = useB2BAgents();
  const queryClient = useQueryClient();
  const { data: agency } = useAgency();
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [includeB2B, setIncludeB2B] = useState(true);

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

  // Calculate stats from real data
  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);

    // B2C Stats
    // Total pending payments from clients (across all time)
    const b2cPendingPayments = clients
      .filter(c => {
        const total = Number(c.selling_price) || 0;
        const paid = Number(c.amount_paid) || 0;
        return paid < total;
      })
      .reduce((sum, c) => {
        const total = Number(c.selling_price) || 0;
        const paid = Number(c.amount_paid) || 0;
        return sum + (total - paid);
      }, 0);

    // Monthly bookings - clients with flight_date in selected month
    const monthlyClients = clients.filter(c => {
      if (!c.flight_date) return false;
      const flightDate = new Date(c.flight_date);
      return flightDate >= monthStart && flightDate <= monthEnd;
    });

    const b2cMonthlyBookings = monthlyClients.length;

    // Monthly revenue - amount paid by clients with flights in selected month
    const b2cMonthlyRevenue = monthlyClients.reduce((sum, c) => {
      return sum + (Number(c.amount_paid) || 0);
    }, 0);

    // Monthly vendor costs - purchasing price of clients with flights in selected month
    const b2cMonthlyVendorCosts = monthlyClients.reduce((sum, c) => {
      return sum + (Number(c.purchasing_price) || 0);
    }, 0);

    // Monthly operating expenses
    const monthlyExpenses = expenses
      .filter(e => {
        const date = new Date(e.expense_date);
        return date >= monthStart && date <= monthEnd;
      })
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    // Total vendor payables - what we owe to ALL vendors (across all time)
    const vendorPayables = vendors.reduce((sum, v) => {
      const vendorClients = clients.filter(c => c.vendor_id === v.id);
      const fromBookingsTotal = vendorClients.reduce((s, c) => s + (Number(c.purchasing_price) || 0), 0);
      const vendorDirectAmount = Number(v.payment_amount) || 0;
      const totalPayable = fromBookingsTotal + vendorDirectAmount;
      const paid = Number(v.amount_paid) || 0;
      return sum + (totalPayable - paid);
    }, 0);

    // Total vendor expenses (across all time)
    const totalVendorExpenses = vendors.reduce((sum, v) => {
      const vendorClients = clients.filter(c => c.vendor_id === v.id);
      const fromBookings = vendorClients.reduce((s, c) => s + (Number(c.purchasing_price) || 0), 0);
      return sum + fromBookings + (Number(v.payment_amount) || 0);
    }, 0);

    // B2B Stats
    const b2bMonthlyBookings = b2bBookings.filter(b => {
      if (!b.created_at) return false;
      const bookingDate = new Date(b.created_at);
      return bookingDate >= monthStart && bookingDate <= monthEnd;
    });

    const b2bBookingsCount = b2bMonthlyBookings.length;
    const b2bTotalSales = b2bMonthlyBookings.reduce((sum, b) => sum + (Number(b.selling_price) || 0), 0);
    const b2bTotalCommission = b2bMonthlyBookings.reduce((sum, b) => sum + (Number(b.commission_amount) || 0), 0);
    const b2bTotalProfit = b2bMonthlyBookings.reduce((sum, b) => sum + (Number(b.profit) || 0), 0);
    const b2bVendorCosts = b2bMonthlyBookings.reduce((sum, b) => sum + (Number(b.purchasing_price) || 0), 0);

    // Combined stats (when B2B toggle is on)
    const combinedBookings = b2cMonthlyBookings + (includeB2B ? b2bBookingsCount : 0);
    const combinedRevenue = b2cMonthlyRevenue + (includeB2B ? b2bTotalSales : 0);
    const combinedVendorCosts = b2cMonthlyVendorCosts + (includeB2B ? b2bVendorCosts : 0);
    const combinedProfit = (b2cMonthlyRevenue - b2cMonthlyVendorCosts - monthlyExpenses) + (includeB2B ? b2bTotalProfit : 0);

    // Total pending (B2C only as B2B has separate ledger tracking)
    const pendingPayments = b2cPendingPayments;

    // Monthly profit = Revenue - Vendor Costs - Operating Expenses
    const monthlyProfit = combinedProfit;
    const profitMargin = combinedRevenue > 0 ? ((monthlyProfit / combinedRevenue) * 100).toFixed(1) : '0.0';

    return {
      totalClients: clients.length + (includeB2B ? b2bAgents.length : 0),
      totalBookings: bookings.length + (includeB2B ? b2bBookings.length : 0),
      totalVendors: vendors.length,
      pendingPayments,
      vendorPayables,
      monthlyBookings: combinedBookings,
      monthlyRevenue: combinedRevenue,
      monthlyVendorCosts: combinedVendorCosts,
      monthlyExpenses,
      totalVendorExpenses,
      monthlyProfit,
      profitMargin,
      pendingPaymentCount: clients.filter(c => {
        const total = Number(c.selling_price) || 0;
        const paid = Number(c.amount_paid) || 0;
        return paid < total;
      }).length,
      // B2B specific stats for display
      b2bBookingsCount,
      b2bTotalSales,
      b2bTotalCommission,
      b2bTotalProfit,
      b2bAgentsCount: b2bAgents.length,
    };
  }, [clients, bookings, expenses, vendors, selectedMonth, b2bBookings, b2bAgents, includeB2B]);

  // Get upcoming flights separated by service type (B2C + B2B combined when toggle is on)
  const upcomingFlights = useMemo(() => {
    const today = startOfDay(new Date());
    const tomorrow = addDays(today, 1);
    const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
    
    // On Saturday (6), also show Monday (add 2 days to get to Monday)
    const lastDay = dayOfWeek === 6 ? addDays(today, 2) : tomorrow;

    // B2C upcoming flights
    const b2cUpcoming = clients
      .filter(c => {
        if (!c.flight_date) return false;
        const flightDate = startOfDay(new Date(c.flight_date));
        const flightTime = flightDate.getTime();
        const todayTime = today.getTime();
        const lastDayTime = lastDay.getTime();
        
        return flightTime >= todayTime && flightTime <= lastDayTime;
      })
      .map(client => {
        const flightDate = startOfDay(new Date(client.flight_date));
        const isToday = flightDate.getTime() === today.getTime();
        const isTomorrow = flightDate.getTime() === tomorrow.getTime();
        
        let dateLabel = format(flightDate, 'MMM d');
        if (isToday) dateLabel = 'Today';
        else if (isTomorrow) dateLabel = 'Tomorrow';

        return {
          id: client.id,
          name: client.name,
          destination: client.destination || 'N/A',
          date: dateLabel,
          fullDate: flightDate,
          flightDateFormatted: format(flightDate, 'MMM d, yyyy'),
          pnr: client.pnr || 'N/A',
          serviceType: client.travel_type || 'Ticket',
          passport: client.passport_number,
          contactNumber: client.contact_number,
          email: client.email,
          flight_date: client.flight_date,
          selling_price: client.selling_price,
          amount_paid: client.amount_paid,
          remaining_payment_date: client.remaining_payment_date,
          source: 'b2c' as const,
        };
      });

    // B2B upcoming flights (only when toggle is on)
    const b2bUpcoming = includeB2B ? b2bBookings
      .filter(b => {
        if (!b.flight_date) return false;
        const flightDate = startOfDay(new Date(b.flight_date));
        const flightTime = flightDate.getTime();
        const todayTime = today.getTime();
        const lastDayTime = lastDay.getTime();
        
        return flightTime >= todayTime && flightTime <= lastDayTime;
      })
      .map(booking => {
        const flightDate = startOfDay(new Date(booking.flight_date!));
        const isToday = flightDate.getTime() === today.getTime();
        const isTomorrow = flightDate.getTime() === tomorrow.getTime();
        
        let dateLabel = format(flightDate, 'MMM d');
        if (isToday) dateLabel = 'Today';
        else if (isTomorrow) dateLabel = 'Tomorrow';

        // Parse service type from notes if available
        let serviceType = 'Ticket';
        try {
          if (booking.notes && booking.notes.startsWith('{')) {
            const parsed = JSON.parse(booking.notes.split('\n')[0]);
            if (parsed.type === 'umrah_package') {
              serviceType = 'Umrah';
            } else if (parsed.type === 'return_flight') {
              serviceType = 'Ticket';
            }
          }
        } catch (e) {
          // Notes are not JSON, use default
        }

        // Get agent name
        const agent = b2bAgents.find(a => a.id === booking.agent_id);

        return {
          id: booking.id,
          name: `${booking.passenger_name} (B2B: ${agent?.agent_name || 'Unknown'})`,
          destination: booking.destination || 'N/A',
          date: dateLabel,
          fullDate: flightDate,
          flightDateFormatted: format(flightDate, 'MMM d, yyyy'),
          pnr: booking.pnr || 'N/A',
          serviceType,
          passport: booking.passenger_passport,
          contactNumber: booking.passenger_contact,
          email: null,
          flight_date: booking.flight_date,
          selling_price: booking.selling_price,
          amount_paid: 0, // B2B tracks via ledger
          remaining_payment_date: null,
          source: 'b2b' as const,
        };
      }) : [];

    // Combine and sort
    const allUpcoming = [...b2cUpcoming, ...b2bUpcoming]
      .sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime());

    return {
      tickets: allUpcoming.filter(f => f.serviceType?.toLowerCase() === 'ticket'),
      umrah: allUpcoming.filter(f => f.serviceType?.toLowerCase() === 'umrah'),
      other: allUpcoming.filter(f => f.serviceType?.toLowerCase() !== 'ticket' && f.serviceType?.toLowerCase() !== 'umrah'),
    };
  }, [clients, b2bBookings, b2bAgents, includeB2B]);

  // Get clients with remaining payments due today
  const clientsWithPaymentDueToday = useMemo(() => {
    const today = startOfDay(new Date());
    
    return clients
      .filter(c => {
        // Check if client has remaining payment
        const total = Number(c.selling_price) || 0;
        const paid = Number(c.amount_paid) || 0;
        const hasRemainingPayment = paid < total;
        
        // Check if payment is due today
        if (!c.remaining_payment_date || !hasRemainingPayment) return false;
        
        const paymentDate = startOfDay(new Date(c.remaining_payment_date));
        return paymentDate.getTime() === today.getTime();
      })
      .sort((a, b) => {
        // Sort by remaining amount (highest first)
        const remainingA = (Number(a.selling_price) || 0) - (Number(a.amount_paid) || 0);
        const remainingB = (Number(b.selling_price) || 0) - (Number(b.amount_paid) || 0);
        return remainingB - remainingA;
      });
  }, [clients]);

  // Get pending and in-progress queries
  const activeQueries = useMemo(() => {
    return queries
      .filter(q => q.status === 'pending' || q.status === 'in-progress')
      .sort((a, b) => {
        // Sort by priority (high > medium > low) then by created_at (newest first)
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const priorityDiff = (priorityOrder[a.priority as keyof typeof priorityOrder] || 2) - 
                            (priorityOrder[b.priority as keyof typeof priorityOrder] || 2);
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [queries]);

  const isLoading = loadingClients || loadingBookings || loadingExpenses || loadingVendors || loadingQueries || loadingB2BBookings || loadingB2BAgents;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div ref={containerRef} className="relative h-full overflow-auto">
      {/* Pull-to-refresh indicator */}
      <div 
        className="absolute top-0 left-0 right-0 flex items-center justify-center transition-all duration-200 ease-out"
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

      <div className="space-y-2 sm:space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground font-heading">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Welcome back! Here's your agency overview
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* B2B Toggle */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg border">
            <Switch
              id="b2b-toggle"
              checked={includeB2B}
              onCheckedChange={setIncludeB2B}
            />
            <Label htmlFor="b2b-toggle" className="text-sm font-medium cursor-pointer flex items-center gap-1.5">
              <Building2 className="w-4 h-4" />
              Include B2B
            </Label>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Calendar className="w-4 h-4 mr-2" />
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

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 sm:gap-3">
        <StatCard
          title={includeB2B ? "Total Bookings (B2C + B2B)" : "Client Bookings"}
          value={stats.totalClients}
          icon={Calendar}
          variant="accent"
        />
        <StatCard
          title="Clients Pending Payment"
          value={`₨${(stats.pendingPayments / 1000).toFixed(0)}K`}
          icon={Banknote}
          variant="warning"
        />
        <StatCard
          title="Vendors Pending Payment"
          value={`₨${(stats.vendorPayables / 1000).toFixed(0)}K`}
          icon={Banknote}
          variant="warning"
        />
      </div>

      {/* B2B Summary Card - Only shown when B2B toggle is ON */}
      {includeB2B && (
        <Card className="border-purple-200 dark:border-purple-800 bg-gradient-to-r from-purple-50/50 to-blue-50/50 dark:from-purple-950/20 dark:to-blue-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-600" />
              B2B Summary ({format(selectedMonth, 'MMMM yyyy')})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">B2B Agents</p>
                <p className="text-lg font-semibold text-purple-600">{stats.b2bAgentsCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">B2B Bookings</p>
                <p className="text-lg font-semibold text-blue-600">{stats.b2bBookingsCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">B2B Sales</p>
                <p className="text-lg font-semibold text-green-600">₨ {(stats.b2bTotalSales / 1000).toFixed(0)}K</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">B2B Profit</p>
                <p className="text-lg font-semibold text-amber-600">₨ {(stats.b2bTotalProfit / 1000).toFixed(0)}K</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Client Queries & Name Update Reminders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4">
        {/* Active Client Queries */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" />
              Active Client Queries
              <Badge variant="secondary" className="ml-2">
                {activeQueries.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeQueries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No active queries</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeQueries.map((query) => (
                  <div
                    key={query.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">{query.client_name}</p>
                        <Badge 
                          variant={query.status === 'pending' ? 'secondary' : 'default'}
                          className="text-xs"
                        >
                          {query.status}
                        </Badge>
                        <Badge 
                          variant={
                            query.priority === 'high' ? 'destructive' : 
                            query.priority === 'medium' ? 'default' : 
                            'secondary'
                          }
                          className="text-xs"
                        >
                          {query.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {query.query_text}
                      </p>
                      {query.contact_number && (
                        <p className="text-xs text-muted-foreground mt-1">
                          📞 {query.contact_number}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {query.due_date && (
                        <p className="font-medium">
                          Due: {format(new Date(query.due_date), 'MMM d')}
                        </p>
                      )}
                      {query.assigned_to && (
                        <p className="mt-1">
                          👤 {query.assigned_to}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Name Update Reminders */}
        <NameUpdateReminder />
      </div>

      {/* Upcoming Flights - Separate Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-4">
        {/* Tickets */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Plane className="w-5 h-5 text-accent" />
              Upcoming Flights - Tickets
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingFlights.tickets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Plane className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No upcoming ticket flights</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingFlights.tickets.map((flight) => (
                  <div
                    key={`${flight.source}-${flight.id}`}
                    className={`flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-muted transition-colors ${
                      flight.source === 'b2b' ? 'bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-800/50' : 'bg-muted/50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{flight.name}</p>
                        {flight.source === 'b2b' && (
                          <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                            B2B
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {flight.destination} • PNR: {flight.pnr}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Flight: {flight.flightDateFormatted}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="font-medium text-sm">{flight.date}</p>
                        <p className="text-xs text-muted-foreground">{format(flight.fullDate, 'EEEE')}</p>
                      </div>
                      {flight.source === 'b2c' && <EmailReminderButton client={flight} type="flight" />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Umrah */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Plane className="w-5 h-5 text-primary" />
              Upcoming Flights - Umrah
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingFlights.umrah.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Plane className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No upcoming Umrah flights</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingFlights.umrah.map((flight) => (
                  <div
                    key={`${flight.source}-${flight.id}`}
                    className={`flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-muted transition-colors ${
                      flight.source === 'b2b' ? 'bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-800/50' : 'bg-muted/50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{flight.name}</p>
                        {flight.source === 'b2b' && (
                          <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                            B2B
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {flight.destination} • PNR: {flight.pnr}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Flight: {flight.flightDateFormatted}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="font-medium text-sm">{flight.date}</p>
                        <p className="text-xs text-muted-foreground">{format(flight.fullDate, 'EEEE')}</p>
                      </div>
                      {flight.source === 'b2c' && <EmailReminderButton client={flight} type="umrah" />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent" />
              {format(selectedMonth, 'MMMM yyyy')} Financial Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Bookings</span>
              <span className="font-semibold">{stats.monthlyBookings}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Revenue Collected</span>
              <span className="font-semibold text-success">
                ₨ {(stats.monthlyRevenue / 1000).toFixed(0)}K
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Vendor Service Costs</span>
              <span className="font-semibold text-warning">
                ₨ {(stats.monthlyVendorCosts / 1000).toFixed(0)}K
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Operating Expenses</span>
              <span className="font-semibold text-destructive">
                ₨ {(stats.monthlyExpenses / 1000).toFixed(0)}K
              </span>
            </div>
            <div className="pt-2 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Net Profit</span>
                <span className={`font-bold text-lg ${stats.monthlyProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  ₨ {(stats.monthlyProfit / 1000).toFixed(0)}K
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Profit Margin: {stats.profitMargin}%
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Banknote className="w-5 h-5 text-destructive" />
              Client Today Remaining Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            {clientsWithPaymentDueToday.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Banknote className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No pending payments due today</p>
              </div>
            ) : (
              <div className="space-y-3">
                {clientsWithPaymentDueToday.map((client) => {
                  const total = Number(client.selling_price) || 0;
                  const paid = Number(client.amount_paid) || 0;
                  const remaining = total - paid;

                  return (
                    <div
                      key={client.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{client.name}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Amount Due: ₨ {remaining.toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="font-bold text-destructive">₨ {remaining.toFixed(0)}</p>
                          <p className="text-xs text-muted-foreground">Due Today</p>
                        </div>
                        <EmailReminderButton client={client} type="payment" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Vendors Widget - Read-only */}
        <TopVendorsWidget />
      </div>
      </div>
    </div>
  );
}
