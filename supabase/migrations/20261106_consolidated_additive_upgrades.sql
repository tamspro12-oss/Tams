-- ==============================================================================
-- TAMS PRO: MULTI-PHASE UPGRADES & REMINDERS (ADDITIVE SCHEMA ONLY)
-- Safe for Live Production: ZERO DESTRUCTIVE CHANGES
-- ==============================================================================

-- 1. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_queries_agency_status_priority_created
ON public.queries (agency_id, status, priority, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_b2b_bookings_search
ON public.b2b_bookings (agency_id, agent_id, passenger_name, pnr);

-- 2. B2B Agent Voucher Privileges
ALTER TABLE public.b2b_agents
ADD COLUMN IF NOT EXISTS can_create_vouchers BOOLEAN DEFAULT false;

-- 3. Vouchers Table
CREATE TABLE IF NOT EXISTS public.vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL,
  agent_id UUID REFERENCES public.b2b_agents(id) ON DELETE SET NULL,
  booking_id UUID,
  voucher_number TEXT NOT NULL,
  voucher_type TEXT NOT NULL CHECK (voucher_type IN ('Umrah', 'Hotel', 'Ticket')),
  status TEXT NOT NULL DEFAULT 'Issued' CHECK (status IN ('Draft', 'Issued', 'Cancelled')),
  passenger_name TEXT NOT NULL,
  passenger_passport TEXT,
  passengers JSONB DEFAULT '[]'::jsonb,
  contact_number TEXT,
  package_name TEXT,
  hotel_name TEXT,
  city TEXT,
  check_in DATE,
  check_out DATE,
  nights INTEGER DEFAULT 0,
  room_type TEXT,
  number_of_rooms INTEGER DEFAULT 1,
  meal_plan TEXT,
  hotel_confirmation_code TEXT,
  transport_details TEXT,
  visa_status TEXT,
  ziyarat_details TEXT,
  makkah_hotel TEXT,
  makkah_check_in DATE,
  makkah_check_out DATE,
  makkah_nights INTEGER,
  madinah_hotel TEXT,
  madinah_check_in DATE,
  madinah_check_out DATE,
  madinah_nights INTEGER,
  airline TEXT,
  flight_number TEXT,
  sector TEXT,
  departure_date TIMESTAMP WITH TIME ZONE,
  arrival_date TIMESTAMP WITH TIME ZONE,
  flight_class TEXT DEFAULT 'Economy',
  baggage TEXT,
  pnr TEXT,
  ticket_number TEXT,
  remarks TEXT,
  terms_and_conditions TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vouchers_agency_id ON public.vouchers(agency_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_agent_id ON public.vouchers(agent_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_type_status ON public.vouchers(voucher_type, status);
CREATE INDEX IF NOT EXISTS idx_vouchers_passenger_pnr ON public.vouchers(passenger_name, pnr);

ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vouchers' AND policyname = 'Users can manage vouchers in their agency'
  ) THEN
    CREATE POLICY "Users can manage vouchers in their agency"
    ON public.vouchers
    FOR ALL
    USING (agency_id = public.current_user_agency_id())
    WITH CHECK (agency_id = public.current_user_agency_id());
  END IF;
END $$;

-- 4. Reminders Table
CREATE TABLE IF NOT EXISTS public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  agency_id UUID NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('flight', 'umrah', 'daily_expense', 'manual')),
  remind_date DATE NOT NULL,
  remind_time TIME DEFAULT '09:00:00',
  booking_id UUID,
  is_completed BOOLEAN DEFAULT false,
  is_recurring_daily BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reminders_agency_date ON public.reminders(agency_id, remind_date, is_completed);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reminders' AND policyname = 'Users can manage reminders in their agency'
  ) THEN
    CREATE POLICY "Users can manage reminders in their agency"
    ON public.reminders
    FOR ALL
    USING (agency_id = public.current_user_agency_id())
    WITH CHECK (agency_id = public.current_user_agency_id());
  END IF;
END $$;

-- 5. Reminder Settings Table
CREATE TABLE IF NOT EXISTS public.reminder_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL UNIQUE,
  opening_time TIME DEFAULT '09:00:00',
  closing_time TIME DEFAULT '20:00:00',
  flight_alerts_enabled BOOLEAN DEFAULT true,
  umrah_alerts_enabled BOOLEAN DEFAULT true,
  daily_expense_reminder_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reminder_settings' AND policyname = 'Users can manage reminder settings in their agency'
  ) THEN
    CREATE POLICY "Users can manage reminder settings in their agency"
    ON public.reminder_settings
    FOR ALL
    USING (agency_id = public.current_user_agency_id())
    WITH CHECK (agency_id = public.current_user_agency_id());
  END IF;
END $$;
