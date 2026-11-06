-- ADDITIVE ONLY: Add payment_mode field to expenses table
-- This does NOT modify existing data - new field with default value

ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS payment_mode text DEFAULT 'cash';

-- ADDITIVE ONLY: Add bank_name field to expenses table (used when payment_mode = 'bank')
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS bank_name text;

-- ADDITIVE ONLY: Add recurring expense fields to expenses table
-- These are optional fields that extend expense functionality
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false;

ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS recurring_frequency text; -- 'monthly', 'quarterly', 'yearly'

ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS recurring_parent_id uuid REFERENCES public.expenses(id) ON DELETE SET NULL;

ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS is_paid boolean DEFAULT true;

ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS paid_date text;

-- ADDITIVE ONLY: Add payment_mode to client_payment_history
ALTER TABLE public.client_payment_history 
ADD COLUMN IF NOT EXISTS payment_mode text DEFAULT 'cash';

ALTER TABLE public.client_payment_history 
ADD COLUMN IF NOT EXISTS bank_name text;

-- ADDITIVE ONLY: Add payment_mode to vendor_payment_history
ALTER TABLE public.vendor_payment_history 
ADD COLUMN IF NOT EXISTS payment_mode text DEFAULT 'cash';

ALTER TABLE public.vendor_payment_history 
ADD COLUMN IF NOT EXISTS bank_name text;

-- ADDITIVE ONLY: Add payment_mode to b2b_ledger
ALTER TABLE public.b2b_ledger 
ADD COLUMN IF NOT EXISTS payment_mode text DEFAULT 'cash';

ALTER TABLE public.b2b_ledger 
ADD COLUMN IF NOT EXISTS bank_name text;

-- Create index for recurring expenses lookup
CREATE INDEX IF NOT EXISTS idx_expenses_recurring_parent ON public.expenses(recurring_parent_id);
CREATE INDEX IF NOT EXISTS idx_expenses_is_recurring ON public.expenses(is_recurring);

-- Note: All existing data remains unchanged - new columns have safe defaults