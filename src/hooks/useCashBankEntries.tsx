import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { toast } from "sonner";

export interface CashBankEntry {
  id: string;
  agency_id: string;
  entry_date: string;
  entry_type: 'cash_in' | 'cash_out' | 'bank_in' | 'bank_out' | 'transfer';
  amount: number;
  payment_mode: string;
  bank_name: string | null;
  category: string | null;
  description: string | null;
  reference_number: string | null;
  created_at: string;
  updated_at: string;
}

export function useCashBankEntries() {
  const queryClient = useQueryClient();
  const { data: agencyId } = useCurrentAgencyId();

  const { data: entries = [], isLoading, error } = useQuery({
    queryKey: ['cash_bank_entries', agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      
      const { data, error } = await supabase
        .from('cash_bank_entries')
        .select('*')
        .eq('agency_id', agencyId)
        .order('entry_date', { ascending: false });
      
      if (error) throw error;
      return data as CashBankEntry[];
    },
    enabled: !!agencyId,
  });

  const addEntry = useMutation({
    mutationFn: async (entry: Omit<CashBankEntry, 'id' | 'agency_id' | 'created_at' | 'updated_at'>) => {
      if (!agencyId) throw new Error('No agency ID');
      
      const { data, error } = await supabase
        .from('cash_bank_entries')
        .insert({ ...entry, agency_id: agencyId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash_bank_entries'] });
      toast.success('Entry recorded successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to add entry', { description: error.message });
    },
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, ...entry }: { id: string } & Partial<Omit<CashBankEntry, 'id' | 'agency_id' | 'created_at' | 'updated_at'>>) => {
      const { data, error } = await supabase
        .from('cash_bank_entries')
        .update({ ...entry, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash_bank_entries'] });
      toast.success('Entry updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to update entry', { description: error.message });
    },
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cash_bank_entries')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash_bank_entries'] });
      toast.success('Entry deleted successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to delete entry', { description: error.message });
    },
  });

  return {
    entries,
    isLoading,
    error,
    addEntry,
    updateEntry,
    deleteEntry,
  };
}
