-- Create vendors table
CREATE TABLE public.vendors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL,
  name TEXT NOT NULL,
  contact_person TEXT,
  contact_number TEXT,
  email TEXT,
  booking_date DATE,
  payment_amount NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'Pending',
  service_type TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- Create policies for vendors
CREATE POLICY "Users can view vendors in their agency"
  ON public.vendors
  FOR SELECT
  USING (agency_id IN (
    SELECT agency_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert vendors in their agency"
  ON public.vendors
  FOR INSERT
  WITH CHECK (agency_id IN (
    SELECT agency_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update vendors in their agency"
  ON public.vendors
  FOR UPDATE
  USING (agency_id IN (
    SELECT agency_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can delete vendors"
  ON public.vendors
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Add license_status to agencies table if not exists
ALTER TABLE public.agencies 
  ADD COLUMN IF NOT EXISTS license_active BOOLEAN DEFAULT true;

-- Create policies for agencies update
CREATE POLICY "Users can update their own agency"
  ON public.agencies
  FOR UPDATE
  USING (id IN (
    SELECT agency_id FROM profiles WHERE id = auth.uid()
  ));