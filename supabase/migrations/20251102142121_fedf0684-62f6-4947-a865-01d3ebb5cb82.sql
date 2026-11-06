-- Add vendor_id column to clients table
ALTER TABLE public.clients 
ADD COLUMN vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL;