import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mail, CheckCircle, XCircle, Clock, RefreshCw, Filter, Trash2, AlertTriangle, Calendar, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { sendEmail } from '@/lib/emailService';
import { useAgency } from '@/hooks/useAgency';
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

type DateFilterPreset = 'current_month' | 'last_month' | 'last_3_months' | 'year_to_date' | 'all_time' | 'custom';

const getDateRangeFromPreset = (preset: DateFilterPreset): { from: Date; to: Date } | null => {
  const now = new Date();
  switch (preset) {
    case 'current_month':
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'last_month':
      const lastMonth = subMonths(now, 1);
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
    case 'last_3_months':
      return { from: startOfMonth(subMonths(now, 2)), to: endOfMonth(now) };
    case 'year_to_date':
      return { from: startOfYear(now), to: now };
    case 'all_time':
      return null;
    default:
      return null;
  }
};

const getFilterLabel = (preset: DateFilterPreset, customRange?: DateRange): string => {
  switch (preset) {
    case 'current_month': return 'This Month';
    case 'last_month': return 'Last Month';
    case 'last_3_months': return 'Last 3 Months';
    case 'year_to_date': return 'Year to Date';
    case 'all_time': return 'All Time';
    case 'custom':
      if (customRange?.from) {
        return customRange.to
          ? `${format(customRange.from, 'MMM d')} - ${format(customRange.to, 'MMM d, yyyy')}`
          : format(customRange.from, 'MMM d, yyyy');
      }
      return 'Custom Range';
    default: return 'This Month';
  }
};

export default function EmailHistory() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'single' | 'bulk', id?: string }>({ type: 'single' });
  const [datePreset, setDatePreset] = useState<DateFilterPreset>('current_month');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const queryClient = useQueryClient();
  const { data: agency } = useAgency();

  const getActiveDateRange = (): { from: Date; to: Date } | null => {
    if (datePreset === 'custom' && customRange?.from) {
      return { from: customRange.from, to: customRange.to || customRange.from };
    }
    return getDateRangeFromPreset(datePreset);
  };

  const handlePresetClick = (preset: DateFilterPreset) => {
    if (preset === 'custom') {
      setShowCustomDialog(true);
    } else {
      setDatePreset(preset);
    }
  };

  const handleCustomApply = () => {
    if (customRange?.from) {
      setDatePreset('custom');
      setShowCustomDialog(false);
    }
  };

  const activeDateRange = getActiveDateRange();

  const { data: emailLogs, isLoading } = useQuery({
    queryKey: ['email-logs', statusFilter, typeFilter, datePreset, customRange?.from?.toISOString(), customRange?.to?.toISOString()],
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
        query = query.gte('sent_at', activeDateRange.from.toISOString());
        query = query.lte('sent_at', activeDateRange.to.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ type, id }: { type: 'single' | 'bulk', id?: string }) => {
      // Get current user's agency_id for RLS
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .single();

      if (!profile?.agency_id) {
        throw new Error('Agency not found');
      }

      if (type === 'single' && id) {
        const { error } = await supabase
          .from('email_logs')
          .delete()
          .eq('id', id)
          .eq('agency_id', profile.agency_id);
        if (error) throw error;
        return { deleted: 1 };
      } else if (type === 'bulk') {
        // Build delete query with agency filter
        let query = supabase
          .from('email_logs')
          .delete()
          .eq('agency_id', profile.agency_id);
        
        if (statusFilter !== 'all') {
          query = query.eq('status', statusFilter);
        }
        if (typeFilter !== 'all') {
          query = query.eq('email_type', typeFilter);
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
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
            <CheckCircle className="w-3 h-3 mr-1" />
            Success
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
            <XCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      case 'queued':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">
            <Clock className="w-3 h-3 mr-1" />
            Queued
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Mail className="w-8 h-8" />
            Email History
          </h1>
          <p className="text-muted-foreground mt-1">
            Track all sent emails with delivery status
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between flex-wrap gap-2">
            <span>Email Logs</span>
            <div className="flex flex-wrap gap-2">
              {/* Date Range Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Calendar className="w-4 h-4" />
                    {getFilterLabel(datePreset, customRange)}
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => handlePresetClick('current_month')}>
                    This Month
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handlePresetClick('last_month')}>
                    Last Month
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handlePresetClick('last_3_months')}>
                    Last 3 Months
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handlePresetClick('year_to_date')}>
                    Year to Date
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handlePresetClick('all_time')}>
                    All Time
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handlePresetClick('custom')}>
                    Custom Range...
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="queued">Queued</SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="booking">Booking</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="flight_reminder">Flight Reminder</SelectItem>
                  <SelectItem value="payment_reminder">Payment Reminder</SelectItem>
                </SelectContent>
              </Select>

              {emailLogs && emailLogs.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteClick('bulk')}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete {statusFilter !== 'all' || typeFilter !== 'all' ? 'Filtered' : 'All'}
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading email history...
              </div>
            ) : emailLogs && emailLogs.length > 0 ? (
              <div className="space-y-3">
                {emailLogs.map((log) => (
                  <Card key={log.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(log.status)}
                          <Badge variant="outline">{getTypeLabel(log.email_type)}</Badge>
                          {log.retry_count > 0 && (
                            <Badge variant="secondary">
                              Retry #{log.retry_count}
                            </Badge>
                          )}
                        </div>

                        <div>
                          <p className="font-medium">{log.subject}</p>
                          <p className="text-sm text-muted-foreground">
                            To: {log.recipient_email}
                          </p>
                          {log.clients && (
                            <p className="text-sm text-muted-foreground">
                              Client: {log.clients.name}
                            </p>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground">
                          {format(new Date(log.sent_at), 'PPp')}
                        </p>

                        {log.error_message && (
                          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-2">
                            <p className="text-xs text-red-800 dark:text-red-200">
                              Error: {log.error_message}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {log.status === 'failed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => retryMutation.mutate(log.id)}
                            disabled={retryMutation.isPending}
                          >
                            <RefreshCw className="w-4 h-4 mr-1" />
                            Retry
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteClick('single', log.id)}
                          disabled={deleteMutation.isPending}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Mail className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">No email logs found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Email history will appear here once you start sending emails
                </p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Custom Date Range Dialog */}
      <Dialog open={showCustomDialog} onOpenChange={setShowCustomDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Custom Date Range</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <CalendarComponent
              mode="range"
              selected={customRange}
              onSelect={setCustomRange}
              numberOfMonths={2}
              className="pointer-events-auto"
            />
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                {customRange?.from && (
                  <>
                    {format(customRange.from, "MMM dd, yyyy")}
                    {customRange.to && ` - ${format(customRange.to, "MMM dd, yyyy")}`}
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowCustomDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCustomApply} disabled={!customRange?.from}>
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget.type === 'single' 
                ? 'Are you sure you want to delete this email log? This action cannot be undone.'
                : `Are you sure you want to delete ${statusFilter !== 'all' || typeFilter !== 'all' ? 'all filtered' : 'ALL'} email logs? This will permanently remove ${emailLogs?.length || 0} log${emailLogs && emailLogs.length > 1 ? 's' : ''} and cannot be undone.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
