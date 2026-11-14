import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cloudStorage } from '@/lib/storage/cloudStorageProvider';
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { invalidateAllFinancialQueries } from "@/lib/accountingEngine";

// Client Payment History (Supabase cloud storage, agency-scoped)
export function useClientPaymentHistoryLocal(clientId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: userAgencyId } = useCurrentAgencyId();

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["clientPaymentHistory", userAgencyId, clientId],
    queryFn: async () => {
      if (!clientId) return [];
      return await cloudStorage.getClientPaymentHistory(clientId);
    },
    enabled: !!userAgencyId && !!clientId,
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
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("You are offline. Connect to the internet to save.");
      }
      await cloudStorage.addClientPaymentHistory(payment);
    },
    onSuccess: () => {
      invalidateAllFinancialQueries(queryClient, userAgencyId);
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
      import('@/lib/autoBackupTrigger').then(({ triggerAutoBackup }) => triggerAutoBackup());
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err?.message || "Failed to record payment history",
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

// Vendor Payment History (Supabase cloud storage, agency-scoped)
export function useVendorPaymentHistoryLocal(vendorId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: userAgencyId } = useCurrentAgencyId();

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["vendorPaymentHistory", userAgencyId, vendorId],
    queryFn: async () => {
      if (!vendorId) return [];
      return await cloudStorage.getVendorPaymentHistory(vendorId);
    },
    enabled: !!userAgencyId && !!vendorId,
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
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("You are offline. Connect to the internet to save.");
      }
      await cloudStorage.addVendorPaymentHistory(payment);
    },
    onSuccess: () => {
      invalidateAllFinancialQueries(queryClient, userAgencyId);
      import('@/lib/sessionManager').then(({ sessionManager }) => sessionManager.extendSession());
      import('@/lib/autoBackupTrigger').then(({ triggerAutoBackup }) => triggerAutoBackup());
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err?.message || "Failed to record payment history",
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

// All Client Payment History (Supabase cloud storage, agency-scoped)
export function useAllClientPaymentHistoryLocal(clientIds: string[]) {
  const { data: userAgencyId } = useCurrentAgencyId();
  const query = useQuery({
    queryKey: ["all-client-payment-history", userAgencyId, clientIds],
    queryFn: async () => {
      if (!clientIds.length) return [];

      const allPayments = [];
      for (const clientId of clientIds) {
        const payments = await cloudStorage.getClientPaymentHistory(clientId);
        allPayments.push(...payments);
      }

      return allPayments.sort((a, b) =>
        new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
      );
    },
    enabled: !!userAgencyId && clientIds.length > 0,
  });

  return query;
}

// All Vendor Payment History (Supabase cloud storage, agency-scoped)
export function useAllVendorPaymentHistoryLocal(vendorIds: string[]) {
  const { data: userAgencyId } = useCurrentAgencyId();
  const query = useQuery({
    queryKey: ["all-vendor-payment-history", userAgencyId, vendorIds],
    queryFn: async () => {
      if (!vendorIds.length) return [];

      const allPayments = [];
      for (const vendorId of vendorIds) {
        const payments = await cloudStorage.getVendorPaymentHistory(vendorId);
        allPayments.push(...payments);
      }

      return allPayments.sort((a, b) =>
        new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
      );
    },
    enabled: !!userAgencyId && vendorIds.length > 0,
  });

  return query;
}
