import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export function useAllClientPaymentHistory(clientIds: string[]) {
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: ["all-client-payment-history", clientIds],
    queryFn: async () => {
      if (!clientIds.length) return [];

      const { data, error } = await supabase
        .from("client_payment_history")
        .select("*, clients(name)")
        .in("client_id", clientIds)
        .order("payment_date", { ascending: false });

      if (error) throw error;

      return data.map((payment) => ({
        ...payment,
        entityName: payment.clients?.name || "Unknown",
        entityId: payment.client_id,
      }));
    },
    enabled: clientIds.length > 0,
  });

  // Real-time sync for all client payment history
  useEffect(() => {
    if (!clientIds.length) return;

    const channel = supabase
      .channel('all-client-payment-history')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'client_payment_history'
        },
        (payload) => {
          console.log('Client payment history change detected:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ["all-client-payment-history"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientIds.length, queryClient]);

  return query;
}

export function useAllVendorPaymentHistory(vendorIds: string[]) {
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: ["all-vendor-payment-history", vendorIds],
    queryFn: async () => {
      if (!vendorIds.length) return [];

      const { data, error } = await supabase
        .from("vendor_payment_history")
        .select("*, vendors(name)")
        .in("vendor_id", vendorIds)
        .order("payment_date", { ascending: false });

      if (error) throw error;

      return data.map((payment) => ({
        ...payment,
        entityName: payment.vendors?.name || "Unknown",
        entityId: payment.vendor_id,
      }));
    },
    enabled: vendorIds.length > 0,
  });

  // Real-time sync for all vendor payment history
  useEffect(() => {
    if (!vendorIds.length) return;

    const channel = supabase
      .channel('all-vendor-payment-history')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vendor_payment_history'
        },
        (payload) => {
          console.log('Vendor payment history change detected:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ["all-vendor-payment-history"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [vendorIds.length, queryClient]);

  return query;
}
