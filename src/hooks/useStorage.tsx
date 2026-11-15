import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cloudStorage } from '@/lib/storage/cloudStorageProvider';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { useCurrentAgencyId } from '@/hooks/useCurrentAgencyId';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { invalidateAllFinancialQueries } from '@/lib/accountingEngine';
import { parseSupabaseError } from '@/lib/supabaseErrorHandler';

export function useClients() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: userAgencyId } = useCurrentAgencyId();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients', userAgencyId],
    enabled: !!userAgencyId,
    queryFn: () => cloudStorage.getClients(),
  });

  // Smart real-time sync for clients
  useRealtimeTable({
    table: 'clients',
    filter: userAgencyId ? `agency_id=eq.${userAgencyId}` : undefined,
    enabled: !!userAgencyId,
    channelPrefix: 'clients-changes',
    onInsert: (payload: any) => {
      if (payload.new.agency_id !== userAgencyId) {
        console.error('SECURITY: Received client data from different agency!', payload.new);
        return;
      }
      queryClient.setQueryData(['clients', userAgencyId], (old: any[] = []) => {
        if (!Array.isArray(old)) return [payload.new];
        if (old.some((item) => item.id === payload.new.id)) {
          return old.map((item) => (item.id === payload.new.id ? payload.new : item));
        }
        return [payload.new, ...old];
      });
    },
    onUpdate: (payload: any) => {
      if (payload.new.agency_id !== userAgencyId) {
        console.error('SECURITY: Received client update from different agency!', payload.new);
        return;
      }
      queryClient.setQueryData(['clients', userAgencyId], (old: any[] = []) => {
        if (!Array.isArray(old)) return [payload.new];
        return old.map(item => item.id === payload.new.id ? payload.new : item);
      });
    },
    onDelete: (payload: any) => {
      if (payload.old.agency_id !== userAgencyId) {
        console.error('SECURITY: Received client deletion from different agency!', payload.old);
        return;
      }
      queryClient.setQueryData(['clients', userAgencyId], (old: any[] = []) => {
        if (!Array.isArray(old)) return [];
        return old.filter(item => item.id !== payload.old.id);
      });
    },
  });

  const isOnline = useOnlineStatus();

  const addClient = useMutation({
    mutationFn: async (client: any) => {
      if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        throw new Error('You are offline. Connect to the internet to save changes.');
      }
      return cloudStorage.addClient(client);
    },
    onSuccess: () => {
      invalidateAllFinancialQueries(queryClient, userAgencyId);
      toast({ title: 'Client added successfully' });
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
    },
    onError: (err) => {
      console.error('[useClients.addClient]', err);
      toast({
        title: 'Error adding client',
        description: parseSupabaseError(err, 'Failed to add client. Please try again.').userMessage,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const updateClient = useMutation({
    mutationFn: async ({ id, client }: { id: string; client: any }) => {
      if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        throw new Error('You are offline. Connect to the internet to save changes.');
      }
      return cloudStorage.updateClient(id, client);
    },
    onMutate: async ({ id, client }) => {
      await queryClient.cancelQueries({ queryKey: ['clients', userAgencyId] });
      const previousClients = queryClient.getQueryData(['clients', userAgencyId]);

      queryClient.setQueryData(['clients', userAgencyId], (old: any[] = []) =>
        old.map(item => item.id === id ? { ...item, ...client } : item)
      );

      return { previousClients };
    },
    onSuccess: () => {
      invalidateAllFinancialQueries(queryClient, userAgencyId);
      toast({ title: 'Client updated successfully' });
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
    },
    onError: (err, _vars, context: any) => {
      console.error('[useClients.updateClient]', err);
      if (context?.previousClients) {
        queryClient.setQueryData(['clients', userAgencyId], context.previousClients);
      }
      toast({
        title: 'Error updating client',
        description: parseSupabaseError(err, 'Failed to update client. Please try again.').userMessage,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        throw new Error('You are offline. Connect to the internet to delete.');
      }
      return cloudStorage.deleteClient(id);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['clients', userAgencyId] });
      const previousClients = queryClient.getQueryData(['clients', userAgencyId]);

      queryClient.setQueryData(['clients', userAgencyId], (old: any[] = []) =>
        old.filter(item => item.id !== id)
      );

      return { previousClients };
    },
    onSuccess: () => {
      invalidateAllFinancialQueries(queryClient, userAgencyId);
      toast({ title: 'Client deleted successfully' });
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
    },
    onError: (err, _id, context: any) => {
      console.error('[useClients.deleteClient]', err);
      if (context?.previousClients) {
        queryClient.setQueryData(['clients', userAgencyId], context.previousClients);
      }
      toast({
        title: 'Error deleting client',
        description: parseSupabaseError(err, 'Failed to delete client. Please try again.').userMessage,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  return { clients, isLoading, addClient, updateClient, deleteClient };
}

export function useBookings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: userAgencyId } = useCurrentAgencyId();

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['bookings', userAgencyId],
    enabled: !!userAgencyId,
    queryFn: () => cloudStorage.getBookings(),
  });

  // Real-time sync for bookings
  useRealtimeTable({
    table: 'bookings',
    filter: userAgencyId ? `agency_id=eq.${userAgencyId}` : undefined,
    enabled: !!userAgencyId,
    channelPrefix: 'bookings-changes',
    onChange: (payload: any) => {
      const data = payload.new || payload.old || {};
      if ('agency_id' in data && data.agency_id !== userAgencyId) {
        console.error('SECURITY: Received booking data from different agency!', data);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });

  const isOnlineBooking = useOnlineStatus();

  const addBooking = useMutation({
    mutationFn: async (booking: any) => {
      if (!isOnlineBooking || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        throw new Error('You are offline. Connect to the internet to save changes.');
      }
      return cloudStorage.addBooking(booking);
    },
    onSuccess: () => {
      invalidateAllFinancialQueries(queryClient, userAgencyId);
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast({ title: 'Booking added successfully' });
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
    },
    onError: (err: unknown) => {
      console.error('[useBookings.addBooking]', err);
      toast({
        title: 'Failed to add booking',
        description: parseSupabaseError(err, 'Failed to add booking').userMessage,
        variant: 'destructive',
      });
    },
  });

  const updateBooking = useMutation({
    mutationFn: async ({ id, booking }: { id: string; booking: any }) => {
      if (!isOnlineBooking || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        throw new Error('You are offline. Connect to the internet to save changes.');
      }
      return cloudStorage.updateBooking(id, booking);
    },
    onSuccess: () => {
      invalidateAllFinancialQueries(queryClient, userAgencyId);
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast({ title: 'Booking updated successfully' });
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
    },
    onError: (err: unknown) => {
      console.error('[useBookings.updateBooking]', err);
      toast({
        title: 'Failed to update booking',
        description: parseSupabaseError(err, 'Failed to update booking').userMessage,
        variant: 'destructive',
      });
    },
  });

  const deleteBooking = useMutation({
    mutationFn: async (id: string) => {
      if (!isOnlineBooking || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        throw new Error('You are offline. Connect to the internet to delete.');
      }
      return cloudStorage.deleteBooking(id);
    },
    onSuccess: () => {
      invalidateAllFinancialQueries(queryClient, userAgencyId);
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast({ title: 'Booking deleted successfully' });
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
    },
    onError: (err: unknown) => {
      console.error('[useBookings.deleteBooking]', err);
      toast({
        title: 'Failed to delete booking',
        description: parseSupabaseError(err, 'Failed to delete booking').userMessage,
        variant: 'destructive',
      });
    },
  });

  return { bookings, isLoading, addBooking, updateBooking, deleteBooking };
}

export function useExpenses() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: userAgencyId } = useCurrentAgencyId();

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses', userAgencyId],
    enabled: !!userAgencyId,
    queryFn: () => cloudStorage.getExpenses(),
  });

  // Smart real-time sync for expenses
  useRealtimeTable({
    table: 'expenses',
    filter: userAgencyId ? `agency_id=eq.${userAgencyId}` : undefined,
    enabled: !!userAgencyId,
    channelPrefix: 'expenses-changes',
    onInsert: (payload: any) => {
      if (payload.new.agency_id !== userAgencyId) {
        console.error('SECURITY: Received expense data from different agency!', payload.new);
        return;
      }
      queryClient.setQueryData(['expenses', userAgencyId], (old: any[] = []) => {
        if (!Array.isArray(old)) return [payload.new];
        if (old.some((item) => item.id === payload.new.id)) {
          return old.map((item) => (item.id === payload.new.id ? payload.new : item));
        }
        return [payload.new, ...old];
      });
    },
    onUpdate: (payload: any) => {
      if (payload.new.agency_id !== userAgencyId) {
        console.error('SECURITY: Received expense update from different agency!', payload.new);
        return;
      }
      queryClient.setQueryData(['expenses', userAgencyId], (old: any[] = []) => {
        if (!Array.isArray(old)) return [payload.new];
        return old.map(item => item.id === payload.new.id ? payload.new : item);
      });
    },
    onDelete: (payload: any) => {
      if (payload.old.agency_id !== userAgencyId) {
        console.error('SECURITY: Received expense deletion from different agency!', payload.old);
        return;
      }
      queryClient.setQueryData(['expenses', userAgencyId], (old: any[] = []) => {
        if (!Array.isArray(old)) return [];
        return old.filter(item => item.id !== payload.old.id);
      });
    },
  });

  const isOnlineExpense = useOnlineStatus();

  const addExpense = useMutation({
    mutationFn: async (expense: any) => {
      if (!isOnlineExpense || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        throw new Error('You are offline. Connect to the internet to save changes.');
      }
      return cloudStorage.addExpense(expense);
    },
    onSuccess: () => {
      invalidateAllFinancialQueries(queryClient, userAgencyId);
      toast({ title: 'Expense added successfully' });
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
    },
    onError: (err: unknown) => {
      console.error('[useExpenses.addExpense]', err);
      toast({
        title: 'Failed to add expense',
        description: parseSupabaseError(err, 'Failed to add expense').userMessage,
        variant: 'destructive',
      });
    },
  });

  const updateExpense = useMutation({
    mutationFn: async ({ id, expense }: { id: string; expense: any }) => {
      if (!isOnlineExpense || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        throw new Error('You are offline. Connect to the internet to save changes.');
      }
      return cloudStorage.updateExpense(id, expense);
    },
    onSuccess: () => {
      invalidateAllFinancialQueries(queryClient, userAgencyId);
      toast({ title: 'Expense updated successfully' });
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
    },
    onError: (err: unknown) => {
      console.error('[useExpenses.updateExpense]', err);
      toast({
        title: 'Failed to update expense',
        description: parseSupabaseError(err, 'Failed to update expense').userMessage,
        variant: 'destructive',
      });
    },
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      if (!isOnlineExpense || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        throw new Error('You are offline. Connect to the internet to delete.');
      }
      return cloudStorage.deleteExpense(id);
    },
    onSuccess: () => {
      invalidateAllFinancialQueries(queryClient, userAgencyId);
      toast({ title: 'Expense deleted successfully' });
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
    },
    onError: (err: unknown) => {
      console.error('[useExpenses.deleteExpense]', err);
      toast({
        title: 'Failed to delete expense',
        description: parseSupabaseError(err, 'Failed to delete expense').userMessage,
        variant: 'destructive',
      });
    },
  });

  return { expenses, isLoading, addExpense, updateExpense, deleteExpense };
}

