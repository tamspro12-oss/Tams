-- Add name_update_date field to clients table for reminder system
ALTER TABLE public.clients 
ADD COLUMN name_update_date DATE;

COMMENT ON COLUMN public.clients.name_update_date IS 'Optional date when passenger name needs to be updated on ticket';

-- Add name_update_date field to bookings table as well
ALTER TABLE public.bookings 
ADD COLUMN name_update_date DATE;

COMMENT ON COLUMN public.bookings.name_update_date IS 'Optional date when passenger name needs to be updated on ticket';