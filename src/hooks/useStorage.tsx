import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cloudStorage } from '@/lib/storage/cloudStorageProvider';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { useCurrentAgencyId } from '@/hooks/useCurrentAgencyId';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { addToOfflineQueue, getQueueCount } from '@/lib/offlineQueue';

export function useClients() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: userAgencyId } = useCurrentAgencyId();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => cloudStorage.getClients(),
  });

  // Smart real-time sync for clients - update cache directly instead of refetching
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
      console.log('Client added:', payload.new);
      queryClient.setQueryData(['clients'], (old: any[] = []) => {
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
      console.log('Client updated:', payload.new);
      queryClient.setQueryData(['clients'], (old: any[] = []) => {
        if (!Array.isArray(old)) return [payload.new];
        return old.map(item => item.id === payload.new.id ? payload.new : item);
      });
    },
    onDelete: (payload: any) => {
      if (payload.old.agency_id !== userAgencyId) {
        console.error('SECURITY: Received client deletion from different agency!', payload.old);
        return;
      }
      console.log('Client deleted:', payload.old);
      queryClient.setQueryData(['clients'], (old: any[] = []) => {
        if (!Array.isArray(old)) return [];
        return old.filter(item => item.id !== payload.old.id);
      });
    },
  });

  const isOnline = useOnlineStatus();

  const addClient = useMutation({
    mutationFn: async (client: any) => {
      if (!isOnline) {
        // Queue for offline sync
        const agencyId = localStorage.getItem('tams_agency_id');
        addToOfflineQueue({
          type: 'add',
          table: 'clients',
          data: { ...client, agency_id: agencyId }
        });
        return { ...client, id: 'pending-' + Date.now(), _pending: true };
      }
      return cloudStorage.addClient(client);
    },
    onMutate: async (newClient) => {
      await queryClient.cancelQueries({ queryKey: ['clients'] });
      const previousClients = queryClient.getQueryData(['clients']);
      
      queryClient.setQueryData(['clients'], (old: any[] = []) => [
        { ...newClient, id: 'temp-' + Date.now(), _pending: !isOnline },
        ...old
      ]);
      
      return { previousClients };
    },
    onSuccess: (data, variables) => {
      if (!isOnline) {
        toast({ title: 'Client saved offline', description: 'Will sync when online' });
      } else {
        toast({ title: 'Client added successfully' });
      }
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
    },
    onError: (err, newClient, context: any) => {
      if (context?.previousClients) {
        queryClient.setQueryData(['clients'], context.previousClients);
      }
      toast({
        title: 'Error adding client',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      if (isOnline) {
        queryClient.invalidateQueries({ queryKey: ['clients'] });
      }
    },
  });

  const updateClient = useMutation({
    mutationFn: ({ id, client }: { id: string; client: any }) => 
      cloudStorage.updateClient(id, client),
    onMutate: async ({ id, client }) => {
      await queryClient.cancelQueries({ queryKey: ['clients'] });
      const previousClients = queryClient.getQueryData(['clients']);
      
      // Optimistically update
      queryClient.setQueryData(['clients'], (old: any[] = []) =>
        old.map(item => item.id === id ? { ...item, ...client } : item)
      );
      
      return { previousClients };
    },
    onSuccess: () => {
      toast({ title: 'Client updated successfully' });
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
    },
    onError: (err, vars, context: any) => {
      if (context?.previousClients) {
        queryClient.setQueryData(['clients'], context.previousClients);
      }
      toast({
        title: 'Error updating client',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const deleteClient = useMutation({
    mutationFn: (id: string) => cloudStorage.deleteClient(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['clients'] });
      const previousClients = queryClient.getQueryData(['clients']);
      
      // Optimistically remove
      queryClient.setQueryData(['clients'], (old: any[] = []) =>
        old.filter(item => item.id !== id)
      );
      
      return { previousClients };
    },
    onSuccess: () => {
      toast({ title: 'Client deleted successfully' });
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
    },
    onError: (err, id, context: any) => {
      if (context?.previousClients) {
        queryClient.setQueryData(['clients'], context.previousClients);
      }
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
    queryKey: ['bookings'],
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
      console.log('Bookings change detected:', payload.eventType);
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });

  const isOnlineBooking = useOnlineStatus();

  const addBooking = useMutation({
    mutationFn: async (booking: any) => {
      if (!isOnlineBooking) {
        const agencyId = localStorage.getItem('tams_agency_id');
        addToOfflineQueue({
          type: 'add',
          table: 'bookings',
          data: { ...booking, agency_id: agencyId }
        });
        return { ...booking, id: 'pending-' + Date.now(), _pending: true };
      }
      return cloudStorage.addBooking(booking);
    },
    onSuccess: () => {
      if (!isOnlineBooking) {
        toast({ title: 'Booking saved offline', description: 'Will sync when online' });
      } else {
        queryClient.invalidateQueries({ queryKey: ['bookings'] });
        toast({ title: 'Booking added successfully' });
      }
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
    },
  });

  const updateBooking = useMutation({
    mutationFn: ({ id, booking }: { id: string; booking: any }) => 
      cloudStorage.updateBooking(id, booking),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast({ title: 'Booking updated successfully' });
      // Extend session on activity
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
    },
  });

  const deleteBooking = useMutation({
    mutationFn: (id: string) => cloudStorage.deleteBooking(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast({ title: 'Booking deleted successfully' });
      // Extend session on activity
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
    },
  });

  return { bookings, isLoading, addBooking, updateBooking, deleteBooking };
}

export function useExpenses() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: userAgencyId } = useCurrentAgencyId();

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses'],
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
      queryClient.setQueryData(['expenses'], (old: any[] = []) => {
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
      queryClient.setQueryData(['expenses'], (old: any[] = []) => {
        if (!Array.isArray(old)) return [payload.new];
        return old.map(item => item.id === payload.new.id ? payload.new : item);
      });
    },
    onDelete: (payload: any) => {
      if (payload.old.agency_id !== userAgencyId) {
        console.error('SECURITY: Received expense deletion from different agency!', payload.old);
        return;
      }
      queryClient.setQueryData(['expenses'], (old: any[] = []) => {
        if (!Array.isArray(old)) return [];
        return old.filter(item => item.id !== payload.old.id);
      });
    },
  });

  const isOnlineExpense = useOnlineStatus();

  const addExpense = useMutation({
    mutationFn: async (expense: any) => {
      if (!isOnlineExpense) {
        const agencyId = localStorage.getItem('tams_agency_id');
        addToOfflineQueue({
          type: 'add',
          table: 'expenses',
          data: { ...expense, agency_id: agencyId }
        });
        return { ...expense, id: 'pending-' + Date.now(), _pending: true };
      }
      return cloudStorage.addExpense(expense);
    },
    onSuccess: () => {
      if (!isOnlineExpense) {
        toast({ title: 'Expense saved offline', description: 'Will sync when online' });
      } else {
        queryClient.invalidateQueries({ queryKey: ['expenses'] });
        toast({ title: 'Expense added successfully' });
      }
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
    },
  });

  const updateExpense = useMutation({
    mutationFn: ({ id, expense }: { id: string; expense: any }) => 
      cloudStorage.updateExpense(id, expense),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast({ title: 'Expense updated successfully' });
      // Extend session on activity
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
    },
  });

  const deleteExpense = useMutation({
    mutationFn: (id: string) => cloudStorage.deleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast({ title: 'Expense deleted successfully' });
      // Extend session on activity
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
    },
  });

  return { expenses, isLoading, addExpense, updateExpense, deleteExpense };
}

