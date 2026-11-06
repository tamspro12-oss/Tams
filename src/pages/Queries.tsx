import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Search,
  Trash2,
  Pencil,
  CheckCircle2,
  Calendar as CalendarIcon,
  PhoneCall,
  ArrowRightCircle,
  FileText,
  X,
  Loader2,
  Clock,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { useQueries, useClients } from "@/hooks/useStorage";
import { PermissionGate } from "@/components/PermissionGate";
import {
  DatePresetFilter,
  type DatePresetFilterValue,
} from "@/components/leads-quotes/DatePresetFilter";
import { isDateWithinPreset } from "@/lib/dateFilterUtils";
import { cn } from "@/lib/utils";

const priorityConfig: Record<string, { label: string; badgeClass: string; dotClass: string }> = {
  urgent: { label: "Urgent", badgeClass: "bg-destructive text-destructive-foreground border-destructive", dotClass: "bg-destructive" },
  high: { label: "High", badgeClass: "bg-orange-500 text-white border-orange-500", dotClass: "bg-orange-500" },
  medium: { label: "Medium", badgeClass: "bg-amber-500 text-white border-amber-500", dotClass: "bg-amber-500" },
  low: { label: "Low", badgeClass: "bg-blue-500 text-white border-blue-500", dotClass: "bg-blue-500" },
};

