import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useB2BAgents, B2BAgent } from "@/hooks/useB2BAgents";
import { useB2BBookings, B2BBooking } from "@/hooks/useB2BBookings";
import { useB2BLedger } from "@/hooks/useB2BLedger";
import { DateFilterSelector } from "@/components/DateFilterSelector";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { parseISO, isWithinInterval, format } from "date-fns";
import { AddB2BAgentDialog } from "@/components/AddB2BAgentDialog";
import { AddB2BBookingDialog } from "@/components/AddB2BBookingDialog";
import { 
  Users, 
  Plus, 
  Search, 
  Eye, 
  Building2, 
  Phone, 
  Globe,
  TrendingUp,
  Banknote,
  AlertCircle,
  Pencil,
  Trash2,
  X,
  Ticket,
  Calendar,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

export default function B2BAgents() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchTab, setSearchTab] = useState<"all" | "agents" | "bookings">("all");
  const [visibleBookingCount, setVisibleBookingCount] = useState<number>(10);
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editAgent, setEditAgent] = useState<B2BAgent | null>(null);
  const [deleteAgent, setDeleteAgent] = useState<B2BAgent | null>(null);
  
  // Booking edit dialog state
  const [selectedBooking, setSelectedBooking] = useState<B2BBooking | null>(null);
  const [selectedBookingAgent, setSelectedBookingAgent] = useState<B2BAgent | null>(null);
  const [showBookingDialog, setShowBookingDialog] = useState(false);

  const { agents, isLoading, deleteAgent: deleteAgentMutation } = useB2BAgents();
  const { bookings: allBookings } = useB2BBookings();
  const { ledgerEntries: allLedger } = useB2BLedger();
  const { filter, setPreset } = useDateFilter();

  // Set "All Time" as default filter for B2B Agents page
  useEffect(() => {
    setPreset("all_time");
  }, []);

  // 300ms Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim().toLowerCase());
      setVisibleBookingCount(10);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Agent lookup map for O(1) matching
  const agentMap = useMemo(() => {
    const map = new Map<string, B2BAgent>();
    agents.forEach(a => map.set(a.id, a));
    return map;
  }, [agents]);

  // Get unique countries for filtering
  const countries = useMemo(() => {
    const countrySet = new Set(agents.map(a => a.country).filter(Boolean));
    return Array.from(countrySet).sort();
  }, [agents]);

  // Filter agents
  const filteredAgents = useMemo(() => {
    return agents.filter(agent => {
      const matchesSearch = !debouncedSearch || 
        agent.agent_name.toLowerCase().includes(debouncedSearch) ||
        agent.business_name?.toLowerCase().includes(debouncedSearch) ||
        agent.city?.toLowerCase().includes(debouncedSearch) ||
        agent.phone?.toLowerCase().includes(debouncedSearch) ||
        agent.email?.toLowerCase().includes(debouncedSearch);
      
      const matchesCountry = countryFilter === "all" || agent.country === countryFilter;
      
      let matchesDate = true;
      if (filter.startDate) {
        const createdAt = agent.created_at ? parseISO(agent.created_at) : null;
        if (!createdAt) {
          matchesDate = false;
        } else if (filter.endDate) {
          matchesDate = isWithinInterval(createdAt, { start: filter.startDate, end: filter.endDate });
        } else {
          matchesDate = createdAt >= filter.startDate;
        }
      }
      
      return matchesSearch && matchesCountry && matchesDate;
    });
  }, [agents, debouncedSearch, countryFilter, filter]);

  // Search bookings belonging ONLY to B2B agents
  const matchingBookings = useMemo(() => {
    if (!debouncedSearch) return [];

    return allBookings.filter((b) => {
      // Must belong strictly to a B2B agent
      if (!b.agent_id) return false;
      const agent = agentMap.get(b.agent_id);

      // Country filter applies to agent's country
      if (countryFilter !== "all" && agent?.country !== countryFilter) {
        return false;
      }

      // Date filter applies to travel/flight date or booking date
      if (filter.startDate) {
        const dateToCheck = b.flight_date ? parseISO(b.flight_date) : b.created_at ? parseISO(b.created_at) : null;
        if (!dateToCheck) return false;
        if (filter.endDate) {
          if (!isWithinInterval(dateToCheck, { start: filter.startDate, end: filter.endDate })) return false;
        } else if (dateToCheck < filter.startDate) {
          return false;
        }
      }

      // Text search matching fields
      const searchFields = [
        b.passenger_name,
        b.passenger_passport,
        b.pnr,
        b.destination,
        b.airline,
        b.notes,
        agent?.agent_name,
        agent?.business_name,
        agent?.city,
      ].filter(Boolean);

      return searchFields.some((f) => f!.toLowerCase().includes(debouncedSearch));
    });
  }, [allBookings, debouncedSearch, agentMap, countryFilter, filter]);

  // Calculate agent statistics
  const getAgentStats = (agentId: string) => {
    const agentBookings = allBookings.filter(b => b.agent_id === agentId);
    const agentLedger = allLedger.filter(l => l.agent_id === agentId);
    
    const totalSales = agentBookings.reduce((sum, b) => sum + (b.selling_price || 0), 0);
    const totalCommission = agentBookings.reduce((sum, b) => sum + (b.commission_amount || 0), 0);
    
    const totalDebits = agentLedger.filter(l => l.entry_type === 'debit').reduce((sum, l) => sum + l.amount, 0);
    const totalCredits = agentLedger.filter(l => l.entry_type === 'credit').reduce((sum, l) => sum + l.amount, 0);
    
    const outstanding = totalDebits - totalCredits;
    
    return { totalSales, totalCommission, outstanding };
  };

  const handleDelete = async () => {
    if (deleteAgent) {
      await deleteAgentMutation.mutateAsync(deleteAgent.id);
      setDeleteAgent(null);
    }
  };

  const renderAgentCard = (agent: B2BAgent) => {
    const stats = getAgentStats(agent.id);
    return (
      <Card key={agent.id} className="hover:shadow-md transition-shadow overflow-hidden">
        {/* Banner Header with Agent Name */}
        <div className="bg-gradient-to-r from-primary to-primary/80 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-xl text-white truncate">{agent.agent_name}</h3>
                {agent.business_name && (
                  <span className="text-sm text-white/80">{agent.business_name}</span>
                )}
              </div>
            </div>
            <Badge
              variant="secondary"
              className={cn(
                "text-sm font-medium",
                agent.status === 'active' 
                  ? "bg-white/20 text-white border-white/30" 
                  : "bg-gray-500/30 text-gray-100 border-gray-300/30"
              )}
            >
              {agent.status === 'active' ? '● Active' : '○ Inactive'}
            </Badge>
          </div>
        </div>

        <CardContent className="py-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Agent Contact Info */}
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {agent.city && (
                  <span className="flex items-center gap-1">
                    <Globe className="w-4 h-4" />
                    {agent.city}{agent.country ? `, ${agent.country}` : ''}
                  </span>
                )}
                {agent.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    {agent.phone}
                  </span>
                )}
                {agent.commission_rate && (
                  <Badge variant="outline" className="text-xs">
                    {agent.commission_type === 'percentage' 
                      ? `${agent.commission_rate}% Comm.`
                      : `Rs ${agent.commission_rate} Comm.`}
                  </Badge>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex items-center gap-3 sm:gap-6 py-2 px-3 bg-muted/40 rounded-lg">
              <div className="text-center">
                <span className="text-xs text-muted-foreground block">Sales</span>
                <span className="font-semibold text-sm">Rs {stats.totalSales.toLocaleString()}</span>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <span className="text-xs text-muted-foreground block">Commission</span>
                <span className="font-semibold text-sm text-emerald-600">Rs {stats.totalCommission.toLocaleString()}</span>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <span className="text-xs text-muted-foreground block">Balance</span>
                <span className={cn(
                  "font-bold text-sm",
                  stats.outstanding > 0 ? "text-destructive" : stats.outstanding < 0 ? "text-emerald-600" : "text-muted-foreground"
                )}>
                  Rs {Math.abs(stats.outstanding).toLocaleString()}
                  <span className="text-[10px] ml-0.5">
                    {stats.outstanding > 0 ? 'DR' : stats.outstanding < 0 ? 'CR' : ''}
                  </span>
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/app/b2b-agents/${agent.id}`)}
                className="gap-1.5"
              >
                <Eye className="w-4 h-4" />
                View Profile
              </Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditAgent(agent)}
                      className="h-8 w-8"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit Agent</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteAgent(agent)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete Agent</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold">B2B Agents</h1>
            <p className="text-sm text-muted-foreground">{agents.length} agents registered</p>
          </div>
        </div>
        
        <Button onClick={() => setShowAddDialog(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add New Agent
        </Button>
      </div>

      {/* Filters & Unified Search Bar */}
      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search agents or bookings (name, passport, PNR, voucher, city...)"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 pr-9"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <Select value={countryFilter} onValueChange={setCountryFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Globe className="w-4 h-4 mr-2" />
                <SelectValue placeholder="All Countries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {countries.map(country => (
                  <SelectItem key={country} value={country!}>{country}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Group filter chips appear when typing in search */}
          {debouncedSearch && (
            <div className="flex items-center gap-2 pt-1 border-t border-border/40">
              <span className="text-xs font-semibold text-muted-foreground">Filter:</span>
              <button
                type="button"
                onClick={() => setSearchTab("all")}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                  searchTab === "all"
                    ? "bg-accent text-accent-foreground border-accent font-semibold"
                    : "bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted"
                )}
              >
                All ({filteredAgents.length + matchingBookings.length})
              </button>
              <button
                type="button"
                onClick={() => setSearchTab("agents")}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                  searchTab === "agents"
                    ? "bg-accent text-accent-foreground border-accent font-semibold"
                    : "bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted"
                )}
              >
                Agents ({filteredAgents.length})
              </button>
              <button
                type="button"
                onClick={() => setSearchTab("bookings")}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                  searchTab === "bookings"
                    ? "bg-accent text-accent-foreground border-accent font-semibold"
                    : "bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted"
                )}
              >
                Bookings ({matchingBookings.length})
              </button>
            </div>
          )}

          <DateFilterSelector />
        </CardContent>
      </Card>

      {/* Main Content Area */}
      {debouncedSearch ? (
        /* Unified Search Results (When typing) */
        <div className="space-y-6">
          {/* Group 1: Matching Agents */}
          {(searchTab === "all" || searchTab === "agents") && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-primary" />
                  Agents ({filteredAgents.length})
                </h3>
              </div>
              {filteredAgents.length === 0 ? (
                <Card>
                  <CardContent className="py-6 text-center text-sm text-muted-foreground">
                    No agents found matching &ldquo;{searchInput}&rdquo;
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {filteredAgents.map(agent => renderAgentCard(agent))}
                </div>
              )}
            </div>
          )}

          {/* Group 2: Matching B2B Bookings */}
          {(searchTab === "all" || searchTab === "bookings") && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Ticket className="w-4 h-4 text-accent" />
                  B2B Bookings ({matchingBookings.length})
                </h3>
              </div>
              {matchingBookings.length === 0 ? (
                <Card>
                  <CardContent className="py-6 text-center text-sm text-muted-foreground">
                    No B2B bookings found matching &ldquo;{searchInput}&rdquo;
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2.5">
                  {matchingBookings.slice(0, visibleBookingCount).map(booking => {
                    const agent = agentMap.get(booking.agent_id);
                    const paymentStatus = booking.payment_status || 'pending';
                    const isUmrah = Boolean(booking.destination?.toLowerCase().includes("umrah") || booking.notes?.toLowerCase().includes("umrah"));
                    const bookingType = isUmrah ? "Umrah" : "Ticket";

                    return (
                      <Card
                        key={booking.id}
                        onClick={() => {
                          setSelectedBooking(booking);
                          setSelectedBookingAgent(agent || null);
                          setShowBookingDialog(true);
                        }}
                        className="p-3.5 hover:border-accent/60 transition-all cursor-pointer shadow-soft-sm group hover:shadow-md"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-foreground group-hover:text-accent transition-colors">
                                {booking.passenger_name}
                              </span>
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4.5 bg-muted/60">
                                {bookingType}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] py-0 px-1.5 h-4.5 capitalize",
                                  paymentStatus === "paid" && "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
                                  paymentStatus === "partial" && "bg-amber-500/15 text-amber-600 border-amber-500/30",
                                  paymentStatus === "pending" && "bg-destructive/15 text-destructive border-destructive/30"
                                )}
                              >
                                {paymentStatus}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1 text-foreground/80 font-medium">
                                <Building2 className="w-3 h-3 text-muted-foreground" />
                                {agent?.agent_name || "Unknown Agent"}
                              </span>
                              {booking.pnr && (
                                <span className="font-mono text-primary font-medium">
                                  PNR: {booking.pnr}
                                </span>
                              )}
                              {booking.passenger_passport && (
                                <span>Passport: {booking.passenger_passport}</span>
                              )}
                              {booking.destination && (
                                <span>{booking.destination}</span>
                              )}
                              {booking.flight_date && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-muted-foreground" />
                                  {format(parseISO(booking.flight_date), "MMM dd, yyyy")}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-border/40 shrink-0">
                            <span className="text-xs text-muted-foreground sm:hidden">Amount</span>
                            <span className="text-sm font-bold text-foreground">
                              Rs {(booking.selling_price || 0).toLocaleString()}
                            </span>
                            <span className="text-[11px] text-accent flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform mt-0.5 hidden sm:flex">
                              View Booking <ArrowRight className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      </Card>
                    );
                  })}

                  {matchingBookings.length > visibleBookingCount && (
                    <div className="text-center pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setVisibleBookingCount(prev => prev + 10)}
                        className="text-xs h-9 gap-1.5"
                      >
                        Show more ({matchingBookings.length - visibleBookingCount} remaining)
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Standard Agents List (When search input is empty - 100% untouched behavior) */
        filteredAgents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No B2B Agents Found</h3>
              <p className="text-muted-foreground mb-4">
                {countryFilter !== "all" 
                  ? "Try adjusting your filters" 
                  : "Add your first B2B agent to get started"}
              </p>
              {countryFilter === "all" && (
                <Button onClick={() => setShowAddDialog(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add First Agent
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredAgents.map(agent => renderAgentCard(agent))}
          </div>
        )
      )}

      {/* Add/Edit Agent Dialog */}
      <AddB2BAgentDialog
        open={showAddDialog || !!editAgent}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false);
            setEditAgent(null);
          }
        }}
        editAgent={editAgent}
      />

      {/* Booking View/Edit Dialog from Unified Search */}
      {selectedBookingAgent && (
        <AddB2BBookingDialog
          open={showBookingDialog}
          onOpenChange={(open) => {
            setShowBookingDialog(open);
            if (!open) {
              setSelectedBooking(null);
              setSelectedBookingAgent(null);
            }
          }}
          agent={selectedBookingAgent}
          editBooking={selectedBooking || undefined}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteAgent} onOpenChange={() => setDeleteAgent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete B2B Agent?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteAgent?.agent_name}</strong>? 
              This will also delete all their bookings and ledger entries. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Agent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
