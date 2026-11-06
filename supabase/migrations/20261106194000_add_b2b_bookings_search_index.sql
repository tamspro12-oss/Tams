-- Phase 5 Additive search performance index on b2b_bookings (Non-destructive)
CREATE INDEX IF NOT EXISTS idx_b2b_bookings_search
ON public.b2b_bookings (agency_id, agent_id, passenger_name, pnr);

