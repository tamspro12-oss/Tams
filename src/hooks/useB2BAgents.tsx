import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { toast } from "sonner";
import { handleSupabaseError } from "@/lib/supabaseErrorHandler";
import { rpcWithPreSqlFallback } from "@/lib/atomicSave";

export interface B2BAgent {
  id: string;
  agency_id: string;
  agent_name: string;
  business_name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  commission_type: string;
  commission_value: number | null;
  status: string;
  can_create_vouchers?: boolean | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export function useB2BAgents() {
  const queryClient = useQueryClient();
  const { data: agencyId } = useCurrentAgencyId();

  const { data: agents = [], isLoading, error } = useQuery({
    queryKey: ['b2b_agents', agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data, error } = await supabase
        .from('b2b_agents')
        .select('*')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as B2BAgent[];
    },
    enabled: !!agencyId,
  });

  const addAgent = useMutation({
    mutationFn: async (
      agent: Omit<B2BAgent, 'id' | 'agency_id' | 'created_at' | 'updated_at'> & {
        requestId?: string;
        openingBalanceAmount?: number;
        openingBalanceType?: 'receivable' | 'payable';
      }
    ) => {
      if (!agencyId) throw new Error('No agency ID');
      const { requestId, openingBalanceAmount, openingBalanceType, ...agentFields } = agent;
      const rpcRes = await rpcWithPreSqlFallback<any>(
        supabase as any,
        'save_b2b_agent_atomic',
        {
          p_agent_data: agentFields,
          p_id: null,
          p_opening_balance_amount: openingBalanceAmount ?? 0,
          p_opening_balance_type: openingBalanceType ?? 'receivable',
          p_request_id: requestId ?? null,
        },
        {
          legacyFallback: async () => {
            const { data, error } = await supabase
              .from('b2b_agents')
              .insert({ ...agentFields, agency_id: agencyId } as any)
              .select()
              .single();
            if (error) throw error;
            return data;
          },
        }
      );
      return rpcRes?.agent ?? rpcRes;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b_agents'] });
      toast.success('B2B Agent added successfully');
    },
    onError: (error: unknown) => {
      handleSupabaseError(error, 'Failed to add agent', 'useB2BAgents.addAgent');
    },
  });

  const updateAgent = useMutation({
    mutationFn: async ({
      id,
      agent,
      requestId,
      openingBalanceAmount,
      openingBalanceType,
    }: {
      id: string;
      agent: Partial<B2BAgent>;
      requestId?: string;
      openingBalanceAmount?: number;
      openingBalanceType?: 'receivable' | 'payable';
    }) => {
      const rpcRes = await rpcWithPreSqlFallback<any>(
        supabase as any,
        'save_b2b_agent_atomic',
        {
          p_agent_data: agent,
          p_id: id,
          p_opening_balance_amount: openingBalanceAmount ?? 0,
          p_opening_balance_type: openingBalanceType ?? 'receivable',
          p_request_id: requestId ?? null,
        },
        {
          legacyFallback: async () => {
            const { data, error } = await supabase
              .from('b2b_agents')
              .update(agent as any)
              .eq('id', id)
              .select()
              .single();
            if (error) throw error;
            return data;
          },
        }
      );
      return rpcRes?.agent ?? rpcRes;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b_agents'] });
      toast.success('B2B Agent updated successfully');
    },
    onError: (error: unknown) => {
      handleSupabaseError(error, 'Failed to update agent', 'useB2BAgents.updateAgent');
    },
  });

  const deleteAgent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('b2b_agents')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b_agents'] });
      toast.success('B2B Agent deleted successfully');
    },
    onError: (error: unknown) => {
      handleSupabaseError(error, 'Failed to delete agent', 'useB2BAgents.deleteAgent');
    },
  });

  return {
    agents,
    isLoading,
    error,
    addAgent,
    updateAgent,
    deleteAgent,
  };
}
