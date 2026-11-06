import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { toast } from "sonner";

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
    mutationFn: async (entry: Omit<B2BLedgerEntry, 'id' | 'agency_id' | 'created_at'> & { linked_booking_id?: string | null }) => {
      if (!agencyId) throw new Error('No agency ID');
      
      // Extract linked_booking_id (not a DB column, just for status update)
      const { linked_booking_id, ...entryData } = entry;
      
      const { data, error } = await supabase
        .from('b2b_ledger')
        .insert({ ...entryData, agency_id: agencyId })
        .select()
        .single();
      
      if (error) throw error;
      
      // If this is a credit entry linked to a booking, update booking payment status
      if (entry.entry_type === 'credit' && entry.remarks) {
        const bookingMatch = entry.remarks.match(/\[Booking: (.+?)\]/);
        if (bookingMatch) {
          await updateBookingPaymentStatus(bookingMatch[1], entry.agent_id);
        }
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b_ledger'] });
      queryClient.invalidateQueries({ queryKey: ['b2b_bookings'] });
      toast.success('Ledger entry added successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to add ledger entry', { description: error.message });
    },
  });

  // Split payment across multiple bookings
  const addSplitPayment = useMutation({
    mutationFn: async (splitEntry: {
      agent_id: string;
      entry_date: string;
      total_amount: number;
      remarks: string;
      allocations: Array<{ bookingId: string; bookingRef: string; amount: number }>;
    }) => {
      if (!agencyId) throw new Error('No agency ID');
      
      const entries: Array<{ agent_id: string; entry_date: string; entry_type: string; amount: number; remarks: string }> = [];
      
      // Create ledger entry for each allocation
      for (const allocation of splitEntry.allocations) {
        entries.push({
          agent_id: splitEntry.agent_id,
          entry_date: splitEntry.entry_date,
          entry_type: 'credit',
          amount: allocation.amount,
          remarks: splitEntry.remarks 
            ? `${splitEntry.remarks} [Booking: ${allocation.bookingRef}]`
            : `[Booking: ${allocation.bookingRef}]`
        });
      }
      
      // Handle unallocated amount if any
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
            : '[Unallocated]'
        });
      }
      
      // Insert all entries
      const { error } = await supabase
        .from('b2b_ledger')
        .insert(entries.map(e => ({ ...e, agency_id: agencyId })));
      
      if (error) throw error;
      
      // Update each booking's payment status
      for (const allocation of splitEntry.allocations) {
        await updateBookingPaymentStatus(allocation.bookingRef, splitEntry.agent_id);
      }
      
      return { entriesCreated: entries.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['b2b_ledger'] });
      queryClient.invalidateQueries({ queryKey: ['b2b_bookings'] });
      toast.success(`Split payment recorded (${data.entriesCreated} entries created)`);
    },
    onError: (error: any) => {
      toast.error('Failed to record split payment', { description: error.message });
    },
  });

  const updateLedgerEntry = useMutation({
    mutationFn: async ({ id, ...entry }: { id: string } & Partial<Omit<B2BLedgerEntry, 'id' | 'agency_id' | 'created_at'>> & { linked_booking_id?: string | null }) => {
      // Extract linked_booking_id (not a DB column)
      const { linked_booking_id, ...entryData } = entry;
      
      const { data, error } = await supabase
        .from('b2b_ledger')
        .update(entryData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      // If this entry has a linked booking, update its payment status
      if (entry.remarks) {
        const bookingMatch = entry.remarks.match(/\[Booking: (.+?)\]/);
        if (bookingMatch && entry.agent_id) {
          await updateBookingPaymentStatus(bookingMatch[1], entry.agent_id);
        }
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b_ledger'] });
      queryClient.invalidateQueries({ queryKey: ['b2b_bookings'] });
      toast.success('Ledger entry updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to update ledger entry', { description: error.message });
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
    onError: (error: any) => {
      toast.error('Failed to delete ledger entry', { description: error.message });
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
