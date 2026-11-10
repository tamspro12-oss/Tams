-- ==============================================================================
-- TAMS PRO: MULTI-TENANT DATA ISOLATION & PER-AGENCY NUMBERING ENGINE
-- Migration: 20261109_tams_pro_data_isolation_and_per_agency_numbering.sql
-- 100% Additive, Idempotent, Non-destructive, Strict Data Isolation
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CURRENT AGENCY ISOLATION HELPER FUNCTIONS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_agency_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID;
BEGIN
  -- 1. Check profiles table for authenticated user
  SELECT agency_id INTO v_agency_id
  FROM public.profiles
  WHERE id = auth.uid();

  -- 2. Fallback to sub_users if profiles.agency_id was null
  IF v_agency_id IS NULL THEN
    SELECT agency_id INTO v_agency_id
    FROM public.sub_users
    WHERE user_id = auth.uid() AND is_active = true;
  END IF;

  RETURN v_agency_id;
END;
$$;

-- Synonym current_agency_id() as required in Section 5
CREATE OR REPLACE FUNCTION public.current_agency_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_agency_id();
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.current_user_agency_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_agency_id() TO authenticated, anon;


-- ------------------------------------------------------------------------------
-- 2. AGENCY IDENTITY COLUMNS & SEQUENCE (agency_no, agency_code)
-- ------------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.agency_no_seq START WITH 1 INCREMENT BY 1;

ALTER TABLE public.agencies
ADD COLUMN IF NOT EXISTS agency_no BIGINT,
ADD COLUMN IF NOT EXISTS agency_code TEXT;

-- Safe backfill for existing agencies
DO $$
DECLARE
  r RECORD;
  v_num BIGINT;
  v_digits INT;
BEGIN
  FOR r IN (
    SELECT id 
    FROM public.agencies 
    WHERE agency_no IS NULL 
    ORDER BY created_at ASC NULLS LAST, id ASC
  ) LOOP
    v_num := nextval('public.agency_no_seq');
    v_digits := GREATEST(5, LENGTH(v_num::TEXT));
    UPDATE public.agencies
    SET agency_no = v_num,
        agency_code = 'A' || LPAD(v_num::TEXT, v_digits, '0')
    WHERE id = r.id;
  END LOOP;
END $$;

-- Enforce Unique Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_agencies_agency_no ON public.agencies (agency_no);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agencies_agency_code ON public.agencies (agency_code);

-- Trigger to auto-assign agency_no and agency_code on agency creation
CREATE OR REPLACE FUNCTION public.set_agency_code_and_no()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num_digits INT;
BEGIN
  IF NEW.agency_no IS NULL THEN
    NEW.agency_no := nextval('public.agency_no_seq');
  END IF;

  IF NEW.agency_code IS NULL OR TRIM(NEW.agency_code) = '' THEN
    v_num_digits := GREATEST(5, LENGTH(NEW.agency_no::TEXT));
    NEW.agency_code := 'A' || LPAD(NEW.agency_no::TEXT, v_num_digits, '0');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_agency_code_and_no ON public.agencies;
CREATE TRIGGER trg_set_agency_code_and_no
BEFORE INSERT ON public.agencies
FOR EACH ROW
EXECUTE FUNCTION public.set_agency_code_and_no();


-- ------------------------------------------------------------------------------
-- 3. PER-AGENCY COUNTERS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agency_counters (
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  counter_type TEXT NOT NULL CHECK (counter_type IN ('invoice', 'client', 'vendor', 'voucher', 'refund')),
  last_value BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (agency_id, counter_type)
);

ALTER TABLE public.agency_counters ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Agencies view own counters" ON public.agency_counters;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Agencies view own counters"
  ON public.agency_counters FOR SELECT
  USING (agency_id = public.current_agency_id());