export function useVendors() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: userAgencyId } = useCurrentAgencyId();

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ['vendors', userAgencyId],
    enabled: !!userAgencyId,
    queryFn: () => cloudStorage.getVendors(),
  });

  // Smart real-time sync for vendors
  useRealtimeTable({
    table: 'vendors',
    filter: userAgencyId ? `agency_id=eq.${userAgencyId}` : undefined,
    enabled: !!userAgencyId,
    channelPrefix: 'vendors-changes',
    onInsert: (payload: any) => {
      if (payload.new.agency_id !== userAgencyId) {
        console.error('SECURITY: Received vendor data from different agency!', payload.new);
        return;
      }
      queryClient.setQueryData(['vendors', userAgencyId], (old: any[] = []) => {
        if (!Array.isArray(old)) return [payload.new];
        if (old.some((item) => item.id === payload.new.id)) {
          return old.map((item) => (item.id === payload.new.id ? payload.new : item));
        }
        return [payload.new, ...old];
      });
    },
    onUpdate: (payload: any) => {
      if (payload.new.agency_id !== userAgencyId) {
        console.error('SECURITY: Received vendor update from different agency!', payload.new);
        return;
      }
      queryClient.setQueryData(['vendors', userAgencyId], (old: any[] = []) => {
        if (!Array.isArray(old)) return [payload.new];
        return old.map(item => item.id === payload.new.id ? payload.new : item);
      });
    },
    onDelete: (payload: any) => {
      if (payload.old.agency_id !== userAgencyId) {
        console.error('SECURITY: Received vendor deletion from different agency!', payload.old);
        return;
      }
      queryClient.setQueryData(['vendors', userAgencyId], (old: any[] = []) => {
        if (!Array.isArray(old)) return [];
        return old.filter(item => item.id !== payload.old.id);
      });
    },
  });

  const isOnlineVendor = useOnlineStatus();

  const addVendor = useMutation({
    mutationFn: async (vendor: any) => {
      if (!isOnlineVendor || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        throw new Error('You are offline. Connect to the internet to save changes.');
      }
      return cloudStorage.addVendor(vendor);
    },
    onSuccess: () => {
      invalidateAllFinancialQueries(queryClient, userAgencyId);
      toast({ title: 'Vendor added successfully' });
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
    },
    onError: (err: unknown) => {
      console.error('[useVendors.addVendor]', err);
      toast({
        title: 'Error adding vendor',
        description: parseSupabaseError(err, 'Failed to add vendor').userMessage,
        variant: 'destructive',
      });
    },
  });

  const updateVendor = useMutation({
    mutationFn: async ({ id, vendor }: { id: string; vendor: any }) => {
      if (!isOnlineVendor || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        throw new Error('You are offline. Connect to the internet to save changes.');
      }
      return cloudStorage.updateVendor(id, vendor);
    },
    onSuccess: () => {
      invalidateAllFinancialQueries(queryClient, userAgencyId);
      toast({ title: 'Vendor updated successfully' });
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
    },
    onError: (err: unknown) => {
      console.error('[useVendors.updateVendor]', err);
      toast({
        title: 'Error updating vendor',
        description: parseSupabaseError(err, 'Failed to update vendor').userMessage,
        variant: 'destructive',
      });
    },
  });

  const deleteVendor = useMutation({
    mutationFn: async (id: string) => {
      if (!isOnlineVendor || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        throw new Error('You are offline. Connect to the internet to delete.');
      }
      return cloudStorage.deleteVendor(id);
    },
    onSuccess: () => {
      invalidateAllFinancialQueries(queryClient, userAgencyId);
      toast({ title: 'Vendor deleted successfully' });
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
    },
    onError: (error: unknown) => {
      console.error('[useVendors.deleteVendor]', error);
      toast({
        title: 'Cannot Delete Vendor',
        description: parseSupabaseError(error, 'Failed to delete vendor').userMessage,
        variant: 'destructive',
      });
    },
  });

  return { vendors, isLoading, addVendor, updateVendor, deleteVendor };
}

