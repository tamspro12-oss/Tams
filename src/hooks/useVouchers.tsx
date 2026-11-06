import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { toast } from "sonner";
import type { Voucher, VoucherType } from "@/types/voucher";

export type VoucherInput = Omit<Voucher, "id" | "agency_id" | "created_at" | "updated_at" | "created_by">;

const describeError = (e: any) =>
  [e?.message, e?.details, e?.hint, e?.code].filter(Boolean).join(" — ");

export function useVouchers() {
  const queryClient = useQueryClient();
  const { data: agencyId } = useCurrentAgencyId();

  const { data: vouchers = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["vouchers", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data, error } = await supabase
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

      if (error) {
        console.error("Failed to fetch vouchers:", error);
        return [];
      }
      return (data || []) as unknown as Voucher[];
    },
    enabled: !!agencyId,
    staleTime: 30 * 1000,
  });

  const getNextVoucherNumber = (type: VoucherType): string => {
    const prefix = type === "Umrah" ? "UV" : type === "Hotel" ? "HV" : "TV";
    const matching = vouchers.filter((v) => v.voucher_number?.startsWith(`${prefix}-`));
    
    let maxNum = 0;
    matching.forEach((v) => {
      const match = v.voucher_number.match(new RegExp(`^${prefix}-(\\d+)`));
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });

    const nextNum = maxNum + 1;
    return `${prefix}-${String(nextNum).padStart(4, "0")}`;
  };

  const addVoucher = useMutation({
    mutationFn: async (v: VoucherInput) => {
      if (!agencyId) throw new Error("No active agency found");
      const { data: { user } } = await supabase.auth.getUser();

      const voucherNumber = v.voucher_number?.trim() || getNextVoucherNumber(v.voucher_type);

      const { data, error } = await supabase
        .from("vouchers" as any)
        .insert({
          ...v,
          voucher_number: voucherNumber,
          agency_id: agencyId,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      toast.success(`Voucher ${data?.voucher_number || ""} created successfully`);
    },
    onError: (e: any) => toast.error("Failed to create voucher", { description: describeError(e) }),
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
    onError: (e: any) => toast.error("Failed to update voucher", { description: describeError(e) }),
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
    onError: (e: any) => toast.error("Failed to delete voucher", { description: describeError(e) }),
  });

  const duplicateVoucher = useMutation({
    mutationFn: async (source: Voucher) => {
      if (!agencyId) throw new Error("No active agency found");
      const { data: { user } } = await supabase.auth.getUser();
      const nextNum = getNextVoucherNumber(source.voucher_type);

      const { id, created_at, updated_at, b2b_agents, voucher_number, ...rest } = source;

      const { data, error } = await supabase
        .from("vouchers" as any)
        .insert({
          ...rest,
          voucher_number: nextNum,
          agency_id: agencyId,
          created_by: user?.id,
          status: "Issued",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      toast.success(`Duplicated as new voucher ${data?.voucher_number}`);
    },
    onError: (e: any) => toast.error("Failed to duplicate voucher", { description: describeError(e) }),
  });

  return {
    vouchers,
    isLoading,
    isFetching,
    refetch,
    getNextVoucherNumber,
    addVoucher,
    updateVoucher,
    deleteVoucher,
    duplicateVoucher,
  };
}
