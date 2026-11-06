import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Trash2, Pencil, DollarSign, CheckSquare, Square, ChevronDown, ChevronUp, History, Users, RefreshCw, AlertTriangle, Plane as PlaneIcon, Calendar as CalendarIcon, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { AddClientDialog } from "@/components/AddClientDialog";
import { ClientPaymentDialog } from "@/components/ClientPaymentDialog";
import { DirectInvoiceButton } from "@/components/DirectInvoiceButton";
import { BookingDownloadButton } from "@/components/BookingDownloadButton";
import { EmailBookingButton } from "@/components/EmailBookingButton";
import { EmailInvoiceButton } from "@/components/EmailInvoiceButton";
import { ExportBookingMenu } from "@/components/ExportBookingMenu";
import { MobileClientCard } from "@/components/MobileClientCard";
import { useToast } from "@/hooks/use-toast";
import { useClients } from "@/hooks/useStorage";
import { isWithinInterval, parseISO, startOfMonth, endOfMonth, addMonths, format, isToday, isTomorrow, addDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DateFilterSelector } from "@/components/DateFilterSelector";
import { DateRangePicker } from "@/components/DateRangePicker";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { exportClientsReport } from "@/lib/pdfExport";
import { DateRange } from "react-day-picker";
import { useVendors } from "@/hooks/useStorage";
import { useAgency } from "@/hooks/useAgency";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { InlinePaymentHistory } from "@/components/InlinePaymentHistory";
import { AllPaymentHistory } from "@/components/AllPaymentHistory";
import { exportToExcel, downloadFile } from "@/lib/excelExport";
import { useIsMobile } from "@/hooks/use-mobile";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PermissionGate } from "@/components/PermissionGate";

