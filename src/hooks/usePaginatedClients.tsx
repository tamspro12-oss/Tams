import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 50;

interface PaginatedClientsResult {
  clients: any[];
  totalCount: number;
  hasMore: boolean;
  isLoading: boolean;
  error: Error | null;
}

export function usePaginatedClients(page: number = 0, filters?: {
  search?: string;
  paymentStatus?: string;
  startDate?: string;
  endDate?: string;
}): PaginatedClientsResult {
  const [totalCount, setTotalCount] = useState(0);

  const { data: clients = [], isLoading, error } = useQuery({
    queryKey: ["clients-paginated", page, filters],
    queryFn: async () => {
      // Always use Supabase cloud storage
        // Cloud pagination with Supabase
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data: profile } = await supabase
          .from('profiles')
          .select('agency_id')
          .eq('id', user.id)
          .single();

        if (!profile) throw new Error('Profile not found');

        let query = supabase
          .from('clients')
          .select('*, vendors(*)', { count: 'exact' })
          .eq('agency_id', profile.agency_id)
          .order('created_at', { ascending: false });

        // Apply filters
        if (filters?.search) {
          query = query.or(`name.ilike.%${filters.search}%,contact_number.ilike.%${filters.search}%,passport_number.ilike.%${filters.search}%`);
        }
        if (filters?.paymentStatus) {
          query = query.eq('payment_status', filters.paymentStatus);
        }
        if (filters?.startDate && filters?.endDate) {
          query = query.gte('flight_date', filters.startDate).lte('flight_date', filters.endDate);
        }

        // Pagination
        query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        const { data, error, count } = await query;

        if (error) throw error;
        if (count !== null) setTotalCount(count);

        return data || [];
    },
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('clients-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        // Invalidate query on changes
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    clients,
    totalCount,
    hasMore: (page + 1) * PAGE_SIZE < totalCount,
    isLoading,
    error: error as Error | null,
  };
}
