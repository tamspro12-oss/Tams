import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { toast } from "sonner";

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
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opening_balances"] });
      toast.success("Opening balance saved");
    },
    onError: (e: any) => toast.error("Failed to save", { description: [e.message, e.details, e.hint, e.code].filter(Boolean).join(" — ") }),
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
    onError: (e: any) => toast.error("Failed to update", { description: [e.message, e.details, e.hint, e.code].filter(Boolean).join(" — ") }),
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
    onError: (e: any) => toast.error("Failed to delete", { description: [e.message, e.details, e.hint, e.code].filter(Boolean).join(" — ") }),
  });

  return { balances, isLoading, isFetching, refetch, upsertBalance, updateBalance, deleteBalance };
}
