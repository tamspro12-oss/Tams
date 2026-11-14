import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { getAuthenticatedAgencyId } from "@/lib/agencyContext";

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
  const queryClient = useQueryClient();
  const { data: currentAgencyId } = useCurrentAgencyId();
  const [totalCount, setTotalCount] = useState(0);

  const { data: clients = [], isLoading, error } = useQuery({
    queryKey: ["clients-paginated", currentAgencyId, page, filters],
    enabled: !!currentAgencyId,
    queryFn: async () => {
      const agencyId = currentAgencyId || (await getAuthenticatedAgencyId());
      if (!agencyId) return [];

        let query = supabase
          .from('clients')
          .select('*, vendors(*)', { count: 'exact' })
          .eq('agency_id', agencyId)
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

  // Real-time subscription scoped by agency_id
  useRealtimeTable({
    table: 'clients',
    filter: currentAgencyId ? `agency_id=eq.${currentAgencyId}` : undefined,
    enabled: !!currentAgencyId,
    channelPrefix: 'paginated-clients',
    onChange: () => {
      queryClient.invalidateQueries({ queryKey: ["clients-paginated"] });
    },
  });

  return {
    clients,
    totalCount,
    hasMore: (page + 1) * PAGE_SIZE < totalCount,
    isLoading,
    error: error as Error | null,
  };
}
