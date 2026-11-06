-- Create invoices table for tracking generated invoices
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL,
  client_id UUID NOT NULL,
  agency_id UUID NOT NULL,
  generated_by UUID NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  balance_due NUMERIC NOT NULL DEFAULT 0,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  item_description TEXT NOT NULL,
  additional_notes TEXT,
  pdf_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(agency_id, invoice_number)
);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view invoices in their agency"
ON public.invoices
FOR SELECT
USING (agency_id IN (
  SELECT agency_id FROM profiles WHERE id = auth.uid()
));

CREATE POLICY "Users can insert invoices in their agency"
ON public.invoices
FOR INSERT
WITH CHECK (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND generated_by = auth.uid()
);

CREATE POLICY "Admins can delete invoices"
ON public.invoices
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Create index for faster queries
CREATE INDEX idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX idx_invoices_agency_id ON public.invoices(agency_id);
CREATE INDEX idx_invoices_invoice_number ON public.invoices(invoice_number);
CREATE INDEX idx_invoices_created_at ON public.invoices(created_at DESC);