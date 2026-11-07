import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { toast } from "sonner";

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
  service_type: "client_booking" | "b2b" | "umrah" | "custom";
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

const describeError = (e: any) =>
  [e?.message, e?.details, e?.hint, e?.code].filter(Boolean).join(" — ");

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
    mutationFn: async (q: QuotationInput) => {
      if (!agencyId) throw new Error("No agency");
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("quotations" as any)
        .insert({ ...q, agency_id: agencyId, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      toast.success("Quotation created");
    },
    onError: (e: any) => toast.error("Failed to create quotation", { description: describeError(e) }),
  });

  const updateQuotation = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<QuotationInput> & { id: string }) => {
      const { data, error } = await supabase
        .from("quotations" as any)
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      toast.success("Quotation updated");
    },
    onError: (e: any) => toast.error("Failed to update", { description: describeError(e) }),
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
    onError: (e: any) => toast.error("Failed to delete", { description: describeError(e) }),
  });

  return { quotations, isLoading, isFetching, refetch, addQuotation, updateQuotation, deleteQuotation };
}
