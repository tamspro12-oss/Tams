-- TAMS Pro: all migrations combined in chronological order (54 files).
-- Paste into Supabase Dashboard > SQL Editor on a FRESH, EMPTY project and click Run.
-- Generated from supabase/migrations/. Do not edit by hand; regenerate if migrations change.


-- ============================================================
-- 20251101083825_7db93a9e-78be-4077-9b9e-7d9a854e8f95.sql
-- ============================================================
-- Create app role enum for user permissions
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');

-- Create agencies table
CREATE TABLE public.agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_info TEXT,
  license_key TEXT UNIQUE NOT NULL,
  license_status TEXT DEFAULT 'active' CHECK (license_status IN ('active', 'expired', 'trial')),
  license_expiry TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE NOT NULL,
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create has_role function for RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  passport_number TEXT,
  contact_number TEXT,
  cnic TEXT,
  travel_type TEXT CHECK (travel_type IN ('Ticket', 'Umrah', 'Other')),
  flight_date DATE,
  destination TEXT,
  airline TEXT,
  pnr TEXT,
  payment_amount DECIMAL(12, 2),
  payment_status TEXT DEFAULT 'Pending' CHECK (payment_status IN ('Paid', 'Partial', 'Pending')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Create bookings table
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  pnr TEXT NOT NULL,
  flight_date DATE NOT NULL,
  seat_class TEXT,
  payment_status TEXT DEFAULT 'Pending' CHECK (payment_status IN ('Paid', 'Partial', 'Pending')),
  booking_type TEXT CHECK (booking_type IN ('Ticket', 'Umrah')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Create expenses table
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE NOT NULL,
  expense_date DATE NOT NULL,
  expense_type TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Create trigger function for new user profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, agency_id, full_name)
  VALUES (
    NEW.id,
    (NEW.raw_user_meta_data->>'agency_id')::UUID,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies for agencies
CREATE POLICY "Users can view their own agency"
  ON public.agencies FOR SELECT
  TO authenticated
  USING (id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid()));

-- RLS Policies for profiles
CREATE POLICY "Users can view profiles in their agency"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for clients
CREATE POLICY "Users can view clients in their agency"
  ON public.clients FOR SELECT
  TO authenticated
  USING (agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert clients in their agency"
  ON public.clients FOR INSERT
  TO authenticated
  WITH CHECK (agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update clients in their agency"
  ON public.clients FOR UPDATE
  TO authenticated
  USING (agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can delete clients"
  ON public.clients FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for bookings
CREATE POLICY "Users can view bookings in their agency"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert bookings in their agency"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK (agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update bookings in their agency"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can delete bookings"
  ON public.bookings FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for expenses
CREATE POLICY "Users can view expenses in their agency"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert expenses in their agency"
  ON public.expenses FOR INSERT
  TO authenticated
  WITH CHECK (agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update expenses in their agency"
  ON public.expenses FOR UPDATE
  TO authenticated
  USING (agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can delete expenses"
  ON public.expenses FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 20251101083906_7432581c-a3b6-4215-810b-8a5c9faa3075.sql
-- ============================================================
-- Fix search_path for update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 20251101120510_1693fb4f-2151-46ab-b06a-e5f9ba26e0af.sql
-- ============================================================
-- Make agency_id nullable so admins can create users first, then assign agency later
ALTER TABLE public.profiles ALTER COLUMN agency_id DROP NOT NULL;

-- Update the trigger to handle null agency_id gracefully
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, agency_id, full_name)
  VALUES (
    NEW.id,
    (NEW.raw_user_meta_data->>'agency_id')::UUID,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

-- ============================================================
-- 20251102070841_b3544eba-f40f-44f0-9d6d-fc9470e11ca3.sql
-- ============================================================
-- Enable realtime for dashboard tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;

-- ============================================================
-- 20251102073320_d7148c00-b2e5-44cc-8ba6-19ffe3d96e4e.sql
-- ============================================================
-- Add purchasing and selling price fields to clients table
ALTER TABLE clients 
ADD COLUMN purchasing_price numeric,
ADD COLUMN selling_price numeric;

-- Update travel_type to allow custom service names (it's already TEXT so supports any value)
-- Add a comment for clarity
COMMENT ON COLUMN clients.travel_type IS 'Service type: Ticket, Umrah, or custom service name';

-- Add profit calculation as a computed column would be ideal, but we'll calculate in the app instead
-- This keeps it flexible for different currencies and business rules

-- ============================================================
-- 20251102074731_5a9bcead-55fe-4103-8c2a-ae0c08a4a805.sql
-- ============================================================
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

-- ============================================================
-- 20251102102638_044a6edc-e678-4a69-a4f1-d43758702b16.sql
-- ============================================================
-- Fix infinite recursion in profiles RLS policy
-- The current policy tries to SELECT from profiles to check if user can SELECT from profiles (circular!)

-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Users can view profiles in their agency" ON profiles;

-- Add a simple policy: users can always view their own profile
CREATE POLICY "Users can view their own profile"
ON profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Add a policy: users can view other profiles in the same agency
-- This uses a non-recursive approach
CREATE POLICY "Users can view profiles in same agency"
ON profiles
FOR SELECT
TO authenticated
USING (
  agency_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM profiles p2 
    WHERE p2.id = auth.uid() 
    AND p2.agency_id = profiles.agency_id
  )
);

-- ============================================================
-- 20251102103746_7f9d7c5e-5f7b-4b6d-9f33-c51ad34d099c.sql
-- ============================================================
-- Update handle_new_user to auto-create agency for new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  new_agency_id UUID;
  agency_name TEXT;
BEGIN
  -- Get agency name from user metadata
  agency_name := COALESCE(NEW.raw_user_meta_data->>'agency_name', 'My Agency');
  
  -- Create a new agency for the user
  INSERT INTO public.agencies (name, license_key, license_status, license_active)
  VALUES (
    agency_name,
    'KEY-' || substr(md5(random()::text), 1, 8),
    'active',
    true
  )
  RETURNING id INTO new_agency_id;
  
  -- Insert profile with the new agency
  INSERT INTO public.profiles (id, agency_id, full_name)
  VALUES (
    NEW.id,
    new_agency_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  
  RETURN NEW;
END;
$$;

-- ============================================================
-- 20251102142121_fedf0684-62f6-4947-a865-01d3ebb5cb82.sql
-- ============================================================
-- Add vendor_id column to clients table
ALTER TABLE public.clients 
ADD COLUMN vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL;

-- ============================================================
-- 20251102142400_a9bd028e-76fd-406e-80cf-2c40c9182998.sql
-- ============================================================
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

-- ============================================================
-- 20251103121434_9675f1f8-66a1-420f-ba32-80de4b4ad5c4.sql
-- ============================================================
-- Fix infinite recursion in profiles RLS policy
-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Users can view profiles in same agency" ON profiles;

-- Create a simpler policy that doesn't cause recursion
-- This policy allows users to view profiles in their agency by checking agency_id directly
CREATE POLICY "Users can view profiles in same agency" ON profiles
  FOR SELECT
  USING (
    agency_id IN (
      SELECT agency_id 
      FROM profiles 
      WHERE id = auth.uid()
      LIMIT 1
    )
  );

-- ============================================================
-- 20251104111258_0bf39e90-8bf2-407f-8f5b-bb59b29c4fe6.sql
-- ============================================================
-- Helper function to safely get current user's agency id without RLS recursion
CREATE OR REPLACE FUNCTION public.current_user_agency_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT agency_id
  FROM public.profiles
  WHERE id = auth.uid();
$$;

-- PROFILES: Fix recursive policy by using the helper function
DROP POLICY IF EXISTS "Users can view profiles in same agency" ON public.profiles;
CREATE POLICY "Users can view profiles in same agency"
ON public.profiles
FOR SELECT
USING (agency_id = public.current_user_agency_id());

-- Keep existing own-profile policy as-is (relies only on id = auth.uid())
-- (No change to UPDATE policy)

-- AGENCIES: Replace subselect-based policies to avoid recursion
DROP POLICY IF EXISTS "Users can view their own agency" ON public.agencies;
CREATE POLICY "Users can view their own agency"
ON public.agencies
FOR SELECT
USING (id = public.current_user_agency_id());

DROP POLICY IF EXISTS "Users can update their own agency" ON public.agencies;
CREATE POLICY "Users can update their own agency"
ON public.agencies
FOR UPDATE
USING (id = public.current_user_agency_id());

-- ============================================================
-- 20251105072946_1b6dc6c1-97d0-4e89-9417-7233cde4a42f.sql
-- ============================================================
-- Add phone_number column to agencies table
ALTER TABLE public.agencies 
ADD COLUMN phone_number text;

-- ============================================================
-- 20251107062607_f5ad988a-340e-4a87-8b96-893bb3257be6.sql
-- ============================================================
-- Add remaining payment date column to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS remaining_payment_date DATE;

-- Create index for faster queries on remaining payment date
CREATE INDEX IF NOT EXISTS idx_clients_remaining_payment_date ON clients(remaining_payment_date);

COMMENT ON COLUMN clients.remaining_payment_date IS 'Date when the remaining payment is expected from the client';

-- ============================================================
-- 20251107064150_19b144a1-d73e-4aa0-83b4-699e490f8343.sql
-- ============================================================
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

-- ============================================================
-- 20251107095507_657b8a90-a6a7-4592-845c-d4e6b7aaa4d8.sql
-- ============================================================
-- Create google_drive_tokens table to store user's Drive OAuth tokens
CREATE TABLE public.google_drive_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  drive_folder_id TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.google_drive_tokens ENABLE ROW LEVEL SECURITY;

-- Users can view their own tokens
CREATE POLICY "Users can view their own Drive tokens"
ON public.google_drive_tokens
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own tokens
CREATE POLICY "Users can insert their own Drive tokens"
ON public.google_drive_tokens
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own tokens
CREATE POLICY "Users can update their own Drive tokens"
ON public.google_drive_tokens
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own tokens
CREATE POLICY "Users can delete their own Drive tokens"
ON public.google_drive_tokens
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_google_drive_tokens_updated_at
BEFORE UPDATE ON public.google_drive_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 20251107132828_f61c4b21-c8b5-4c7b-8e82-05a75a8906c7.sql
-- ============================================================
-- Drop existing foreign key constraint
ALTER TABLE public.clients
DROP CONSTRAINT IF EXISTS clients_vendor_id_fkey;

-- Recreate with CASCADE delete
-- When a vendor is deleted, all clients linked to that vendor will be automatically deleted
ALTER TABLE public.clients
ADD CONSTRAINT clients_vendor_id_fkey 
FOREIGN KEY (vendor_id) 
REFERENCES public.vendors(id) 
ON DELETE CASCADE;

-- ============================================================
-- 20251107133212_ff7f7469-a1ee-4efe-9b3d-7932ddd3a6df.sql
-- ============================================================
-- Allow users to delete clients in their own agency (needed for cascade delete to work)
DROP POLICY IF EXISTS "Users can delete clients in their agency" ON public.clients;
CREATE POLICY "Users can delete clients in their agency" 
ON public.clients 
FOR DELETE 
USING (
  agency_id IN (
    SELECT profiles.agency_id
    FROM profiles
    WHERE profiles.id = auth.uid()
  )
);

-- Allow users to delete vendors in their own agency  
DROP POLICY IF EXISTS "Users can delete vendors in their agency" ON public.vendors;
CREATE POLICY "Users can delete vendors in their agency" 
ON public.vendors 
FOR DELETE 
USING (
  agency_id IN (
    SELECT profiles.agency_id
    FROM profiles
    WHERE profiles.id = auth.uid()
  )
);

-- Keep admin policies for backward compatibility
-- Admin policy for clients
CREATE POLICY "Admins can delete all clients" 
ON public.clients 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin policy for vendors
CREATE POLICY "Admins can delete all vendors" 
ON public.vendors 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 20251107133240_79759cfe-e236-4f97-9e37-bbdd95e55af8.sql
-- ============================================================
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

-- ============================================================
-- 20251107133449_119bfa52-acd7-4a2a-a119-d6d2b9e50f90.sql
-- ============================================================
-- Add group booking columns to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS group_size integer DEFAULT 1 CHECK (group_size > 0),
ADD COLUMN IF NOT EXISTS group_booking_type text DEFAULT 'individual' CHECK (group_booking_type IN ('individual', 'group'));

-- Add comment for clarity
COMMENT ON COLUMN public.clients.group_size IS 'Number of passengers/people in this booking (1 for individual, >1 for group)';
COMMENT ON COLUMN public.clients.group_booking_type IS 'Type of booking: individual or group';

-- ============================================================
-- 20251107133905_87f63d89-003d-4940-9709-9ee91d480062.sql
-- ============================================================
-- Add passengers_data column to store individual passenger information for group bookings
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS passengers_data jsonb DEFAULT '[]'::jsonb;

-- Add comment for clarity
COMMENT ON COLUMN public.clients.passengers_data IS 'Array of passenger objects with name, passport, CNIC, etc for group bookings';

-- ============================================================
-- 20251107141522_f152e120-2591-4b0b-993d-6aed87c6d3f1.sql
-- ============================================================
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

-- ============================================================
-- 20251107143411_3fd8e766-19fd-4d95-bc29-bcc1ad01f21c.sql
-- ============================================================
-- Enable full row tracking for realtime updates
ALTER TABLE public.clients REPLICA IDENTITY FULL;
ALTER TABLE public.vendors REPLICA IDENTITY FULL;
ALTER TABLE public.expenses REPLICA IDENTITY FULL;
ALTER TABLE public.bookings REPLICA IDENTITY FULL;
ALTER TABLE public.client_payment_history REPLICA IDENTITY FULL;
ALTER TABLE public.vendor_payment_history REPLICA IDENTITY FULL;
ALTER TABLE public.invoices REPLICA IDENTITY FULL;

-- ============================================================
-- 20251109060121_59f80add-dfd7-4ea6-bb8c-632415e832f4.sql
-- ============================================================
-- Create queries table for client inquiries and to-do items
CREATE TABLE public.queries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL,
  client_name TEXT NOT NULL,
  contact_number TEXT,
  query_text TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed', 'cancelled')),
  assigned_to TEXT,
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.queries ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view queries in their agency" 
ON public.queries 
FOR SELECT 
USING (agency_id IN (
  SELECT agency_id 
  FROM profiles 
  WHERE id = auth.uid()
));

CREATE POLICY "Users can insert queries in their agency" 
ON public.queries 
FOR INSERT 
WITH CHECK (agency_id IN (
  SELECT agency_id 
  FROM profiles 
  WHERE id = auth.uid()
));

CREATE POLICY "Users can update queries in their agency" 
ON public.queries 
FOR UPDATE 
USING (agency_id IN (
  SELECT agency_id 
  FROM profiles 
  WHERE id = auth.uid()
));

CREATE POLICY "Users can delete queries in their agency" 
ON public.queries 
FOR DELETE 
USING (agency_id IN (
  SELECT agency_id 
  FROM profiles 
  WHERE id = auth.uid()
));

-- Create trigger for updated_at
CREATE TRIGGER update_queries_updated_at
BEFORE UPDATE ON public.queries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Create indexes for better performance
CREATE INDEX idx_queries_agency_id ON public.queries(agency_id);
CREATE INDEX idx_queries_status ON public.queries(status);
CREATE INDEX idx_queries_priority ON public.queries(priority);
CREATE INDEX idx_queries_due_date ON public.queries(due_date);

-- ============================================================
-- 20251119062106_5a9054c4-bbc1-41c6-be5e-f826a2e87780.sql
-- ============================================================
-- Add name_update_date field to clients table for reminder system
ALTER TABLE public.clients 
ADD COLUMN name_update_date DATE;

COMMENT ON COLUMN public.clients.name_update_date IS 'Optional date when passenger name needs to be updated on ticket';

-- Add name_update_date field to bookings table as well
ALTER TABLE public.bookings 
ADD COLUMN name_update_date DATE;

COMMENT ON COLUMN public.bookings.name_update_date IS 'Optional date when passenger name needs to be updated on ticket';

-- ============================================================
-- 20251119101007_3ced193a-aa49-4b00-87bb-d632d144c6ee.sql
-- ============================================================
-- Add critical performance indexes for scalability

-- Clients table indexes
CREATE INDEX IF NOT EXISTS idx_clients_flight_date ON public.clients(flight_date);
CREATE INDEX IF NOT EXISTS idx_clients_payment_status ON public.clients(payment_status);
CREATE INDEX IF NOT EXISTS idx_clients_agency_id_flight_date ON public.clients(agency_id, flight_date);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON public.clients(created_at);

-- Bookings table indexes
CREATE INDEX IF NOT EXISTS idx_bookings_flight_date ON public.bookings(flight_date);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON public.bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_agency_id_flight_date ON public.bookings(agency_id, flight_date);

-- Queries table indexes
CREATE INDEX IF NOT EXISTS idx_queries_status ON public.queries(status);
CREATE INDEX IF NOT EXISTS idx_queries_priority ON public.queries(priority);
CREATE INDEX IF NOT EXISTS idx_queries_agency_id_status ON public.queries(agency_id, status);
CREATE INDEX IF NOT EXISTS idx_queries_due_date ON public.queries(due_date);

-- Expenses table indexes
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON public.expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_type ON public.expenses(expense_type);
CREATE INDEX IF NOT EXISTS idx_expenses_agency_id_date ON public.expenses(agency_id, expense_date);

-- Vendors table indexes
CREATE INDEX IF NOT EXISTS idx_vendors_payment_status ON public.vendors(payment_status);
CREATE INDEX IF NOT EXISTS idx_vendors_service_type ON public.vendors(service_type);
CREATE INDEX IF NOT EXISTS idx_vendors_agency_id_payment_status ON public.vendors(agency_id, payment_status);

-- Payment history indexes
CREATE INDEX IF NOT EXISTS idx_client_payment_history_payment_date ON public.client_payment_history(payment_date);
CREATE INDEX IF NOT EXISTS idx_client_payment_history_client_id_date ON public.client_payment_history(client_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_vendor_payment_history_payment_date ON public.vendor_payment_history(payment_date);
CREATE INDEX IF NOT EXISTS idx_vendor_payment_history_vendor_id_date ON public.vendor_payment_history(vendor_id, payment_date);

-- Comment explaining the performance impact
COMMENT ON INDEX idx_clients_flight_date IS 'Speeds up dashboard queries filtering by flight date';
COMMENT ON INDEX idx_queries_status IS 'Optimizes active/pending queries filtering';
COMMENT ON INDEX idx_expenses_expense_date IS 'Improves date range queries in reports';

-- ============================================================
-- 20251120092207_a37f3f2d-d72c-4799-8855-8084464d43fe.sql
-- ============================================================
-- Add email fields to agencies table
ALTER TABLE public.agencies 
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS email_password text,
ADD COLUMN IF NOT EXISTS contact_email text;

-- Add email field to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS contact_person text;

-- Add comment for email_password security note
COMMENT ON COLUMN public.agencies.email_password IS 'Gmail App Password (16 characters) - stored encrypted';

-- Create index for better email lookups
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(email);
CREATE INDEX IF NOT EXISTS idx_agencies_email ON public.agencies(email);

-- ============================================================
-- 20251120094556_886f7e0b-2b78-4e5c-bd29-3704f26c1df3.sql
-- ============================================================
-- Create storage bucket for agency lightweight data
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'agency-files',
  'agency-files',
  false,
  5242880, -- 5MB limit per file
  ARRAY['application/json', 'text/plain']::text[]
);

-- RLS policies for agency-files bucket
CREATE POLICY "Users can view their own agency files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'agency-files' AND
  (storage.foldername(name))[1] = (
    SELECT REPLACE(REPLACE(auth.email(), '@', '-'), '.', '-')
    FROM auth.users
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can upload their own agency files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'agency-files' AND
  (storage.foldername(name))[1] = (
    SELECT REPLACE(REPLACE(auth.email(), '@', '-'), '.', '-')
    FROM auth.users
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update their own agency files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'agency-files' AND
  (storage.foldername(name))[1] = (
    SELECT REPLACE(REPLACE(auth.email(), '@', '-'), '.', '-')
    FROM auth.users
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own agency files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'agency-files' AND
  (storage.foldername(name))[1] = (
    SELECT REPLACE(REPLACE(auth.email(), '@', '-'), '.', '-')
    FROM auth.users
    WHERE id = auth.uid()
  )
);

-- ============================================================
-- 20251121064324_e7085029-077f-4f69-9dc7-8dc1f56c51d1.sql
-- ============================================================
-- Add subscription and storage fields to agencies
ALTER TABLE public.agencies 
ADD COLUMN IF NOT EXISTS subscription_plan text DEFAULT 'free' CHECK (subscription_plan IN ('free', 'monthly', 'yearly')),
ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS max_storage_bytes bigint DEFAULT 1073741824, -- 1GB default
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id);

-- Create files tracking table
CREATE TABLE IF NOT EXISTS public.files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  path text NOT NULL,
  filename text NOT NULL,
  size_bytes bigint NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  is_temporary boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone
);

-- Enable RLS on files table
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for files
CREATE POLICY "Users can view files in their agency"
ON public.files
FOR SELECT
USING (agency_id IN (
  SELECT agency_id FROM profiles WHERE id = auth.uid()
));

CREATE POLICY "Users can insert files in their agency"
ON public.files
FOR INSERT
WITH CHECK (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND uploaded_by = auth.uid()
);

CREATE POLICY "Admins can delete files"
ON public.files
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Function to get agency storage usage
CREATE OR REPLACE FUNCTION public.get_agency_storage_usage(p_agency_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(size_bytes), 0)
  FROM public.files
  WHERE agency_id = p_agency_id
    AND (is_temporary = false OR expires_at > now());
$$;

-- Function to check if agency can upload file
CREATE OR REPLACE FUNCTION public.can_upload_file(
  p_agency_id uuid,
  p_file_size bigint
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    SELECT max_storage_bytes FROM public.agencies WHERE id = p_agency_id
  ) >= (
    public.get_agency_storage_usage(p_agency_id) + p_file_size
  );
$$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_files_agency_id ON public.files(agency_id);
CREATE INDEX IF NOT EXISTS idx_files_expires_at ON public.files(expires_at) WHERE is_temporary = true;
CREATE INDEX IF NOT EXISTS idx_agencies_approval_status ON public.agencies(approval_status);

-- ============================================================
-- 20251122063040_ba0e2005-b328-4dff-860a-8a4eba493e49.sql
-- ============================================================
-- Create temporary email PDF storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tams-temp-email',
  'tams-temp-email',
  false,
  10485760, -- 10MB limit
  ARRAY['application/pdf']
);

-- RLS policy: users can only access their own temp files
CREATE POLICY "Users can manage their own temp email files"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'tams-temp-email' 
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'tams-temp-email'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Auto-cleanup policy: delete files older than 24 hours
CREATE POLICY "Auto delete temp files older than 24 hours"
ON storage.objects
FOR DELETE
TO service_role
USING (
  bucket_id = 'tams-temp-email'
  AND created_at < (now() - interval '24 hours')
);

-- ============================================================
-- 20251122065045_263b44bc-919e-4cb0-bd07-6fe35e9583cf.sql
-- ============================================================
-- Remove approval workflow columns from agencies table
ALTER TABLE public.agencies 
DROP COLUMN IF EXISTS approval_status,
DROP COLUMN IF EXISTS approved_at,
DROP COLUMN IF EXISTS approved_by;

-- Update handle_new_user trigger to remove approval logic
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_agency_id UUID;
  agency_name TEXT;
BEGIN
  -- Get agency name from user metadata
  agency_name := COALESCE(NEW.raw_user_meta_data->>'agency_name', 'My Agency');
  
  -- Create a new agency for the user (without approval status)
  INSERT INTO public.agencies (name, license_key, license_status, license_active)
  VALUES (
    agency_name,
    'KEY-' || substr(md5(random()::text), 1, 8),
    'active',
    true
  )
  RETURNING id INTO new_agency_id;
  
  -- Insert profile with the new agency
  INSERT INTO public.profiles (id, agency_id, full_name)
  VALUES (
    NEW.id,
    new_agency_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  
  RETURN NEW;
END;
$function$;

-- ============================================================
-- 20251126065811_2ef1d729-bb61-42ee-a279-d27124c1e41d.sql
-- ============================================================
-- Create policy acknowledgments table
CREATE TABLE public.policy_acknowledgments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  privacy_policy_version text NOT NULL DEFAULT '2025-11-25',
  terms_version text NOT NULL DEFAULT '2025-11-25',
  acknowledged_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.policy_acknowledgments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can insert their own acknowledgment"
ON public.policy_acknowledgments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own acknowledgment"
ON public.policy_acknowledgments
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own acknowledgment"
ON public.policy_acknowledgments
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 20251128074126_09b8274e-3dae-4f40-ae6f-7a28401afc6f.sql
-- ============================================================
-- Performance Indexes for TAMS
-- These indexes dramatically speed up searches and filtering

-- Index for PNR searches (clients table)
CREATE INDEX IF NOT EXISTS idx_clients_pnr ON clients(pnr);

-- Index for passport searches (clients table)
CREATE INDEX IF NOT EXISTS idx_clients_passport ON clients(passport_number);

-- Index for name searches - case insensitive (clients table)
CREATE INDEX IF NOT EXISTS idx_clients_name_lower ON clients(LOWER(name));

-- Index for phone searches (clients table)
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(contact_number);

-- Index for flight date filtering (clients table)
CREATE INDEX IF NOT EXISTS idx_clients_flight_date ON clients(flight_date);

-- Index for vendor relationships (clients table)
CREATE INDEX IF NOT EXISTS idx_clients_vendor_id ON clients(vendor_id);

-- Index for agency_id on all tables (for RLS optimization)
CREATE INDEX IF NOT EXISTS idx_clients_agency ON clients(agency_id);
CREATE INDEX IF NOT EXISTS idx_vendors_agency ON vendors(agency_id);
CREATE INDEX IF NOT EXISTS idx_expenses_agency ON expenses(agency_id);
CREATE INDEX IF NOT EXISTS idx_queries_agency ON queries(agency_id);
CREATE INDEX IF NOT EXISTS idx_bookings_agency ON bookings(agency_id);

-- Index for vendor name searches - case insensitive
CREATE INDEX IF NOT EXISTS idx_vendors_name_lower ON vendors(LOWER(name));

-- Index for expense date filtering
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);

-- Index for expense type filtering
CREATE INDEX IF NOT EXISTS idx_expenses_type ON expenses(expense_type);

-- Index for query status filtering
CREATE INDEX IF NOT EXISTS idx_queries_status ON queries(status);

-- Index for query priority filtering
CREATE INDEX IF NOT EXISTS idx_queries_priority ON queries(priority);

-- Index for booking PNR searches
CREATE INDEX IF NOT EXISTS idx_bookings_pnr ON bookings(pnr);

-- Index for booking flight date
CREATE INDEX IF NOT EXISTS idx_bookings_flight_date ON bookings(flight_date);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_clients_agency_flight_date ON clients(agency_id, flight_date DESC);
CREATE INDEX IF NOT EXISTS idx_vendors_agency_booking_date ON vendors(agency_id, booking_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_agency_date ON expenses(agency_id, expense_date DESC);

-- ============================================================
-- 20251201055239_a84a2424-b656-4d01-8697-17a7d92f9289.sql
-- ============================================================
-- Create email_logs table to track all sent emails
CREATE TABLE public.email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  sent_by UUID NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  email_type TEXT NOT NULL, -- 'booking', 'invoice', 'flight_reminder', 'payment_reminder'
  status TEXT NOT NULL DEFAULT 'pending', -- 'success', 'failed', 'queued'
  error_message TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  retry_count INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view email logs in their agency"
  ON public.email_logs
  FOR SELECT
  USING (agency_id IN (
    SELECT agency_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert email logs in their agency"
  ON public.email_logs
  FOR INSERT
  WITH CHECK (
    agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
    AND sent_by = auth.uid()
  );

-- Index for performance
CREATE INDEX idx_email_logs_agency_id ON public.email_logs(agency_id);
CREATE INDEX idx_email_logs_sent_at ON public.email_logs(sent_at DESC);
CREATE INDEX idx_email_logs_status ON public.email_logs(status);

-- ============================================================
-- 20251202081353_cd66e251-f36e-4403-a6de-3970137a23ae.sql
-- ============================================================
-- Update RLS policies for email_logs to allow deletion
DROP POLICY IF EXISTS "Users can delete email logs in their agency" ON public.email_logs;

CREATE POLICY "Users can delete email logs in their agency"
ON public.email_logs
FOR DELETE
USING (
  agency_id IN (
    SELECT agency_id 
    FROM profiles 
    WHERE id = auth.uid()
  )
);

-- Add auto_cleanup_settings column to agencies table for email log cleanup preferences
ALTER TABLE public.agencies 
ADD COLUMN IF NOT EXISTS email_cleanup_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS email_cleanup_frequency text DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS email_cleanup_keep_days integer DEFAULT 30;

COMMENT ON COLUMN public.agencies.email_cleanup_enabled IS 'Enable automatic cleanup of old email logs';
COMMENT ON COLUMN public.agencies.email_cleanup_frequency IS 'Cleanup frequency: weekly or monthly';
COMMENT ON COLUMN public.agencies.email_cleanup_keep_days IS 'Number of days to keep email logs before deletion';

-- ============================================================
-- 20251202090226_9679fc9f-5a38-4b7b-a47a-f8da02055066.sql
-- ============================================================
-- Allow admins to view all agencies
CREATE POLICY "Admins can view all agencies"
ON public.agencies FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update all agencies
CREATE POLICY "Admins can update all agencies"
ON public.agencies FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 20251202090923_6d798209-1ba6-4426-8487-d9ff0dd95336.sql
-- ============================================================
-- Create admin_audit_logs table for tracking all admin actions
CREATE TABLE public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  action_type text NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  target_name text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
ON public.admin_audit_logs FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can insert audit logs
CREATE POLICY "Admins can insert audit logs"
ON public.admin_audit_logs FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add delete policy for agencies (allow admins to delete)
CREATE POLICY "Admins can delete agencies"
ON public.agencies FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 20251202102845_075e15c2-f7ec-4dbe-91ac-0b98c809da44.sql
-- ============================================================
-- Create a function to get active session counts for all users
-- This function has SECURITY DEFINER to allow querying auth schema
CREATE OR REPLACE FUNCTION public.get_active_session_counts()
RETURNS TABLE (user_id uuid, session_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT 
    user_id,
    COUNT(*)::bigint as session_count
  FROM auth.sessions
  WHERE (not_after IS NULL OR not_after > NOW())
  GROUP BY user_id
$$;

-- ============================================================
-- 20251202103139_8c4045ba-5d96-40af-989b-483b33c6fc83.sql
-- ============================================================
-- Create function to get active sessions for a specific user
CREATE OR REPLACE FUNCTION public.get_user_active_sessions(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  user_agent text,
  ip text,
  not_after timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT 
    id,
    created_at,
    user_agent,
    ip::text,
    not_after
  FROM auth.sessions
  WHERE user_id = p_user_id
    AND (not_after IS NULL OR not_after > NOW())
  ORDER BY created_at DESC
$$;

-- Create function to delete all sessions for a user
CREATE OR REPLACE FUNCTION public.delete_all_user_sessions(p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  DELETE FROM auth.sessions
  WHERE user_id = p_user_id
$$;

-- Create function to delete a specific session (only if it belongs to the user)
CREATE OR REPLACE FUNCTION public.delete_user_session(p_user_id uuid, p_session_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  DELETE FROM auth.sessions
  WHERE id = p_session_id
    AND user_id = p_user_id
$$;


-- ============================================================
-- 20251202120450_838d5a12-2204-434b-a274-2e112d96955b.sql
-- ============================================================
-- Create sub_users table for Sub ID management
CREATE TABLE public.sub_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  main_user_id uuid NOT NULL,
  agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE NOT NULL,
  sub_id_code text NOT NULL UNIQUE,
  permissions jsonb NOT NULL DEFAULT '{
    "dashboard": true,
    "bookings": {"read": true, "write": false, "delete": false},
    "vendors": {"read": true, "write": false, "delete": false},
    "clients": {"read": true, "write": false, "delete": false},
    "queries": {"read": true, "write": false, "delete": false},
    "expenses": {"read": true, "write": false, "delete": false},
    "reports": {"read": true},
    "invoices": {"read": true, "write": false},
    "settings": false
  }'::jsonb,
  is_active boolean DEFAULT true,
  last_login timestamp with time zone,
  last_activity timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sub_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sub_users
CREATE POLICY "Super Admin can view all sub users"
ON public.sub_users
FOR SELECT
USING (
  (SELECT email FROM auth.users WHERE id = auth.uid()) = 'usmn4u@gmail.com'
);

CREATE POLICY "Main users can view their own sub users"
ON public.sub_users
FOR SELECT
USING (main_user_id = auth.uid());

CREATE POLICY "Sub users can view their own record"
ON public.sub_users
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Super Admin can manage all sub users"
ON public.sub_users
FOR ALL
USING (
  (SELECT email FROM auth.users WHERE id = auth.uid()) = 'usmn4u@gmail.com'
);

CREATE POLICY "Main users can manage their own sub users"
ON public.sub_users
FOR ALL
USING (main_user_id = auth.uid());

-- Helper function: Check if user is a Sub ID
CREATE OR REPLACE FUNCTION public.is_sub_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.sub_users WHERE user_id = _user_id AND is_active = true);
$$;

-- Helper function: Get Main ID for a Sub ID
CREATE OR REPLACE FUNCTION public.get_main_user_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT main_user_id FROM public.sub_users WHERE user_id = _user_id;
$$;

-- Helper function: Count Sub IDs for a Main ID
CREATE OR REPLACE FUNCTION public.count_sub_users(_main_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM public.sub_users WHERE main_user_id = _main_user_id AND is_active = true;
$$;

-- Helper function: Check module permission for Sub ID
CREATE OR REPLACE FUNCTION public.has_module_permission(_user_id uuid, _module text, _action text DEFAULT 'read')
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  perms jsonb;
  module_perms jsonb;
BEGIN
  -- If not a Sub ID, return true (Main ID has full access)
  SELECT permissions INTO perms FROM public.sub_users WHERE user_id = _user_id AND is_active = true;
  IF NOT FOUND THEN RETURN true; END IF;
  
  -- Check module permission
  module_perms := perms->_module;
  IF module_perms IS NULL THEN RETURN false; END IF;
  IF module_perms::text = 'true' THEN RETURN true; END IF;
  IF module_perms::text = 'false' THEN RETURN false; END IF;
  
  -- Check action-level permission
  RETURN COALESCE((module_perms->>_action)::boolean, false);
END;
$$;

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_sub_users_updated_at
BEFORE UPDATE ON public.sub_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 20251202121654_1f0afbd6-be86-4c63-9410-b73e5bf77236.sql
-- ============================================================
-- Fix sub_users RLS policies that reference auth.users and cause permission errors

-- Drop problematic Super Admin policies that directly query auth.users
DROP POLICY IF EXISTS "Super Admin can manage all sub users" ON public.sub_users;
DROP POLICY IF EXISTS "Super Admin can view all sub users" ON public.sub_users;

-- ============================================================
-- 20251202124231_4296876b-cb2b-446c-93b2-86579d2cd95e.sql
-- ============================================================
-- Security Hardening: Add sub-user permission enforcement to RLS policies
-- This ensures sub-users can only perform actions they have explicit permissions for

-- =====================================================
-- CLIENTS TABLE - Permission-based policies
-- =====================================================

-- Update INSERT policy to require write permission
DROP POLICY IF EXISTS "Users can insert clients in their agency" ON public.clients;
CREATE POLICY "Users can insert clients in their agency" 
ON public.clients FOR INSERT 
WITH CHECK (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'clients', 'write')
);

-- Update UPDATE policy to require write permission
DROP POLICY IF EXISTS "Users can update clients in their agency" ON public.clients;
CREATE POLICY "Users can update clients in their agency" 
ON public.clients FOR UPDATE 
USING (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'clients', 'write')
);

-- Update DELETE policy to require delete permission (non-admin)
DROP POLICY IF EXISTS "Users can delete clients in their agency" ON public.clients;
CREATE POLICY "Users can delete clients in their agency" 
ON public.clients FOR DELETE 
USING (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'clients', 'delete')
);

-- =====================================================
-- VENDORS TABLE - Permission-based policies
-- =====================================================

DROP POLICY IF EXISTS "Users can insert vendors in their agency" ON public.vendors;
CREATE POLICY "Users can insert vendors in their agency" 
ON public.vendors FOR INSERT 
WITH CHECK (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'vendors', 'write')
);

DROP POLICY IF EXISTS "Users can update vendors in their agency" ON public.vendors;
CREATE POLICY "Users can update vendors in their agency" 
ON public.vendors FOR UPDATE 
USING (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'vendors', 'write')
);

DROP POLICY IF EXISTS "Users can delete vendors in their agency" ON public.vendors;
CREATE POLICY "Users can delete vendors in their agency" 
ON public.vendors FOR DELETE 
USING (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'vendors', 'delete')
);

-- =====================================================
-- BOOKINGS TABLE - Permission-based policies
-- =====================================================

DROP POLICY IF EXISTS "Users can insert bookings in their agency" ON public.bookings;
CREATE POLICY "Users can insert bookings in their agency" 
ON public.bookings FOR INSERT 
WITH CHECK (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'bookings', 'write')
);

DROP POLICY IF EXISTS "Users can update bookings in their agency" ON public.bookings;
CREATE POLICY "Users can update bookings in their agency" 
ON public.bookings FOR UPDATE 
USING (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'bookings', 'write')
);

-- Add DELETE policy for bookings (requires delete permission)
CREATE POLICY "Users can delete bookings in their agency" 
ON public.bookings FOR DELETE 
USING (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'bookings', 'delete')
);

-- =====================================================
-- EXPENSES TABLE - Permission-based policies
-- =====================================================

DROP POLICY IF EXISTS "Users can insert expenses in their agency" ON public.expenses;
CREATE POLICY "Users can insert expenses in their agency" 
ON public.expenses FOR INSERT 
WITH CHECK (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'expenses', 'write')
);

DROP POLICY IF EXISTS "Users can update expenses in their agency" ON public.expenses;
CREATE POLICY "Users can update expenses in their agency" 
ON public.expenses FOR UPDATE 
USING (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'expenses', 'write')
);

-- Add DELETE policy for expenses (requires delete permission)
CREATE POLICY "Users can delete expenses in their agency" 
ON public.expenses FOR DELETE 
USING (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'expenses', 'delete')
);

