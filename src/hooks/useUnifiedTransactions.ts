import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { invalidateAllFinancialQueries, getKarachiYmd } from "@/lib/accountingEngine";
import { toast } from "sonner";

export interface AccountItem {
  id: string;
  agency_id: string;
  name: string;
  type: "cash" | "bank";
  opening_balance: number;
  active: boolean;
  total_in?: number;
  total_out?: number;
  current_balance?: number;
  created_at?: string;
}

export interface TransactionItem {
  id: string;
  agency_id?: string;
  date: string;
  type: "charge" | "payment_in" | "payment_out" | "expense" | "refund" | "transfer" | "adjustment" | "opening";
  reference_no: string | null;
  category: string | null;
  notes: string | null;
  method: string | null;
  account_id: string | null;
  account_name?: string | null;
  party_id: string | null;
  party_type: "client" | "agent" | "vendor" | null;
  party_name?: string | null;
  booking_id: string | null;
  booking_ref?: string | null;
  debit: number;
  credit: number;
  reversed_of?: string | null;
  is_reversed?: boolean;
  running_balance?: number;
  created_at?: string;
}

export interface PartyStatementRow {
  id: string;
  date: string;
  type: string;
  reference_no: string | null;
  booking_ref: string | null;
  notes: string | null;
  method: string | null;
  account_name: string | null;
  debit: number;
  credit: number;
  reversed_of: string | null;
  is_reversed: boolean;
  running_balance: number;
}

export interface RecordPaymentPayload {
  direction: "in" | "out";
  amount: number;
  accountId: string;
  partyId?: string | null;
  partyType?: "client" | "agent" | "vendor" | null;
  bookingId?: string | null;
  date?: string;
  method?: string;
  referenceNo?: string;
  category?: string;
  notes?: string;
}

export interface RecordExpensePayload {
  amount: number;
  accountId: string;
  category: string;
  date?: string;
  method?: string;
  referenceNo?: string;
  notes?: string;
  partyId?: string | null;
  partyType?: "client" | "agent" | "vendor" | null;
}

export interface RecordRefundPayload {
  amount: number;
  accountId: string;
  partyId?: string | null;
  partyType?: "client" | "agent" | "vendor" | null;
  bookingId?: string | null;
  date?: string;
  method?: string;
  referenceNo?: string;
  reason?: string;
  notes?: string;
}

export interface RecordTransferPayload {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date?: string;
  referenceNo?: string;
  notes?: string;
}

// 1. Hook to get and manage Cash & Bank Accounts
export function useAccounts() {
  const queryClient = useQueryClient();
  const { data: agencyId } = useCurrentAgencyId();

  // Fetch accounts with calculated balances
  const { data: accounts = [], isLoading, error, refetch } = useQuery({
    queryKey: ["accounts_with_balances", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];

      // Try RPC first
      const { data: rpcData, error: rpcErr } = await (supabase.rpc as any)("account_balances", {
        p_agency_id: agencyId,
      });

      if (!rpcErr && rpcData && rpcData.length > 0) {
        return rpcData.map((a: any) => ({
          id: a.account_id,
          agency_id: agencyId,
          name: a.account_name,
          type: a.account_type as "cash" | "bank",
          opening_balance: Number(a.opening_balance) || 0,
          total_in: Number(a.total_in) || 0,
          total_out: Number(a.total_out) || 0,
          current_balance: Number(a.current_balance) || 0,
          active: a.active ?? true,
        })) as AccountItem[];
      }

      // Direct fallback
      const { data: directAccounts, error: directErr } = await supabase
        .from("accounts")
        .select("*")
        .eq("agency_id", agencyId)
        .order("type", { ascending: false })
        .order("name", { ascending: true });

      if (directErr) {
        // If accounts table empty, attempt to seed default cash account
        console.warn("Accounts fetch warning:", directErr.message);
        return [];
      }

      if (!directAccounts || directAccounts.length === 0) {
        // Create initial default cash account
        const { data: newCash } = await supabase
          .from("accounts")
          .insert({
            agency_id: agencyId,
            type: "cash",
            name: "Main Cash Account",
            opening_balance: 0,
            active: true,
          })
          .select()
          .single();

        return newCash ? [newCash as unknown as AccountItem] : [];
      }

      return directAccounts.map((a: any) => ({
        ...a,
        total_in: 0,
        total_out: 0,
        current_balance: Number(a.opening_balance) || 0,
      })) as AccountItem[];
    },
    enabled: !!agencyId,
  });

  const createAccount = useMutation({
    mutationFn: async (payload: { name: string; type: "cash" | "bank"; opening_balance?: number }) => {
      if (!agencyId) throw new Error("No active agency ID");
      const { data, error } = await supabase
        .from("accounts")
        .insert({
          agency_id: agencyId,
          name: payload.name.trim(),
          type: payload.type,
          opening_balance: payload.opening_balance || 0,
          active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateAllFinancialQueries(queryClient, agencyId);
      toast.success("Account added successfully");
    },
    onError: (err: any) => {
      toast.error("Failed to add account", { description: err.message });
    },
  });

  const updateAccount = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AccountItem> & { id: string }) => {
      const { data, error } = await supabase
        .from("accounts")
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateAllFinancialQueries(queryClient, agencyId);
      toast.success("Account updated");
    },
    onError: (err: any) => {
      toast.error("Failed to update account", { description: err.message });
    },
  });

  return {
    accounts,
    isLoading,
    error,
    refetch,
    createAccount,
    updateAccount,
    cashAccount: accounts.find((a) => a.type === "cash") || accounts[0],
    bankAccounts: accounts.filter((a) => a.type === "bank"),
  };
}

