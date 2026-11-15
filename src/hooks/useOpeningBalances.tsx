import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { toast } from "sonner";
import { handleSupabaseError } from "@/lib/supabaseErrorHandler";

export type PartyType = "client" | "vendor" | "b2b_agent";
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

export type OpeningBalanceInput = Omit<OpeningBalance, "id" | "agency_id" | "created_at" | "updated_at">;

export function useOpeningBalances() {
  const queryClient = useQueryClient();
  const { data: agencyId } = useCurrentAgencyId();

  const { data: balances = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["opening_balances", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data, error } = await supabase
        .from("opening_balances" as any)
        .select("*")
        .eq("agency_id", agencyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as OpeningBalance[];
    },
    enabled: !!agencyId,
  });

  const upsertBalance = useMutation({
    mutationFn: async (b: OpeningBalanceInput) => {
      if (!agencyId) throw new Error("No agency");
      const { data, error } = await supabase
        .from("opening_balances" as any)
        .upsert(
          { ...b, agency_id: agencyId },
          { onConflict: "agency_id,party_type,party_id" }
        )
        .select()
        .single();
      if (error) throw error;

      // Sync into transactions single source of truth
      try {
        const pType = b.party_type === "b2b_agent" ? "agent" : b.party_type;
        const debit = b.balance_type === "receivable" ? b.amount : 0;
        const credit = b.balance_type === "payable" ? b.amount : 0;
        await supabase
          .from("transactions")
          .upsert({
            agency_id: agencyId,
            date: b.as_of_date,
            type: "opening",
            party_id: b.party_id,
            party_type: pType as any,
            debit,
            credit,
            method: "opening",
            notes: b.notes || "Opening balance",
            legacy_source: "opening_balances",
            legacy_id: (data as any)?.id,
          }, { onConflict: "agency_id,legacy_source,legacy_id" });
      } catch (e) {
        console.warn("Unified transaction sync warning:", e);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opening_balances"] });
      toast.success("Opening balance saved");
    },
    onError: (e: unknown) => handleSupabaseError(e, "Failed to save opening balance", "useOpeningBalances.upsert"),
  });

  const updateBalance = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<OpeningBalanceInput> & { id: string }) => {
      const { data, error } = await supabase
        .from("opening_balances" as any)
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opening_balances"] });
      toast.success("Opening balance updated");
    },
    onError: (e: unknown) => handleSupabaseError(e, "Failed to update opening balance", "useOpeningBalances.update"),
  });

  const deleteBalance = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("opening_balances" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opening_balances"] });
      toast.success("Removed");
    },
    onError: (e: unknown) => handleSupabaseError(e, "Failed to delete opening balance", "useOpeningBalances.delete"),
  });

  return { balances, isLoading, isFetching, refetch, upsertBalance, updateBalance, deleteBalance };
}