-- =====================================================
-- QUERIES TABLE - Permission-based policies
-- =====================================================

DROP POLICY IF EXISTS "Users can insert queries in their agency" ON public.queries;
CREATE POLICY "Users can insert queries in their agency" 
ON public.queries FOR INSERT 
WITH CHECK (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'queries', 'write')
);

DROP POLICY IF EXISTS "Users can update queries in their agency" ON public.queries;
CREATE POLICY "Users can update queries in their agency" 
ON public.queries FOR UPDATE 
USING (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'queries', 'write')
);

DROP POLICY IF EXISTS "Users can delete queries in their agency" ON public.queries;
CREATE POLICY "Users can delete queries in their agency" 
ON public.queries FOR DELETE 
USING (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'queries', 'delete')
);

-- =====================================================
-- CLIENT PAYMENT HISTORY - Permission-based policies
-- =====================================================

DROP POLICY IF EXISTS "Users can insert payment history in their agency" ON public.client_payment_history;
CREATE POLICY "Users can insert payment history in their agency" 
ON public.client_payment_history FOR INSERT 
WITH CHECK (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'clients', 'write')
);

DROP POLICY IF EXISTS "Users can update payment history in their agency" ON public.client_payment_history;
CREATE POLICY "Users can update payment history in their agency" 
ON public.client_payment_history FOR UPDATE 
USING (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'clients', 'write')
);

