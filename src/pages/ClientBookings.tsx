import React, { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  User,
  Plus,
  Search,
  Download,
  Calendar as CalendarIcon,
  Filter,
  DollarSign,
  TrendingUp,
  Receipt,
  Plane,
  Building2,
  Clock,
  ArrowRight,
  Sparkles,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Phone,
  Globe,
  SlidersHorizontal,
} from "lucide-react";
import { useClients } from "@/hooks/useStorage";
import { useB2BAgents, B2BAgent } from "@/hooks/useB2BAgents";
import { useB2BBookings, B2BBooking } from "@/hooks/useB2BBookings";
import { useB2BLedger } from "@/hooks/useB2BLedger";
import { useAgency } from "@/hooks/useAgency";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { DateFilterSelector } from "@/components/DateFilterSelector";
import { MasterAddBookingModal } from "@/components/bookings/MasterAddBookingModal";
import { DirectBookingDetailModal } from "@/components/bookings/DirectBookingDetailModal";
import { AgentDetailModal } from "@/components/bookings/AgentDetailModal";
import { ManageAgentsModal } from "@/components/bookings/ManageAgentsModal";
import { format, parseISO, isWithinInterval } from "date-fns";
import { exportToExcel } from "@/lib/excelExport";
import { exportClientsReport } from "@/lib/pdfExport";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function ClientBookings() {
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterChip, setFilterChip] = useState<"all" | "direct" | "b2b" | "agents">("all");
  const { filter } = useDateFilter();

  // Modals
  const [showMasterAddModal, setShowMasterAddModal] = useState(false);
  const [masterModalMode, setMasterModalMode] = useState<"direct" | "b2b">("direct");
  const [masterPrefilledAgentId, setMasterPrefilledAgentId] = useState<string | null>(null);
  const [masterEditData, setMasterEditData] = useState<any | null>(null);

  // Detail Modals
  const [selectedDirectBooking, setSelectedDirectBooking] = useState<any | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<B2BAgent | null>(null);
  const [showManageAgents, setShowManageAgents] = useState(false);

  // Highlight newly added or edited card
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null);

  // Data hooks
  const { clients, isLoading: clientsLoading } = useClients();
  const { agents, isLoading: agentsLoading } = useB2BAgents();
  const { bookings: allB2BBookings, isLoading: b2bLoading } = useB2BBookings();
  const { ledgerEntries: allLedger } = useB2BLedger();
  const { data: agency } = useAgency();

  // Quick refresh
  const isRefreshing = clientsLoading || agentsLoading || b2bLoading;

  // Clear highlight after 4 seconds
  useEffect(() => {
    if (highlightedCardId) {
      const timer = setTimeout(() => setHighlightedCardId(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [highlightedCardId]);

  // Map for fast agent lookup
  const agentMap = useMemo(() => {
    const map = new Map<string, B2BAgent>();
    agents.forEach((a) => map.set(a.id, a));
    return map;
  }, [agents]);

  // Date interval helper
  const isDateInFilter = (dateStr?: string | null) => {
    if (!filter.startDate || !filter.endDate) return true;
    if (!dateStr) return false;
    try {
      const parsed = parseISO(dateStr);
      return isWithinInterval(parsed, {
        start: filter.startDate,
        end: filter.endDate,
      });
    } catch {
      return false;
    }
  };

  // ===================== DIRECT BOOKINGS =====================
  const filteredDirectBookings = useMemo(() => {
    let list = Array.isArray(clients) ? clients : [];

    // Date Filter
    if (filter.startDate && filter.endDate) {
      list = list.filter((c: any) => {
        const dateToCheck = c.flight_date || c.created_at;
        return isDateInFilter(dateToCheck);
      });
    }

    // Text Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((c: any) => {
        return (
          c.name?.toLowerCase().includes(q) ||
          c.pnr?.toLowerCase().includes(q) ||
          c.passport_number?.toLowerCase().includes(q) ||
          c.airline?.toLowerCase().includes(q) ||
          c.destination?.toLowerCase().includes(q) ||
          (Array.isArray(c.passengers_data) &&
            c.passengers_data.some(
              (p: any) =>
                p.name?.toLowerCase().includes(q) ||
                p.passport_number?.toLowerCase().includes(q)
            ))
        );
      });
    }

    // Sort by latest flight_date / created_at
    return list.sort((a: any, b: any) => {
      const dateA = new Date(a.flight_date || a.created_at || 0).getTime();
      const dateB = new Date(b.flight_date || b.created_at || 0).getTime();
      return dateB - dateA;
    });
  }, [clients, filter, searchQuery]);

  // ===================== B2B AGENTS WITH GROUPED BOOKINGS =====================
  const filteredB2BAgentsData = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return agents
      .map((agent) => {
        // All bookings belonging to this agent
        const agentBookings = allB2BBookings.filter((b) => b.agent_id === agent.id);
        const agentLedger = allLedger.filter((l) => l.agent_id === agent.id);

        // Date-filtered bookings
        const dateFilteredBookings = agentBookings.filter((b) => {
          if (!filter.startDate || !filter.endDate) return true;
          const dateToCheck = b.flight_date || b.created_at;
          return isDateInFilter(dateToCheck);
        });

        // Search matching
        const agentMatchesText =
          !q ||
          agent.agent_name.toLowerCase().includes(q) ||
          agent.business_name?.toLowerCase().includes(q) ||
          agent.city?.toLowerCase().includes(q) ||
          agent.phone?.toLowerCase().includes(q);

        const bookingMatchesText =
          !q ||
          agentBookings.some(
            (b) =>
              b.passenger_name.toLowerCase().includes(q) ||
              b.pnr?.toLowerCase().includes(q) ||
              b.passenger_passport?.toLowerCase().includes(q)
          );

        // Calculations strictly preserving existing financial formulas
        const totalSales = dateFilteredBookings.reduce(
          (sum, b) => sum + (b.selling_price || 0),
          0
        );
        const totalPurchase = dateFilteredBookings.reduce(
          (sum, b) => sum + (b.purchasing_price || 0),
          0
        );
        const totalCommission = dateFilteredBookings.reduce(
          (sum, b) => sum + (b.commission_amount || 0),
          0
        );
        const totalProfit = totalSales - totalPurchase - totalCommission;

        const totalDebits = agentLedger
          .filter((l) => l.entry_type === "debit")
          .reduce((sum, l) => sum + l.amount, 0);
        const totalCredits = agentLedger
          .filter((l) => l.entry_type === "credit")
          .reduce((sum, l) => sum + l.amount, 0);
        const outstanding = totalDebits - totalCredits;

        return {
          agent,
          bookings: dateFilteredBookings,
          totalBookingsCount: dateFilteredBookings.length,
          allTimeBookingsCount: agentBookings.length,
          totalSales,
          totalPurchase,
          totalCommission,
          totalProfit,
          totalPaid: totalCredits,
          outstanding,
          matches: agentMatchesText || bookingMatchesText,
          latestDate: agentBookings[0]?.flight_date || agent.created_at,
        };
      })
      .filter((item) => item.matches)
      .sort((a, b) => {
        const dateA = new Date(a.latestDate || 0).getTime();
        const dateB = new Date(b.latestDate || 0).getTime();
        return dateB - dateA;
      });
  }, [agents, allB2BBookings, allLedger, filter, searchQuery]);

  // ===================== AGGREGATE FINANCIAL STATS =====================
  const stats = useMemo(() => {
    // Direct calculations
    const directRevenue = filteredDirectBookings.reduce(
      (sum: number, c: any) => sum + (c.selling_price || 0),
      0
    );
    const directPurchase = filteredDirectBookings.reduce(
      (sum: number, c: any) => sum + (c.purchasing_price || 0),
      0
    );
    const directPaid = filteredDirectBookings.reduce(
      (sum: number, c: any) => sum + (c.amount_paid || 0),
      0
    );
    const directPending = Math.max(0, directRevenue - directPaid);
    const directProfit = directRevenue - directPurchase;

    // B2B calculations
    const b2bSales = filteredB2BAgentsData.reduce(
      (sum, item) => sum + item.totalSales,
      0
    );
    const b2bPurchase = filteredB2BAgentsData.reduce(
      (sum, item) => sum + item.totalPurchase,
      0
    );
    const b2bPaid = filteredB2BAgentsData.reduce(
      (sum, item) => sum + item.totalPaid,
      0
    );
    const b2bPending = filteredB2BAgentsData.reduce(
      (sum, item) => sum + Math.max(0, item.outstanding),
      0
    );
    const b2bProfit = filteredB2BAgentsData.reduce(
      (sum, item) => sum + item.totalProfit,
      0
    );

    if (filterChip === "direct") {
      return {
        revenue: directRevenue,
        purchase: directPurchase,
        profit: directProfit,
        paid: directPaid,
        pending: directPending,
      };
    } else if (filterChip === "b2b" || filterChip === "agents") {
      return {
        revenue: b2bSales,
        purchase: b2bPurchase,
        profit: b2bProfit,
        paid: b2bPaid,
        pending: b2bPending,
      };
    }

    // ALL
    return {
      revenue: directRevenue + b2bSales,
      purchase: directPurchase + b2bPurchase,
      profit: directProfit + b2bProfit,
      paid: directPaid + b2bPaid,
      pending: directPending + b2bPending,
    };
  }, [filteredDirectBookings, filteredB2BAgentsData, filterChip]);

  // Combined Cards array for unified grid when filterChip === 'all'
  const combinedCards = useMemo(() => {
    type CardItem =
      | { type: "direct"; data: any; sortDate: number; id: string }
      | { type: "b2b"; data: typeof filteredB2BAgentsData[0]; sortDate: number; id: string };

    const items: CardItem[] = [];

    if (filterChip === "all" || filterChip === "direct") {
      filteredDirectBookings.forEach((c: any) => {
        items.push({
          type: "direct",
          data: c,
          sortDate: new Date(c.flight_date || c.created_at || 0).getTime(),
          id: c.id,
        });
      });
    }

    if (filterChip === "all" || filterChip === "b2b" || filterChip === "agents") {
      filteredB2BAgentsData.forEach((item) => {
        items.push({
          type: "b2b",
          data: item,
          sortDate: new Date(item.latestDate || item.agent.created_at || 0).getTime(),
          id: item.agent.id,
        });
      });
    }

    return items.sort((a, b) => b.sortDate - a.sortDate);
  }, [filteredDirectBookings, filteredB2BAgentsData, filterChip]);

  // ===================== EXPORT HANDLERS =====================
  const handleExportExcel = async () => {
    try {
      const rows: any[] = [];

      if (filterChip === "all" || filterChip === "direct") {
        filteredDirectBookings.forEach((c: any) => {
          rows.push({
            Type: "Direct Client",
            Name: c.name,
            Service: c.travel_type || "Ticket",
            Destination: c.destination || "",
            Airline: c.airline || "",
            PNR: c.pnr || "",
            FlightDate: c.flight_date || "",
            SellingPrice: c.selling_price || 0,
            PurchasingPrice: c.purchasing_price || 0,
            Paid: c.amount_paid || 0,
            Pending: Math.max(0, (c.selling_price || 0) - (c.amount_paid || 0)),
            Status: c.payment_status || "Pending",
          });
        });
      }

      if (filterChip === "all" || filterChip === "b2b" || filterChip === "agents") {
        filteredB2BAgentsData.forEach((item) => {
          rows.push({
            Type: "B2B Agent",
            Name: item.agent.agent_name,
            Service: `${item.totalBookingsCount} Bookings`,
            Destination: item.agent.city || "",
            Airline: item.agent.business_name || "",
            PNR: "",
            FlightDate: "",
            SellingPrice: item.totalSales,
            PurchasingPrice: item.totalPurchase,
            Paid: item.totalPaid,
            Pending: Math.max(0, item.outstanding),
            Status: item.outstanding > 0 ? "Debit Due" : "Settled",
          });
        });
      }

      if (rows.length === 0) {
        toast.error("No booking records to export");
        return;
      }

      const blob = await exportToExcel({
        clients: rows,
        bookings: [],
        vendors: [],
        expenses: [],
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `bookings-export-${format(new Date(), "yyyyMMdd")}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${rows.length} booking record(s) to Excel`);
    } catch (err: any) {
      toast.error("Failed to export Excel report");
    }
  };

  const handleExportPdfReport = async () => {
    try {
      if (filteredDirectBookings.length === 0) {
        toast.error("No direct bookings to export in report");
        return;
      }
      const start = filter.startDate || new Date();
      const end = filter.endDate || new Date();
      await exportClientsReport(filteredDirectBookings, start, end, agency?.name);
      toast.success("PDF report generated successfully!");
    } catch (err: any) {
      toast.error("Failed to generate PDF report");
    }
  };

  // Open master form handler
  const handleOpenAddBooking = (mode: "direct" | "b2b" = "direct", agentId: string | null = null) => {
    setMasterEditData(null);
    setMasterModalMode(mode);
    setMasterPrefilledAgentId(agentId);
    setShowMasterAddModal(true);
  };

  // Edit handler
  const handleEditDirectBooking = (booking: any) => {
    setMasterEditData(booking);
    setMasterModalMode("direct");
    setMasterPrefilledAgentId(null);
    setShowMasterAddModal(true);
  };

  const handleEditB2BBooking = (booking: B2BBooking) => {
    setMasterEditData(booking);
    setMasterModalMode("b2b");
    setMasterPrefilledAgentId(booking.agent_id);
    setShowMasterAddModal(true);
  };

  // Callback on save to highlight card
  const handleSavedBooking = (savedItem: any, mode: "direct" | "b2b") => {
    if (mode === "direct" && savedItem?.id) {
      setHighlightedCardId(savedItem.id);
    } else if (mode === "b2b" && savedItem?.agent_id) {
      setHighlightedCardId(savedItem.agent_id);
    }
  };

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-150">
      {/* ===================== 1. TOP CONTROLS & STATS ===================== */}

      {/* Top Toolbar: One row, all items same height & radius */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5 bg-card border rounded-lg p-2.5 shadow-xs">
        {/* 1. Search Box (far left, takes flexible width) */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, passport, PNR, destination..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 text-xs pl-9 rounded-lg bg-background"
          />
        </div>

        {/* 2. ONE Segmented Switch with 4 options: All | Direct | B2B | Manage Agents */}
        <div className="inline-flex h-9 items-center rounded-lg border border-input bg-muted/40 p-0.5 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setFilterChip("all")}
            className={cn(
              "h-7 px-3 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap",
              filterChip === "all"
                ? "bg-background text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilterChip("direct")}
            className={cn(
              "h-7 px-3 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap",
              filterChip === "direct"
                ? "bg-blue-600 text-white shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <User className="w-3 h-3" />
            Direct
          </button>
          <button
            type="button"
            onClick={() => setFilterChip("b2b")}
            className={cn(
              "h-7 px-3 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap",
              filterChip === "b2b"
                ? "bg-purple-600 text-white shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="w-3 h-3" />
            B2B
          </button>
          <button
            type="button"
            onClick={() => {
              setFilterChip("agents");
              setShowManageAgents(true);
            }}
            className={cn(
              "h-7 px-3 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap",
              filterChip === "agents"
                ? "bg-purple-600 text-white shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="w-3 h-3 text-purple-500" />
            Manage Agents
          </button>
        </div>

        {/* 3. Time Filter Dropdown (matching height & radius) */}
        <DateFilterSelector size="sm" className="h-9 text-xs rounded-lg shrink-0" />

        {/* 4. Export */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 text-xs rounded-lg gap-1.5 shrink-0">
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-xs">
            <DropdownMenuItem onClick={handleExportExcel} className="gap-2 cursor-pointer">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Export to Excel (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportPdfReport} className="gap-2 cursor-pointer">
              <FileText className="w-3.5 h-3.5 text-red-600" />
              Export PDF Report (.pdf)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 5. Add Booking (Primary button, far right) */}
        <Button
          size="sm"
          onClick={() => handleOpenAddBooking("direct")}
          className="h-9 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-bold gap-1.5 shadow-sm shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Booking
        </Button>
      </div>

      {/* Row 2: Top Stat Cards - 4 in ONE row: Total Revenue, Purchase Cost, Total Pending, Total Paid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* 1. Total Revenue */}
        <div className="bg-card border rounded-lg p-3 shadow-2xs hover:shadow-xs transition-shadow">
          <span className="text-xs font-semibold text-muted-foreground block">
            Total Revenue
          </span>
          <span className="text-base sm:text-xl font-bold text-foreground">
            PKR {stats.revenue.toLocaleString()}
          </span>
        </div>

        {/* 2. Purchase Cost */}
        <div className="bg-card border rounded-lg p-3 shadow-2xs hover:shadow-xs transition-shadow">
          <span className="text-xs font-semibold text-muted-foreground block">
            Purchase Cost
          </span>
          <span className="text-base sm:text-xl font-bold text-foreground">
            PKR {stats.purchase.toLocaleString()}
          </span>
        </div>

        {/* 3. Total Pending (moved up) */}
        <div className="bg-card border rounded-lg p-3 shadow-2xs hover:shadow-xs transition-shadow">
          <span className="text-xs font-semibold text-muted-foreground block">
            Total Pending
          </span>
          <span
            className={cn(
              "text-base sm:text-xl font-bold",
              stats.pending > 0 ? "text-amber-600" : "text-muted-foreground"
            )}
          >
            PKR {stats.pending.toLocaleString()}
          </span>
        </div>

        {/* 4. Total Paid */}
        <div className="bg-card border rounded-lg p-3 shadow-2xs hover:shadow-xs transition-shadow">
          <span className="text-xs font-semibold text-muted-foreground block">
            Total Paid
          </span>
          <span className="text-base sm:text-xl font-bold text-emerald-600">
            PKR {stats.paid.toLocaleString()}
          </span>
        </div>
      </div>

      {/* ===================== 2. CARDS GRID ===================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
        {combinedCards.length > 0 ? (
          combinedCards.map((item) => {
            const isHighlighted = highlightedCardId === item.id;

            if (item.type === "direct") {
              const booking = item.data;
              const sell = Number(booking.selling_price) || 0;
              const paid = Number(booking.amount_paid) || 0;
              const pending = Math.max(0, sell - paid);

              return (
                <div
                  key={`direct-${booking.id}`}
                  onClick={() => setSelectedDirectBooking(booking)}
                  className={cn(
                    "group bg-card border rounded-lg p-4 cursor-pointer hover:border-blue-500/50 hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between space-y-3",
                    isHighlighted && "ring-2 ring-blue-500 shadow-lg animate-pulse"
                  )}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="secondary"
                          className="bg-blue-600/10 text-blue-700 dark:text-blue-300 border-blue-500/20 text-[10px] font-bold"
                        >
                          Direct
                        </Badge>
                        <Badge variant="outline" className="text-[10px] h-5">
                          {booking.travel_type || "Ticket"}
                        </Badge>
                        {booking.payment_status && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] h-5 capitalize",
                              booking.payment_status === "Paid" || booking.payment_status === "paid"
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                : booking.payment_status === "Partial" || booking.payment_status === "partial"
                                ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                : "bg-red-500/10 text-red-600 border-red-500/20"
                            )}
                          >
                            ● {booking.payment_status}
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-bold text-sm sm:text-base text-foreground truncate group-hover:text-blue-600 transition-colors">
                        {booking.name}
                      </h3>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1 justify-end">
                        <CalendarIcon className="w-3 h-3" />
                        {booking.flight_date
                          ? format(parseISO(booking.flight_date), "dd MMM yyyy")
                          : booking.created_at
                          ? format(parseISO(booking.created_at), "dd MMM")
                          : "-"}
                      </span>
                    </div>
                  </div>

                  {/* Card Body: Flight / Route / PNR */}
                  <div className="bg-muted/30 rounded-md p-2.5 text-xs flex items-center justify-between">
                    <div>
                      <span className="text-muted-foreground text-[11px] block">PNR</span>
                      <span className="font-mono font-bold text-foreground">
                        {booking.pnr || "NO PNR"}
                      </span>
                    </div>

                    {booking.airline && (
                      <div className="text-center">
                        <span className="text-muted-foreground text-[11px] block">Airline</span>
                        <span className="font-semibold text-foreground truncate max-w-[90px] block">
                          {booking.airline}
                        </span>
                      </div>
                    )}

                    {booking.destination && (
                      <div className="text-right">
                        <span className="text-muted-foreground text-[11px] block">Sector</span>
                        <span className="font-semibold text-foreground uppercase truncate max-w-[80px] block">
                          {booking.destination}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Financials (Total / Paid / Pending) */}
                  <div className="pt-2 border-t flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Total</span>
                      <span className="font-bold text-foreground">
                        PKR {sell.toLocaleString()}
                      </span>
                    </div>

                    <div className="text-center">
                      <span className="text-[10px] text-muted-foreground block">Paid</span>
                      <span className="font-bold text-emerald-600">
                        PKR {paid.toLocaleString()}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-muted-foreground block">Pending</span>
                      <span
                        className={cn(
                          "font-bold",
                          pending > 0 ? "text-amber-600" : "text-muted-foreground"
                        )}
                      >
                        PKR {pending.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            } else {
              // B2B Agent Card
              const { agent, totalBookingsCount, totalSales, totalPaid, outstanding } = item.data;

              return (
                <div
                  key={`agent-${agent.id}`}
                  onClick={() => setSelectedAgent(agent)}
                  className={cn(
                    "group bg-card border rounded-lg p-4 cursor-pointer hover:border-purple-500/50 hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between space-y-3",
                    isHighlighted && "ring-2 ring-purple-500 shadow-lg animate-pulse"
                  )}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="secondary"
                          className="bg-purple-600/10 text-purple-700 dark:text-purple-300 border-purple-500/20 text-[10px] font-bold"
                        >
                          B2B
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] h-5",
                            agent.status === "active"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : "text-muted-foreground"
                          )}
                        >
                          {agent.status === "active" ? "● Active" : "○ Inactive"}
                        </Badge>
                      </div>
                      <h3 className="font-bold text-sm sm:text-base text-foreground truncate group-hover:text-purple-600 transition-colors">
                        {agent.agent_name}
                      </h3>
                      {agent.business_name && (
                        <span className="text-xs text-muted-foreground block truncate">
                          {agent.business_name}
                        </span>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <Badge variant="outline" className="text-xs bg-purple-500/5 border-purple-500/30 text-purple-700 dark:text-purple-300 font-bold">
                        {totalBookingsCount} Booking{totalBookingsCount !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  </div>

                  {/* Card Body: Contact & Location */}
                  <div className="bg-muted/30 rounded-md p-2.5 text-xs flex items-center justify-between text-muted-foreground">
                    <div className="truncate">
                      {agent.phone ? (
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <Phone className="w-3 h-3 text-primary" />
                          {agent.phone}
                        </span>
                      ) : (
                        <span>No phone set</span>
                      )}
                    </div>

                    <div className="text-right">
                      {agent.city ? (
                        <span className="flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {agent.city}
                        </span>
                      ) : (
                        <span>Pakistan</span>
                      )}
                    </div>
                  </div>

                  {/* Card Footer: Financials (Sales / Paid / Outstanding) */}
                  <div className="pt-2 border-t flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Sales</span>
                      <span className="font-bold text-foreground">
                        PKR {totalSales.toLocaleString()}
                      </span>
                    </div>

                    <div className="text-center">
                      <span className="text-[10px] text-muted-foreground block">Paid</span>
                      <span className="font-bold text-emerald-600">
                        PKR {totalPaid.toLocaleString()}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-muted-foreground block">Balance</span>
                      <span
                        className={cn(
                          "font-bold",
                          outstanding > 0
                            ? "text-destructive"
                            : outstanding < 0
                            ? "text-emerald-600"
                            : "text-muted-foreground"
                        )}
                      >
                        PKR {Math.abs(outstanding).toLocaleString()}{" "}
                        <span className="text-[10px]">
                          {outstanding > 0 ? "DR" : outstanding < 0 ? "CR" : ""}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            }
          })
        ) : (
          <div className="col-span-full py-16 text-center bg-card border rounded-lg p-6 space-y-3">
            <div className="w-12 h-12 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
              <Plane className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-foreground">No Bookings Found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {searchQuery
                ? `No bookings or agents matching "${searchQuery}". Try clearing search.`
                : "No bookings recorded yet for the selected period. Click Add Booking to create one."}
            </p>
            <Button
              size="sm"
              onClick={() => handleOpenAddBooking("direct")}
              className="text-xs font-semibold gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Create First Booking
            </Button>
          </div>
        )}
      </div>

      {/* ===================== MODALS ===================== */}

      {/* Master Add / Edit Booking Full-Screen Modal */}
      {showMasterAddModal && (
        <MasterAddBookingModal
          open={showMasterAddModal}
          onOpenChange={setShowMasterAddModal}
          initialMode={masterModalMode}
          prefilledAgentId={masterPrefilledAgentId}
          editBookingData={masterEditData}
          onSaved={handleSavedBooking}
        />
      )}

      {/* Full-Screen Direct Booking Detail Modal */}
      {selectedDirectBooking && (
        <DirectBookingDetailModal
          client={selectedDirectBooking}
          open={Boolean(selectedDirectBooking)}
          onOpenChange={(val) => !val && setSelectedDirectBooking(null)}
          onEdit={handleEditDirectBooking}
        />
      )}

      {/* Full-Screen B2B Agent Detail Modal */}
      {selectedAgent && (
        <AgentDetailModal
          agent={selectedAgent}
          open={Boolean(selectedAgent)}
          onOpenChange={(val) => !val && setSelectedAgent(null)}
          onAddBookingForAgent={(agentId) => handleOpenAddBooking("b2b", agentId)}
          onEditBooking={handleEditB2BBooking}
        />
      )}

      {/* Secondary "Manage Agents" Modal */}
      {showManageAgents && (
        <ManageAgentsModal
          open={showManageAgents}
          onOpenChange={setShowManageAgents}
        />
      )}
    </div>
  );
}

