-- ==============================================================================
-- TAMS PRO — ADDITIVE PERFORMANCE INDEXES
-- File: supabase/migrations/20261121_01_perf_indexes.sql
-- DO NOT RUN AUTOMATICALLY — FOR REVIEW ONLY
-- ==============================================================================

BEGIN;

CREATE INDEX IF NOT EXISTS idx_client_payment_history_agency_id
  ON public.client_payment_history (agency_id);

CREATE INDEX IF NOT EXISTS idx_vendor_payment_history_agency_id
  ON public.vendor_payment_history (agency_id);

CREATE INDEX IF NOT EXISTS idx_policy_acknowledgments_agency_id
  ON public.policy_acknowledgments (agency_id);

CREATE INDEX IF NOT EXISTS idx_bookings_client_id
  ON public.bookings (client_id);

COMMIT;

