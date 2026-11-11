import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { useToast } from "@/hooks/use-toast";
import { triggerAutoBackup } from '@/lib/autoBackupTrigger';
import { getAuthenticatedAgencyId } from "@/lib/agencyContext";

// Client Payment History
export function useClientPaymentHistory(clientId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["clientPaymentHistory", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from("client_payment_history")
        .select("*")
        .eq("client_id", clientId)
        .order("payment_date", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  // Real-time sync for client payment history
  useRealtimeTable({
    table: 'client_payment_history',
    filter: clientId ? `client_id=eq.${clientId}` : undefined,
    enabled: !!clientId,
    channelPrefix: 'client-payment-history',
    onChange: (payload: any) => {
      console.log('Client payment history change detected:', payload.eventType);
      queryClient.invalidateQueries({ queryKey: ["clientPaymentHistory", clientId] });
    },
  });

  const addPaymentHistory = useMutation({
    mutationFn: async (payment: {
      client_id: string;
      payment_amount: number;
      payment_type: "partial" | "full";
      notes?: string;
    }) => {
      const agencyId = await getAuthenticatedAgencyId();

      const { error } = await supabase
        .from("client_payment_history")
        .insert({
          ...payment,
          agency_id: agencyId,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientPaymentHistory"] });
      // Extend session on activity
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
      // Auto-backup after client payment
      triggerAutoBackup();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to record payment history",
        variant: "destructive",
      });
    },
  });

  return {
    history,
    isLoading,
    addPaymentHistory,
  };
}

// Vendor Payment History
export function useVendorPaymentHistory(vendorId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["vendorPaymentHistory", vendorId],
    queryFn: async () => {
      if (!vendorId) return [];
      
      const { data, error } = await supabase
        .from("vendor_payment_history")
        .select("*")
        .eq("vendor_id", vendorId)
        .order("payment_date", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!vendorId,
  });

  // Real-time sync for vendor payment history
  useRealtimeTable({
    table: 'vendor_payment_history',
    filter: vendorId ? `vendor_id=eq.${vendorId}` : undefined,
    enabled: !!vendorId,
    channelPrefix: 'vendor-payment-history',
    onChange: (payload: any) => {
      console.log('Vendor payment history change detected:', payload.eventType);
      queryClient.invalidateQueries({ queryKey: ["vendorPaymentHistory", vendorId] });
    },
  });

  const addPaymentHistory = useMutation({
    mutationFn: async (payment: {
      vendor_id: string;
      payment_amount: number;
      payment_type: "partial" | "full";
      notes?: string;
    }) => {
      const agencyId = await getAuthenticatedAgencyId();

      const { error } = await supabase
        .from("vendor_payment_history")
        .insert({
          ...payment,
          agency_id: agencyId,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorPaymentHistory"] });
      // Extend session on activity
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
      // Auto-backup after vendor payment
      triggerAutoBackup();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to record payment history",
        variant: "destructive",
      });
    },
  });

  return {
    history,
    isLoading,
    addPaymentHistory,
  };
}
