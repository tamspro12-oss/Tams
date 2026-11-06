-- Add amount_paid column to clients table for tracking partial payments
ALTER TABLE public.clients 
ADD COLUMN amount_paid numeric DEFAULT 0;

-- Update existing records: set amount_paid based on payment_status
UPDATE public.clients 
SET amount_paid = CASE 
  WHEN payment_status = 'Paid' THEN COALESCE(selling_price, 0)
  ELSE 0 
END;

-- Add similar column to vendors table
ALTER TABLE public.vendors
ADD COLUMN amount_paid numeric DEFAULT 0;

UPDATE public.vendors 
SET amount_paid = CASE 
  WHEN payment_status = 'Paid' THEN COALESCE(payment_amount, 0)
  ELSE 0 
END;