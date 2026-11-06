
CREATE TABLE public.quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL,
  quotation_number TEXT NOT NULL,
  quotation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  service_type TEXT NOT NULL DEFAULT 'client_booking',
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  client_id UUID,
  agent_id UUID,
  title TEXT,
  description TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  tax NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'PKR',
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  terms TEXT,
  source TEXT,
  source_ref JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotations TO authenticated;
GRANT ALL ON public.quotations TO service_role;

ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view quotations in their agency"
ON public.quotations FOR SELECT
USING (agency_id = current_user_agency_id());

CREATE POLICY "Users insert quotations in their agency"
ON public.quotations FOR INSERT
WITH CHECK (agency_id = current_user_agency_id());

CREATE POLICY "Users update quotations in their agency"
ON public.quotations FOR UPDATE
USING (agency_id = current_user_agency_id());

CREATE POLICY "Users delete quotations in their agency"
ON public.quotations FOR DELETE
USING (agency_id = current_user_agency_id());

CREATE INDEX idx_quotations_agency ON public.quotations(agency_id, created_at DESC);

CREATE TRIGGER quotations_set_updated_at
BEFORE UPDATE ON public.quotations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