// Hook for Queries
export function useQueries() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: userAgencyId } = useCurrentAgencyId();

  const { data: queries = [], isLoading } = useQuery({
    queryKey: ['queries', userAgencyId],
    enabled: !!userAgencyId,
    queryFn: async () => {
      return await cloudStorage.getQueries();
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // Setup realtime listener
  useRealtimeTable({
    table: 'queries',
    filter: userAgencyId ? `agency_id=eq.${userAgencyId}` : undefined,
    enabled: !!userAgencyId,
    channelPrefix: 'queries-changes',
    onChange: (payload: any) => {
      const data = payload.new || payload.old || {};
      if ('agency_id' in data && data.agency_id !== userAgencyId) {
        console.error('SECURITY: Received query data from different agency!', data);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['queries'] });
    },
  });

  const isOnlineQuery = useOnlineStatus();

  const addQuery = useMutation({
    mutationFn: async (query: any) => {
      if (!isOnlineQuery || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        throw new Error('You are offline. Connect to the internet to save changes.');
      }
      return await cloudStorage.addQuery(query);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queries'] });
      toast({ title: 'Query added successfully' });
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
    },
    onError: (error: unknown) => {
      console.error('[useQueries.addQuery]', error);
      toast({
        title: 'Failed to add query',
        description: parseSupabaseError(error, 'Failed to add query').userMessage,
        variant: 'destructive',
      });
    },
  });

  const updateQuery = useMutation({
    mutationFn: async ({ id, query }: { id: string; query: any }) => {
      if (!isOnlineQuery || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        throw new Error('You are offline. Connect to the internet to save changes.');
      }
      return await cloudStorage.updateQuery(id, query);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queries'] });
      toast({ title: 'Query updated successfully' });
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
    },
    onError: (error: unknown) => {
      console.error('[useQueries.updateQuery]', error);
      toast({
        title: 'Failed to update query',
        description: parseSupabaseError(error, 'Failed to update query').userMessage,
        variant: 'destructive',
      });
    },
  });

  const deleteQuery = useMutation({
    mutationFn: async (id: string) => {
      if (!isOnlineQuery || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        throw new Error('You are offline. Connect to the internet to delete.');
      }
      return await cloudStorage.deleteQuery(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queries'] });
      toast({ title: 'Query deleted successfully' });
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
    },
    onError: (error: unknown) => {
      console.error('[useQueries.deleteQuery]', error);
      toast({
        title: 'Failed to delete query',
        description: parseSupabaseError(error, 'Failed to delete query').userMessage,
        variant: 'destructive',
      });
    },
  });

  return { queries, isLoading, addQuery, updateQuery, deleteQuery };
}
