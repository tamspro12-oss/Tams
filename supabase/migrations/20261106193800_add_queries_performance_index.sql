-- Phase 4 Additive performance index on queries table (Non-destructive)
CREATE INDEX IF NOT EXISTS idx_queries_agency_status_priority_created
ON public.queries (agency_id, status, priority, created_at DESC);

