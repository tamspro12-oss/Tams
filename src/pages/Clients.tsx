import { useMemo, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Trash2, Pencil, DollarSign, CheckSquare, Square, ChevronDown, ChevronUp, History, Users, RefreshCw, AlertTriangle, Plane as PlaneIcon, Calendar as CalendarIcon, X, SlidersHorizontal, Check } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
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
import { isWithinInterval, parseISO, startOfMonth, endOfMonth, addMonths, format, isToday, isTomorrow, addDays, startOfWeek, endOfWeek, startOfDay, endOfDay } from "date-fns";
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
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [prefillClient, setPrefillClient] = useState<any>(null);

  useEffect(() => {
    if (location.state?.openAddClient) {
      if (location.state.prefill) {
        setPrefillClient(location.state.prefill);
      }
      setShowAddDialog(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);
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

  // Mobile Filters & Bottom Sheet States
  const [mobileStatus, setMobileStatus] = useState<"all" | "pending" | "paid" | "partial">("all");
  const [mobileType, setMobileType] = useState<"all" | "ticket" | "umrah">("all");
  const [mobileDatePreset, setMobileDatePreset] = useState<"all_time" | "today" | "this_week" | "current_month" | "last_month" | "custom">("all_time");
  const [mobileDateRange, setMobileDateRange] = useState<DateRange | undefined>();
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  // Draft filters for bottom sheet
  const [draftStatus, setDraftStatus] = useState<"all" | "pending" | "paid" | "partial">("all");
  const [draftType, setDraftType] = useState<"all" | "ticket" | "umrah">("all");
  const [draftDatePreset, setDraftDatePreset] = useState<"all_time" | "today" | "this_week" | "current_month" | "last_month" | "custom">("all_time");
  const [draftDateRange, setDraftDateRange] = useState<DateRange | undefined>();

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (mobileStatus !== "all") count++;
    if (mobileType !== "all") count++;
    if (mobileDatePreset !== "all_time") count++;
    return count;
  }, [mobileStatus, mobileType, mobileDatePreset]);
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

    // Apply mobile status filter
    if (isMobile && mobileStatus !== "all") {
      filtered = filtered.filter((c: any) => {
        switch (mobileStatus) {
          case "pending": return c.payment_status === "pending" || !c.payment_status;
          case "paid": return c.payment_status === "paid";
          case "partial": return c.payment_status === "partial";
          default: return true;
        }
      });
    }

    // Apply mobile travel type filter
    if (isMobile && mobileType !== "all") {
      filtered = filtered.filter((c: any) => {
        switch (mobileType) {
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
      if (mobileDatePreset === "today") {
        mStart = startOfDay(now);
        mEnd = endOfDay(now);
      } else if (mobileDatePreset === "this_week") {
        mStart = startOfWeek(now, { weekStartsOn: 1 });
        mEnd = endOfWeek(now, { weekStartsOn: 1 });
      } else if (mobileDatePreset === "current_month") {
        mStart = startOfMonth(now);
        mEnd = endOfMonth(now);
      } else if (mobileDatePreset === "last_month") {
        const lm = addMonths(now, -1);
        mStart = startOfMonth(lm);
        mEnd = endOfMonth(lm);
      } else if (mobileDatePreset === "custom" && mobileDateRange?.from) {
        mStart = startOfDay(mobileDateRange.from);
        mEnd = endOfDay(mobileDateRange.to || mobileDateRange.from);
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
  }, [clients, searchQuery, filter, isMobile, mobileStatus, mobileType, mobileDatePreset, mobileDateRange]);

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
    setPrefillClient(null);
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
        <div className="space-y-3 px-1 sm:px-2">
          {/* 1. Compact Header */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex items-baseline gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">Bookings</h1>
              <span className="text-xs font-medium text-muted-foreground">
                {filteredClients.length} {filteredClients.length === 1 ? "record" : "records"}
              </span>
            </div>
            {pendingPaymentsCount > 0 && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20 shrink-0">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{pendingPaymentsCount} pending</span>
              </div>
            )}
          </div>

          {/* Tomorrow flight alert (compact pill) */}
          {tomorrowFlightsCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-accent/10 text-accent border border-accent/20 w-fit">
              <PlaneIcon className="h-3.5 w-3.5" />
              <span>{tomorrowFlightsCount} flight{tomorrowFlightsCount > 1 ? "s" : ""} tomorrow</span>
            </div>
          )}

          {/* 2. Search + Single Filter Trigger */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, passport, PNR, vendor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 bg-card/60 border-border/60 rounded-xl text-sm placeholder:text-muted-foreground/70"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button
              variant={activeFilterCount > 0 ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setDraftStatus(mobileStatus);
                setDraftType(mobileType);
                setDraftDatePreset(mobileDatePreset);
                setDraftDateRange(mobileDateRange);
                setIsFilterSheetOpen(true);
              }}
              className={cn(
                "h-10 px-3.5 rounded-xl gap-1.5 shrink-0 font-medium text-xs border transition-all",
                activeFilterCount > 0
                  ? "bg-accent text-accent-foreground border-accent shadow-sm"
                  : "bg-card text-muted-foreground border-border/60 hover:text-foreground"
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="ml-0.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-accent-foreground text-accent text-[10px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>

          {/* 4. Active Filter Chips (Removable) */}
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide text-xs">
              {mobileStatus !== "all" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent/15 text-accent border border-accent/30 font-medium shrink-0">
                  Status: {mobileStatus}
                  <button onClick={() => setMobileStatus("all")} className="hover:opacity-75">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {mobileType !== "all" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent/15 text-accent border border-accent/30 font-medium shrink-0">
                  Type: {mobileType}
                  <button onClick={() => setMobileType("all")} className="hover:opacity-75">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {mobileDatePreset !== "all_time" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent/15 text-accent border border-accent/30 font-medium shrink-0">
                  {mobileDatePreset === "today" ? "Today" :
                   mobileDatePreset === "this_week" ? "This Week" :
                   mobileDatePreset === "current_month" ? "This Month" :
                   mobileDatePreset === "last_month" ? "Last Month" :
                   mobileDateRange?.from ? `${format(mobileDateRange.from, "MMM d")}${mobileDateRange.to ? ` - ${format(mobileDateRange.to, "MMM d")}` : ""}` : "Custom"}
                  <button onClick={() => { setMobileDatePreset("all_time"); setMobileDateRange(undefined); }} className="hover:opacity-75">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              <button
                onClick={() => {
                  setMobileStatus("all");
                  setMobileType("all");
                  setMobileDatePreset("all_time");
                  setMobileDateRange(undefined);
                }}
                className="text-[11px] text-muted-foreground hover:text-destructive underline px-1 shrink-0"
              >
                Clear all
              </button>
            </div>
          )}

          {/* 5. Compact Summary Row */}
          <div className="grid grid-cols-3 gap-2 bg-card rounded-xl p-2.5 border border-border/50 shadow-soft-sm">
            <div className="text-center px-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Revenue</p>
              <p className="text-xs sm:text-sm font-bold text-foreground truncate mt-0.5">
                Rs {totalRevenue.toLocaleString()}
              </p>
            </div>
            <div className="text-center px-1 border-x border-border/40">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Profit</p>
              <p className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 truncate mt-0.5">
                Rs {totalProfit.toLocaleString()}
              </p>
            </div>
            <div className="text-center px-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Pending</p>
              <p className="text-xs sm:text-sm font-bold text-destructive truncate mt-0.5">
                Rs {totalPending.toLocaleString()}
              </p>
            </div>
          </div>

          {/* 3. Filters Bottom Sheet */}
          <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
            <SheetContent side="bottom" className="rounded-t-2xl max-h-[85dvh] overflow-y-auto px-5 pb-6 pt-4">
              <SheetHeader className="pb-3 border-b border-border/50 text-left">
                <SheetTitle className="text-base font-bold">Filter Bookings</SheetTitle>
              </SheetHeader>

              <div className="space-y-5 py-4">
                {/* Status Chips */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                    Payment Status
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: "all", label: "All Statuses" },
                      { key: "pending", label: "Pending" },
                      { key: "paid", label: "Paid" },
                      { key: "partial", label: "Partial" },
                    ].map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setDraftStatus(s.key as any)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors touch-manipulation",
                          draftStatus === s.key
                            ? "bg-accent text-accent-foreground border-accent font-semibold shadow-sm"
                            : "bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted"
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Booking Type Chips */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                    Booking Type
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: "all", label: "All Types" },
                      { key: "ticket", label: "Ticket" },
                      { key: "umrah", label: "Umrah" },
                    ].map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setDraftType(t.key as any)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors touch-manipulation",
                          draftType === t.key
                            ? "bg-accent text-accent-foreground border-accent font-semibold shadow-sm"
                            : "bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted"
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date Chips */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                    Date Range
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: "all_time", label: "All Time" },
                      { key: "today", label: "Today" },
                      { key: "this_week", label: "This Week" },
                      { key: "current_month", label: "This Month" },
                      { key: "last_month", label: "Last Month" },
                      { key: "custom", label: "Custom Range" },
                    ].map((d) => (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() => setDraftDatePreset(d.key as any)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors touch-manipulation",
                          draftDatePreset === d.key
                            ? "bg-accent text-accent-foreground border-accent font-semibold shadow-sm"
                            : "bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted"
                        )}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>

                  {draftDatePreset === "custom" && (
                    <div className="mt-3 p-3 bg-muted/30 rounded-xl border border-border/50">
                      <Calendar
                        mode="range"
                        selected={draftDateRange}
                        onSelect={setDraftDateRange}
                        numberOfMonths={1}
                        className="pointer-events-auto mx-auto"
                      />
                    </div>
                  )}
                </div>
              </div>

              <SheetFooter className="flex flex-row gap-2 pt-2 border-t border-border/50">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDraftStatus("all");
                    setDraftType("all");
                    setDraftDatePreset("all_time");
                    setDraftDateRange(undefined);
                  }}
                  className="flex-1 rounded-xl h-10 text-xs font-medium"
                >
                  Reset
                </Button>
                <Button
                  onClick={() => {
                    setMobileStatus(draftStatus);
                    setMobileType(draftType);
                    setMobileDatePreset(draftDatePreset);
                    setMobileDateRange(draftDateRange);
                    setIsFilterSheetOpen(false);
                  }}
                  className="flex-1 rounded-xl h-10 text-xs font-semibold bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  Apply Filters
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          {/* Mobile Card List */}
          {isLoading ? (
            <div className="text-center py-12 text-sm text-muted-foreground">Loading bookings...</div>
          ) : filteredClients.length === 0 ? (
             <div className="text-center py-12 text-muted-foreground text-sm">
              {searchQuery || activeFilterCount > 0 ? "No bookings match your filters" : "No bookings yet"}
            </div>
          ) : (
            <div className="space-y-2.5 pb-24">
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

          {/* 6. Floating Action Button anchored cleanly above bottom nav */}
          <PermissionGate module="clients" action="write">
            <button
              onClick={handleAddNew}
              className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+72px)] right-4 z-40 w-14 h-14 bg-accent text-accent-foreground rounded-2xl shadow-lg shadow-accent/30 flex items-center justify-center active:scale-95 transition-transform touch-manipulation"
              aria-label="Add Booking"
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
        prefillClient={prefillClient}
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
