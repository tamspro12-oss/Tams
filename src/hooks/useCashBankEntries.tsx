import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { toast } from "sonner";
import { handleSupabaseError } from "@/lib/supabaseErrorHandler";
import { isMissingFunctionError } from "@/lib/friendlyError";
import { refreshAffectedFinancialQueries } from "@/lib/accountingEngine";
import { isMissingRpcOrParamError } from "@/lib/atomicSave";

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
  transaction_id?: string | null;
  created_at: string;
  updated_at: string;
}

export type AddCashBankEntryInput = Omit<
  CashBankEntry,
  'id' | 'agency_id' | 'created_at' | 'updated_at' | 'transaction_id'
> & {
  account_id?: string | null;
  requestId?: string;
};

export function useCashBankEntries() {
  const queryClient = useQueryClient();
  const { data: agencyId } = useCurrentAgencyId();

  const { data: entries = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['cash_bank_entries', agencyId],
    queryFn: async () => {
      if (!agencyId) return [];

      const { data, error } = await supabase
        .from('cash_bank_entries')
        .select('*')
        .eq('agency_id', agencyId)
        .order('entry_date', { ascending: false });

      if (error) {
        console.error('Failed to fetch cash/bank entries:', error);
        throw error;
      }
      return data as CashBankEntry[];
    },
    enabled: !!agencyId,
  });

  const addEntry = useMutation({
    mutationFn: async (input: AddCashBankEntryInput) => {
      if (!agencyId) throw new Error('No agency ID');

      const { account_id, requestId, ...entry } = input;
      const baseParams = {
        p_entry_date: entry.entry_date,
        p_entry_type: entry.entry_type,
        p_amount: entry.amount,
        p_payment_mode: entry.payment_mode,
        p_bank_name: entry.bank_name,
        p_category: entry.category,
        p_description: entry.description,
        p_reference_number: entry.reference_number,
        p_account_id: account_id ?? null,
      };
      let { data: rpcData, error: rpcError } = await (supabase as any).rpc(
        'add_cash_bank_entry_atomic',
        requestId ? { ...baseParams, p_request_id: requestId } : baseParams
      );
      if (rpcError && requestId && isMissingRpcOrParamError(rpcError)) {
        const retry = await (supabase as any).rpc('add_cash_bank_entry_atomic', baseParams);
        rpcData = retry.data;
        rpcError = retry.error;
      }

      if (!rpcError) {
        return rpcData?.entry ?? rpcData;
      }

      if (!isMissingFunctionError(rpcError, 'add_cash_bank_entry_atomic')) {
        throw rpcError;
      }

      // Pre-SQL compatibility fallback: sync unified ledger FIRST and abort if sync fails.
      let syncedTxId: string | null = null;
      if (entry.entry_type !== 'transfer') {
        const isIn = entry.entry_type === 'cash_in' || entry.entry_type === 'bank_in';
        if (isIn) {
          const { data: payRes, error: payErr } = await (supabase as any).rpc('record_payment', {
            p_direction: 'in',
            p_amount: entry.amount,
            p_account_id: account_id ?? null,
            p_party_id: null,
            p_party_type: null,
            p_booking_id: null,
            p_date: entry.entry_date,
            p_method: entry.payment_mode || 'cash',
            p_reference_no: entry.reference_number || null,
            p_category: entry.category || null,
            p_notes: entry.description || null,
            p_is_manual: Boolean(entry.reference_number),
          });
          if (payErr) throw payErr;
          syncedTxId = payRes?.transaction_id ?? null;
        } else {
          const { data: expRes, error: expErr } = await (supabase as any).rpc('record_expense', {
            p_amount: entry.amount,
            p_account_id: account_id ?? null,
            p_category: entry.category || 'General Expense',
            p_date: entry.entry_date,
            p_method: entry.payment_mode || 'cash',
            p_reference_no: entry.reference_number || null,
            p_notes: entry.description || null,
            p_party_id: null,
            p_party_type: null,
            p_bank_name: entry.bank_name || null,
            p_is_manual: Boolean(entry.reference_number),
          });
          if (expErr) throw expErr;
          syncedTxId = expRes?.transaction_id ?? null;
        }
      }

      const { data, error } = await supabase
        .from('cash_bank_entries')
        .insert({ ...entry, agency_id: agencyId })
        .select()
        .single();

      if (error) {
        if (syncedTxId) {
          await (supabase as any).rpc('reverse_transaction', {
            p_transaction_id: syncedTxId,
            p_reason: 'Rollback after failed cash/bank entry insert',
          });
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      refreshAffectedFinancialQueries(queryClient, 'cash_bank', agencyId);
      toast.success('Entry recorded successfully');
    },
    onError: (error: unknown) => {
      handleSupabaseError(error, 'Failed to add entry', 'useCashBankEntries.addEntry');
    },
  });

  const updateEntry = useMutation({
    mutationFn: async ({
      id,
      ...entry
    }: { id: string } & Partial<
      Omit<CashBankEntry, 'id' | 'agency_id' | 'created_at' | 'updated_at' | 'transaction_id'>
    >) => {
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
      refreshAffectedFinancialQueries(queryClient, 'cash_bank', agencyId);
      toast.success('Entry updated successfully');
    },
    onError: (error: unknown) => {
      handleSupabaseError(error, 'Failed to update entry', 'useCashBankEntries.updateEntry');
    },
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error: rpcError } = await (supabase as any).rpc('delete_cash_bank_entry_atomic', {
        p_entry_id: id,
      });

      if (!rpcError) return;

      if (!isMissingFunctionError(rpcError, 'delete_cash_bank_entry_atomic')) {
        throw rpcError;
      }

      const { error } = await supabase
        .from('cash_bank_entries')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      refreshAffectedFinancialQueries(queryClient, 'cash_bank', agencyId);
      toast.success('Entry deleted and ledger reversed');
    },
    onError: (error: unknown) => {
      handleSupabaseError(error, 'Failed to delete entry', 'useCashBankEntries.deleteEntry');
    },
  });

  return {
    entries,
    isLoading,
    isError,
    error,
    refetch,
    addEntry,
    updateEntry,
    deleteEntry,
  };
}