-- Auto-initialize counters for every new agency
CREATE OR REPLACE FUNCTION public.initialize_agency_counters()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.agency_counters (agency_id, counter_type, last_value, updated_at)
  VALUES
    (NEW.id, 'invoice', 0, now()),
    (NEW.id, 'client', 0, now()),
    (NEW.id, 'vendor', 0, now()),
    (NEW.id, 'voucher', 0, now()),
    (NEW.id, 'refund', 0, now())
  ON CONFLICT (agency_id, counter_type) DO NOTHING;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_initialize_agency_counters ON public.agencies;
CREATE TRIGGER trg_initialize_agency_counters
AFTER INSERT ON public.agencies
FOR EACH ROW
EXECUTE FUNCTION public.initialize_agency_counters();

-- Initialize counters for existing agencies without breaking existing counts
DO $$
DECLARE
  a RECORD;
  v_max_inv BIGINT;
  v_max_clt BIGINT;
  v_max_vnd BIGINT;
  v_max_vch BIGINT;
  v_max_rf BIGINT;
BEGIN
  FOR a IN (SELECT id FROM public.agencies) LOOP
    -- 1. Invoice sequence check
    SELECT COALESCE(MAX(
      CASE 
        WHEN invoice_no ~ '[0-9]+$' THEN (regexp_match(invoice_no, '([0-9]+)$'))[1]::BIGINT 
        ELSE 0 
      END
    ), 0) INTO v_max_inv
    FROM public.booking_invoices
    WHERE agency_id = a.id;

    -- Legacy invoices table check
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices' AND table_schema = 'public') THEN
      v_max_inv := GREATEST(v_max_inv, COALESCE((
        SELECT MAX(
          CASE 
            WHEN invoice_number ~ '[0-9]+$' THEN (regexp_match(invoice_number, '([0-9]+)$'))[1]::BIGINT 
            ELSE 0 
          END
        )
        FROM public.invoices
        WHERE agency_id = a.id
      ), 0));
    END IF;

    -- 2. Clients sequence check
    SELECT COALESCE(MAX(
      CASE 
        WHEN code ~ '^C-[0-9]+$' THEN (SUBSTRING(code FROM 3))::BIGINT
        WHEN code ~ '[0-9]+$' THEN (regexp_match(code, '([0-9]+)$'))[1]::BIGINT 
        ELSE 0 
      END
    ), 0) INTO v_max_clt
    FROM public.parties
    WHERE agency_id = a.id AND type IN ('client', 'both');

    -- 3. Vendors sequence check
    SELECT COALESCE(MAX(
      CASE 
        WHEN code ~ '^V-[0-9]+$' THEN (SUBSTRING(code FROM 3))::BIGINT
        WHEN code ~ '[0-9]+$' THEN (regexp_match(code, '([0-9]+)$'))[1]::BIGINT 
        ELSE 0 
      END
    ), 0) INTO v_max_vnd
    FROM public.parties
    WHERE agency_id = a.id AND type IN ('vendor', 'both');

    -- 4. Vouchers sequence check
    SELECT COALESCE(MAX(
      CASE 
        WHEN voucher_no ~ '[0-9]+$' THEN (regexp_match(voucher_no, '([0-9]+)$'))[1]::BIGINT 
        ELSE 0 
      END
    ), 0) INTO v_max_vch
    FROM public.payment_vouchers
    WHERE agency_id = a.id;

    -- 5. Refunds sequence check
    SELECT COALESCE(COUNT(*), 0) INTO v_max_rf
    FROM public.refunds
    WHERE agency_id = a.id;

    -- Insert initial counters for this agency
    INSERT INTO public.agency_counters (agency_id, counter_type, last_value, updated_at)
    VALUES
      (a.id, 'invoice', v_max_inv, now()),
      (a.id, 'client', v_max_clt, now()),
      (a.id, 'vendor', v_max_vnd, now()),
      (a.id, 'voucher', v_max_vch, now()),
      (a.id, 'refund', v_max_rf, now())
    ON CONFLICT (agency_id, counter_type)
    DO UPDATE SET last_value = GREATEST(public.agency_counters.last_value, EXCLUDED.last_value);
  END LOOP;
