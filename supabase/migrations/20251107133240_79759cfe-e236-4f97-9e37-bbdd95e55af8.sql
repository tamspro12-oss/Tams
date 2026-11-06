-- Add cascade delete for client payment history
-- When a client is deleted, remove all their payment records
ALTER TABLE public.client_payment_history
DROP CONSTRAINT IF EXISTS client_payment_history_client_id_fkey;

ALTER TABLE public.client_payment_history
ADD CONSTRAINT client_payment_history_client_id_fkey 
FOREIGN KEY (client_id) 
REFERENCES public.clients(id) 
ON DELETE CASCADE;

-- Add cascade delete for vendor payment history
-- When a vendor is deleted, remove all their payment records
ALTER TABLE public.vendor_payment_history
DROP CONSTRAINT IF EXISTS vendor_payment_history_vendor_id_fkey;

ALTER TABLE public.vendor_payment_history
ADD CONSTRAINT vendor_payment_history_vendor_id_fkey 
FOREIGN KEY (vendor_id) 
REFERENCES public.vendors(id) 
ON DELETE CASCADE;