-- Create B2B tables (b2b_agents, b2b_bookings, b2b_ledger)

CREATE TABLE IF NOT EXISTS public.b2b_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL CONSTRAINT b2b_agents_agency_id_fkey REFERENCES public.agencies(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  business_name TEXT,
  email TEXT,
  phone TEXT,
  country TEXT,
  city TEXT,
  commission_type TEXT NOT NULL DEFAULT 'fixed',
  commission_value NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.b2b_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view agents in their agency"
ON public.b2b_agents FOR SELECT TO authenticated
USING (agency_id = public.current_user_agency_id());

CREATE POLICY "Users can insert agents in their agency"
ON public.b2b_agents FOR INSERT TO authenticated
WITH CHECK (agency_id = public.current_user_agency_id());

CREATE POLICY "Users can update agents in their agency"
ON public.b2b_agents FOR UPDATE TO authenticated
USING (agency_id = public.current_user_agency_id());

CREATE POLICY "Users can delete agents in their agency"
ON public.b2b_agents FOR DELETE TO authenticated
USING (agency_id = public.current_user_agency_id());

CREATE TRIGGER update_b2b_agents_updated_at
  BEFORE UPDATE ON public.b2b_agents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX IF NOT EXISTS idx_b2b_agents_agency ON public.b2b_agents(agency_id);

-- b2b_bookings
CREATE TABLE IF NOT EXISTS public.b2b_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL CONSTRAINT b2b_bookings_agency_id_fkey REFERENCES public.agencies(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL CONSTRAINT b2b_bookings_agent_id_fkey REFERENCES public.b2b_agents(id) ON DELETE CASCADE,
  vendor_id UUID CONSTRAINT b2b_bookings_vendor_id_fkey REFERENCES public.vendors(id) ON DELETE SET NULL,
  pnr TEXT,
  passenger_name TEXT NOT NULL,
  passenger_passport TEXT,
  passenger_contact TEXT,
  destination TEXT,
  airline TEXT,
  flight_date TEXT,
  purchasing_price NUMERIC DEFAULT 0,
  selling_price NUMERIC DEFAULT 0,
  commission_amount NUMERIC DEFAULT 0,
  profit NUMERIC DEFAULT 0,
  booking_status TEXT DEFAULT 'confirmed',
  payment_status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.b2b_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view bookings in their agency"
ON public.b2b_bookings FOR SELECT TO authenticated
USING (agency_id = public.current_user_agency_id());

CREATE POLICY "Users can insert bookings in their agency"
ON public.b2b_bookings FOR INSERT TO authenticated
WITH CHECK (agency_id = public.current_user_agency_id());

CREATE POLICY "Users can update bookings in their agency"
ON public.b2b_bookings FOR UPDATE TO authenticated
USING (agency_id = public.current_user_agency_id());

CREATE POLICY "Users can delete bookings in their agency"
ON public.b2b_bookings FOR DELETE TO authenticated
USING (agency_id = public.current_user_agency_id());

CREATE TRIGGER update_b2b_bookings_updated_at
  BEFORE UPDATE ON public.b2b_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX IF NOT EXISTS idx_b2b_bookings_agency ON public.b2b_bookings(agency_id);
CREATE INDEX IF NOT EXISTS idx_b2b_bookings_agent ON public.b2b_bookings(agent_id);

-- b2b_ledger
CREATE TABLE IF NOT EXISTS public.b2b_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL CONSTRAINT b2b_ledger_agency_id_fkey REFERENCES public.agencies(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL CONSTRAINT b2b_ledger_agent_id_fkey REFERENCES public.b2b_agents(id) ON DELETE CASCADE,
  entry_date TEXT NOT NULL DEFAULT (to_char(now(), 'YYYY-MM-DD')),
  entry_type TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_mode TEXT DEFAULT 'cash',
  bank_name TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.b2b_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ledger in their agency"
ON public.b2b_ledger FOR SELECT TO authenticated
USING (agency_id = public.current_user_agency_id());

CREATE POLICY "Users can insert ledger in their agency"
ON public.b2b_ledger FOR INSERT TO authenticated
WITH CHECK (agency_id = public.current_user_agency_id());

CREATE POLICY "Users can update ledger in their agency"
ON public.b2b_ledger FOR UPDATE TO authenticated
USING (agency_id = public.current_user_agency_id());

CREATE POLICY "Users can delete ledger in their agency"
ON public.b2b_ledger FOR DELETE TO authenticated
USING (agency_id = public.current_user_agency_id());

CREATE INDEX IF NOT EXISTS idx_b2b_ledger_agency ON public.b2b_ledger(agency_id);
CREATE INDEX IF NOT EXISTS idx_b2b_ledger_agent ON public.b2b_ledger(agent_id);