END $$;


-- ------------------------------------------------------------------------------
-- 4. ATOMIC COUNTER INCREMENT & NUMBER FORMATTING FUNCTIONS
-- ------------------------------------------------------------------------------
-- next_number(agency_id, counter_type) increments atomically
CREATE OR REPLACE FUNCTION public.next_number(p_agency_id UUID, p_counter_type TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next BIGINT;
BEGIN
  -- Strict multi-tenant verification: authenticated caller can only advance their own counter
  IF auth.uid() IS NOT NULL AND public.current_agency_id() IS NOT NULL THEN
    IF p_agency_id <> public.current_agency_id() THEN
      RAISE EXCEPTION 'Access denied: Cannot advance counter for another agency';
    END IF;
  END IF;

  INSERT INTO public.agency_counters (agency_id, counter_type, last_value, updated_at)
  VALUES (p_agency_id, p_counter_type, 1, now())
  ON CONFLICT (agency_id, counter_type)
  DO UPDATE SET last_value = public.agency_counters.last_value + 1, updated_at = now()
  RETURNING last_value INTO v_next;

  RETURN v_next;
END;
$$;

-- format_agency_number formats numbers according to Section 3 specs
CREATE OR REPLACE FUNCTION public.format_agency_number(
  p_agency_id UUID,
  p_counter_type TEXT,
  p_val BIGINT
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_code TEXT;
  v_digits INT;
BEGIN
  SELECT agency_code INTO v_agency_code
  FROM public.agencies
  WHERE id = p_agency_id;

  IF v_agency_code IS NULL OR TRIM(v_agency_code) = '' THEN
    v_agency_code := 'A00001';
  END IF;

  IF p_counter_type = 'invoice' THEN
    -- Invoice: INV-A00001-00000001 (prefix, agency_code, 8-digit sequence minimum)
    v_digits := GREATEST(8, LENGTH(p_val::TEXT));
    RETURN 'INV-' || v_agency_code || '-' || LPAD(p_val::TEXT, v_digits, '0');
  ELSIF p_counter_type = 'client' THEN
    -- Client code: C-000001 (6-digit sequence minimum)
    v_digits := GREATEST(6, LENGTH(p_val::TEXT));
    RETURN 'C-' || LPAD(p_val::TEXT, v_digits, '0');
  ELSIF p_counter_type = 'vendor' THEN
    -- Vendor code: V-000001 (6-digit sequence minimum)
    v_digits := GREATEST(6, LENGTH(p_val::TEXT));
    RETURN 'V-' || LPAD(p_val::TEXT, v_digits, '0');
  ELSIF p_counter_type = 'voucher' THEN
    -- Voucher: PV-00000001 (8-digit sequence minimum)
    v_digits := GREATEST(8, LENGTH(p_val::TEXT));
    RETURN 'PV-' || LPAD(p_val::TEXT, v_digits, '0');
  ELSIF p_counter_type = 'refund' THEN
    -- Refund: RF-00000001 (8-digit sequence minimum)
    v_digits := GREATEST(8, LENGTH(p_val::TEXT));
    RETURN 'RF-' || LPAD(p_val::TEXT, v_digits, '0');
  ELSE
    RETURN p_val::TEXT;
  END IF;
END;
$$;

-- next_formatted_number increments atomically and returns the formatted string
CREATE OR REPLACE FUNCTION public.next_formatted_number(p_agency_id UUID, p_counter_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num BIGINT;
BEGIN
  v_num := public.next_number(p_agency_id, p_counter_type);
  RETURN public.format_agency_number(p_agency_id, p_counter_type, v_num);
END;
$$;

-- preview_next_number provides read-only UI preview WITHOUT incrementing
CREATE OR REPLACE FUNCTION public.preview_next_number(p_counter_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID;
  v_last BIGINT := 0;
  v_next BIGINT := 1;
BEGIN
  v_agency_id := public.current_agency_id();
  IF v_agency_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(last_value, 0) INTO v_last
  FROM public.agency_counters
  WHERE agency_id = v_agency_id AND counter_type = p_counter_type;

  v_next := COALESCE(v_last, 0) + 1;
  RETURN public.format_agency_number(v_agency_id, p_counter_type, v_next);
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_number(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.format_agency_number(UUID, TEXT, BIGINT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.next_formatted_number(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_next_number(TEXT) TO authenticated;


-- ------------------------------------------------------------------------------
-- 5. SCHEMA CONSTRAINTS & UNIQUE INDEXES PER AGENCY
-- ------------------------------------------------------------------------------
-- Add client_code, vendor_code, refund_no columns if not existing
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS client_code TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS vendor_code TEXT;
ALTER TABLE public.refunds ADD COLUMN IF NOT EXISTS refund_no TEXT;

-- Unique constraints per agency
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_invoices_agency_invoice_no ON public.booking_invoices (agency_id, invoice_no);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_vouchers_agency_voucher_no ON public.payment_vouchers (agency_id, voucher_no);
CREATE UNIQUE INDEX IF NOT EXISTS idx_parties_agency_code_unique ON public.parties (agency_id, code) WHERE code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_agency_client_code ON public.clients (agency_id, client_code) WHERE client_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_agency_vendor_code ON public.vendors (agency_id, vendor_code) WHERE vendor_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_refunds_agency_refund_no ON public.refunds (agency_id, refund_no) WHERE refund_no IS NOT NULL;


-- ------------------------------------------------------------------------------
-- 6. DATABASE AUTO-ASSIGN NUMBERING TRIGGERS
-- ------------------------------------------------------------------------------
-- Auto-assign Booking Invoice Number
CREATE OR REPLACE FUNCTION public.assign_booking_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.invoice_no IS NULL OR TRIM(NEW.invoice_no) = '' OR NEW.invoice_no ~* 'preview' OR NEW.invoice_no ~ '^INV-[0-9]{4,7}$' THEN
    NEW.invoice_no := public.next_formatted_number(NEW.agency_id, 'invoice');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_booking_invoice_number ON public.booking_invoices;
CREATE TRIGGER trg_assign_booking_invoice_number
BEFORE INSERT ON public.booking_invoices
FOR EACH ROW
EXECUTE FUNCTION public.assign_booking_invoice_number();

-- Auto-assign Payment Voucher Number
CREATE OR REPLACE FUNCTION public.assign_payment_voucher_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.voucher_no IS NULL OR TRIM(NEW.voucher_no) = '' OR NEW.voucher_no ~* 'preview' OR NEW.voucher_no ~ '^(PV|CRV|CPV)-[0-9]{4,7}$' THEN
    NEW.voucher_no := public.next_formatted_number(NEW.agency_id, 'voucher');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_payment_voucher_number ON public.payment_vouchers;
CREATE TRIGGER trg_assign_payment_voucher_number
BEFORE INSERT ON public.payment_vouchers
FOR EACH ROW
EXECUTE FUNCTION public.assign_payment_voucher_number();

-- Auto-assign Parties Code (C-000001 or V-000001)
CREATE OR REPLACE FUNCTION public.assign_party_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.code IS NULL OR TRIM(NEW.code) = '' OR NEW.code ~ '^(CLT|VND|PRT)-[0-9]{4,6}$' THEN
    IF NEW.type = 'vendor' THEN
      NEW.code := public.next_formatted_number(NEW.agency_id, 'vendor');
    ELSE
      NEW.code := public.next_formatted_number(NEW.agency_id, 'client');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_party_code ON public.parties;
CREATE TRIGGER trg_assign_party_code
BEFORE INSERT ON public.parties
FOR EACH ROW
EXECUTE FUNCTION public.assign_party_code();

-- Auto-assign Clients Code
CREATE OR REPLACE FUNCTION public.assign_clients_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.client_code IS NULL OR TRIM(NEW.client_code) = '' THEN
    NEW.client_code := public.next_formatted_number(NEW.agency_id, 'client');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_clients_code ON public.clients;
CREATE TRIGGER trg_assign_clients_code
BEFORE INSERT ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.assign_clients_code();

-- Auto-assign Vendors Code
CREATE OR REPLACE FUNCTION public.assign_vendors_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.vendor_code IS NULL OR TRIM(NEW.vendor_code) = '' THEN
    NEW.vendor_code := public.next_formatted_number(NEW.agency_id, 'vendor');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_vendors_code ON public.vendors;
CREATE TRIGGER trg_assign_vendors_code
BEFORE INSERT ON public.vendors
FOR EACH ROW
EXECUTE FUNCTION public.assign_vendors_code();

-- Auto-assign Refunds Number
CREATE OR REPLACE FUNCTION public.assign_refunds_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.refund_no IS NULL OR TRIM(NEW.refund_no) = '' THEN
    NEW.refund_no := public.next_formatted_number(NEW.agency_id, 'refund');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_refunds_number ON public.refunds;
CREATE TRIGGER trg_assign_refunds_number
BEFORE INSERT ON public.refunds
FOR EACH ROW
EXECUTE FUNCTION public.assign_refunds_number();


-- ------------------------------------------------------------------------------
-- 7. SECURITY & STRICT DATA ISOLATION ENFORCEMENT
-- ------------------------------------------------------------------------------
-- Universal trigger function to guarantee agency_id is never forged from frontend
CREATE OR REPLACE FUNCTION public.enforce_agency_isolation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_agency UUID;
BEGIN
  v_user_agency := public.current_agency_id();

  -- If operation is executed in authenticated session
  IF auth.uid() IS NOT NULL THEN
    IF v_user_agency IS NULL THEN
      RAISE EXCEPTION 'Access denied: User is not linked to any active agency';
    END IF;

    IF TG_OP = 'INSERT' THEN
      -- Automatically enforce agency_id from server session
      IF NEW.agency_id IS NULL OR NEW.agency_id <> v_user_agency THEN
        NEW.agency_id := v_user_agency;
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      -- Block any attempt to change agency_id or modify another agency's data
      IF NEW.agency_id <> OLD.agency_id THEN
        RAISE EXCEPTION 'Security violation: agency_id cannot be changed';
      END IF;
      IF NEW.agency_id <> v_user_agency THEN
        RAISE EXCEPTION 'Access denied: Cannot update data belonging to another agency';
      END IF;
    ELSIF TG_OP = 'DELETE' THEN
      IF OLD.agency_id <> v_user_agency THEN
        RAISE EXCEPTION 'Access denied: Cannot delete data belonging to another agency';
      END IF;
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- Trigger to block cross-agency foreign keys (e.g. invoice referencing another agency's party)
CREATE OR REPLACE FUNCTION public.check_cross_agency_fk()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'booking_invoices' THEN
    IF NEW.party_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.parties WHERE id = NEW.party_id AND agency_id = NEW.agency_id) THEN
        RAISE EXCEPTION 'Cross-agency violation: party_id does not belong to your agency';
      END IF;
    END IF;
    IF NEW.vendor_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.parties WHERE id = NEW.vendor_id AND agency_id = NEW.agency_id) THEN
        RAISE EXCEPTION 'Cross-agency violation: vendor_id does not belong to your agency';
      END IF;
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'payment_vouchers' THEN
    IF NEW.party_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.parties WHERE id = NEW.party_id AND agency_id = NEW.agency_id) THEN
        RAISE EXCEPTION 'Cross-agency violation: party_id does not belong to your agency';
      END IF;
    END IF;
    IF NEW.account_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = NEW.account_id AND agency_id = NEW.agency_id) THEN
        RAISE EXCEPTION 'Cross-agency violation: account_id does not belong to your agency';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fk_booking_invoices ON public.booking_invoices;
CREATE TRIGGER trg_fk_booking_invoices
BEFORE INSERT OR UPDATE ON public.booking_invoices
FOR EACH ROW
EXECUTE FUNCTION public.check_cross_agency_fk();

DROP TRIGGER IF EXISTS trg_fk_payment_vouchers ON public.payment_vouchers;
CREATE TRIGGER trg_fk_payment_vouchers
BEFORE INSERT OR UPDATE ON public.payment_vouchers
FOR EACH ROW
EXECUTE FUNCTION public.check_cross_agency_fk();


-- ------------------------------------------------------------------------------
-- 8. UNIFIED ROW-LEVEL SECURITY (RLS) POLICIES ON ALL BUSINESS TABLES
-- ------------------------------------------------------------------------------
-- Macro DO block to enable RLS and set strict policies
DO $$
DECLARE
  t TEXT;
  tbls TEXT[] := ARRAY[
    'clients', 'vendors', 'bookings', 'invoices', 'booking_invoices',
    'parties', 'accounts', 'transactions', 'payment_vouchers',
    'invoice_allocations', 'refunds', 'refund_void_records', 'expenses',
    'client_payment_history', 'vendor_payment_history', 'cash_bank_entries',
    'agency_banks', 'b2b_agents', 'b2b_bookings', 'b2b_ledger',
    'central_journal_entries', 'notifications', 'quotations', 'queries',
    'reminders', 'reminder_settings', 'agency_whatsapp_settings',
    'opening_balances', 'files', 'vouchers', 'agency_counters'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t AND table_schema = 'public') THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
      
      -- Drop old policies to avoid permissive leaks
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_agency_isolation', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'Agencies manage their own ' || t, t);
      
      -- Create strict unified isolation policy
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL USING (agency_id = public.current_agency_id()) WITH CHECK (agency_id = public.current_agency_id());',
        t || '_agency_isolation',
        t
      );

      -- Attach agency isolation trigger
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I;', 'trg_isolation_' || t, t);
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_agency_isolation();',
        'trg_isolation_' || t,
        t
      );
    END IF;
  END LOOP;
END $$;

-- Agencies table RLS
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  DROP POLICY IF EXISTS "Agencies manage own record" ON public.agencies;
  DROP POLICY IF EXISTS "Agencies view own record" ON public.agencies;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Agencies view and update own record"
  ON public.agencies FOR ALL
  USING (id = public.current_agency_id())
  WITH CHECK (id = public.current_agency_id());

-- Profiles table RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  DROP POLICY IF EXISTS "Profiles view same agency" ON public.profiles;
  DROP POLICY IF EXISTS "Profiles update own" ON public.profiles;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Profiles view same agency"
  ON public.profiles FOR SELECT
  USING (agency_id = public.current_agency_id() OR id = auth.uid());

CREATE POLICY "Profiles update own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND agency_id = public.current_agency_id());

-- Storage strict agency isolation
DO $$
BEGIN
  DROP POLICY IF EXISTS "Agency members can read their agency files" ON storage.objects;
  DROP POLICY IF EXISTS "Agency members can upload agency files" ON storage.objects;
  DROP POLICY IF EXISTS "Agency members can update their agency files" ON storage.objects;
  DROP POLICY IF EXISTS "Agency members can delete their agency files" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Agency members can read their agency files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'agency-files'
  AND (storage.foldername(name))[1] = public.current_agency_id()::text
);

CREATE POLICY "Agency members can upload agency files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'agency-files'
  AND public.current_agency_id() IS NOT NULL
  AND (storage.foldername(name))[1] = public.current_agency_id()::text
);