// 2. Hook to get Agency-Wide Ledger
export function useAgencyLedger(filters?: {
  startDate?: string;
  endDate?: string;
  accountId?: string;
  partyId?: string;
  type?: string;
  includeReversed?: boolean;
}) {
  const { data: agencyId } = useCurrentAgencyId();

  return useQuery({
    queryKey: ["agency_ledger", agencyId, filters],
    queryFn: async () => {
      if (!agencyId) return [];

      const { data: rpcData, error: rpcErr } = await (supabase.rpc as any)("get_agency_ledger", {
        p_start_date: filters?.startDate || null,
        p_end_date: filters?.endDate || null,
        p_account_id: filters?.accountId && filters.accountId !== "all" ? filters.accountId : null,
        p_party_id: filters?.partyId && filters.partyId !== "all" ? filters.partyId : null,
        p_type: filters?.type && filters.type !== "all" ? filters.type : null,
        p_include_reversed: filters?.includeReversed ?? false,
      });

      if (!rpcErr && rpcData) {
        return rpcData as TransactionItem[];
      }

      // Fallback query directly on transactions
      let query = supabase
        .from("transactions")
        .select("*, accounts(name)")
        .eq("agency_id", agencyId)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (filters?.startDate) query = query.gte("date", filters.startDate);
      if (filters?.endDate) query = query.lte("date", filters.endDate);
      if (filters?.accountId && filters.accountId !== "all") query = query.eq("account_id", filters.accountId);
      if (filters?.partyId && filters.partyId !== "all") query = query.eq("party_id", filters.partyId);
      if (filters?.type && filters.type !== "all") query = query.eq("type", filters.type as any);
      if (!filters?.includeReversed) query = query.is("reversed_of", null);

      const { data, error } = await query;
      if (error) throw error;

      let runBal = 0;
      return (data || []).map((t: any) => {
        runBal += (Number(t.debit) || 0) - (Number(t.credit) || 0);
        return {
          ...t,
          account_name: t.accounts?.name || null,
          running_balance: runBal,
          is_reversed: !!t.reversed_of,
        };
      }) as TransactionItem[];
    },
    enabled: !!agencyId,
  });
}

// 3. Hook for Party Statement (Customer/Agent/Vendor ledger)
export function usePartyStatement(partyId: string | null | undefined, options?: {
  startDate?: string;
  endDate?: string;
  includeReversed?: boolean;
}) {
  const { data: agencyId } = useCurrentAgencyId();

  return useQuery({
    queryKey: ["party_statement", agencyId, partyId, options],
    queryFn: async () => {
      if (!agencyId || !partyId) return [];

      const { data, error } = await (supabase.rpc as any)("get_party_statement", {
        p_party_id: partyId,
        p_start_date: options?.startDate || null,
        p_end_date: options?.endDate || null,
        p_include_reversed: options?.includeReversed ?? false,
      });

      if (error) {
        // Fallback: direct query
        const { data: directData, error: dirErr } = await supabase
          .from("transactions")
          .select("*, accounts(name)")
          .eq("agency_id", agencyId)
          .eq("party_id", partyId)
          .order("date", { ascending: true })
          .order("created_at", { ascending: true });

        if (dirErr) throw dirErr;

        let bal = 0;
        return (directData || []).map((t: any) => {
          const deb = t.type === "charge" ? t.debit : (t.type === "payment_in" ? 0 : t.debit);
          const cred = t.type === "payment_in" ? t.debit : (t.type === "charge" ? 0 : t.credit);
          bal += deb - cred;
          return {
            id: t.id,
            date: t.date,
            type: t.type,
            reference_no: t.reference_no,
            booking_ref: t.reference_no,
            notes: t.notes,
            method: t.method,
            account_name: t.accounts?.name || null,
            debit: deb,
            credit: cred,
            reversed_of: t.reversed_of,
            is_reversed: !!t.reversed_of,
            running_balance: bal,
          };
        }) as PartyStatementRow[];
      }

      return (data || []) as PartyStatementRow[];
    },
    enabled: !!agencyId && !!partyId,
  });
}

