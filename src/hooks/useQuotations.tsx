import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { toast } from "sonner";
import { handleSupabaseError, withDuplicateRetry } from "@/lib/supabaseErrorHandler";
import { rpcWithPreSqlFallback } from "@/lib/atomicSave";

export interface QuotationItem {
  description: string;
  qty: number;
  unit_price: number;
  amount: number;
}

export interface Quotation {
  id: string;
  agency_id: string;
  quotation_number: string;
  quotation_date: string;
  valid_until: string | null;
  service_type: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  client_id: string | null;
  agent_id: string | null;
  title: string | null;
  description: string | null;
  items: QuotationItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  status: "draft" | "sent" | "accepted" | "rejected";
  notes: string | null;
  terms: string | null;
  source: string | null;
  source_ref: any;
  booking_id?: string | null;
  converted_booking_id?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type QuotationInput = Omit<Quotation, "id" | "agency_id" | "created_at" | "updated_at" | "created_by">;

export function useQuotations() {
  const queryClient = useQueryClient();
  const { data: agencyId } = useCurrentAgencyId();

  const { data: quotations = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["quotations", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data, error } = await supabase
        .from("quotations" as any)
        .select("*")
        .eq("agency_id", agencyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Quotation[];
    },
    enabled: !!agencyId,
  });

  // Real-time synchronization for quotations
  useRealtimeTable({
    table: 'quotations',
    filter: agencyId ? `agency_id=eq.${agencyId}` : undefined,
    enabled: !!agencyId,
    channelPrefix: 'quotations-changes',
    onChange: () => {
      queryClient.invalidateQueries({ queryKey: ["quotations", agencyId] });
    },
  });

  const addQuotation = useMutation({
    mutationFn: async (q: QuotationInput & { requestId?: string; isManual?: boolean }) => {
      if (!agencyId) throw new Error("No active agency assigned");
      const { requestId, isManual, ...quoteFields } = q;
      const isAuto = !isManual && (!quoteFields.quotation_number || !quoteFields.quotation_number.trim());

      const rpcRes = await rpcWithPreSqlFallback<any>(
        supabase as any,
        "save_quotation_atomic",
        {
          p_quotation_data: quoteFields,
          p_id: null,
          p_is_manual: !isAuto,
          p_request_id: requestId ?? null,
        },
        {
          isAutoMode: isAuto,
          legacyFallback: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            return await withDuplicateRetry(
              async () => {
                const { data, error } = await supabase
                  .from("quotations" as any)
                  .insert({ ...quoteFields, agency_id: agencyId, created_by: user?.id })
                  .select()
                  .single();
                if (error) throw error;
                return data;
              },
              { isAutoMode: isAuto }
            );
          },
        }
      );

      return rpcRes?.quotation ?? rpcRes;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      toast.success("Quotation created");
    },
    onError: (e: any) => handleSupabaseError(e, "Failed to create quotation", "useQuotations.add"),
  });

  const updateQuotation = useMutation({
    mutationFn: async ({
      id,
      requestId,
      ...patch
    }: Partial<QuotationInput> & { id: string; requestId?: string }) => {
      const rpcRes = await rpcWithPreSqlFallback<any>(
        supabase as any,
        "save_quotation_atomic",
        {
          p_quotation_data: patch,
          p_id: id,
          p_is_manual: false,
          p_request_id: requestId ?? null,
        },
        {
          legacyFallback: async () => {
            const { data, error } = await supabase
              .from("quotations" as any)
              .update(patch)
              .eq("id", id)
              .select()
              .single();
            if (error) throw error;
            return data;
          },
        }
      );
      return rpcRes?.quotation ?? rpcRes;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      toast.success("Quotation updated");
    },
    onError: (e: any) => handleSupabaseError(e, "Failed to update quotation", "useQuotations.update"),
  });

  const deleteQuotation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quotations" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      toast.success("Quotation deleted");
    },
    onError: (e: any) => handleSupabaseError(e, "Failed to delete quotation", "useQuotations.delete"),
  });

  return { quotations, isLoading, isFetching, refetch, addQuotation, updateQuotation, deleteQuotation };
}
