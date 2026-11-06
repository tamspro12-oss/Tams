-- Drop existing foreign key constraint
ALTER TABLE public.clients
DROP CONSTRAINT IF EXISTS clients_vendor_id_fkey;

-- Recreate with CASCADE delete
-- When a vendor is deleted, all clients linked to that vendor will be automatically deleted
ALTER TABLE public.clients
ADD CONSTRAINT clients_vendor_id_fkey 
FOREIGN KEY (vendor_id) 
REFERENCES public.vendors(id) 
ON DELETE CASCADE;