// 4. Hook for Atomic Transactions Mutations
export function useTransactionMutations() {
  const queryClient = useQueryClient();
  const { data: agencyId } = useCurrentAgencyId();

  const invalidateAllFinance = () => {
    invalidateAllFinancialQueries(queryClient, agencyId);
    queryClient.invalidateQueries({ queryKey: ["b2b_agents"] });
    queryClient.invalidateQueries({ queryKey: ["b2b_bookings"] });
    queryClient.invalidateQueries({ queryKey: ["b2b_ledger"] });
    queryClient.invalidateQueries({ queryKey: ["client_payment_history"] });
    queryClient.invalidateQueries({ queryKey: ["vendor_payment_history"] });
  };

  // Record Payment (Received or Paid)
  const recordPayment = useMutation({
    mutationFn: async (payload: RecordPaymentPayload) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("You are offline — connect to the internet to record payments.");
      }
      const { data, error } = await (supabase.rpc as any)("record_payment", {
        p_direction: payload.direction,
        p_amount: payload.amount,
        p_account_id: payload.accountId,
        p_party_id: payload.partyId || null,
        p_party_type: payload.partyType || null,
        p_booking_id: payload.bookingId || null,
        p_date: payload.date || getKarachiYmd(),
        p_method: payload.method || "cash",
        p_reference_no: payload.referenceNo || null,
        p_category: payload.category || null,
        p_notes: payload.notes || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateAllFinance();
      toast.success("Payment recorded successfully");
    },
    onError: (err: any) => {
      toast.error("Failed to record payment", { description: err.message });
    },
  });

  // Record Operating Expense
  const recordExpense = useMutation({
    mutationFn: async (payload: RecordExpensePayload) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("You are offline — connect to the internet to record expenses.");
      }
      const { data, error } = await (supabase.rpc as any)("record_expense", {
        p_amount: payload.amount,
        p_account_id: payload.accountId,
        p_category: payload.category,
        p_date: payload.date || getKarachiYmd(),
        p_method: payload.method || "cash",
        p_reference_no: payload.referenceNo || null,
        p_notes: payload.notes || null,
        p_party_id: payload.partyId || null,
        p_party_type: payload.partyType || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateAllFinance();
      toast.success("Expense recorded successfully");
    },
    onError: (err: any) => {
      toast.error("Failed to record expense", { description: err.message });
    },
  });

  // Record Customer Refund
  const recordRefund = useMutation({
    mutationFn: async (payload: RecordRefundPayload) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("You are offline — connect to the internet to record refunds.");
      }
      const { data, error } = await (supabase.rpc as any)("record_refund", {
        p_amount: payload.amount,
        p_account_id: payload.accountId,
        p_party_id: payload.partyId || null,
        p_party_type: payload.partyType || "client",
        p_booking_id: payload.bookingId || null,
        p_date: payload.date || getKarachiYmd(),
        p_method: payload.method || "cash",
        p_reference_no: payload.referenceNo || null,
        p_reason: payload.reason || null,
        p_notes: payload.notes || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateAllFinance();
      toast.success("Refund recorded successfully");
    },
    onError: (err: any) => {
      toast.error("Failed to record refund", { description: err.message });
    },
  });

  // Record Account-to-Account Transfer
  const recordTransfer = useMutation({
    mutationFn: async (payload: RecordTransferPayload) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("You are offline — connect to the internet to record transfers.");
      }
      const { data, error } = await (supabase.rpc as any)("record_transfer", {
        p_from_account_id: payload.fromAccountId,
        p_to_account_id: payload.toAccountId,
        p_amount: payload.amount,
        p_date: payload.date || getKarachiYmd(),
        p_reference_no: payload.referenceNo || null,
        p_notes: payload.notes || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateAllFinance();
      toast.success("Transfer completed successfully");
    },
    onError: (err: any) => {
      toast.error("Failed to record transfer", { description: err.message });
    },
  });

  // Reverse Transaction (Soft delete / void)
  const reverseTransaction = useMutation({
    mutationFn: async ({ transactionId, reason }: { transactionId: string; reason?: string }) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("You are offline — connect to the internet to reverse transactions.");
      }
      const { data, error } = await (supabase.rpc as any)("reverse_transaction", {
        p_transaction_id: transactionId,
        p_reason: reason || "Voided from interface",
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateAllFinance();
      toast.success("Transaction reversed successfully");
    },
    onError: (err: any) => {
      toast.error("Failed to reverse transaction", { description: err.message });
    },
  });

  return {
    recordPayment,
    recordExpense,
    recordRefund,
    recordTransfer,
    reverseTransaction,
  };
}
