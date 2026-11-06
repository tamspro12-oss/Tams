-- ADDITIVE ONLY: Create cash_bank_entries table for manual cash/bank transactions
-- This does NOT modify any existing tables or data

CREATE TABLE IF NOT EXISTS public.cash_bank_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  entry_date TEXT NOT NULL DEFAULT (to_char(now(), 'YYYY-MM-DD')),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('cash_in', 'cash_out', 'bank_in', 'bank_out', 'transfer')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_mode TEXT NOT NULL DEFAULT 'cash',
  bank_name TEXT,
  category TEXT,
  description TEXT,
  reference_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cash_bank_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their agency cash_bank_entries"
ON public.cash_bank_entries FOR SELECT
USING (agency_id = public.current_user_agency_id());

CREATE POLICY "Users can insert their agency cash_bank_entries"
ON public.cash_bank_entries FOR INSERT
WITH CHECK (agency_id = public.current_user_agency_id());

CREATE POLICY "Users can update their agency cash_bank_entries"
ON public.cash_bank_entries FOR UPDATE
USING (agency_id = public.current_user_agency_id());

CREATE POLICY "Users can delete their agency cash_bank_entries"
ON public.cash_bank_entries FOR DELETE
USING (agency_id = public.current_user_agency_id());

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_cash_bank_entries_agency ON public.cash_bank_entries(agency_id);
CREATE INDEX IF NOT EXISTS idx_cash_bank_entries_date ON public.cash_bank_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_cash_bank_entries_type ON public.cash_bank_entries(entry_type);

-- ADDITIVE ONLY: Create agency_banks table for managing bank accounts
CREATE TABLE IF NOT EXISTS public.agency_banks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_number TEXT,
  account_title TEXT,
  branch_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  opening_balance NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(agency_id, bank_name)
);

-- Enable RLS
ALTER TABLE public.agency_banks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their agency banks"
ON public.agency_banks FOR SELECT
USING (agency_id = public.current_user_agency_id());

CREATE POLICY "Users can insert their agency banks"
ON public.agency_banks FOR INSERT
WITH CHECK (agency_id = public.current_user_agency_id());

CREATE POLICY "Users can update their agency banks"
ON public.agency_banks FOR UPDATE
USING (agency_id = public.current_user_agency_id());

CREATE POLICY "Users can delete their agency banks"
ON public.agency_banks FOR DELETE
USING (agency_id = public.current_user_agency_id());

-- Create index
CREATE INDEX IF NOT EXISTS idx_agency_banks_agency ON public.agency_banks(agency_id);