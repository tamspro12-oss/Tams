import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { getAuthenticatedAgencyId } from "@/lib/agencyContext";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { invalidateAllFinancialQueries } from "@/lib/accountingEngine";

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
      invalidateAllFinancialQueries(queryClient, userAgencyId);
    },
  });

  const addPartyMutation = useMutation({
    mutationFn: async (party: Partial<Party>) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("You are offline. Connect to the internet to save.");
      }
      const activeAgencyId = userAgencyId || (await getAuthenticatedAgencyId());
      if (!activeAgencyId) {
        throw new Error("Unable to save party: No active agency account found");
      }

      const partyPayload = {
        ...party,
        agency_id: activeAgencyId,
      };

      const { data, error } = await (supabase as any)
        .from("parties")
        .insert([partyPayload])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to save party: ${error.message}`);
      }
      return data;
    },
    onSuccess: () => {
      invalidateAllFinancialQueries(queryClient, userAgencyId);
      toast.success("Party saved successfully");
    },
    onError: (err: any) => {
      toast.error(`Could not save: ${err.message || "Failed to save party"}`);
    },
  });

  const updatePartyMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Party> }) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("You are offline. Connect to the internet to save.");
      }
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
      if (error) throw new Error(`Failed to update party: ${error.message}`);
      return data;
    },
    onSuccess: () => {
      invalidateAllFinancialQueries(queryClient, userAgencyId);
      toast.success("Party updated successfully");
    },
    onError: (err: any) => {
      toast.error(`Could not save: ${err.message || "Failed to update party"}`);
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

