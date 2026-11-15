import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { toast } from "sonner";
import type { Voucher, VoucherType } from "@/types/voucher";
import { handleSupabaseError, withDuplicateRetry } from "@/lib/supabaseErrorHandler";

export type VoucherInput = Omit<Voucher, "id" | "agency_id" | "created_at" | "updated_at" | "created_by">;

export function useVouchers() {
  const queryClient = useQueryClient();
  const { data: agencyId } = useCurrentAgencyId();

  const { data: vouchers = [], isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["vouchers", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data, error: queryError } = await supabase
        .from("vouchers" as any)
        .select(`
          *,
          b2b_agents (
            agency_name,
            contact_person
          )
        `)
        .eq("agency_id", agencyId)
        .order("created_at", { ascending: false });

      if (queryError) {
        console.error("Failed to fetch vouchers:", queryError);
        throw queryError;
      }
      return (data || []) as unknown as Voucher[];
    },
    enabled: !!agencyId,
    staleTime: 30 * 1000,
  });

  const getNextVoucherNumber = (type: VoucherType): string => {
    const prefix = type === "Umrah" ? "UV" : type === "Hotel" ? "HV" : "TV";
    return `${prefix}-Auto`;
  };

  const addVoucher = useMutation({
    mutationFn: async (v: VoucherInput) => {
      if (!agencyId) throw new Error("No active agency found");
      const { data: { user } } = await supabase.auth.getUser();

      const manualNo = v.voucher_number?.trim() || "";
      const isAuto = !manualNo || /^(__AUTO__|preview|auto-generated)$/i.test(manualNo);

      return await withDuplicateRetry(
        async () => {
          const { data, error } = await supabase
            .from("vouchers" as any)
            .insert({
              ...v,
              voucher_number: isAuto ? "" : manualNo,
              agency_id: agencyId,
              created_by: user?.id,
            })
            .select()
            .single();

          if (error) throw error;
          return data;
        },
        { isAutoMode: isAuto }
      );
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      toast.success(`Voucher ${data?.voucher_number || ""} created successfully`);
    },
    onError: (e: any) => handleSupabaseError(e, "Failed to create voucher", "useVouchers.add"),
  });

  const updateVoucher = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<VoucherInput> & { id: string }) => {
      const { data, error } = await supabase
        .from("vouchers" as any)
        .update({
          ...patch,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      toast.success("Voucher updated successfully");
    },
    onError: (e: any) => handleSupabaseError(e, "Failed to update voucher", "useVouchers.update"),
  });

  const deleteVoucher = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vouchers" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      toast.success("Voucher deleted");
    },
    onError: (e: any) => handleSupabaseError(e, "Failed to delete voucher", "useVouchers.delete"),
  });

  const duplicateVoucher = useMutation({
    mutationFn: async (source: Voucher) => {
      if (!agencyId) throw new Error("No active agency found");
      const { data: { user } } = await supabase.auth.getUser();

      const { id, created_at, updated_at, b2b_agents, voucher_number, ...rest } = source;

      return await withDuplicateRetry(
        async () => {
          const { data, error } = await supabase
            .from("vouchers" as any)
            .insert({
              ...rest,
              voucher_number: "",
              agency_id: agencyId,
              created_by: user?.id,
              status: "Issued",
            })
            .select()
            .single();

          if (error) throw error;
          return data;
        },
        { isAutoMode: true }
      );
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      toast.success(`Duplicated as new voucher ${data?.voucher_number}`);
    },
    onError: (e: any) => handleSupabaseError(e, "Failed to duplicate voucher", "useVouchers.duplicate"),
  });

  return {
    vouchers,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    getNextVoucherNumber,
    addVoucher,
    updateVoucher,
    deleteVoucher,
    duplicateVoucher,
  };
}

