import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { toast } from "sonner";
import { handleSupabaseError } from "@/lib/supabaseErrorHandler";
import { isMissingFunctionError } from "@/lib/friendlyError";
import { refreshAffectedFinancialQueries } from "@/lib/accountingEngine";
import { isMissingRpcOrParamError } from "@/lib/atomicSave";

export type PartyType = "client" | "vendor";
export type BalanceType = "receivable" | "payable";

export interface OpeningBalance {
  id: string;
  agency_id: string;
  party_type: PartyType;
  party_id: string;
  balance_type: BalanceType;
  amount: number;
  as_of_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type OpeningBalanceInput = Omit<OpeningBalance, "id" | "agency_id" | "created_at" | "updated_at"> & {
  requestId?: string;
};

async function syncOpeningTransactionLegacy(
  agencyId: string,
  ob: {
    id: string;
    party_type: string;
    party_id: string;
    balance_type: string;
    amount: number;
    as_of_date: string;
    notes: string | null;
  }
) {
  const pType = ob.party_type;
  const debit = ob.balance_type === "receivable" ? ob.amount : 0;
  const credit = ob.balance_type === "payable" ? ob.amount : 0;

  const { data: existing, error: findErr } = await supabase
    .from("transactions")
    .select("id")
    .eq("agency_id", agencyId)
    .in("legacy_source", ["opening_balance", "opening_balances"])
    .eq("legacy_id", ob.id)
    .is("reversed_of", null)
    .limit(1)
    .maybeSingle();

  if (findErr) throw findErr;

  if (existing?.id) {
    const { error: updErr } = await supabase
      .from("transactions")
      .update({
        date: ob.as_of_date,
        party_id: ob.party_id,
        party_type: pType as any,
        debit,
        credit,
        notes: ob.notes || `Opening ${ob.balance_type} balance`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .eq("agency_id", agencyId);
    if (updErr) throw updErr;
  } else {
    const { error: insErr } = await supabase.from("transactions").insert({
      agency_id: agencyId,
      date: ob.as_of_date,
      type: "opening",
      party_id: ob.party_id,
      party_type: pType as any,
      debit,
      credit,
      method: "opening",
      reference_no: "OPENING-BAL",
      category: "Opening Balance",
      notes: ob.notes || `Opening ${ob.balance_type} balance`,
      legacy_source: "opening_balance",
      legacy_id: ob.id,
    } as any);
    if (insErr) throw insErr;
  }
}

export function useOpeningBalances() {
  const queryClient = useQueryClient();
  const { data: agencyId } = useCurrentAgencyId();

  const { data: balances = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["opening_balances", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data, error: queryError } = await supabase
        .from("opening_balances" as any)
        .select("*")
        .eq("agency_id", agencyId)
        .order("created_at", { ascending: false });
      if (queryError) {
        console.error("Failed to fetch opening balances:", queryError);
        throw queryError;
      }
      return (data || []) as unknown as OpeningBalance[];
    },
    enabled: !!agencyId,
  });

  const upsertBalance = useMutation({
    mutationFn: async (b: OpeningBalanceInput) => {
      if (!agencyId) throw new Error("No agency");

      const { requestId, ...cleanInput } = b;
      const baseParams = {
        p_party_type: cleanInput.party_type,
        p_party_id: cleanInput.party_id,
        p_balance_type: cleanInput.balance_type,
        p_amount: cleanInput.amount,
        p_as_of_date: cleanInput.as_of_date,
        p_notes: cleanInput.notes ?? null,
      };
      let { data: rpcData, error: rpcErr } = await (supabase as any).rpc(
        "upsert_opening_balance_atomic",
        requestId ? { ...baseParams, p_request_id: requestId } : baseParams
      );
      if (rpcErr && requestId && isMissingRpcOrParamError(rpcErr)) {
        const retry = await (supabase as any).rpc("upsert_opening_balance_atomic", baseParams);
        rpcData = retry.data;
        rpcErr = retry.error;
      }

      if (!rpcErr) {
        return rpcData?.opening_balance ?? rpcData;
      }

      if (!isMissingFunctionError(rpcErr, "upsert_opening_balance_atomic")) {
        throw rpcErr;
      }

      const { data: prev } = await supabase
        .from("opening_balances" as any)
        .select("*")
        .eq("agency_id", agencyId)
        .eq("party_type", b.party_type)
        .eq("party_id", b.party_id)
        .maybeSingle();

      const { data, error } = await supabase
        .from("opening_balances" as any)
        .upsert(
          { ...cleanInput, agency_id: agencyId },
          { onConflict: "agency_id,party_type,party_id" }
        )
        .select()
        .single();
      if (error) throw error;

      try {
        await syncOpeningTransactionLegacy(agencyId, data as any);
      } catch (syncErr) {
        if (prev) {
          await supabase.from("opening_balances" as any).upsert(prev as any);
        } else if ((data as any)?.id) {
          await supabase.from("opening_balances" as any).delete().eq("id", (data as any).id);
        }
        throw syncErr;
      }

      return data;
    },
    onSuccess: () => {
      refreshAffectedFinancialQueries(queryClient, "opening_balance", agencyId);
      toast.success("Opening balance saved");
    },
    onError: (e: unknown) =>
      handleSupabaseError(e, "Failed to save opening balance", "useOpeningBalances.upsert"),
  });

  const updateBalance = useMutation({
    mutationFn: async ({ id, requestId, ...patch }: Partial<OpeningBalanceInput> & { id: string; requestId?: string }) => {
      if (!agencyId) throw new Error("No agency");

      const baseParams = {
        p_id: id,
        p_amount: patch.amount ?? 0,
        p_balance_type: patch.balance_type ?? null,
        p_as_of_date: patch.as_of_date ?? null,
        p_notes: patch.notes ?? null,
      };
      let { data: rpcData, error: rpcErr } = await (supabase as any).rpc(
        "update_opening_balance_atomic",
        requestId ? { ...baseParams, p_request_id: requestId } : baseParams
      );
      if (rpcErr && requestId && isMissingRpcOrParamError(rpcErr)) {
        const retry = await (supabase as any).rpc("update_opening_balance_atomic", baseParams);
        rpcData = retry.data;
        rpcErr = retry.error;
      }

      if (!rpcErr) {
        return rpcData?.opening_balance ?? rpcData;
      }

      if (!isMissingFunctionError(rpcErr, "update_opening_balance_atomic")) {
        throw rpcErr;
      }

      const { data: previous, error: prevErr } = await supabase
        .from("opening_balances" as any)
        .select("*")
        .eq("id", id)
        .single();
      if (prevErr) throw prevErr;

      const { data, error } = await supabase
        .from("opening_balances" as any)
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;

      try {
        await syncOpeningTransactionLegacy(agencyId, data as any);
      } catch (syncErr) {
        await supabase.from("opening_balances" as any).update(previous as any).eq("id", id);
        throw syncErr;
      }

      return data;
    },
    onSuccess: () => {
      refreshAffectedFinancialQueries(queryClient, "opening_balance", agencyId);
      toast.success("Opening balance updated");
    },
    onError: (e: unknown) =>
      handleSupabaseError(e, "Failed to update opening balance", "useOpeningBalances.update"),
  });

  const deleteBalance = useMutation({
    mutationFn: async (id: string) => {
      if (!agencyId) throw new Error("No agency");

      const { error: rpcErr } = await (supabase as any).rpc(
        "delete_opening_balance_atomic",
        { p_id: id }
      );

      if (!rpcErr) return;

      if (!isMissingFunctionError(rpcErr, "delete_opening_balance_atomic")) {
        throw rpcErr;
      }

      const { data: txs, error: txFetchErr } = await supabase
        .from("transactions")
        .select("id")
        .eq("agency_id", agencyId)
        .in("legacy_source", ["opening_balance", "opening_balances"])
        .eq("legacy_id", id)
        .is("reversed_of", null);
      if (txFetchErr) throw txFetchErr;

      for (const tx of txs || []) {
        const { error: revErr } = await (supabase as any).rpc("reverse_transaction", {
          p_transaction_id: tx.id,
          p_reason: "Opening balance deleted",
        });
        if (revErr) throw revErr;
      }

      const { error } = await supabase.from("opening_balances" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refreshAffectedFinancialQueries(queryClient, "opening_balance", agencyId);
      toast.success("Opening balance removed");
    },
    onError: (e: unknown) =>
      handleSupabaseError(e, "Failed to delete opening balance", "useOpeningBalances.delete"),
  });

  return {
    balances,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
    upsertBalance,
    updateBalance,
    deleteBalance,
  };
}
