import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { toast } from "sonner";
import { handleSupabaseError } from "@/lib/supabaseErrorHandler";
import { isMissingFunctionError } from "@/lib/friendlyError";
import { invalidateAllFinancialQueries } from "@/lib/accountingEngine";

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

function formatBankAccountName(bankName: string, accountNumber?: string | null): string {
  const num = (accountNumber || "").trim();
  return num ? `${bankName.trim()} (${num})` : bankName.trim();
}

export function useAgencyBanks() {
  const queryClient = useQueryClient();
  const { data: agencyId } = useCurrentAgencyId();

  const { data: banks = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['agency_banks', agencyId],
    queryFn: async () => {
      if (!agencyId) return [];

      const { data, error } = await supabase
        .from('agency_banks')
        .select('*')
        .eq('agency_id', agencyId)
        .order('bank_name', { ascending: true });

      if (error) {
        console.error('Failed to fetch agency banks:', error);
        throw error;
      }
      return data as AgencyBank[];
    },
    enabled: !!agencyId,
  });

  const addBank = useMutation({
    mutationFn: async (bank: Omit<AgencyBank, 'id' | 'agency_id' | 'created_at' | 'updated_at'>) => {
      if (!agencyId) throw new Error('No agency ID');

      const { data: rpcData, error: rpcErr } = await (supabase as any).rpc(
        'upsert_agency_bank_atomic',
        {
          p_id: null,
          p_bank_name: bank.bank_name,
          p_account_title: bank.account_title ?? null,
          p_account_number: bank.account_number ?? null,
          p_branch_name: bank.branch_name ?? null,
          p_opening_balance: bank.opening_balance ?? 0,
          p_is_active: bank.is_active ?? true,
        }
      );

      if (!rpcErr) {
        return rpcData?.bank ?? rpcData;
      }

      if (!isMissingFunctionError(rpcErr, 'upsert_agency_bank_atomic')) {
        throw rpcErr;
      }

      const { data, error } = await supabase
        .from('agency_banks')
        .insert({ ...bank, agency_id: agencyId })
        .select()
        .single();

      if (error) throw error;

      const fullName = formatBankAccountName(bank.bank_name, bank.account_number);
      const { error: accErr } = await (supabase as any).from('accounts').upsert(
        {
          agency_id: agencyId,
          type: 'bank',
          name: fullName,
          opening_balance: bank.opening_balance ?? 0,
          active: bank.is_active ?? true,
        },
        { onConflict: 'agency_id,name' }
      );
      if (accErr) {
        await supabase.from('agency_banks').delete().eq('id', data.id);
        throw accErr;
      }

      return data;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['agency_banks'] });
      await invalidateAllFinancialQueries(queryClient, agencyId);
      toast.success('Bank account added successfully');
    },
    onError: (error: unknown) => {
      handleSupabaseError(error, 'Failed to add bank account', 'useAgencyBanks.addBank');
    },
  });

  const updateBank = useMutation({
    mutationFn: async ({ id, ...bank }: { id: string } & Partial<Omit<AgencyBank, 'id' | 'agency_id' | 'created_at' | 'updated_at'>>) => {
      if (!agencyId) throw new Error('No agency ID');

      const { data: rpcData, error: rpcErr } = await (supabase as any).rpc(
        'upsert_agency_bank_atomic',
        {
          p_id: id,
          p_bank_name: bank.bank_name ?? null,
          p_account_title: bank.account_title ?? null,
          p_account_number: bank.account_number ?? null,
          p_branch_name: bank.branch_name ?? null,
          p_opening_balance: bank.opening_balance ?? null,
          p_is_active: bank.is_active ?? null,
        }
      );

      if (!rpcErr) {
        return rpcData?.bank ?? rpcData;
      }

      if (!isMissingFunctionError(rpcErr, 'upsert_agency_bank_atomic')) {
        throw rpcErr;
      }

      const { data: oldBank, error: prevErr } = await supabase
        .from('agency_banks')
        .select('*')
        .eq('id', id)
        .single();
      if (prevErr) throw prevErr;

      const { data, error } = await supabase
        .from('agency_banks')
        .update({ ...bank, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const oldName = formatBankAccountName(oldBank.bank_name, oldBank.account_number);
      const newName = formatBankAccountName(data.bank_name, data.account_number);
      const { error: accErr } = await (supabase as any)
        .from('accounts')
        .update({
          name: newName,
          opening_balance: data.opening_balance ?? 0,
          active: data.is_active ?? true,
          updated_at: new Date().toISOString(),
        })
        .eq('agency_id', agencyId)
        .eq('type', 'bank')
        .or(`name.eq."${oldName}",name.eq."${oldBank.bank_name}"`);

      if (accErr) {
        await supabase.from('agency_banks').update(oldBank).eq('id', id);
        throw accErr;
      }

      return data;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['agency_banks'] });
      await invalidateAllFinancialQueries(queryClient, agencyId);
      toast.success('Bank account updated successfully');
    },
    onError: (error: unknown) => {
      handleSupabaseError(error, 'Failed to update bank account', 'useAgencyBanks.updateBank');
    },
  });

  const deleteBank = useMutation({
    mutationFn: async (id: string) => {
      if (!agencyId) throw new Error('No agency ID');

      const { error: rpcErr } = await (supabase as any).rpc(
        'delete_agency_bank_atomic',
        { p_bank_id: id }
      );

      if (!rpcErr) return;

      if (!isMissingFunctionError(rpcErr, 'delete_agency_bank_atomic')) {
        throw rpcErr;
      }

      const { data: bankRow, error: fetchErr } = await supabase
        .from('agency_banks')
        .select('*')
        .eq('id', id)
        .single();
      if (fetchErr) throw fetchErr;

      const fullName = formatBankAccountName(bankRow.bank_name, bankRow.account_number);
      const { error: accDeactivateErr } = await (supabase as any)
        .from('accounts')
        .update({ active: false, opening_balance: 0, updated_at: new Date().toISOString() })
        .eq('agency_id', agencyId)
        .eq('type', 'bank')
        .or(`name.eq."${fullName}",name.eq."${bankRow.bank_name}"`);
      if (accDeactivateErr) throw accDeactivateErr;

      const { error } = await supabase
        .from('agency_banks')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['agency_banks'] });
      await invalidateAllFinancialQueries(queryClient, agencyId);
      toast.success('Bank account deleted successfully');
    },
    onError: (error: unknown) => {
      handleSupabaseError(error, 'Failed to delete bank account', 'useAgencyBanks.deleteBank');
    },
  });

  // Get all bank names (agency banks + common banks)
  const allBankNames = [...new Set([...banks.map(b => b.bank_name), ...COMMON_BANKS])].sort();

  return {
    banks,
    allBankNames,
    isLoading,
    isError,
    error,
    refetch,
    addBank,
    updateBank,
    deleteBank,
  };
}