CREATE POLICY "Agency members can update their agency files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'agency-files'
  AND (storage.foldername(name))[1] = public.current_agency_id()::text
);

CREATE POLICY "Agency members can delete their agency files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'agency-files'
  AND (storage.foldername(name))[1] = public.current_agency_id()::text
);


-- ------------------------------------------------------------------------------
-- 9. UPDATED RPC FUNCTIONS WITH ATOMIC NUMBERING & AUDITING
-- ------------------------------------------------------------------------------
-- Update save_booking_invoice to atomically assign and return final invoice_no
CREATE OR REPLACE FUNCTION public.save_booking_invoice(
    p_invoice_no TEXT,
    p_service TEXT,
    p_party_id UUID,
    p_vendor_id UUID DEFAULT NULL,
    p_client_amount NUMERIC DEFAULT 0,
    p_vendor_payable NUMERIC DEFAULT 0,
    p_invoice_date DATE DEFAULT CURRENT_DATE,
    p_pnr TEXT DEFAULT NULL,
    p_ticket_no TEXT DEFAULT NULL,
    p_passport_no TEXT DEFAULT NULL,
    p_passengers JSONB DEFAULT '[]'::jsonb,
    p_currency TEXT DEFAULT 'PKR',
    p_sar_rate NUMERIC DEFAULT NULL,
    p_sar_amount NUMERIC DEFAULT NULL,
    p_commission NUMERIC DEFAULT 0,
    p_wht NUMERIC DEFAULT 0,
    p_more_details JSONB DEFAULT '{}'::jsonb,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_agency_id UUID;
    v_invoice_id UUID;
    v_group_id UUID := gen_random_uuid();
    v_profit NUMERIC;
    v_inv_no TEXT;
    v_party_name TEXT;
    v_vendor_name TEXT;
    v_acc_receivable_id UUID;
    v_acc_revenue_id UUID;
    v_acc_payable_id UUID;
    v_acc_cogs_id UUID;
BEGIN
    v_agency_id := public.current_agency_id();
    IF v_agency_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: No active agency found for current user';
    END IF;

    -- Calculate profit
    v_profit := COALESCE(p_client_amount, 0) - COALESCE(p_vendor_payable, 0);

    -- Atomic invoice number from database sequence
    v_inv_no := public.next_formatted_number(v_agency_id, 'invoice');

    -- Insert Booking Invoice
    INSERT INTO public.booking_invoices (
        agency_id, invoice_no, invoice_date, service, party_id, vendor_id,
        client_amount, vendor_payable, profit, pnr, ticket_no, passport_no,
        passengers, currency, sar_rate, sar_amount, commission, wht,
        more_details, notes, created_by
    )
    VALUES (
        v_agency_id, v_inv_no, COALESCE(p_invoice_date, CURRENT_DATE), p_service,
        p_party_id, p_vendor_id, COALESCE(p_client_amount, 0), COALESCE(p_vendor_payable, 0),
        v_profit, p_pnr, p_ticket_no, p_passport_no,
        COALESCE(p_passengers, '[]'::jsonb), COALESCE(p_currency, 'PKR'),
        p_sar_rate, p_sar_amount, COALESCE(p_commission, 0), COALESCE(p_wht, 0),
        COALESCE(p_more_details, '{}'::jsonb), p_notes, auth.uid()
    )
    RETURNING id INTO v_invoice_id;

    -- Automatic Ledger & Party Balance Sync
    IF p_party_id IS NOT NULL AND COALESCE(p_client_amount, 0) > 0 THEN
      UPDATE public.parties
      SET current_balance = COALESCE(current_balance, 0) + p_client_amount,
          updated_at = now()
      WHERE id = p_party_id AND agency_id = v_agency_id;
    END IF;

    IF p_vendor_id IS NOT NULL AND COALESCE(p_vendor_payable, 0) > 0 THEN
      UPDATE public.parties
      SET current_balance = COALESCE(current_balance, 0) - p_vendor_payable,
          updated_at = now()
      WHERE id = p_vendor_id AND agency_id = v_agency_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'invoice_id', v_invoice_id,
        'invoice_no', v_inv_no,
        'profit', v_profit,
        'message', 'Booking Invoice generated and posted with strict agency isolation'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_booking_invoice TO authenticated;