export function useVendors() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: userAgencyId } = useCurrentAgencyId();

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ['vendors'],
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
      queryClient.setQueryData(['vendors'], (old: any[] = []) => {
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
      queryClient.setQueryData(['vendors'], (old: any[] = []) => {
        if (!Array.isArray(old)) return [payload.new];
        return old.map(item => item.id === payload.new.id ? payload.new : item);
      });
    },
    onDelete: (payload: any) => {
      if (payload.old.agency_id !== userAgencyId) {
        console.error('SECURITY: Received vendor deletion from different agency!', payload.old);
        return;
      }
      queryClient.setQueryData(['vendors'], (old: any[] = []) => {
        if (!Array.isArray(old)) return [];
        return old.filter(item => item.id !== payload.old.id);
      });
    },
  });

  const isOnlineVendor = useOnlineStatus();

  const addVendor = useMutation({
    mutationFn: async (vendor: any) => {
      if (!isOnlineVendor) {
        const agencyId = localStorage.getItem('tams_agency_id');
        addToOfflineQueue({
          type: 'add',
          table: 'vendors',
          data: { ...vendor, agency_id: agencyId }
        });
        return { ...vendor, id: 'pending-' + Date.now(), _pending: true };
      }
      return cloudStorage.addVendor(vendor);
    },
    onSuccess: () => {
      if (!isOnlineVendor) {
        toast({ title: 'Vendor saved offline', description: 'Will sync when online' });
      } else {
        queryClient.invalidateQueries({ queryKey: ['vendors'] });
        toast({ title: 'Vendor added successfully' });
      }
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
    },
    onError: () => {
      toast({ title: 'Error adding vendor', variant: 'destructive' });
    },
  });

  const updateVendor = useMutation({
    mutationFn: ({ id, vendor }: { id: string; vendor: any }) => 
      cloudStorage.updateVendor(id, vendor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast({ title: 'Vendor updated successfully' });
      // Extend session on activity
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
    },
  });

  const deleteVendor = useMutation({
    mutationFn: (id: string) => cloudStorage.deleteVendor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast({ title: 'Vendor deleted successfully' });
      // Extend session on activity
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
    },
    onError: (error: Error) => {
      // Check for foreign key constraint error (vendor has linked bookings/clients)
      if (error.message.includes('foreign key constraint') || error.message.includes('still referenced')) {
        toast({ 
          title: 'Cannot Delete Vendor', 
          description: 'This vendor has linked bookings or clients. Please remove those first before deleting the vendor.',
          variant: 'destructive'
        });
      } else {
        toast({ 
          title: 'Failed to delete vendor', 
          description: error.message,
          variant: 'destructive'
        });
      }
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
    queryKey: ['queries'],
    queryFn: async () => {
      return await cloudStorage.getQueries();
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
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
      if (!isOnlineQuery) {
        const agencyId = localStorage.getItem('tams_agency_id');
        addToOfflineQueue({
          type: 'add',
          table: 'queries',
          data: { ...query, agency_id: agencyId }
        });
        return { ...query, id: 'pending-' + Date.now(), _pending: true };
      }
      try {
        const result = await cloudStorage.addQuery(query);
        return result;
      } catch (error) {
        throw error;
      }
    },
    onSuccess: () => {
      if (!isOnlineQuery) {
        toast({ title: 'Query saved offline', description: 'Will sync when online' });
      } else {
        queryClient.invalidateQueries({ queryKey: ['queries'] });
        toast({ title: 'Query added successfully' });
      }
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to add query', 
        description: error?.message || 'An error occurred',
        variant: 'destructive' 
      });
    },
  });

  const updateQuery = useMutation({
    mutationFn: async ({ id, query }: { id: string; query: any }) => {
      return await cloudStorage.updateQuery(id, query);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queries'] });
      toast({ title: 'Query updated successfully' });
      // Extend session on activity
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
    },
  });

  const deleteQuery = useMutation({
    mutationFn: async (id: string) => {
      return await cloudStorage.deleteQuery(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queries'] });
      toast({ title: 'Query deleted successfully' });
      // Extend session on activity
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
    },
  });

  return { queries, isLoading, addQuery, updateQuery, deleteQuery };
}