const statusConfig: Record<string, { label: string; badgeClass: string }> = {
  pending: { label: "Pending", badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300" },
  "in-progress": { label: "In Progress", badgeClass: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-300" },
  completed: { label: "Completed", badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300" },
  cancelled: { label: "Cancelled", badgeClass: "bg-muted text-muted-foreground border-muted-foreground/30" },
};

export default function Queries() {
  const navigate = useNavigate();
  const { queries = [], isLoading, deleteQuery, updateQuery } = useQueries();
  const { clients = [] } = useClients();

  // Search & Filter State
  const [searchInput, setSearchInput] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<DatePresetFilterValue>({
    preset: "this_month",
  });

  const [deleteQueryId, setDeleteQueryId] = useState<string | null>(null);

  // Shortcut 'N' for Add Query
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === "n" || e.key === "N") &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA" &&
        document.activeElement?.tagName !== "SELECT"
      ) {
        e.preventDefault();
        navigate("/app/leads-quotes/queries/new");
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [navigate]);

  // Date-filtered queries
  const dateFilteredQueries = useMemo(() => {
    return queries.filter((q: any) => {
      const qDate = q.created_at || q.due_date;
      return isDateWithinPreset(
        qDate,
        dateFilter.preset,
        dateFilter.customFrom,
        dateFilter.customTo
      );
    });
  }, [queries, dateFilter]);

  // Slim Stats Strip (Total, Pending, Completed, Urgent) - Reflects date filter
  const stats = useMemo(() => {
    const list = dateFilteredQueries;
    return {
      total: list.length,
      pending: list.filter((q: any) => q.status === "pending").length,
      inProgress: list.filter((q: any) => q.status === "in-progress").length,
      completed: list.filter((q: any) => q.status === "completed").length,
      urgent: list.filter((q: any) => q.priority === "urgent" && q.status !== "completed").length,
    };
  }, [dateFilteredQueries]);

  // Filtered queries list
  const filteredQueries = useMemo(() => {
    return dateFilteredQueries.filter((q: any) => {
      if (filterPriority !== "all" && q.priority !== filterPriority) return false;
      if (filterStatus !== "all" && q.status !== filterStatus) return false;

      if (searchInput.trim()) {
        const s = searchInput.toLowerCase();
        const matchName = q.client_name?.toLowerCase().includes(s);
        const matchPhone = q.contact_number?.includes(s);
        const matchText = q.query_text?.toLowerCase().includes(s);
        const matchAssignee = q.assigned_to?.toLowerCase().includes(s);
        if (!matchName && !matchPhone && !matchText && !matchAssignee) return false;
      }

      return true;
    }).sort((a: any, b: any) => {
      const pOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
      const diff = (pOrder[a.priority] ?? 2) - (pOrder[b.priority] ?? 2);
      if (diff !== 0) return diff;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [dateFilteredQueries, filterPriority, filterStatus, searchInput]);

  // Status change handler
  const handleStatusChange = async (queryId: string, newStatus: string) => {
    try {
      const updatedData: any = { status: newStatus };
      if (newStatus === "completed") {
        updatedData.completed_at = new Date().toISOString();
      }
      await updateQuery.mutateAsync({ id: queryId, query: updatedData });
      toast.success("Query status updated");
    } catch {
      toast.error("Failed to update status");
    }
  };

  // Convert to Booking handler
  const handleConvertToBooking = useCallback(
    (query: any) => {
      navigate("/app/bookings?tab=clients", {
        state: {
          openAddClient: true,
          prefill: {
            name: query.client_name,
            contact_number: query.contact_number,
            travel_type: query.service_type || "Ticket",
            notes: `Converted from Query #${query.id.slice(0, 8)}${query.query_text ? `\nQuery: ${query.query_text}` : ""}${query.notes ? `\nNotes: ${query.notes}` : ""}`,
            converted_from_query_id: query.id,
          },
        },
      });
    },
    [navigate]
  );

  // Create Quotation from Query
  const handleCreateQuotation = useCallback(
    (query: any) => {
      navigate("/app/leads-quotes/quotations/new", {
        state: {
          prefill: {
            client_name: query.client_name,
            client_phone: query.contact_number || "",
            title: `Quotation: ${query.query_text?.slice(0, 32)}...`,
            notes: `Source: Query #${query.id.slice(0, 8)}\nClient inquiry: ${query.query_text}${query.notes ? `\nNotes: ${query.notes}` : ""}`,
            items: [
              {
                description: query.query_text?.slice(0, 80) || "Travel Services Inquiry",
                qty: 1,
                unit_price: 0,
                amount: 0,
              },
            ],
          },
        },
      });
    },
    [navigate]
  );

  const handleDelete = async () => {
    if (!deleteQueryId) return;
    try {
      await deleteQuery.mutateAsync(deleteQueryId);
      toast.success("Query deleted successfully");
    } catch {
      toast.error("Failed to delete query");
    } finally {
      setDeleteQueryId(null);
    }
  };

  const renderBookingReference = (query: any) => {
    if (!query.converted_booking_id) return null;
    const client = clients.find((c: any) => c.id === query.converted_booking_id);
    const label = client?.serial_number ? `#BK-${client.serial_number}` : `Booked`;
    return (
      <Badge
        variant="outline"
        className="text-[10px] bg-green-50 text-green-700 border-green-300 dark:bg-green-950/60 dark:text-green-300 dark:border-green-800 gap-1 h-5 px-1.5 shrink-0"
        title="Converted to Booking"
      >
        <CheckCircle2 className="w-3 h-3 text-green-600 dark:text-green-400" />
        <span className="font-semibold">{label}</span>
      </Badge>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-7.5rem)] md:h-[calc(100dvh-8rem)] w-full overflow-hidden">
      {/* Compact Top Row: Title Left, + Add Query Right */}
      <div className="flex items-center justify-between pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-lg md:text-xl font-bold tracking-tight text-foreground">Client Queries</h2>
          <span className="text-xs text-muted-foreground font-medium">({filteredQueries.length})</span>
        </div>
        <PermissionGate module="queries" action="write">
          <Button
            size="sm"
            onClick={() => navigate("/app/leads-quotes/queries/new")}
            className="h-8 px-3 text-xs font-semibold gap-1.5 shadow-sm"
            title="Press N to create a new query"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Query</span>
            <kbd className="hidden sm:inline-block text-[10px] px-1 rounded bg-primary-foreground/20 text-primary-foreground font-mono">
              N
            </kbd>
          </Button>
        </PermissionGate>
      </div>

      {/* Slim Single-Row Stats Strip (~64px): Total, Pending, Completed, Urgent */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-2 shrink-0">
        <div className="h-16 px-3.5 py-2 rounded-xl border border-border/70 bg-card/70 flex flex-col justify-center">
          <span className="text-[11px] text-muted-foreground font-medium">Total Queries</span>
          <span className="text-lg md:text-xl font-black text-foreground">{stats.total}</span>
        </div>

        <div className="h-16 px-3.5 py-2 rounded-xl border border-border/70 bg-card/70 flex flex-col justify-center">
          <span className="text-[11px] text-muted-foreground font-medium">Pending Inquiries</span>
          <span className="text-lg md:text-xl font-black text-amber-600 dark:text-amber-400">
            {stats.pending}
          </span>
        </div>

        <div className="h-16 px-3.5 py-2 rounded-xl border border-border/70 bg-card/70 flex flex-col justify-center">
          <span className="text-[11px] text-muted-foreground font-medium">Completed</span>
          <span className="text-lg md:text-xl font-black text-emerald-600 dark:text-emerald-400">
            {stats.completed}
          </span>
        </div>

        <div className="h-16 px-3.5 py-2 rounded-xl border border-border/70 bg-card/70 flex flex-col justify-center">
          <span className="text-[11px] text-muted-foreground font-medium">Urgent Attention</span>
          <span className="text-lg md:text-xl font-black text-destructive">
            {stats.urgent}
          </span>
        </div>
      </div>

      {/* ONE Filter Row: Search | DATE FILTER | All Priorities | All Status */}
      <div className="flex flex-col sm:flex-row gap-2 mb-2 shrink-0">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9 h-9 text-xs rounded-lg"
            placeholder="Search by client, phone, request text, assignee..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 sm:pb-0">
          <DatePresetFilter
            value={dateFilter}
            onChange={setDateFilter}
            className="h-9 shrink-0"
          />

          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="h-9 w-32 text-xs rounded-lg shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-50 text-xs">
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-9 w-32 text-xs rounded-lg shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-50 text-xs">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ONE Horizontal Chip Row: All, Pending, In Progress, Completed (Never stacked, solid active) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 shrink-0 no-scrollbar">
        {[
          { key: "all", label: "All", count: stats.total, activeColor: "bg-primary text-primary-foreground" },
          { key: "pending", label: "Pending", count: stats.pending, activeColor: "bg-amber-500 text-white" },
          { key: "in-progress", label: "In Progress", count: stats.inProgress, activeColor: "bg-blue-600 text-white" },
          { key: "completed", label: "Completed", count: stats.completed, activeColor: "bg-emerald-600 text-white" },
        ].map((chip) => {
          const isSelected = filterStatus === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => setFilterStatus(chip.key)}
              className={cn(
                "h-7 px-3 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 border whitespace-nowrap",
                isSelected
                  ? `${chip.activeColor} border-transparent shadow-sm font-semibold`
                  : "bg-background/80 hover:bg-muted text-muted-foreground border-border/80"
              )}
            >
              <span>{chip.label}</span>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full",
                  isSelected
                    ? "bg-black/20 text-current"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {chip.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* TABLE / LIST CONTAINER: Fills remaining height, internal scroll only */}
      <div className="flex-1 min-h-0 bg-card rounded-xl border border-border/70 overflow-hidden flex flex-col shadow-sm">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
            <p className="text-xs">Loading queries...</p>
          </div>
        ) : filteredQueries.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <HelpCircle className="w-10 h-10 text-muted-foreground/30 mb-2" />
            <p className="text-sm font-semibold text-foreground">No client queries found</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {searchInput || filterStatus !== "all" || filterPriority !== "all" || dateFilter.preset !== "this_month"
                ? "Try clearing filters to see all queries."
                : "Add your first client inquiry or request to track follow-ups."}
            </p>
            <PermissionGate module="queries" action="write">
              <Button
                size="sm"
                onClick={() => navigate("/app/leads-quotes/queries/new")}
                className="mt-3 h-8 text-xs font-semibold gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Query</span>
              </Button>
            </PermissionGate>
          </div>
        ) : (
          <>
            {/* DESKTOP TABLE VIEW (>= 1024px) */}
            <div className="hidden lg:block flex-1 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-muted/90 backdrop-blur z-10 border-b text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Client</th>
                    <th className="py-2.5 px-3">Contact</th>
                    <th className="py-2.5 px-3">Query / Request</th>
                    <th className="py-2.5 px-3">Priority</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Assigned To</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredQueries.map((query: any) => {
                    const p = priorityConfig[query.priority] || priorityConfig.medium;
                    const s = statusConfig[query.status] || statusConfig.pending;
                    return (
                      <tr key={query.id} className="hover:bg-muted/40 transition-colors group">
                        {/* Client */}
                        <td className="py-2.5 px-3 font-semibold text-foreground">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate max-w-[150px]">{query.client_name}</span>
                            {renderBookingReference(query)}
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap font-mono text-[11px]">
                          {query.contact_number || "—"}
                        </td>

                        {/* Query (one line truncated) */}
                        <td className="py-2.5 px-3 text-foreground/90 max-w-xs truncate" title={query.query_text}>
                          <span className="truncate block">{query.query_text}</span>
                          {query.notes && (
                            <span className="text-[10px] text-muted-foreground truncate block">
                              Note: {query.notes}
                            </span>
                          )}
                        </td>

                        {/* Priority (colored badge) */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <Badge variant="outline" className={cn("text-[10px] font-semibold py-0 px-2 h-5", p.badgeClass)}>
                            {p.label}
                          </Badge>
                        </td>

                        {/* Status dropdown */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <Select
                            value={query.status}
                            onValueChange={(val) => handleStatusChange(query.id, val)}
                          >
                            <SelectTrigger className="h-6 w-24 text-[11px] rounded">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="z-50 text-xs">
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="in-progress">In Progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>

                        {/* Assigned To */}
                        <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap text-[11px]">
                          {query.assigned_to ? (
                            <Badge variant="secondary" className="text-[10px] font-normal py-0 px-1.5 h-4.5">
                              {query.assigned_to}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>

                        {/* Due Date */}
                        <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground text-[11px]">
                          {query.due_date ? format(parseISO(query.due_date), "dd MMM") : "—"}
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {/* Create Quotation from query */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCreateQuotation(query)}
                              className="h-7 text-[11px] px-2 gap-1 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-emerald-400/40 font-semibold"
                              title="Create Quotation from this Query"
                            >
                              <FileText className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>Quote</span>
                            </Button>

                            {!query.converted_booking_id && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleConvertToBooking(query)}
                                className="h-7 text-[11px] px-2 gap-1 text-primary hover:bg-primary/10 border-primary/40 font-semibold"
                                title="Convert Query to Booking"
                              >
                                <ArrowRightCircle className="w-3 h-3" />
                                <span>Convert</span>
                              </Button>
                            )}

                            <PermissionGate module="queries" action="write">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => navigate(`/app/leads-quotes/queries/${query.id}/edit`)}
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                title="Edit Query"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            </PermissionGate>

                            <PermissionGate module="queries" action="delete">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-destructive/70 hover:text-destructive"
                                    title="Delete Query"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="z-[100]">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete client query?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently remove the query from {query.client_name}.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => {
                                        setDeleteQueryId(query.id);
                                        deleteQuery.mutate(query.id);
                                      }}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </PermissionGate>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARD VIEW (< 1024px) */}
            <div className="lg:hidden flex-1 overflow-y-auto p-2.5 space-y-2">
              {filteredQueries.map((query: any) => {
                const p = priorityConfig[query.priority] || priorityConfig.medium;
                return (
                  <div
                    key={query.id}
                    className="p-3 rounded-xl border border-border/70 bg-card hover:bg-muted/20 transition-all flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm text-foreground truncate">{query.client_name}</span>
                          {renderBookingReference(query)}
                          <Badge variant="outline" className={cn("text-[9px] font-semibold py-0 px-1.5 h-4.5", p.badgeClass)}>
                            {p.label}
                          </Badge>
                        </div>
                        {query.contact_number && (
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <PhoneCall className="w-3 h-3" />
                            <span>{query.contact_number}</span>
                          </p>
                        )}
                      </div>

                      <Select
                        value={query.status}
                        onValueChange={(val) => handleStatusChange(query.id, val)}
                      >
                        <SelectTrigger className="h-7 w-24 text-[11px] rounded shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-50 text-xs">
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in-progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <p className="text-xs text-foreground/90 line-clamp-2">{query.query_text}</p>

                    {query.notes && (
                      <p className="text-[11px] text-muted-foreground bg-muted/40 p-1.5 rounded line-clamp-1">
                        <span className="font-semibold">Note:</span> {query.notes}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-1.5 border-t gap-1">
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {query.due_date && <span>Due: {format(parseISO(query.due_date), "dd MMM")}</span>}
                        {query.assigned_to && <span>• {query.assigned_to}</span>}
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCreateQuotation(query)}
                          className="h-7 text-[11px] px-2 gap-1 text-emerald-700 dark:text-emerald-300 border-emerald-400/40"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Quote</span>
                        </Button>

                        {!query.converted_booking_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleConvertToBooking(query)}
                            className="h-7 text-[11px] px-2 gap-1 text-primary border-primary/40"
                          >
                            <ArrowRightCircle className="w-3 h-3" />
                            <span>Convert</span>
                          </Button>
                        )}

                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => navigate(`/app/leads-quotes/queries/${query.id}/edit`)}
                          className="h-7 w-7 text-muted-foreground"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
