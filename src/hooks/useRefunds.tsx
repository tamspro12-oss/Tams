import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { toast } from "sonner";

export interface Refund {
  id: string;
  agency_id: string;
  client_id: string | null;
  booking_id: string | null;
  refund_date: string;
  refund_amount: number;
  payment_mode: string | null;
  bank_name: string | null;
  reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type RefundInput = Omit<Refund, "id" | "agency_id" | "created_at" | "updated_at">;

export function useRefunds() {
  const queryClient = useQueryClient();
  const { data: agencyId } = useCurrentAgencyId();

  const { data: refunds = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["refunds", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data, error } = await supabase
        .from("refunds" as any)
        .select("*")
        .eq("agency_id", agencyId)
        .order("refund_date", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Refund[];
    },
    enabled: !!agencyId,
  });

  const addRefund = useMutation({
    mutationFn: async (refund: RefundInput) => {
      if (!agencyId) throw new Error("No agency");
      const { data, error } = await supabase
        .from("refunds" as any)
        .insert({ ...refund, agency_id: agencyId })
        .select()
        .single();
      if (error) throw error;

      // Sync into master transactions table
      try {
        await supabase.from("transactions").insert({
          agency_id: agencyId,
          date: refund.refund_date,
          type: "refund",
          party_id: refund.client_id,
          party_type: "client",
          booking_id: refund.booking_id,
          debit: 0,
          credit: refund.refund_amount,
          method: refund.payment_mode || "cash",
          notes: refund.notes || refund.reason || "Refund",
          legacy_source: "refunds",
          legacy_id: (data as any)?.id,
        });
      } catch (e) {
        console.warn("Unified transaction sync warning:", e);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["refunds"] });
      toast.success("Refund recorded");
    },
    onError: (e: any) => toast.error("Failed to record refund", { description: [e.message, e.details, e.hint, e.code].filter(Boolean).join(" — ") }),
  });

  const updateRefund = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<RefundInput> & { id: string }) => {
      const { data, error } = await supabase
        .from("refunds" as any)
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["refunds"] });
      toast.success("Refund updated");
    },
    onError: (e: any) => toast.error("Failed to update", { description: [e.message, e.details, e.hint, e.code].filter(Boolean).join(" — ") }),
  });

  const deleteRefund = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("refunds" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["refunds"] });
      toast.success("Refund deleted");
    },
    onError: (e: any) => toast.error("Failed to delete", { description: [e.message, e.details, e.hint, e.code].filter(Boolean).join(" — ") }),
  });

  return { refunds, isLoading, isFetching, refetch, addRefund, updateRefund, deleteRefund };
}
