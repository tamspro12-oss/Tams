import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import { triggerAutoBackup } from '@/lib/autoBackupTrigger';

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
  useEffect(() => {
    if (!clientId) return;

    const channel = supabase
      .channel(`client-payment-history-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'client_payment_history',
          filter: `client_id=eq.${clientId}`
        },
        (payload) => {
          console.log('Client payment history change detected:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ["clientPaymentHistory", clientId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId, queryClient]);

  const addPaymentHistory = useMutation({
    mutationFn: async (payment: {
      client_id: string;
      payment_amount: number;
      payment_type: "partial" | "full";
      notes?: string;
    }) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("agency_id")
        .single();

      const { error } = await supabase
        .from("client_payment_history")
        .insert({
          ...payment,
          agency_id: profile?.agency_id,
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
  useEffect(() => {
    if (!vendorId) return;

    const channel = supabase
      .channel(`vendor-payment-history-${vendorId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vendor_payment_history',
          filter: `vendor_id=eq.${vendorId}`
        },
        (payload) => {
          console.log('Vendor payment history change detected:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ["vendorPaymentHistory", vendorId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [vendorId, queryClient]);

  const addPaymentHistory = useMutation({
    mutationFn: async (payment: {
      vendor_id: string;
      payment_amount: number;
      payment_type: "partial" | "full";
      notes?: string;
    }) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("agency_id")
        .single();

      const { error } = await supabase
        .from("vendor_payment_history")
        .insert({
          ...payment,
          agency_id: profile?.agency_id,
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
