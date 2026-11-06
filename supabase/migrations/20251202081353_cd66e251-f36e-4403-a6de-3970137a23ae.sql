-- Update RLS policies for email_logs to allow deletion
DROP POLICY IF EXISTS "Users can delete email logs in their agency" ON public.email_logs;

CREATE POLICY "Users can delete email logs in their agency"
ON public.email_logs
FOR DELETE
USING (
  agency_id IN (
    SELECT agency_id 
    FROM profiles 
    WHERE id = auth.uid()
  )
);

-- Add auto_cleanup_settings column to agencies table for email log cleanup preferences
ALTER TABLE public.agencies 
ADD COLUMN IF NOT EXISTS email_cleanup_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS email_cleanup_frequency text DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS email_cleanup_keep_days integer DEFAULT 30;

COMMENT ON COLUMN public.agencies.email_cleanup_enabled IS 'Enable automatic cleanup of old email logs';
COMMENT ON COLUMN public.agencies.email_cleanup_frequency IS 'Cleanup frequency: weekly or monthly';
COMMENT ON COLUMN public.agencies.email_cleanup_keep_days IS 'Number of days to keep email logs before deletion';