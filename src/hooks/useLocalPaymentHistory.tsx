import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cloudStorage } from '@/lib/storage/cloudStorageProvider';

// Client Payment History for Local Storage
export function useClientPaymentHistoryLocal(clientId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["clientPaymentHistory", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      return await cloudStorage.getClientPaymentHistory(clientId);
    },
    enabled: !!clientId,
  });

  const addPaymentHistory = useMutation({
    mutationFn: async (payment: {
      client_id: string;
      agency_id?: string;
      payment_amount: number;
      payment_type: "partial" | "full";
      payment_date: string;
      notes?: string;
      payment_mode?: string;
      bank_name?: string | null;
    }) => {
      await cloudStorage.addClientPaymentHistory(payment);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientPaymentHistory"] });
      queryClient.invalidateQueries({ queryKey: ["all-client-payment-history"] });
      // Extend session on activity
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
      // Auto-backup after payment
      import('@/lib/autoBackupTrigger').then(({ triggerAutoBackup }) => triggerAutoBackup());
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

// Vendor Payment History for Local Storage
export function useVendorPaymentHistoryLocal(vendorId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["vendorPaymentHistory", vendorId],
    queryFn: async () => {
      if (!vendorId) return [];
      return await cloudStorage.getVendorPaymentHistory(vendorId);
    },
    enabled: !!vendorId,
  });

  const addPaymentHistory = useMutation({
    mutationFn: async (payment: {
      vendor_id: string;
      agency_id: string;
      payment_amount: number;
      payment_type: "partial" | "full";
      payment_date: string;
      notes?: string;
      payment_mode?: string;
      bank_name?: string | null;
    }) => {
      await cloudStorage.addVendorPaymentHistory(payment);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorPaymentHistory"] });
      queryClient.invalidateQueries({ queryKey: ["all-vendor-payment-history"] });
      // Extend session on activity
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
      // Auto-backup after payment
      import('@/lib/autoBackupTrigger').then(({ triggerAutoBackup }) => triggerAutoBackup());
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

// All Client Payment History for Local Storage
export function useAllClientPaymentHistoryLocal(clientIds: string[]) {
  const query = useQuery({
    queryKey: ["all-client-payment-history", clientIds],
    queryFn: async () => {
      if (!clientIds.length) return [];

      const allPayments = [];
      for (const clientId of clientIds) {
        const payments = await cloudStorage.getClientPaymentHistory(clientId);
        allPayments.push(...payments);
      }

      // Sort by date descending
      return allPayments.sort((a, b) => 
        new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
      );
    },
    enabled: clientIds.length > 0,
  });

  return query;
}

// All Vendor Payment History for Local Storage
export function useAllVendorPaymentHistoryLocal(vendorIds: string[]) {
  const query = useQuery({
    queryKey: ["all-vendor-payment-history", vendorIds],
    queryFn: async () => {
      if (!vendorIds.length) return [];

      const allPayments = [];
      for (const vendorId of vendorIds) {
        const payments = await cloudStorage.getVendorPaymentHistory(vendorId);
        allPayments.push(...payments);
      }

      // Sort by date descending
      return allPayments.sort((a, b) => 
        new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
      );
    },
    enabled: vendorIds.length > 0,
  });

  return query;
}
