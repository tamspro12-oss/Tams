import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, Trash2, Pencil, CheckCircle2, Clock, AlertCircle, PhoneCall, Calendar as CalendarIcon, RefreshCw } from "lucide-react";
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

export default function Queries() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingQuery, setEditingQuery] = useState<any>(null);
  const [deleteQueryId, setDeleteQueryId] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const { queries, isLoading, deleteQuery, updateQuery } = useQueries();
  const queryClient = useQueryClient();

  // Pull-to-refresh functionality
  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['queries'] });
    toast.success("Queries refreshed");
  };

  const { containerRef, isPulling, isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  const filteredQueries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let filtered = Array.isArray(queries) ? queries : [];

    if (q) {
      filtered = filtered.filter((query: any) =>
        [query.client_name, query.contact_number, query.query_text]
          .filter(Boolean)
          .some((v: string) => v.toLowerCase().includes(q))
      );
    }

    if (filterPriority !== "all") {
      filtered = filtered.filter((query: any) => query.priority === filterPriority);
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter((query: any) => query.status === filterStatus);
    }

    return filtered.sort((a: any, b: any) => {
      // Sort by priority (urgent > high > medium > low)
      const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by due date (earliest first)
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      if (a.due_date) return -1;
      if (b.due_date) return 1;

      // Finally by created date (newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [queries, searchQuery, filterPriority, filterStatus]);

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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-destructive text-destructive-foreground";
      case "high": return "bg-orange-500 text-white";
      case "medium": return "bg-yellow-500 text-white";
      case "low": return "bg-blue-500 text-white";
      default: return "";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="w-4 h-4 text-success" />;
      case "in-progress": return <Clock className="w-4 h-4 text-primary" />;
      case "pending": return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
      default: return null;
    }
  };

  const handleStatusChange = async (queryId: string, newStatus: string) => {
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
  };

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

  const queriesByStatus = {
    pending: filteredQueries.filter((q: any) => q.status === 'pending'),
    inProgress: filteredQueries.filter((q: any) => q.status === 'in-progress'),
    completed: filteredQueries.filter((q: any) => q.status === 'completed'),
  };

  const QueryCard = ({ query }: { query: any }) => (
    <Card key={query.id} className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-base">{query.client_name}</CardTitle>
              <Badge variant="outline" className={getPriorityColor(query.priority)}>
                {query.priority}
              </Badge>
            </div>
            {query.contact_number && (
              <CardDescription className="flex items-center gap-1 text-xs">
                <PhoneCall className="w-3 h-3" />
                {query.contact_number}
              </CardDescription>
            )}
          </div>
          <div className="flex gap-1">
            <PermissionGate module="queries" action="write">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setEditingQuery(query);
                  setShowAddDialog(true);
                }}
              >
                <Pencil className="w-4 h-4" />
              </Button>
            </PermissionGate>
            <PermissionGate module="queries" action="delete">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => setDeleteQueryId(query.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </PermissionGate>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">{query.query_text}</p>
        
        {query.notes && (
          <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
            <strong>Notes:</strong> {query.notes}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {query.due_date && (
              <div className="flex items-center gap-1">
                <CalendarIcon className="w-3 h-3" />
                {format(parseISO(query.due_date), 'MMM dd, yyyy')}
              </div>
            )}
            {query.assigned_to && (
              <Badge variant="secondary" className="text-xs">
                {query.assigned_to}
              </Badge>
            )}
          </div>
          <Select
            value={query.status}
            onValueChange={(value) => handleStatusChange(query.id, value)}
          >
            <SelectTrigger className="h-7 w-[130px] text-xs">
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
  );

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <p className="text-muted-foreground">Loading queries...</p>
      </div>
    );
  }

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

      <div className="space-y-2 sm:space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Client Queries</h1>
          <p className="text-muted-foreground mt-1">Manage client inquiries and follow-ups</p>
        </div>
        <PermissionGate module="queries" action="write">
          <Button onClick={() => { setEditingQuery(null); setShowAddDialog(true); }} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Query
          </Button>
        </PermissionGate>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-3">
        <Card>
          <CardHeader className="pb-1 sm:pb-2 p-2 sm:p-4">
            <CardDescription className="text-xs">Total</CardDescription>
            <CardTitle className="text-base sm:text-xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1 sm:pb-2 p-2 sm:p-4">
            <CardDescription className="text-xs">Pending</CardDescription>
            <CardTitle className="text-base sm:text-xl text-muted-foreground">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1 sm:pb-2 p-2 sm:p-4">
            <CardDescription className="text-xs">Completed</CardDescription>
            <CardTitle className="text-base sm:text-xl text-success">{stats.completed}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1 sm:pb-2 p-2 sm:p-4">
            <CardDescription className="text-xs">Urgent</CardDescription>
            <CardTitle className="text-base sm:text-xl text-destructive">{stats.urgent}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search by client name, contact, or query..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[150px]">
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
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]">
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

      {/* Queries Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All ({filteredQueries.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({queriesByStatus.pending.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({queriesByStatus.completed.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-2 mt-2">
          {filteredQueries.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground mb-4">No queries found</p>
                <Button onClick={() => setShowAddDialog(true)} variant="outline" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Your First Query
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {filteredQueries.map((query: any) => (
                <QueryCard key={query.id} query={query} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-2 mt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {queriesByStatus.pending.map((query: any) => (
              <QueryCard key={query.id} query={query} />
            ))}
          </div>
        </TabsContent>


        <TabsContent value="completed" className="space-y-2 mt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {queriesByStatus.completed.map((query: any) => (
              <QueryCard key={query.id} query={query} />
            ))}
          </div>
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
