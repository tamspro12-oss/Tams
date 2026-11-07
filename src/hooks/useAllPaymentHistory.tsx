import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";

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
  useRealtimeTable({
    table: 'client_payment_history',
    channelPrefix: 'all-client-payment-history',
    enabled: clientIds.length > 0,
    onChange: (payload: any) => {
      console.log('Client payment history change detected:', payload.eventType);
      queryClient.invalidateQueries({ queryKey: ["all-client-payment-history"] });
    },
  });

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
  useRealtimeTable({
    table: 'vendor_payment_history',
    channelPrefix: 'all-vendor-payment-history',
    enabled: vendorIds.length > 0,
    onChange: (payload: any) => {
      console.log('Vendor payment history change detected:', payload.eventType);
      queryClient.invalidateQueries({ queryKey: ["all-vendor-payment-history"] });
    },
  });

  return query;
}
