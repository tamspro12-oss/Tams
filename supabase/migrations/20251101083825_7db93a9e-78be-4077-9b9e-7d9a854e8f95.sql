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