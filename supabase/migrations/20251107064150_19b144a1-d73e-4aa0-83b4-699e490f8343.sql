-- Create client payment history table
CREATE TABLE IF NOT EXISTS public.client_payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL,
  payment_amount NUMERIC NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('partial', 'full')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create vendor payment history table
CREATE TABLE IF NOT EXISTS public.vendor_payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL,
  payment_amount NUMERIC NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('partial', 'full')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_payment_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for client_payment_history
CREATE POLICY "Users can view payment history in their agency"
  ON public.client_payment_history FOR SELECT
  USING (agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert payment history in their agency"
  ON public.client_payment_history FOR INSERT
  WITH CHECK (agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update payment history in their agency"
  ON public.client_payment_history FOR UPDATE
  USING (agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can delete payment history"
  ON public.client_payment_history FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for vendor_payment_history
CREATE POLICY "Users can view vendor payment history in their agency"
  ON public.vendor_payment_history FOR SELECT
  USING (agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert vendor payment history in their agency"
  ON public.vendor_payment_history FOR INSERT
  WITH CHECK (agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update vendor payment history in their agency"
  ON public.vendor_payment_history FOR UPDATE
  USING (agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can delete vendor payment history"
  ON public.vendor_payment_history FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for better query performance
CREATE INDEX idx_client_payment_history_client_id ON public.client_payment_history(client_id);
CREATE INDEX idx_client_payment_history_payment_date ON public.client_payment_history(payment_date);
CREATE INDEX idx_vendor_payment_history_vendor_id ON public.vendor_payment_history(vendor_id);
CREATE INDEX idx_vendor_payment_history_payment_date ON public.vendor_payment_history(payment_date);

-- Create triggers for updated_at
CREATE TRIGGER update_client_payment_history_updated_at
  BEFORE UPDATE ON public.client_payment_history
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_vendor_payment_history_updated_at
  BEFORE UPDATE ON public.vendor_payment_history
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();