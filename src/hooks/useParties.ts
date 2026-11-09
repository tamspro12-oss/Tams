import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

  const { data: parties = [], isLoading, error } = useQuery({
    queryKey: ["parties"],
    queryFn: async () => {
      // 1. Try querying parties table
      const { data, error } = await (supabase as any)
        .from("parties")
        .select("*")
        .order("name", { ascending: true });

      if (!error && data && data.length > 0) {
        return data as Party[];
      }

      // 2. Fallback: Aggregate from existing clients and vendors if migration not yet applied
      const [clientsRes, vendorsRes] = await Promise.all([
        supabase.from("clients").select("id, agency_id, name, contact_number, destination, payment_status, selling_price, amount_paid, created_at"),
        supabase.from("vendors").select("id, agency_id, name, phone, city, total_payable, amount_paid, created_at"),
      ]);

      const clientParties: Party[] = (clientsRes.data || []).map((c: any) => ({
        id: c.id,
        agency_id: c.agency_id,
        type: "client",
        name: c.name,
        code: `CLT-${c.id.slice(0, 4).toUpperCase()}`,
        phone: c.contact_number,
        whatsapp: c.contact_number,
        city: c.destination || "",
        credit_limit: 0,
        opening_balance: 0,
        current_balance: Math.max(0, (c.selling_price || 0) - (c.amount_paid || 0)),
        active: true,
        created_at: c.created_at,
      }));

      const vendorParties: Party[] = (vendorsRes.data || []).map((v: any) => ({
        id: v.id,
        agency_id: v.agency_id,
        type: "vendor",
        name: v.name,
        code: `VND-${v.id.slice(0, 4).toUpperCase()}`,
        phone: v.phone,
        whatsapp: v.phone,
        city: v.city || "",
        credit_limit: 0,
        opening_balance: 0,
        current_balance: -Math.max(0, (v.total_payable || 0) - (v.amount_paid || 0)),
        active: true,
        created_at: v.created_at,
      }));

      return [...clientParties, ...vendorParties];
    },
  });

  const addPartyMutation = useMutation({
    mutationFn: async (party: Partial<Party>) => {
      const { data, error } = await (supabase as any)
        .from("parties")
        .insert([party])
        .select()
        .single();

      if (error) {
        // Fallback: insert into clients or vendors
        if (party.type === "client") {
          const { data: cData, error: cErr } = await supabase
            .from("clients")
            .insert({
              name: party.name!,
              contact_number: party.phone,
              destination: party.city,
              notes: party.notes,
            } as any)
            .select()
            .single();
          if (cErr) throw cErr;
          return cData;
        } else {
          const { data: vData, error: vErr } = await supabase
            .from("vendors")
            .insert({
              name: party.name!,
              phone: party.phone,
              city: party.city,
            } as any)
            .select()
            .single();
          if (vErr) throw vErr;
          return vData;
        }
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parties"] });
      toast.success("Party saved successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save party");
    },
  });

  const updatePartyMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Party> }) => {
      const { data, error } = await (supabase as any)
        .from("parties")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parties"] });
      toast.success("Party updated successfully");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update party");
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

