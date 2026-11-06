
-- 1. Optional discount on bookings (additive, safe default)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;

-- 2. Refunds (Sales Returns)
CREATE TABLE IF NOT EXISTS public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  client_id uuid,
  booking_id uuid,
  refund_date date NOT NULL DEFAULT CURRENT_DATE,
  refund_amount numeric NOT NULL,
  payment_mode text DEFAULT 'cash',
  bank_name text,
  reason text,
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view refunds in their agency"
  ON public.refunds FOR SELECT
  USING (agency_id = current_user_agency_id());

CREATE POLICY "Users insert refunds in their agency"
  ON public.refunds FOR INSERT
  WITH CHECK (agency_id = current_user_agency_id());

CREATE POLICY "Users update refunds in their agency"
  ON public.refunds FOR UPDATE
  USING (agency_id = current_user_agency_id());

CREATE POLICY "Users delete refunds in their agency"
  ON public.refunds FOR DELETE
  USING (agency_id = current_user_agency_id());

CREATE TRIGGER refunds_updated_at
  BEFORE UPDATE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX IF NOT EXISTS idx_refunds_agency ON public.refunds(agency_id);
CREATE INDEX IF NOT EXISTS idx_refunds_client ON public.refunds(client_id);
CREATE INDEX IF NOT EXISTS idx_refunds_booking ON public.refunds(booking_id);

-- 3. Opening Balances (per client / vendor / b2b agent)
CREATE TABLE IF NOT EXISTS public.opening_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  party_type text NOT NULL CHECK (party_type IN ('client','vendor','b2b_agent')),
  party_id uuid NOT NULL,
  balance_type text NOT NULL CHECK (balance_type IN ('receivable','payable')),
  amount numeric NOT NULL DEFAULT 0,
  as_of_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (agency_id, party_type, party_id)
);

ALTER TABLE public.opening_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view opening balances in their agency"
  ON public.opening_balances FOR SELECT
  USING (agency_id = current_user_agency_id());

CREATE POLICY "Users insert opening balances in their agency"
  ON public.opening_balances FOR INSERT
  WITH CHECK (agency_id = current_user_agency_id());

CREATE POLICY "Users update opening balances in their agency"
  ON public.opening_balances FOR UPDATE
  USING (agency_id = current_user_agency_id());

CREATE POLICY "Users delete opening balances in their agency"
  ON public.opening_balances FOR DELETE
  USING (agency_id = current_user_agency_id());

CREATE TRIGGER opening_balances_updated_at
  BEFORE UPDATE ON public.opening_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX IF NOT EXISTS idx_opening_balances_agency ON public.opening_balances(agency_id);
