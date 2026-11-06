-- Add passengers_data column to store individual passenger information for group bookings
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS passengers_data jsonb DEFAULT '[]'::jsonb;

-- Add comment for clarity
COMMENT ON COLUMN public.clients.passengers_data IS 'Array of passenger objects with name, passport, CNIC, etc for group bookings';