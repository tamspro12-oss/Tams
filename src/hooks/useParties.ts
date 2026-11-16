import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { getAuthenticatedAgencyId } from "@/lib/agencyContext";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import {
  refreshAffectedFinancialQueries,
  scheduleCoalescedFinancialRefresh,
} from "@/lib/accountingEngine";
import { handleSupabaseError, withDuplicateRetry } from "@/lib/supabaseErrorHandler";
import { rpcWithPreSqlFallback } from "@/lib/atomicSave";

export interface Party {
  id: string;
  agency_id: string;
  type: "client" | "vendor" | "both";
  name: string;
  code?: string;
  phone?: string;
  whatsapp?: string;
  city?: string;
  address?: string;
  cnic?: string;
  ntn?: string;
  email?: string;
  passport?: string;
  credit_limit: number;
  opening_balance: number;
  current_balance: number; // positive = client dues / receivable, negative = vendor payable
  notes?: string;
  active: boolean;
  created_at: string;
}

export function useParties() {
  const queryClient = useQueryClient();
  const { data: userAgencyId } = useCurrentAgencyId();

  const { data: parties = [], isLoading, error } = useQuery({
    queryKey: ["parties", userAgencyId],
    enabled: !!userAgencyId,
    queryFn: async () => {
      const activeAgencyId = userAgencyId || (await getAuthenticatedAgencyId());
      if (!activeAgencyId) return [];

      // Query parties, legacy clients, and legacy vendors in parallel strictly scoped to activeAgencyId
      const [partiesRes, clientsRes, vendorsRes] = await Promise.all([
        (supabase as any)
          .from("parties")
          .select("*")
          .eq("agency_id", activeAgencyId)
          .order("name", { ascending: true }),
        supabase
          .from("clients")
          .select("id, agency_id, name, contact_number, destination, payment_status, selling_price, amount_paid, created_at")
          .eq("agency_id", activeAgencyId),
        supabase
          .from("vendors")
          .select("id, agency_id, name, phone, city, payment_amount, amount_paid, created_at")
          .eq("agency_id", activeAgencyId),
      ]);

      const directParties: Party[] = (partiesRes.data || []) as Party[];
      const seenIds = new Set(directParties.map((p) => p.id));
      const seenClientNames = new Set(
        directParties
          .filter((p) => p.type === "client" || p.type === "both")
          .map((p) => (p.name || "").trim().toLowerCase())
      );
      const seenVendorNames = new Set(
        directParties
          .filter((p) => p.type === "vendor" || p.type === "both")
          .map((p) => (p.name || "").trim().toLowerCase())
      );

      const clientParties: Party[] = (clientsRes.data || [])
        .filter((c: any) => !seenIds.has(c.id) && !seenClientNames.has((c.name || "").trim().toLowerCase()))
        .map((c: any) => ({
          id: c.id,
          agency_id: c.agency_id || activeAgencyId,
          type: "client" as const,
          name: c.name,
          code: `CLT-${c.id.slice(0, 4).toUpperCase()}`,
          phone: c.contact_number,
          whatsapp: c.contact_number,
          city: c.destination || "",
          credit_limit: 0,
          opening_balance: 0,
          current_balance: Math.max(0, (c.selling_price || 0) - (c.amount_paid || 0)),
          active: true,
          created_at: c.created_at || new Date().toISOString(),
        }));

      const vendorParties: Party[] = (vendorsRes.data || [])
        .filter((v: any) => !seenIds.has(v.id) && !seenVendorNames.has((v.name || "").trim().toLowerCase()))
        .map((v: any) => ({
          id: v.id,
          agency_id: v.agency_id || activeAgencyId,
          type: "vendor" as const,
          name: v.name,
          code: `VND-${v.id.slice(0, 4).toUpperCase()}`,
          phone: v.phone,
          whatsapp: v.phone,
          city: v.city || "",
          credit_limit: 0,
          opening_balance: 0,
          current_balance: -Math.max(0, (Number(v.payment_amount) || 0) - (Number(v.amount_paid) || 0)),
          active: true,
          created_at: v.created_at || new Date().toISOString(),
        }));

      const combined = [...directParties, ...clientParties, ...vendorParties];
      combined.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      return combined;
    },
  });

  // Realtime subscription for parties table
  useRealtimeTable({
    table: "parties",
    filter: userAgencyId ? `agency_id=eq.${userAgencyId}` : undefined,
    enabled: !!userAgencyId,
    channelPrefix: "parties-changes",
    onChange: (payload) => {
      const data = payload.new || payload.old || {};
      if ("agency_id" in data && data.agency_id !== userAgencyId) {
        return;
      }
      scheduleCoalescedFinancialRefresh(queryClient, "parties-rt", "party", 350);
    },
  });

  const addPartyMutation = useMutation({
    mutationFn: async (party: Partial<Party> & { requestId?: string; isManual?: boolean }) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("You are offline. Connect to the internet to save.");
      }

      const { requestId, isManual, ...partyFields } = party;
      const isAutoCode = !isManual && (!partyFields.code || !String(partyFields.code).trim());

      return await rpcWithPreSqlFallback(
        supabase as any,
        "save_party_atomic",
        {
          p_id: null,
          p_type: partyFields.type || "client",
          p_name: partyFields.name || "",
          p_code: isManual ? String(partyFields.code || "").trim() : null,
          p_phone: partyFields.phone ?? null,
          p_whatsapp: partyFields.whatsapp ?? null,
          p_city: partyFields.city ?? null,
          p_address: partyFields.address ?? null,
          p_cnic: partyFields.cnic ?? null,
          p_ntn: partyFields.ntn ?? null,
          p_email: partyFields.email ?? null,
          p_passport: partyFields.passport ?? null,
          p_credit_limit: partyFields.credit_limit ?? 0,
          p_opening_balance: partyFields.opening_balance ?? 0,
          p_notes: partyFields.notes ?? null,
          p_is_manual: Boolean(isManual || (partyFields.code && String(partyFields.code).trim())),
          p_request_id: requestId ?? null,
        },
        {
          isAutoMode: isAutoCode,
          legacyFallback: async () => {
            const activeAgencyId = userAgencyId || (await getAuthenticatedAgencyId());
            if (!activeAgencyId) {
              throw new Error("Unable to save party: No active agency account found");
            }
            const partyPayload = { ...partyFields, agency_id: activeAgencyId };
            return await withDuplicateRetry(
              async () => {
                const { data: inserted, error } = await (supabase as any)
                  .from("parties")
                  .insert([partyPayload])
                  .select()
                  .single();
                if (error) throw error;
                return inserted;
              },
              { isAutoMode: isAutoCode }
            );
          },
        }
      ).then((res: any) => res?.party ?? res);
    },
    onSuccess: () => {
      refreshAffectedFinancialQueries(queryClient, "party", userAgencyId);
      toast.success("Party saved successfully");
    },
    onError: (err: any) => {
      handleSupabaseError(err, "Failed to save party", "useParties.addParty");
    },
  });

  const updatePartyMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
      requestId,
    }: {
      id: string;
      updates: Partial<Party>;
      requestId?: string;
    }) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("Network connection issue. You are offline.");
      }
      return await rpcWithPreSqlFallback(
        supabase as any,
        "save_party_atomic",
        {
          p_id: id,
          p_type: updates.type || "client",
          p_name: updates.name || "",
          p_code: updates.code ?? null,
          p_phone: updates.phone ?? null,
          p_whatsapp: updates.whatsapp ?? null,
          p_city: updates.city ?? null,
          p_address: updates.address ?? null,
          p_cnic: updates.cnic ?? null,
          p_ntn: updates.ntn ?? null,
          p_email: updates.email ?? null,
          p_passport: updates.passport ?? null,
          p_credit_limit: updates.credit_limit ?? 0,
          p_opening_balance: updates.opening_balance ?? 0,
          p_notes: updates.notes ?? null,
          p_is_manual: false,
          p_request_id: requestId ?? null,
        },
        {
          legacyFallback: async () => {
            const activeAgencyId = userAgencyId || (await getAuthenticatedAgencyId());
            if (!activeAgencyId) {
              throw new Error("Unable to identify active agency.");
            }
            const { data, error } = await (supabase as any)
              .from("parties")
              .update(updates)
              .eq("id", id)
              .eq("agency_id", activeAgencyId)
              .select()
              .single();
            if (error) throw error;
            return data;
          },
        }
      ).then((res: any) => res?.party ?? res);
    },
    onSuccess: () => {
      refreshAffectedFinancialQueries(queryClient, "party", userAgencyId);
      toast.success("Party updated successfully");
    },
    onError: (err: any) => {
      handleSupabaseError(err, "Failed to update party", "useParties.updateParty");
    },
  });

  return {
    parties,
    isLoading,
    error,
    addParty: addPartyMutation.mutateAsync,
    updateParty: updatePartyMutation.mutateAsync,
    isSaving: addPartyMutation.isPending || updatePartyMutation.isPending,
  };
}