export default function Clients() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentClient, setPaymentClient] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [exportMonth, setExportMonth] = useState<Date>(new Date());
  const [exportDateType, setExportDateType] = useState<"current-month" | "custom">("current-month");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
  const [expandedBookings, setExpandedBookings] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const [mobileFilter, setMobileFilter] = useState("all");
  const [mobileDatePreset, setMobileDatePreset] = useState<"all_time" | "current_month" | "last_month" | "last_3_months" | "year_to_date" | "custom">("all_time");
  const [mobileDateRange, setMobileDateRange] = useState<DateRange | undefined>();
  const [showMobileDateDialog, setShowMobileDateDialog] = useState(false);
  const { toast } = useToast();
  const { clients, isLoading, deleteClient } = useClients();
  const { vendors } = useVendors();
  const { filter } = useDateFilter();
  const { data: agency } = useAgency();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  // Pull-to-refresh functionality
  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['clients'] });
    toast({ title: "Client list refreshed" });
  };

  const { containerRef, isPulling, isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  const toggleBooking = (clientId: string) => {
    setExpandedBookings(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };

  useEffect(() => {
    setExportMonth(new Date());
  }, []);
  
  const getVendorName = (vendorId: string | null) => {
    if (!vendorId) return null;
    const vendor = vendors.find(v => v.id === vendorId);
    return vendor?.name;
  };

  const filteredClients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = Array.isArray(clients) ? clients : [];
    
    let filtered = list;
    
    if (q) {
      filtered = filtered.filter((c: any) => {
        const vendorName = getVendorName(c.vendor_id);
        return [c.name, c.passport_number, c.pnr, vendorName]
          .filter(Boolean)
          .some((v: string) => v.toLowerCase().includes(q));
      });
    }
    
    if (filter.startDate && filter.endDate) {
      filtered = filtered.filter((c: any) => {
        if (!c.flight_date && !c.created_at) return false;
        const dateToCheck = c.flight_date || c.created_at;
        return isWithinInterval(parseISO(dateToCheck), {
          start: filter.startDate,
          end: filter.endDate
        });
      });
    }

    // Apply mobile filter chips
    if (isMobile && mobileFilter !== "all") {
      filtered = filtered.filter((c: any) => {
        switch (mobileFilter) {
          case "pending": return c.payment_status === "pending" || !c.payment_status;
          case "paid": return c.payment_status === "paid";
          case "partial": return c.payment_status === "partial";
          case "ticket": return c.travel_type?.toLowerCase().includes("ticket");
          case "umrah": return c.travel_type?.toLowerCase().includes("umrah");
          default: return true;
        }
      });
    }

    // Apply mobile date preset filter
    if (isMobile && mobileDatePreset !== "all_time") {
      const now = new Date();
      let mStart: Date | null = null;
      let mEnd: Date | null = null;
      if (mobileDatePreset === "current_month") {
        mStart = startOfMonth(now);
        mEnd = endOfMonth(now);
      } else if (mobileDatePreset === "last_month") {
        const lm = addMonths(now, -1);
        mStart = startOfMonth(lm);
        mEnd = endOfMonth(lm);
      } else if (mobileDatePreset === "last_3_months") {
        mStart = startOfMonth(addMonths(now, -2));
        mEnd = endOfMonth(now);
      } else if (mobileDatePreset === "year_to_date") {
        mStart = new Date(now.getFullYear(), 0, 1);
        mEnd = endOfMonth(now);
      } else if (mobileDatePreset === "custom" && mobileDateRange?.from) {
        mStart = mobileDateRange.from;
        mEnd = mobileDateRange.to || mobileDateRange.from;
      }
      if (mStart && mEnd) {
        filtered = filtered.filter((c: any) => {
          if (!c.flight_date && !c.created_at) return false;
          const dateToCheck = parseISO(c.flight_date || c.created_at);
          return isWithinInterval(dateToCheck, { start: mStart!, end: mEnd! });
        });
      }
    }
    
     return filtered.sort((a: any, b: any) => {
      const dateA = a.flight_date || a.created_at;
      const dateB = b.flight_date || b.created_at;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }, [clients, searchQuery, filter, isMobile, mobileFilter, mobileDatePreset, mobileDateRange]);

  // Mobile alert stats
  const pendingPaymentsCount = useMemo(() => {
    const list = Array.isArray(clients) ? clients : [];
    return list.filter((c: any) => c.payment_status !== "paid").length;
  }, [clients]);

  const tomorrowFlightsCount = useMemo(() => {
    const list = Array.isArray(clients) ? clients : [];
    const tomorrow = addDays(new Date(), 1);
    return list.filter((c: any) => {
      if (!c.flight_date) return false;
      return isTomorrow(parseISO(c.flight_date));
    }).length;
  }, [clients]);

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      
      const clientsToExport = filteredClients.filter((c: any) => 
        selectedClients.has(c.id)
      );

      if (clientsToExport.length === 0) {
        toast({
          title: "No data to export",
          description: "Please select clients to export",
          variant: "destructive",
        });
        return;
      }

      const excelData = clientsToExport.map((client: any) => {
        const vendorName = getVendorName(client.vendor_id);
        const purchasePrice = client.purchasing_price || 0;
        const sellingPrice = client.selling_price || 0;
        const amountPaid = client.amount_paid || 0;
        const pending = sellingPrice - amountPaid;
        const profit = sellingPrice - purchasePrice;

        return {
          "Name": client.name || "",
          "Service": client.travel_type || "",
          "Destination": client.destination || "",
          "Vendor": vendorName || "",
          "Status": client.payment_status || "",
          "Passport": client.passport_number || "",
          "Purchase Price": purchasePrice,
          "Total Amount": sellingPrice,
          "Paid": amountPaid,
          "Pending": pending,
          "Profit": profit,
        };
      });

      const exportData = {
        clients: excelData,
        bookings: [],
        vendors: [],
        expenses: []
      };
      
      const blob = await exportToExcel(exportData);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = "client-bookings-export.xlsx";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Export successful",
        description: `Exported ${clientsToExport.length} booking(s) to Excel`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export failed",
        description: "There was an error exporting to Excel",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportClients = async () => {
    if (selectedClients.size === 0) {
      toast({
        title: "No clients selected",
        description: "Please select at least one client booking to export",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      const clientsToExport = filteredClients.filter((c: any) => 
        selectedClients.has(c.id)
      );

      let startDate: Date;
      let endDate: Date;

      if (exportDateType === "current-month") {
        startDate = startOfMonth(exportMonth);
        endDate = endOfMonth(exportMonth);
      } else {
        if (!customDateRange?.from || !customDateRange?.to) {
          toast({
            title: "Invalid date range",
            description: "Please select a valid custom date range",
            variant: "destructive",
          });
          setIsExporting(false);
          return;
        }
        startDate = customDateRange.from;
        endDate = customDateRange.to;
      }

      const dateFilteredClients = clientsToExport.filter((c: any) => {
        const flightDate = c.flight_date ? parseISO(c.flight_date) : null;
        if (!flightDate) return false;
        return isWithinInterval(flightDate, { start: startDate, end: endDate });
      });

      if (dateFilteredClients.length === 0) {
        toast({
          title: "No bookings in selected period",
          description: `No bookings found for the selected date range`,
          variant: "destructive",
        });
        setIsExporting(false);
        return;
      }

      await exportClientsReport(dateFilteredClients, startDate, endDate, agency?.name);

      toast({
        title: "Export successful",
        description: `Exported ${dateFilteredClients.length} booking(s) for ${format(startDate, "MMM yyyy")}`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export failed",
        description: "There was an error generating the PDF",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = (clientId: string) => {
    setClientToDelete(clientId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (clientToDelete) {
      deleteClient.mutate(clientToDelete, {
        onSuccess: () => {
          toast({
            title: "Booking deleted successfully",
            description: "The booking has been removed from your records",
          });
          setDeleteDialogOpen(false);
          setClientToDelete(null);
        },
        onError: () => {
          toast({
            title: "Failed to delete booking",
            description: "There was an error deleting the booking. Please try again.",
            variant: "destructive",
          });
        }
      });
    }
  };

  const handleEdit = (client: any) => {
    setEditingClient(client);
    setShowAddDialog(true);
  };

  const handleAddNew = () => {
    setEditingClient(null);
    setShowAddDialog(true);
  };

  const handleDialogClose = () => {
    setShowAddDialog(false);
    setEditingClient(null);
  };

  const handlePayment = (client: any) => {
    setPaymentClient(client);
    setPaymentDialogOpen(true);
  };

  const toggleSelectAll = () => {
    if (selectedClients.size === filteredClients.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(filteredClients.map((c: any) => c.id)));
    }
  };

  const toggleSelect = (clientId: string) => {
    setSelectedClients(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };

  const totalRevenue = useMemo(() => 
    filteredClients.reduce((sum: number, c: any) => sum + (c.selling_price || 0), 0),
    [filteredClients]
  );

  const totalPurchase = useMemo(() => 
    filteredClients.reduce((sum: number, c: any) => sum + (c.purchasing_price || 0), 0),
    [filteredClients]
  );

  const totalProfit = useMemo(() => totalRevenue - totalPurchase, [totalRevenue, totalPurchase]);

  const totalPaid = useMemo(() => 
    filteredClients.reduce((sum: number, c: any) => sum + (c.amount_paid || 0), 0),
    [filteredClients]
  );

  const totalPending = useMemo(() => totalRevenue - totalPaid, [totalRevenue, totalPaid]);

  const filterChips = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "paid", label: "Paid" },
    { key: "partial", label: "Partial" },
    { key: "ticket", label: "Ticket" },
    { key: "umrah", label: "Umrah" },
  ];

  return (
    <div ref={containerRef} className="relative h-full overflow-auto">
      {/* Pull-to-refresh indicator */}
      <div 
        className="absolute top-0 left-0 right-0 flex items-center justify-center transition-all duration-200 ease-out z-50"
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

      <div className="space-y-4 md:space-y-6 max-w-full overflow-hidden">

      {/* ======================== MOBILE VIEW ======================== */}
      {isMobile ? (
        <div className="space-y-3">
          {/* Mobile Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-accent/10 rounded-xl flex items-center justify-center">
                <Users className="w-4.5 h-4.5 text-accent" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">Bookings</h1>
                <p className="text-[11px] text-muted-foreground">{filteredClients.length} records</p>
              </div>
            </div>
          </div>

          {/* Alert Notifications */}
          {(pendingPaymentsCount > 0 || tomorrowFlightsCount > 0) && (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {pendingPaymentsCount > 0 && (
                <div className="flex items-center gap-1.5 bg-destructive/10 text-destructive rounded-lg px-2.5 py-1.5 text-xs font-medium flex-shrink-0 border border-destructive/20">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {pendingPaymentsCount} pending payments
                </div>
              )}
              {tomorrowFlightsCount > 0 && (
                <div className="flex items-center gap-1.5 bg-accent/10 text-accent rounded-lg px-2.5 py-1.5 text-xs font-medium flex-shrink-0 border border-accent/20">
                  <PlaneIcon className="h-3.5 w-3.5" />
                  {tomorrowFlightsCount} flights tomorrow
                </div>
              )}
            </div>
          )}

          {/* Mobile Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, passport, PNR, vendor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10"
            />
          </div>

          {/* Filter Chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
            {filterChips.map(chip => (
              <button
                key={chip.key}
                onClick={() => setMobileFilter(chip.key)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0 transition-all duration-200 border",
                  "min-h-[32px] touch-manipulation",
                  mobileFilter === chip.key
                    ? "bg-accent text-accent-foreground border-accent shadow-sm"
                    : "bg-card text-muted-foreground border-border/60 hover:border-accent/40"
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Advanced Date Filter */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs flex-1 justify-between h-9">
                  <div className="flex items-center gap-1.5">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    <span>
                      {mobileDatePreset === "all_time" ? "All Time" :
                       mobileDatePreset === "current_month" ? "This Month" :
                       mobileDatePreset === "last_month" ? "Last Month" :
                       mobileDatePreset === "last_3_months" ? "Last 3 Months" :
                       mobileDatePreset === "year_to_date" ? "Year to Date" :
                       mobileDateRange?.from ? `${format(mobileDateRange.from, "MMM dd")}${mobileDateRange.to ? ` - ${format(mobileDateRange.to, "MMM dd")}` : ""}` : "Custom Range"}
                    </span>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => { setMobileDatePreset("current_month"); }}>This Month</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setMobileDatePreset("last_month"); }}>Last Month</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setMobileDatePreset("last_3_months"); }}>Last 3 Months</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setMobileDatePreset("year_to_date"); }}>Year to Date</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { setMobileDatePreset("all_time"); setMobileDateRange(undefined); }}>All Time</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { setShowMobileDateDialog(true); }}>Custom Range...</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {mobileDatePreset !== "all_time" && (
              <button
                onClick={() => { setMobileDatePreset("all_time"); setMobileDateRange(undefined); }}
                className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors touch-manipulation"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Custom Date Range Dialog */}
          <Dialog open={showMobileDateDialog} onOpenChange={setShowMobileDateDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Select Custom Date Range</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Calendar
                  mode="range"
                  selected={mobileDateRange}
                  onSelect={setMobileDateRange}
                  numberOfMonths={1}
                  className="pointer-events-auto"
                />
                <div className="flex justify-between items-center">
                  <div className="text-sm text-muted-foreground">
                    {mobileDateRange?.from && (
                      <>
                        {format(mobileDateRange.from, "MMM dd, yyyy")}
                        {mobileDateRange.to && ` - ${format(mobileDateRange.to, "MMM dd, yyyy")}`}
                      </>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowMobileDateDialog(false)}>Cancel</Button>
                    <Button size="sm" onClick={() => { setMobileDatePreset("custom"); setShowMobileDateDialog(false); }} disabled={!mobileDateRange?.from}>Apply</Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Mobile Stats Row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-card rounded-xl p-2.5 border border-border/40 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Revenue</p>
              <p className="text-sm font-bold text-foreground mt-0.5">{totalRevenue.toLocaleString()}</p>
            </div>
            <div className="bg-card rounded-xl p-2.5 border border-border/40 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Profit</p>
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{totalProfit.toLocaleString()}</p>
            </div>
            <div className="bg-card rounded-xl p-2.5 border border-border/40 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pending</p>
              <p className="text-sm font-bold text-destructive mt-0.5">{totalPending.toLocaleString()}</p>
            </div>
          </div>

          {/* Mobile Card List */}
          {isLoading ? (
            <div className="text-center py-12 text-sm text-muted-foreground">Loading bookings...</div>
          ) : filteredClients.length === 0 ? (
             <div className="text-center py-12 text-muted-foreground text-sm">
              {searchQuery || mobileFilter !== "all" || mobileDatePreset !== "all_time" ? "No bookings match your filters" : "No bookings yet"}
            </div>
          ) : (
            <div className="space-y-2.5 pb-20">
              {filteredClients.map((client: any) => (
                <MobileClientCard
                  key={client.id}
                  client={client}
                  vendorName={getVendorName(client.vendor_id)}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onPayment={handlePayment}
                />
              ))}
            </div>
          )}

          {/* Floating Action Button */}
          <PermissionGate module="clients" action="write">
            <button
              onClick={handleAddNew}
              className="fixed bottom-20 right-4 z-40 w-14 h-14 bg-accent text-accent-foreground rounded-2xl shadow-lg shadow-accent/30 flex items-center justify-center active:scale-95 transition-transform touch-manipulation"
            >
              <Plus className="w-6 h-6" />
            </button>
          </PermissionGate>
        </div>
      ) : (
      /* ======================== DESKTOP VIEW (unchanged) ======================== */
      <>
      {/* Header - matching B2B Agents style */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Client Bookings</h1>
            <p className="text-sm text-muted-foreground">{filteredClients.length} bookings</p>
          </div>
        </div>
        <PermissionGate module="clients" action="write">
          <Button onClick={handleAddNew} className="gap-2">
            <Plus className="w-4 h-4" />
            Add New Booking
          </Button>
        </PermissionGate>
      </div>

      {/* Date Filter */}
      <DateFilterSelector />

      {/* Stats Cards - cleaner spacing */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-5">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 p-3 sm:p-4">
            <CardDescription className="text-xs sm:text-sm">Total Revenue</CardDescription>
            <CardTitle className="text-lg sm:text-xl truncate">Rs. {totalRevenue.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 p-3 sm:p-4">
            <CardDescription className="text-xs sm:text-sm">Purchase Cost</CardDescription>
            <CardTitle className="text-lg sm:text-xl truncate">Rs. {totalPurchase.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 p-3 sm:p-4">
            <CardDescription className="text-xs sm:text-sm">Total Profit</CardDescription>
            <CardTitle className="text-lg sm:text-xl text-green-600 truncate">Rs. {totalProfit.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 p-3 sm:p-4">
            <CardDescription className="text-xs sm:text-sm">Total Paid</CardDescription>
            <CardTitle className="text-lg sm:text-xl text-blue-600 truncate">Rs. {totalPaid.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 p-3 sm:p-4">
            <CardDescription className="text-xs sm:text-sm">Total Pending</CardDescription>
            <CardTitle className="text-lg sm:text-xl text-orange-600 truncate">Rs. {totalPending.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
      </div>


      {/* Search and Filters Card - matching B2B Agents style */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, passport, or PNR..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <ExportBookingMenu
              selectedCount={selectedClients.size}
              onExportPDF={handleExportClients}
              onExportExcel={handleExportExcel}
              isExporting={isExporting}
            />
          </div>
        </CardContent>
      </Card>

      {/* Bookings Table Card */}
      <Card>
        <CardContent className="p-3 sm:p-4">

          {isLoading ? (
            <div className="text-center py-8 text-sm">Loading...</div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {searchQuery ? "No bookings found matching your search" : "No bookings yet"}
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto -mx-3 sm:mx-0">
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedClients.size === filteredClients.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client: any) => {
                    const vendorName = getVendorName(client.vendor_id);
                    const purchasePrice = client.purchasing_price || 0;
                    const sellingPrice = client.selling_price || 0;
                    const amountPaid = client.amount_paid || 0;
                    const pending = sellingPrice - amountPaid;
                    const profit = sellingPrice - purchasePrice;
                    const isExpanded = expandedBookings.has(client.id);
                    
                    // Check if this is a Custom Service
                    const isCustomService = client.travel_type && 
                      !['Ticket', 'Ticket – One Way', 'Ticket – Return', 'Umrah'].includes(client.travel_type);
                    
                    // Get custom service data from passengers_data if available
                    const customServiceData = client.passengers_data?.[0]?.custom_service;
                    
                    // Determine display value for location/destination column
                    const locationDisplay = isCustomService 
                      ? (customServiceData?.location || client.destination || "—")
                      : (client.destination || "—");

                    return (
                      <>
                        <TableRow key={client.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedClients.has(client.id)}
                              onCheckedChange={() => toggleSelect(client.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleBooking(client.id)}
                                className="h-6 w-6 p-0"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                              <div>
                                <div className="font-medium">{client.name}</div>
                                {client.group_size && client.group_size > 1 && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Users className="h-3 w-3" />
                                    {client.group_size} travelers
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{client.travel_type || "—"}</TableCell>
                          <TableCell>{locationDisplay}</TableCell>
                          <TableCell>{vendorName || "—"}</TableCell>
                          <TableCell>
                            <Badge variant={
                              client.payment_status === "paid" ? "default" :
                              client.payment_status === "partial" ? "secondary" :
                              "destructive"
                            }>
                              {client.payment_status || "pending"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <TooltipProvider>
                                <PermissionGate module="clients" action="write">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => handleEdit(client)}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Edit Client</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </PermissionGate>
                                <PermissionGate module="clients" action="delete">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => handleDelete(client.id)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Delete Client</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </PermissionGate>
                              </TooltipProvider>
                              <BookingDownloadButton client={client} vendor={vendorName ? { name: vendorName } : undefined} />
                              <EmailBookingButton client={client} vendor={vendorName ? { name: vendorName } : undefined} />
                              <DirectInvoiceButton client={client} />
                              <EmailInvoiceButton client={client} />
                              <TooltipProvider>
                                <PermissionGate module="clients" action="write">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => handlePayment(client)}
                                      >
                                        <DollarSign className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Record Payment</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </PermissionGate>
                              </TooltipProvider>
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={7} className="bg-muted/50">
                              <div className="p-4 space-y-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                  <div>
                                    <div className="text-sm text-muted-foreground">Passport</div>
                                    <div className="font-medium">{client.passport_number || "—"}</div>
                                  </div>
                                  <div>
                                    <div className="text-sm text-muted-foreground">Group Info</div>
                                    <div className="font-medium">
                                      {client.group_size && client.group_size > 1
                                        ? `${client.group_booking_type || "Group"} (${client.group_size})`
                                        : "Individual"}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-sm text-muted-foreground">Purchase Price</div>
                                    <div className="font-medium">Rs. {purchasePrice.toLocaleString()}</div>
                                  </div>
                                  <div>
                                    <div className="text-sm text-muted-foreground">Total Amount</div>
                                    <div className="font-medium">Rs. {sellingPrice.toLocaleString()}</div>
                                  </div>
                                  <div>
                                    <div className="text-sm text-muted-foreground">Paid</div>
                                    <div className="font-medium text-blue-600">Rs. {amountPaid.toLocaleString()}</div>
                                  </div>
                                  <div>
                                    <div className="text-sm text-muted-foreground">Pending</div>
                                    <div className="font-medium text-orange-600">Rs. {pending.toLocaleString()}</div>
                                  </div>
                                  <div>
                                    <div className="text-sm text-muted-foreground">Profit</div>
                                    <div className="font-medium text-green-600">Rs. {profit.toLocaleString()}</div>
                                  </div>
                                </div>
                                
                                <InlinePaymentHistory entityId={client.id} entityType="client" />
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      </>
      )}

      <AddClientDialog
        open={showAddDialog}
        onOpenChange={handleDialogClose}
        editClient={editingClient}
      />
      <ClientPaymentDialog
        client={paymentClient}
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
      />
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this booking and remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              Yes, Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}
