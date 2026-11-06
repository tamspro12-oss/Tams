import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, Trash2, Pencil, CheckCircle2, Clock, AlertCircle, PhoneCall, Calendar as CalendarIcon, RefreshCw, X, ChevronDown } from "lucide-react";
import { useQueries } from "@/hooks/useStorage";
import { AddQueryDialog } from "@/components/AddQueryDialog";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useQueryClient } from "@tanstack/react-query";
import { PermissionGate } from "@/components/PermissionGate";
import { Skeleton } from "@/components/ui/skeleton";

interface QueryCardProps {
  query: any;
  onEdit: (query: any) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "urgent": return "bg-destructive text-destructive-foreground";
    case "high": return "bg-orange-500 text-white";
    case "medium": return "bg-yellow-500 text-white";
    case "low": return "bg-blue-500 text-white";
    default: return "";
  }
};

const QueryCard = React.memo(({ query, onEdit, onDelete, onStatusChange }: QueryCardProps) => (
  <Card key={query.id} className="hover:shadow-sm transition-shadow border-border/60">
    <CardHeader className="pb-2.5 pt-3.5 px-3.5 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <CardTitle className="text-sm sm:text-base font-semibold truncate">{query.client_name}</CardTitle>
            <Badge variant="outline" className={`text-[10px] font-semibold py-0 px-2 h-5 ${getPriorityColor(query.priority)}`}>
              {query.priority}
            </Badge>
          </div>
          {query.contact_number && (
            <CardDescription className="flex items-center gap-1 text-xs text-muted-foreground">
              <PhoneCall className="w-3 h-3 shrink-0" />
              <span>{query.contact_number}</span>
            </CardDescription>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <PermissionGate module="queries" action="write">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => onEdit(query)}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          </PermissionGate>
          <PermissionGate module="queries" action="delete">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive/70 hover:text-destructive"
              onClick={() => onDelete(query.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </PermissionGate>
        </div>
      </div>
    </CardHeader>
    <CardContent className="space-y-2.5 px-3.5 pb-3.5 sm:p-4 pt-0">
      <p className="text-xs sm:text-sm text-foreground/90 line-clamp-3">{query.query_text}</p>
      
      {query.notes && (
        <div className="text-[11px] text-muted-foreground bg-muted/50 p-2 rounded-lg">
          <strong className="font-semibold text-foreground/80">Notes:</strong> {query.notes}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-border/40 gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0 flex-1">
          {query.due_date && (
            <div className="flex items-center gap-1 text-[11px] shrink-0">
              <CalendarIcon className="w-3 h-3" />
              <span>{format(parseISO(query.due_date), 'MMM dd')}</span>
            </div>
          )}
          {query.assigned_to && (
            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4.5 truncate max-w-[100px]">
              {query.assigned_to}
            </Badge>
          )}
        </div>
        <Select
          value={query.status}
          onValueChange={(value) => onStatusChange(query.id, value)}
        >
          <SelectTrigger className="h-7 w-[115px] sm:w-[130px] text-xs shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background z-50">
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </CardContent>
  </Card>
));

QueryCard.displayName = "QueryCard";

export default function Queries() {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingQuery, setEditingQuery] = useState<any>(null);
  const [deleteQueryId, setDeleteQueryId] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [displayCount, setDisplayCount] = useState<number>(20);

  const { queries, isLoading, deleteQuery, updateQuery } = useQueries();
  const queryClient = useQueryClient();

  // 300ms Debounced search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim().toLowerCase());
      setDisplayCount(20);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Pull-to-refresh functionality
  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['queries'] });
    toast.success("Queries refreshed");
  };

  const { containerRef, isPulling, isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  const filteredQueries = useMemo(() => {
    let filtered = Array.isArray(queries) ? queries : [];

    if (debouncedSearch) {
      filtered = filtered.filter((query: any) =>
        [query.client_name, query.contact_number, query.query_text]
          .filter(Boolean)
          .some((v: string) => v.toLowerCase().includes(debouncedSearch))
      );
    }

    if (filterPriority !== "all") {
      filtered = filtered.filter((query: any) => query.priority === filterPriority);
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter((query: any) => query.status === filterStatus);
    }

    return filtered.sort((a: any, b: any) => {
      const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
      const priorityDiff = (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
      if (priorityDiff !== 0) return priorityDiff;

      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      if (a.due_date) return -1;
      if (b.due_date) return 1;

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [queries, debouncedSearch, filterPriority, filterStatus]);

  const stats = useMemo(() => {
    const allQueries = Array.isArray(queries) ? queries : [];
    return {
      total: allQueries.length,
      pending: allQueries.filter((q: any) => q.status === 'pending').length,
      inProgress: allQueries.filter((q: any) => q.status === 'in-progress').length,
      completed: allQueries.filter((q: any) => q.status === 'completed').length,
      urgent: allQueries.filter((q: any) => q.priority === 'urgent' && q.status !== 'completed').length,
    };
  }, [queries]);

  const handleStatusChange = useCallback(async (queryId: string, newStatus: string) => {
    try {
      const query = queries.find((q: any) => q.id === queryId);
      if (!query) return;

      const updatedData: any = { status: newStatus };
      if (newStatus === 'completed') {
        updatedData.completed_at = new Date().toISOString();
      }

      await updateQuery.mutateAsync({ id: queryId, query: updatedData });
      toast.success("Query status updated");
    } catch (error) {
      toast.error("Failed to update status");
    }
  }, [queries, updateQuery]);

  const handleDeleteConfirm = useCallback((id: string) => {
    setDeleteQueryId(id);
  }, []);

  const handleEdit = useCallback((query: any) => {
    setEditingQuery(query);
    setShowAddDialog(true);
  }, []);

  const queriesByStatus = useMemo(() => ({
    all: filteredQueries,
    pending: filteredQueries.filter((q: any) => q.status === 'pending'),
    completed: filteredQueries.filter((q: any) => q.status === 'completed'),
  }), [filteredQueries]);

  const handleDelete = async () => {
    if (!deleteQueryId) return;
    try {
      await deleteQuery.mutateAsync(deleteQueryId);
      toast.success("Query deleted successfully");
    } catch (error) {
      toast.error("Failed to delete query");
    } finally {
      setDeleteQueryId(null);
    }
  };

  const renderTabContent = (items: any[]) => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4 space-y-3">
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-12" />
              </div>
              <Skeleton className="h-10 w-full" />
              <div className="flex justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-24" />
              </div>
            </Card>
          ))}
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-sm text-muted-foreground mb-3">No queries found</p>
            <Button onClick={() => setShowAddDialog(true)} variant="outline" size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" />
              Add Query
            </Button>
          </CardContent>
        </Card>
      );
    }

    const visibleItems = items.slice(0, displayCount);
    const hasMore = items.length > displayCount;

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {visibleItems.map((query: any) => (
            <QueryCard
              key={query.id}
              query={query}
              onEdit={handleEdit}
              onDelete={handleDeleteConfirm}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
        {hasMore && (
          <div className="text-center pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDisplayCount((prev) => prev + 20)}
              className="text-xs h-9 px-4 gap-1.5"
            >
              <span>Load More ({items.length - displayCount} remaining)</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={containerRef} className="relative h-full overflow-auto">
      {/* Pull-to-refresh indicator */}
      <div 
        className="absolute top-0 left-0 right-0 flex items-center justify-center transition-all duration-200 ease-out z-50 pointer-events-none"
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

      <div className="space-y-3 sm:space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 pt-0.5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Client Queries</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Manage client inquiries and follow-ups</p>
          </div>
          <PermissionGate module="queries" action="write">
            <Button onClick={() => { setEditingQuery(null); setShowAddDialog(true); }} size="sm" className="gap-1.5 h-9 shrink-0">
              <Plus className="w-4 h-4" />
              <span>Add Query</span>
            </Button>
          </PermissionGate>
        </div>

        {/* Stats Cards - Hidden on Mobile (< 768px), rendered cleanly on desktop */}
        <div className="hidden md:grid grid-cols-4 gap-3">
          <Card>
            <CardHeader className="pb-1 p-3">
              <CardDescription className="text-xs">Total Queries</CardDescription>
              <CardTitle className="text-xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-1 p-3">
              <CardDescription className="text-xs">Pending</CardDescription>
              <CardTitle className="text-xl text-muted-foreground">{stats.pending}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-1 p-3">
              <CardDescription className="text-xs">Completed</CardDescription>
              <CardTitle className="text-xl text-success">{stats.completed}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-1 p-3">
              <CardDescription className="text-xs">Urgent</CardDescription>
              <CardTitle className="text-xl text-destructive">{stats.urgent}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Filters Row */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by client name, contact, query..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 h-10 bg-card/60 border-border/60 rounded-xl text-sm"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <Select value={filterPriority} onValueChange={(val) => { setFilterPriority(val); setDisplayCount(20); }}>
              <SelectTrigger className="w-full sm:w-[140px] h-10 rounded-xl text-xs">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={(val) => { setFilterStatus(val); setDisplayCount(20); }}>
              <SelectTrigger className="w-full sm:w-[140px] h-10 rounded-xl text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Queries Tabs */}
        <Tabs defaultValue="all" className="w-full" onValueChange={() => setDisplayCount(20)}>
          <TabsList className="grid grid-cols-3 max-w-sm h-9">
            <TabsTrigger value="all" className="text-xs">All ({queriesByStatus.all.length})</TabsTrigger>
            <TabsTrigger value="pending" className="text-xs">Pending ({queriesByStatus.pending.length})</TabsTrigger>
            <TabsTrigger value="completed" className="text-xs">Completed ({queriesByStatus.completed.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-3">
            {renderTabContent(queriesByStatus.all)}
          </TabsContent>

          <TabsContent value="pending" className="mt-3">
            {renderTabContent(queriesByStatus.pending)}
          </TabsContent>

          <TabsContent value="completed" className="mt-3">
            {renderTabContent(queriesByStatus.completed)}
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <AddQueryDialog
          open={showAddDialog}
          onOpenChange={(open) => {
            setShowAddDialog(open);
            if (!open) setEditingQuery(null);
          }}
          editQuery={editingQuery}
        />

        <AlertDialog open={!!deleteQueryId} onOpenChange={() => setDeleteQueryId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Query?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this query. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
