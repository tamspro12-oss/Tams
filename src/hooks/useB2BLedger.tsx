import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { toast } from "sonner";
import { handleSupabaseError } from "@/lib/supabaseErrorHandler";
import { rpcWithPreSqlFallback } from "@/lib/atomicSave";

export interface B2BLedgerEntry {
  id: string;
  agency_id: string;
  agent_id: string;
  entry_date: string;
  entry_type: string;
  amount: number;
  remarks: string | null;
  created_at: string | null;
}

// Helper to calculate payment status from amounts
function calculatePaymentStatus(totalAmount: number, amountPaid: number): string {
  if (amountPaid <= 0) return 'pending';
  if (amountPaid >= totalAmount) return 'paid';
  return 'partial';
}

export function useB2BLedger(agentId?: string) {
  const queryClient = useQueryClient();
  const { data: agencyId } = useCurrentAgencyId();

  const { data: ledgerEntries = [], isLoading, error } = useQuery({
    queryKey: ['b2b_ledger', agencyId, agentId],
    queryFn: async () => {
      if (!agencyId) return [];

      let query = supabase
        .from('b2b_ledger')
        .select('*')
        .eq('agency_id', agencyId)
        .order('entry_date', { ascending: false });

      if (agentId) {
        query = query.eq('agent_id', agentId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as B2BLedgerEntry[];
    },
    enabled: !!agencyId,
  });

  // Helper to update booking payment status based on ledger entries
  const updateBookingPaymentStatus = async (bookingRef: string, agentId: string) => {
    if (!agencyId) return;

    // Find the booking by PNR or passenger name
    const { data: bookings, error: fetchError } = await supabase
      .from('b2b_bookings')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('agent_id', agentId);

    if (fetchError || !bookings) return;

    const booking = bookings.find(b =>
      b.pnr === bookingRef || b.passenger_name === bookingRef
    );

    if (!booking) return;

    // Calculate total service amount (what agent owes)
    const serviceAmount = (booking.selling_price || 0) - (booking.commission_amount || 0);

    // Get all credit entries linked to this booking
    const { data: ledgerData } = await supabase
      .from('b2b_ledger')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('agent_id', agentId)
      .eq('entry_type', 'credit');

    if (!ledgerData) return;

    // Calculate total paid for this booking from linked credit entries
    const totalPaid = ledgerData
      .filter(e => e.remarks?.includes(`[Booking: ${bookingRef}]`))
      .reduce((sum, e) => sum + e.amount, 0);

    // Calculate new payment status
    const newPaymentStatus = calculatePaymentStatus(serviceAmount, totalPaid);

    // Update booking payment status if changed
    if (booking.payment_status !== newPaymentStatus) {
      await supabase
        .from('b2b_bookings')
        .update({ payment_status: newPaymentStatus })
        .eq('id', booking.id);
    }
  };

  const addLedgerEntry = useMutation({
    mutationFn: async (
      entry: Omit<B2BLedgerEntry, 'id' | 'agency_id' | 'created_at'> & {
        linked_booking_id?: string | null;
        payment_mode?: string | null;
        bank_name?: string | null;
        requestId?: string;
      }
    ) => {
      if (!agencyId) throw new Error('No agency ID');

      const { linked_booking_id, requestId, ...entryData } = entry;

      const rpcRes = await rpcWithPreSqlFallback<any>(
        supabase as any,
        'save_b2b_ledger_entry_atomic',
        {
          p_agent_id: entryData.agent_id,
          p_entry_date: entryData.entry_date,
          p_entry_type: entryData.entry_type,
          p_amount: entryData.amount,
          p_payment_mode: entryData.payment_mode || 'cash',
          p_bank_name: entryData.bank_name || null,
          p_remarks: entryData.remarks ?? null,
          p_id: null,
          p_request_id: requestId ?? null,
        },
        {
          legacyFallback: async () => {
            const { data, error } = await supabase
              .from('b2b_ledger')
              .insert({ ...entryData, agency_id: agencyId })
              .select()
              .single();
            if (error) throw error;
            if (entry.entry_type === 'credit' && entry.remarks) {
              const bookingMatch = entry.remarks.match(/\[Booking: (.+?)\]/);
              if (bookingMatch) {
                await updateBookingPaymentStatus(bookingMatch[1], entry.agent_id);
              }
            }
            return data;
          },
        }
      );

      return rpcRes?.entry ?? rpcRes;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b_ledger'] });
      queryClient.invalidateQueries({ queryKey: ['b2b_bookings'] });
      toast.success('Ledger entry added successfully');
    },
    onError: (error: unknown) => {
      handleSupabaseError(error, 'Failed to add ledger entry', 'useB2BLedger.addLedgerEntry');
    },
  });

  // Split payment across multiple bookings (uses single atomic RPC with pre-SQL fallback)
  const addSplitPayment = useMutation({
    mutationFn: async (splitEntry: {
      agent_id: string;
      entry_date: string;
      total_amount: number;
      remarks: string;
      payment_mode?: string;
      bank_name?: string | null;
      requestId?: string;
      allocations: Array<{ bookingId: string; bookingRef: string; amount: number; statusAfter?: string }>;
    }) => {
      if (!agencyId) throw new Error('No agency ID');

      const rpcRes = await rpcWithPreSqlFallback<any>(
        supabase as any,
        'record_b2b_lumpsum_atomic',
        {
          p_agent_id: splitEntry.agent_id,
          p_total_amount: splitEntry.total_amount,
          p_entry_date: splitEntry.entry_date,
          p_payment_mode: splitEntry.payment_mode || 'cash',
          p_bank_name: splitEntry.bank_name || null,
          p_remarks: splitEntry.remarks || null,
          p_allocations: splitEntry.allocations,
          p_request_id: splitEntry.requestId ?? null,
        },
        {
          legacyFallback: async () => {
            const entries: Array<{ agent_id: string; entry_date: string; entry_type: string; amount: number; remarks: string }> = [];
            for (const allocation of splitEntry.allocations) {
              entries.push({
                agent_id: splitEntry.agent_id,
                entry_date: splitEntry.entry_date,
                entry_type: 'credit',
                amount: allocation.amount,
                remarks: splitEntry.remarks
                  ? `${splitEntry.remarks} [Booking: ${allocation.bookingRef}]`
                  : `[Booking: ${allocation.bookingRef}]`,
              });
            }
            const allocatedTotal = splitEntry.allocations.reduce((sum, a) => sum + a.amount, 0);
            const unallocated = splitEntry.total_amount - allocatedTotal;
            if (unallocated > 0) {
              entries.push({
                agent_id: splitEntry.agent_id,
                entry_date: splitEntry.entry_date,
                entry_type: 'credit',
                amount: unallocated,
                remarks: splitEntry.remarks
                  ? `${splitEntry.remarks} [Unallocated]`
                  : '[Unallocated]',
              });
            }
            const { error } = await supabase
              .from('b2b_ledger')
              .insert(entries.map((e) => ({ ...e, agency_id: agencyId })));
            if (error) throw error;
            for (const allocation of splitEntry.allocations) {
              await updateBookingPaymentStatus(allocation.bookingRef, splitEntry.agent_id);
            }
            return { entriesCreated: entries.length };
          },
        }
      );

      return {
        entriesCreated: rpcRes?.entries_created ?? rpcRes?.entriesCreated ?? splitEntry.allocations.length,
        handledAtomically: Boolean(rpcRes?.success),
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['b2b_ledger'] });
      queryClient.invalidateQueries({ queryKey: ['b2b_bookings'] });
      toast.success(`Split payment recorded (${data.entriesCreated} entries created)`);
    },
    onError: (error: unknown) => {
      handleSupabaseError(error, 'Failed to record split payment', 'useB2BLedger.addSplitPayment');
    },
  });

  const updateLedgerEntry = useMutation({
    mutationFn: async ({
      id,
      requestId,
      ...entry
    }: { id: string; requestId?: string } & Partial<
      Omit<B2BLedgerEntry, 'id' | 'agency_id' | 'created_at'>
    > & { linked_booking_id?: string | null; payment_mode?: string | null; bank_name?: string | null }) => {
      const { linked_booking_id, ...entryData } = entry;

      const rpcRes = await rpcWithPreSqlFallback<any>(
        supabase as any,
        'save_b2b_ledger_entry_atomic',
        {
          p_agent_id: entryData.agent_id,
          p_entry_date: entryData.entry_date,
          p_entry_type: entryData.entry_type || 'credit',
          p_amount: entryData.amount || 0,
          p_payment_mode: entryData.payment_mode || 'cash',
          p_bank_name: entryData.bank_name || null,
          p_remarks: entryData.remarks ?? null,
          p_id: id,
          p_request_id: requestId ?? null,
        },
        {
          legacyFallback: async () => {
            const { data, error } = await supabase
              .from('b2b_ledger')
              .update(entryData)
              .eq('id', id)
              .select()
              .single();
            if (error) throw error;
            if (entry.remarks && entry.agent_id) {
              const bookingMatch = entry.remarks.match(/\[Booking: (.+?)\]/);
              if (bookingMatch) {
                await updateBookingPaymentStatus(bookingMatch[1], entry.agent_id);
              }
            }
            return data;
          },
        }
      );

      return rpcRes?.entry ?? rpcRes;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b_ledger'] });
      queryClient.invalidateQueries({ queryKey: ['b2b_bookings'] });
      toast.success('Ledger entry updated successfully');
    },
    onError: (error: unknown) => {
      handleSupabaseError(error, 'Failed to update ledger entry', 'useB2BLedger.updateLedgerEntry');
    },
  });

  const deleteLedgerEntry = useMutation({
    mutationFn: async (id: string) => {
      // Get the entry first to check if it's linked to a booking
      const { data: entry } = await supabase
        .from('b2b_ledger')
        .select('*')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('b2b_ledger')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // If deleted entry was linked to a booking, update booking status
      if (entry?.remarks) {
        const bookingMatch = entry.remarks.match(/\[Booking: (.+?)\]/);
        if (bookingMatch) {
          await updateBookingPaymentStatus(bookingMatch[1], entry.agent_id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b_ledger'] });
      queryClient.invalidateQueries({ queryKey: ['b2b_bookings'] });
      toast.success('Ledger entry deleted successfully');
    },
    onError: (error: unknown) => {
      handleSupabaseError(error, 'Failed to delete ledger entry', 'useB2BLedger.deleteLedgerEntry');
    },
  });

  return {
    ledgerEntries,
    isLoading,
    error,
    addLedgerEntry,
    updateLedgerEntry,
    deleteLedgerEntry,
    addSplitPayment,
  };
}