-- =====================================================
-- VENDOR PAYMENT HISTORY - Permission-based policies
-- =====================================================

DROP POLICY IF EXISTS "Users can insert vendor payment history in their agency" ON public.vendor_payment_history;
CREATE POLICY "Users can insert vendor payment history in their agency" 
ON public.vendor_payment_history FOR INSERT 
WITH CHECK (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'vendors', 'write')
);

DROP POLICY IF EXISTS "Users can update vendor payment history in their agency" ON public.vendor_payment_history;
CREATE POLICY "Users can update vendor payment history in their agency" 
ON public.vendor_payment_history FOR UPDATE 
USING (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND has_module_permission(auth.uid(), 'vendors', 'write')
);

-- =====================================================
-- INVOICES TABLE - Permission-based policies
-- =====================================================

DROP POLICY IF EXISTS "Users can insert invoices in their agency" ON public.invoices;
CREATE POLICY "Users can insert invoices in their agency" 
ON public.invoices FOR INSERT 
WITH CHECK (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND generated_by = auth.uid()
  AND has_module_permission(auth.uid(), 'invoices', 'write')
);

-- ============================================================
-- 20260106110622_91c54373-22ff-4386-860e-25816ed625bc.sql
-- ============================================================
-- Remove the restrictive travel_type constraint to allow Custom Service names
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_travel_type_check;

