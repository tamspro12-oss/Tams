import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { toast } from "sonner";

export interface AgencyBank {
  id: string;
  agency_id: string;
  bank_name: string;
  account_number: string | null;
  account_title: string | null;
  branch_name: string | null;
  is_active: boolean;
  opening_balance: number;
  created_at: string;
  updated_at: string;
}

// Common bank names for quick selection
export const COMMON_BANKS = [
  "HBL",
  "UBL",
  "MCB",
  "Allied Bank",
  "Bank Alfalah",
  "Meezan Bank",
  "Faysal Bank",
  "Askari Bank",
  "JS Bank",
  "Bank of Punjab",
  "Habib Metro",
  "Standard Chartered",
  "National Bank",
  "Summit Bank",
  "Silk Bank",
  "Bank Al Habib",
  "Soneri Bank",
  "Dubai Islamic Bank",
  "Al Baraka Bank",
  "Samba Bank",
];

export function useAgencyBanks() {
  const queryClient = useQueryClient();
  const { data: agencyId } = useCurrentAgencyId();

  const { data: banks = [], isLoading, error } = useQuery({
    queryKey: ['agency_banks', agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      
      const { data, error } = await supabase
        .from('agency_banks')
        .select('*')
        .eq('agency_id', agencyId)
        .order('bank_name', { ascending: true });
      
      if (error) throw error;
      return data as AgencyBank[];
    },
    enabled: !!agencyId,
  });

  const addBank = useMutation({
    mutationFn: async (bank: Omit<AgencyBank, 'id' | 'agency_id' | 'created_at' | 'updated_at'>) => {
      if (!agencyId) throw new Error('No agency ID');
      
      const { data, error } = await supabase
        .from('agency_banks')
        .insert({ ...bank, agency_id: agencyId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agency_banks'] });
      toast.success('Bank account added successfully');
    },
    onError: (error: any) => {
      if (error.message?.includes('duplicate')) {
        toast.error('Bank already exists', { description: 'This bank account is already added.' });
      } else {
        toast.error('Failed to add bank', { description: error.message });
      }
    },
  });

  const updateBank = useMutation({
    mutationFn: async ({ id, ...bank }: { id: string } & Partial<Omit<AgencyBank, 'id' | 'agency_id' | 'created_at' | 'updated_at'>>) => {
      const { data, error } = await supabase
        .from('agency_banks')
        .update({ ...bank, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agency_banks'] });
      toast.success('Bank account updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to update bank', { description: error.message });
    },
  });

  const deleteBank = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('agency_banks')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agency_banks'] });
      toast.success('Bank account deleted successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to delete bank', { description: error.message });
    },
  });

  // Get all bank names (agency banks + common banks)
  const allBankNames = [...new Set([...banks.map(b => b.bank_name), ...COMMON_BANKS])].sort();

  return {
    banks,
    allBankNames,
    isLoading,
    error,
    addBank,
    updateBank,
    deleteBank,
  };
}
