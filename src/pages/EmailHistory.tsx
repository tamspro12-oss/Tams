import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mail, CheckCircle, XCircle, Clock, RefreshCw, Filter, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAgency } from '@/hooks/useAgency';
import { getAuthenticatedAgencyId } from '@/lib/agencyContext';
import {
  DateFilter,
  DEFAULT_DATE_FILTER,
  DatePresetFilterValue,
  getDateRangeForPreset,
} from '@/components/DateFilter';
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

export default function EmailHistory() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<DatePresetFilterValue>(DEFAULT_DATE_FILTER);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'single' | 'bulk', id?: string }>({ type: 'single' });
  const queryClient = useQueryClient();
  const { data: agency } = useAgency();

  const activeDateRange = getDateRangeForPreset(dateFilter.preset, dateFilter.customFrom, dateFilter.customTo);

  const { data: emailLogs, isLoading } = useQuery({
    queryKey: ['email-logs', statusFilter, typeFilter, dateFilter.preset, dateFilter.customFrom, dateFilter.customTo],
    queryFn: async () => {
      let query = supabase
        .from('email_logs')
        .select('*, clients(name)')
        .order('sent_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (typeFilter !== 'all') {
        query = query.eq('email_type', typeFilter);
      }

      // Apply date range filter
      if (activeDateRange) {
        query = query.gte('sent_at', activeDateRange.start.toISOString());
        query = query.lte('sent_at', activeDateRange.end.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ type, id }: { type: 'single' | 'bulk', id?: string }) => {
      // Get current user's agency_id for RLS
      const agencyId = await getAuthenticatedAgencyId();

      if (!agencyId) {
        throw new Error('Agency not found');
      }

      if (type === 'single' && id) {
        const { error } = await supabase
          .from('email_logs')
          .delete()
          .eq('id', id)
          .eq('agency_id', agencyId);
        if (error) throw error;
        return { deleted: 1 };
      } else if (type === 'bulk') {
        // Build delete query with agency filter
        let query = supabase
          .from('email_logs')
          .delete()
          .eq('agency_id', agencyId);
        
        if (statusFilter !== 'all') {
          query = query.eq('status', statusFilter);
        }
        if (typeFilter !== 'all') {
          query = query.eq('email_type', typeFilter);
        }
        if (activeDateRange) {
          query = query.gte('sent_at', activeDateRange.start.toISOString());
          query = query.lte('sent_at', activeDateRange.end.toISOString());
        }
        
        const { data, error } = await query.select();
        if (error) throw error;
        return { deleted: data?.length || 0 };
      }
      throw new Error('Invalid delete operation');
    },
    onSuccess: (data) => {
      toast.success(`${data.deleted} email log${data.deleted > 1 ? 's' : ''} deleted successfully`);
      queryClient.invalidateQueries({ queryKey: ['email-logs'] });
      setShowDeleteDialog(false);
    },
    onError: (error: any) => {
      toast.error(`Delete failed: ${error.message}`);
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (logId: string) => {
      const log = emailLogs?.find(l => l.id === logId);
      if (!log || !agency) throw new Error('Log or agency not found');

      // Update retry count
      const { error: updateError } = await supabase
        .from('email_logs')
        .update({ retry_count: (log.retry_count || 0) + 1 })
        .eq('id', logId);

      if (updateError) throw updateError;

      // Note: Actual retry would need stored email body/attachments
      // This is a placeholder that marks the log as retried
      toast.info('Retry feature requires stored email content. Please resend from the original location.');
      return { success: true, message: 'Marked for retry' };
    },
    onSuccess: () => {
      toast.success('Email marked for retry');
      queryClient.invalidateQueries({ queryKey: ['email-logs'] });
    },
    onError: (error: any) => {
      toast.error(`Retry failed: ${error.message}`);
    },
  });

  const handleDeleteClick = (type: 'single' | 'bulk', id?: string) => {
    setDeleteTarget({ type, id });
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    deleteMutation.mutate(deleteTarget);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 text-xs">
            <CheckCircle className="w-3 h-3 mr-1" />
            Success
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100 text-xs">
            <XCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      case 'queued':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 text-xs">
            <Clock className="w-3 h-3 mr-1" />
            Queued
          </Badge>
        );
      default:
        return <Badge className="text-xs">{status}</Badge>;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      booking: 'Booking Confirmation',
      invoice: 'Invoice',
      flight_reminder: 'Flight Reminder',
      payment_reminder: 'Payment Reminder',
      general: 'General',
    };
    return labels[type] || type;
  };

  const isFiltered = statusFilter !== 'all' || typeFilter !== 'all' || dateFilter.preset !== 'all';

  return (
    <div className="space-y-4">
      {/* Header and Filter Row on same line, right-aligned */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
            <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            Email History
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track all sent emails with delivery status
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Shared DateFilter */}
          <DateFilter
            value={dateFilter}
            onChange={setDateFilter}
            triggerClassName="h-9 text-xs rounded-lg min-w-[130px]"
          />

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-xs rounded-lg w-[120px]">
              <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 text-xs rounded-lg w-[140px]">
              <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="booking">Booking</SelectItem>
              <SelectItem value="invoice">Invoice</SelectItem>
              <SelectItem value="flight_reminder">Flight Reminder</SelectItem>
              <SelectItem value="payment_reminder">Payment Reminder</SelectItem>
              <SelectItem value="general">General</SelectItem>
            </SelectContent>
          </Select>

          {emailLogs && emailLogs.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              className="h-9 text-xs rounded-lg"
              onClick={() => handleDeleteClick('bulk')}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Delete {isFiltered ? 'Filtered' : 'All'}
            </Button>
          )}
        </div>
      </div>

      {/* Logs List directly rendered, no inner "Email Logs" card */}
      <div className="rounded-lg border bg-card/60 p-3">
        <ScrollArea className="h-[480px]">
          {isLoading ? (
            <div className="text-center py-10 text-xs text-muted-foreground">
              Loading email history...
            </div>
          ) : emailLogs && emailLogs.length > 0 ? (
            <div className="space-y-2.5">
              {emailLogs.map((log) => (
                <div key={log.id} className="p-3 rounded-lg border bg-background/80 hover:bg-background transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {getStatusBadge(log.status)}
                        <Badge variant="outline" className="text-xs">{getTypeLabel(log.email_type)}</Badge>
                        {log.retry_count > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            Retry #{log.retry_count}
                          </Badge>
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="font-semibold text-xs sm:text-sm truncate">{log.subject}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          To: {log.recipient_email}
                        </p>
                        {log.clients && (
                          <p className="text-xs text-muted-foreground truncate">
                            Client: {log.clients.name}
                          </p>
                        )}
                      </div>

                      <p className="text-[11px] text-muted-foreground">
                        {format(new Date(log.sent_at), 'PPp')}
                      </p>

                      {log.error_message && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-1.5">
                          <p className="text-xs text-red-800 dark:text-red-200">
                            Error: {log.error_message}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {log.status === 'failed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => retryMutation.mutate(log.id)}
                          disabled={retryMutation.isPending}
                        >
                          <RefreshCw className="w-3.5 h-3.5 mr-1" />
                          Retry
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteClick('single', log.id)}
                        disabled={deleteMutation.isPending}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <Mail className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm font-semibold">No email logs found</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Email history will appear here once you start sending emails
              </p>
            </div>
          )}
        </ScrollArea>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-sm sm:text-base">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm">
              {deleteTarget.type === 'single' 
                ? 'Are you sure you want to delete this email log? This action cannot be undone.'
                : `Are you sure you want to delete ${isFiltered ? 'all filtered' : 'ALL'} email logs? This will permanently remove ${emailLogs?.length || 0} log${emailLogs && emailLogs.length > 1 ? 's' : ''} and cannot be undone.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending} className="h-8 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              className="h-8 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