-- ============================================================
-- 20260110000000_create_b2b_tables.sql
-- ============================================================
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


-- ============================================================
-- 20260111070214_1f424f36-0e90-4ca8-ac19-aa723c72bd7a.sql
-- ============================================================
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

-- ============================================================
-- 20260111072913_22e82e10-6e90-49c0-8218-796805ac1e26.sql
-- ============================================================
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

-- ============================================================
-- 20260406063032_27edb120-2900-414b-85b4-ec64c25cac9b.sql
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_agency_id UUID;
  agency_name TEXT;
  plan TEXT;
  duration_days INT;
  is_free BOOLEAN;
BEGIN
  -- Get values from user metadata
  agency_name := COALESCE(NEW.raw_user_meta_data->>'agency_name', 'My Agency');
  plan := LOWER(COALESCE(NEW.raw_user_meta_data->>'subscription_plan', 'free'));
  
  -- Determine duration
  IF plan = 'yearly' THEN
    duration_days := 370;
    is_free := false;
  ELSIF plan = 'monthly' THEN
    duration_days := 32;
    is_free := false;
  ELSE
    plan := 'free';
    duration_days := 14;
    is_free := true;
  END IF;

  -- Create a new agency for the user
  INSERT INTO public.agencies (
    name, license_key, subscription_plan,
    license_expiry, license_status, license_active
  )
  VALUES (
    agency_name,
    'KEY-' || substr(md5(random()::text), 1, 8),
    plan,
    NOW() + (duration_days || ' days')::interval,
    CASE WHEN is_free THEN 'active' ELSE 'pending_payment' END,
    is_free
  )
  RETURNING id INTO new_agency_id;
  
  -- Insert profile with the new agency
  INSERT INTO public.profiles (id, agency_id, full_name)
  VALUES (
    NEW.id,
    new_agency_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  
  RETURN NEW;
END;
$function$;

-- ============================================================
-- 20260406064504_7d5dace1-d67a-4787-bc88-a187c4bf5290.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_agency_id UUID;
  agency_name TEXT;
  plan TEXT;
BEGIN
  agency_name := COALESCE(NEW.raw_user_meta_data->>'agency_name', 'My Agency');
  plan := LOWER(COALESCE(NEW.raw_user_meta_data->>'subscription_plan', 'free'));
  
  IF plan NOT IN ('free', 'monthly', 'yearly') THEN
    plan := 'free';
  END IF;

  -- All plans get 14-day free trial, active immediately
  INSERT INTO public.agencies (
    name, license_key, subscription_plan,
    license_expiry, license_status, license_active
  )
  VALUES (
    agency_name,
    'KEY-' || substr(md5(random()::text), 1, 8),
    plan,
    NOW() + INTERVAL '14 days',
    'active',
    true
  )
  RETURNING id INTO new_agency_id;
  
  INSERT INTO public.profiles (id, agency_id, full_name)
  VALUES (
    NEW.id,
    new_agency_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  
  RETURN NEW;
END;
$function$;


-- ============================================================
-- 20260503125416_aa77e4d5-5990-4211-8289-824d833100ed.sql
-- ============================================================

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


-- ============================================================
-- 20260601112356_19eb2990-6d22-4c80-910a-f3e067ac6665.sql
-- ============================================================

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


-- ============================================================
-- 20260605070308_468f1198-3321-44e5-a07f-05d06d805133.sql
-- ============================================================
-- 1. Block sub-users from modifying financial tables (b2b_ledger, cash_bank_entries, opening_balances, refunds)
-- b2b_ledger
DROP POLICY IF EXISTS "Users can insert ledger in their agency" ON public.b2b_ledger;
DROP POLICY IF EXISTS "Users can update ledger in their agency" ON public.b2b_ledger;
DROP POLICY IF EXISTS "Users can delete ledger in their agency" ON public.b2b_ledger;

CREATE POLICY "Users can insert ledger in their agency" ON public.b2b_ledger
  FOR INSERT TO authenticated
  WITH CHECK (agency_id = public.current_user_agency_id() AND NOT public.is_sub_user(auth.uid()));
CREATE POLICY "Users can update ledger in their agency" ON public.b2b_ledger
  FOR UPDATE TO authenticated
  USING (agency_id = public.current_user_agency_id() AND NOT public.is_sub_user(auth.uid()));
CREATE POLICY "Users can delete ledger in their agency" ON public.b2b_ledger
  FOR DELETE TO authenticated
  USING (agency_id = public.current_user_agency_id() AND NOT public.is_sub_user(auth.uid()));

-- cash_bank_entries
DROP POLICY IF EXISTS "Users can insert their agency cash_bank_entries" ON public.cash_bank_entries;
DROP POLICY IF EXISTS "Users can update their agency cash_bank_entries" ON public.cash_bank_entries;
DROP POLICY IF EXISTS "Users can delete their agency cash_bank_entries" ON public.cash_bank_entries;

CREATE POLICY "Users can insert their agency cash_bank_entries" ON public.cash_bank_entries
  FOR INSERT TO authenticated
  WITH CHECK (agency_id = public.current_user_agency_id() AND NOT public.is_sub_user(auth.uid()));
CREATE POLICY "Users can update their agency cash_bank_entries" ON public.cash_bank_entries
  FOR UPDATE TO authenticated
  USING (agency_id = public.current_user_agency_id() AND NOT public.is_sub_user(auth.uid()));
CREATE POLICY "Users can delete their agency cash_bank_entries" ON public.cash_bank_entries
  FOR DELETE TO authenticated
  USING (agency_id = public.current_user_agency_id() AND NOT public.is_sub_user(auth.uid()));

-- opening_balances
DROP POLICY IF EXISTS "Users insert opening balances in their agency" ON public.opening_balances;
DROP POLICY IF EXISTS "Users update opening balances in their agency" ON public.opening_balances;
DROP POLICY IF EXISTS "Users delete opening balances in their agency" ON public.opening_balances;

CREATE POLICY "Users insert opening balances in their agency" ON public.opening_balances
  FOR INSERT TO authenticated
  WITH CHECK (agency_id = public.current_user_agency_id() AND NOT public.is_sub_user(auth.uid()));
CREATE POLICY "Users update opening balances in their agency" ON public.opening_balances
  FOR UPDATE TO authenticated
  USING (agency_id = public.current_user_agency_id() AND NOT public.is_sub_user(auth.uid()));
CREATE POLICY "Users delete opening balances in their agency" ON public.opening_balances
  FOR DELETE TO authenticated
  USING (agency_id = public.current_user_agency_id() AND NOT public.is_sub_user(auth.uid()));

-- refunds
DROP POLICY IF EXISTS "Users insert refunds in their agency" ON public.refunds;
DROP POLICY IF EXISTS "Users update refunds in their agency" ON public.refunds;
DROP POLICY IF EXISTS "Users delete refunds in their agency" ON public.refunds;

CREATE POLICY "Users insert refunds in their agency" ON public.refunds
  FOR INSERT TO authenticated
  WITH CHECK (agency_id = public.current_user_agency_id() AND NOT public.is_sub_user(auth.uid()));
CREATE POLICY "Users update refunds in their agency" ON public.refunds
  FOR UPDATE TO authenticated
  USING (agency_id = public.current_user_agency_id() AND NOT public.is_sub_user(auth.uid()));
CREATE POLICY "Users delete refunds in their agency" ON public.refunds
  FOR DELETE TO authenticated
  USING (agency_id = public.current_user_agency_id() AND NOT public.is_sub_user(auth.uid()));

-- 2. Revoke EXECUTE on backend-only SECURITY DEFINER functions from anon/authenticated
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_active_session_counts() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_active_sessions(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_user_session(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_all_user_sessions(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.count_sub_users(uuid) FROM PUBLIC, anon, authenticated;

-- Also tighten anon access on RLS helpers (only authenticated needs them)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_module_permission(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_agency_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_sub_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_main_user_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_upload_file(uuid, bigint) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_agency_storage_usage(uuid) FROM PUBLIC, anon;

-- 3. Remove column-level read access on agencies.email_password from regular users
-- Keep service_role full access (edge functions). Admins retain ALL via existing role.
REVOKE SELECT (email_password) ON public.agencies FROM anon, authenticated;


-- ============================================================
-- 20260701132942_e74b2aa1-4efd-4473-9c5c-f87e4b7581b6.sql
-- ============================================================

-- Files: agency-scoped DELETE and UPDATE for regular users
CREATE POLICY "Agency members can delete their agency files"
ON public.files
FOR DELETE
TO authenticated
USING (agency_id = public.current_user_agency_id());

CREATE POLICY "Agency members can update their agency files"
ON public.files
FOR UPDATE
TO authenticated
USING (agency_id = public.current_user_agency_id())
WITH CHECK (agency_id = public.current_user_agency_id());

-- Invoices: UPDATE policy mirroring INSERT permission check
CREATE POLICY "Agency members with write permission can update invoices"
ON public.invoices
FOR UPDATE
TO authenticated
USING (
  agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
  AND public.has_module_permission(auth.uid(), 'invoices', 'write')
)
WITH CHECK (
  agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
  AND public.has_module_permission(auth.uid(), 'invoices', 'write')
);


-- ============================================================
-- 20260705120046_f573fb4d-48c5-4150-8e3b-2b0c330297cf.sql
-- ============================================================
-- Admin role seed moved to supabase/seed_after_signup.sql
-- (Previously seeded an old project user into public.user_roles)


-- ============================================================
-- 20260823070456_dbe30e5e-d4cb-4fd7-8c21-c645059c4097.sql
-- ============================================================
-- 1. Hide SMTP password and license key from direct client reads
REVOKE SELECT (email_password, license_key) ON public.agencies FROM authenticated;
REVOKE SELECT (email_password, license_key) ON public.agencies FROM anon;

CREATE OR REPLACE FUNCTION public.agency_smtp_configured()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((
    SELECT email_password IS NOT NULL AND email_password <> ''
    FROM public.agencies
    WHERE id = public.current_user_agency_id()
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.get_agency_smtp_password()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.email_password
  FROM public.agencies a
  WHERE a.id = public.current_user_agency_id()
    AND NOT public.is_sub_user(auth.uid());
$$;

REVOKE ALL ON FUNCTION public.agency_smtp_configured() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_agency_smtp_password() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agency_smtp_configured() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agency_smtp_password() TO authenticated;

-- 2. Storage: verify agency-files ownership against application data
DROP POLICY IF EXISTS "Users can view their own agency files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own agency files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own agency files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own agency files" ON storage.objects;

CREATE POLICY "Agency members can read their agency files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'agency-files'
  AND (
    EXISTS (
      SELECT 1 FROM public.files f
      WHERE f.path = storage.objects.name
        AND f.agency_id = public.current_user_agency_id()
    )
    OR (storage.foldername(name))[1] = public.current_user_agency_id()::text
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

CREATE POLICY "Agency members can upload agency files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'agency-files'
  AND public.current_user_agency_id() IS NOT NULL
  AND (
    (storage.foldername(name))[1] = public.current_user_agency_id()::text
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

CREATE POLICY "Agency members can update their agency files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'agency-files'
  AND (
    EXISTS (
      SELECT 1 FROM public.files f
      WHERE f.path = storage.objects.name
        AND f.agency_id = public.current_user_agency_id()
    )
    OR (storage.foldername(name))[1] = public.current_user_agency_id()::text
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

CREATE POLICY "Agency members can delete their agency files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'agency-files'
  AND (
    EXISTS (
      SELECT 1 FROM public.files f
      WHERE f.path = storage.objects.name
        AND f.agency_id = public.current_user_agency_id()
    )
    OR (storage.foldername(name))[1] = public.current_user_agency_id()::text
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);
