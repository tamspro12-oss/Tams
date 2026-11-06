import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { toast } from "sonner";
import { format } from "date-fns";

export interface B2BBooking {
  id: string;
  agency_id: string;
  agent_id: string;
  vendor_id: string | null;
  pnr: string | null;
  passenger_name: string;
  passenger_passport: string | null;
  passenger_contact: string | null;
  destination: string | null;
  airline: string | null;
  flight_date: string | null;
  purchasing_price: number | null;
  selling_price: number | null;
  commission_amount: number | null;
  profit: number | null;
  booking_status: string | null;
  payment_status: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// Helper to calculate payment status from amounts
export function calculatePaymentStatus(totalAmount: number, amountPaid: number): string {
  if (amountPaid <= 0) return 'pending';
  if (amountPaid >= totalAmount) return 'paid';
  return 'partial';
}

export function useB2BBookings(agentId?: string) {
  const queryClient = useQueryClient();
  const { data: agencyId } = useCurrentAgencyId();

  const { data: bookings = [], isLoading, error } = useQuery({
    queryKey: ['b2b_bookings', agencyId, agentId],
    queryFn: async () => {
      if (!agencyId) return [];
      
      let query = supabase
        .from('b2b_bookings')
        .select('*')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false });
      
      if (agentId) {
        query = query.eq('agent_id', agentId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as B2BBooking[];
    },
    enabled: !!agencyId,
  });

  const addBooking = useMutation({
    mutationFn: async (booking: Omit<B2BBooking, 'id' | 'agency_id' | 'created_at' | 'updated_at'> & { amount_received?: number; payment_mode?: string | null; bank_name?: string | null }) => {
      if (!agencyId) throw new Error('No agency ID');
      
      // Extract non-DB fields before inserting
      const { amount_received, payment_mode, bank_name, ...bookingData } = booking;
      const amountReceived = amount_received || 0;
      const sellingPrice = bookingData.selling_price || 0;
      const commissionAmount = bookingData.commission_amount || 0;
      
      // Calculate the amount agent owes (selling price minus commission)
      const totalServiceAmount = sellingPrice - commissionAmount;
      
      // Auto-calculate payment status based on amounts
      const calculatedPaymentStatus = calculatePaymentStatus(totalServiceAmount, amountReceived);
      
      // Insert booking with calculated payment status
      const { data: newBooking, error } = await supabase
        .from('b2b_bookings')
        .insert({ 
          ...bookingData, 
          agency_id: agencyId,
          payment_status: calculatedPaymentStatus
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // AUTO-POST LEDGER ENTRIES
      const bookingRef = newBooking.pnr || newBooking.passenger_name;
      const entryDate = format(new Date(), 'yyyy-MM-dd');
      
      // Entry 1: DEBIT for total service amount (agent owes agency)
      if (totalServiceAmount > 0) {
        const { error: debitError } = await supabase
          .from('b2b_ledger')
          .insert({
            agency_id: agencyId,
            agent_id: bookingData.agent_id,
            entry_date: entryDate,
            entry_type: 'debit',
            amount: totalServiceAmount,
            remarks: `Booking: ${bookingRef} - ${bookingData.passenger_name} [Booking: ${bookingRef}]`
          });
        
        if (debitError) {
          console.error('Failed to create debit ledger entry:', debitError);
        }
      }
      
      // Entry 2: CREDIT if payment received at booking (with payment mode)
      if (amountReceived > 0) {
        const { error: creditError } = await supabase
          .from('b2b_ledger')
          .insert({
            agency_id: agencyId,
            agent_id: bookingData.agent_id,
            entry_date: entryDate,
            entry_type: 'credit',
            amount: amountReceived,
            remarks: `Payment received at booking [Booking: ${bookingRef}]`,
            payment_mode: payment_mode || 'cash',
            bank_name: payment_mode === 'bank' ? bank_name : null
          });
        
        if (creditError) {
          console.error('Failed to create credit ledger entry:', creditError);
        }
      }
      
      return newBooking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b_bookings'] });
      queryClient.invalidateQueries({ queryKey: ['b2b_ledger'] });
      toast.success('B2B Booking added successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to add booking', { description: error.message });
    },
  });

  const updateBooking = useMutation({
    mutationFn: async ({ id, booking }: { id: string; booking: Partial<B2BBooking> }) => {
      const { data, error } = await supabase
        .from('b2b_bookings')
        .update(booking)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b_bookings'] });
      toast.success('B2B Booking updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to update booking', { description: error.message });
    },
  });

  const deleteBooking = useMutation({
    mutationFn: async (id: string) => {
      if (!agencyId) throw new Error('No agency ID');
      
      // First, get the booking to create reversal entries
      const { data: booking, error: fetchError } = await supabase
        .from('b2b_bookings')
        .select('*')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;
      
      const bookingRef = booking.pnr || booking.passenger_name;
      const sellingPrice = booking.selling_price || 0;
      const commissionAmount = booking.commission_amount || 0;
      const totalServiceAmount = sellingPrice - commissionAmount;
      const entryDate = format(new Date(), 'yyyy-MM-dd');
      
      // Create REVERSAL CREDIT entry (reverse the original debit)
      if (totalServiceAmount > 0) {
        await supabase
          .from('b2b_ledger')
          .insert({
            agency_id: agencyId,
            agent_id: booking.agent_id,
            entry_date: entryDate,
            entry_type: 'credit',
            amount: totalServiceAmount,
            remarks: `REVERSAL: Booking cancelled - ${booking.passenger_name} [Booking: ${bookingRef}]`
          });
      }
      
      // Delete the booking
      const { error } = await supabase
        .from('b2b_bookings')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['b2b_bookings'] });
      queryClient.invalidateQueries({ queryKey: ['b2b_ledger'] });
      toast.success('B2B Booking deleted with reversal entry created');
    },
    onError: (error: any) => {
      toast.error('Failed to delete booking', { description: error.message });
    },
  });

  return {
    bookings,
    isLoading,
    error,
    addBooking,
    updateBooking,
    deleteBooking,
  };
}
