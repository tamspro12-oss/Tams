-- Add group booking columns to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS group_size integer DEFAULT 1 CHECK (group_size > 0),
ADD COLUMN IF NOT EXISTS group_booking_type text DEFAULT 'individual' CHECK (group_booking_type IN ('individual', 'group'));

-- Add comment for clarity
COMMENT ON COLUMN public.clients.group_size IS 'Number of passengers/people in this booking (1 for individual, >1 for group)';
COMMENT ON COLUMN public.clients.group_booking_type IS 'Type of booking: individual or group';