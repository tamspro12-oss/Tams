-- ==============================================================================
-- TAMS PRO — SINGLE IDEMPOTENT HARDENING & ATOMIC NUMBERING MIGRATION
-- File: supabase/migrations/20261115_01_hardening_all_forms_and_atomic_numbering.sql
--
-- Safe, idempotent, non-destructive upgrade covering:
--   1. One-time pre-migration backup snapshot schema (backup_20261115)
--   2. Active sub-user & agency owner RBAC guards + strict RLS isolation
--   3. Row-locked (SELECT ... FOR UPDATE) atomic per-agency counters across ALL
--      auto-numbered entities + collision-skipping auto assignment + manual
--      override pre-check RPC (check_document_number_available)
--   4. Seeding all counter types for every agency from current max values
--   5. Cleanup of redundant unique indexes & addition of missing unique indexes
--   6. Atomic RPCs supporting Auto mode & validated Manual Override mode
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. NON-DESTRUCTIVE PRE-MIGRATION SNAPSHOT BACKUP (Created once if absent)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_tbl TEXT;
  v_tables TEXT[] := ARRAY[
    'agencies',
    'agency_counters',
    'booking_invoices',
    'payment_vouchers',
    'parties',
    'clients',
    'vendors',
    'refunds',
    'refund_void_records',
    'expenses',
    'quotations',
    'vouchers',
    'invoices',
    'reminders',
    'queries',
    'transactions',
    'central_journal_entries',
    'invoice_allocations',
    'sub_users',
    'accounts',
    'opening_balances'
  ];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.schemata WHERE schema_name = 'backup_20261115'
  ) THEN
    CREATE SCHEMA backup_20261115;
    REVOKE ALL ON SCHEMA backup_20261115 FROM PUBLIC, anon, authenticated;

    FOREACH v_tbl IN ARRAY v_tables LOOP
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = v_tbl
      ) THEN
        EXECUTE format(
          'CREATE TABLE backup_20261115.%I AS TABLE public.%I',
          v_tbl, v_tbl
        );
      END IF;
    END LOOP;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. SCHEMA ADDITIONS, REDUNDANT INDEX CLEANUP & MISSING UNIQUE INDEXES
-- ------------------------------------------------------------------------------

-- Nullable sequence column for reminders (preserves all existing rows)
ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS reminder_no TEXT;

-- Remove redundant duplicate unique indexes while preserving canonical UNIQUE constraints
DROP INDEX IF EXISTS public.idx_booking_invoices_agency_invoice_no;
DROP INDEX IF EXISTS public.idx_payment_vouchers_agency_voucher_no;

-- Safely create missing per-agency unique indexes if no conflicting duplicates exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'quotations'
      AND indexname = 'idx_quotations_agency_quotation_number_unique'
  ) THEN
    IF NOT EXISTS (
      SELECT agency_id, quotation_number
      FROM public.quotations
      GROUP BY agency_id, quotation_number
      HAVING COUNT(*) > 1
    ) THEN
      CREATE UNIQUE INDEX idx_quotations_agency_quotation_number_unique
        ON public.quotations (agency_id, quotation_number);
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'vouchers'
      AND indexname = 'idx_vouchers_agency_voucher_number_unique'
  ) THEN
    IF NOT EXISTS (
      SELECT agency_id, voucher_number
      FROM public.vouchers
      GROUP BY agency_id, voucher_number
      HAVING COUNT(*) > 1
    ) THEN
      CREATE UNIQUE INDEX idx_vouchers_agency_voucher_number_unique
        ON public.vouchers (agency_id, voucher_number);
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'expenses'
      AND indexname = 'idx_expenses_agency_reference_no_unique'
  ) THEN
    IF NOT EXISTS (
      SELECT agency_id, reference_number
      FROM public.expenses
      WHERE reference_number IS NOT NULL AND TRIM(reference_number) <> ''
      GROUP BY agency_id, reference_number
      HAVING COUNT(*) > 1
    ) THEN
      CREATE UNIQUE INDEX idx_expenses_agency_reference_no_unique
        ON public.expenses (agency_id, reference_number)
        WHERE reference_number IS NOT NULL AND TRIM(reference_number) <> '';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'refund_void_records'
      AND indexname = 'idx_refund_void_records_agency_record_no_unique'
  ) THEN
    IF NOT EXISTS (
      SELECT agency_id, record_no
      FROM public.refund_void_records
      GROUP BY agency_id, record_no
      HAVING COUNT(*) > 1
    ) THEN
      CREATE UNIQUE INDEX idx_refund_void_records_agency_record_no_unique
        ON public.refund_void_records (agency_id, record_no);
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'reminders'
      AND indexname = 'idx_reminders_agency_reminder_no_unique'
  ) THEN
    IF NOT EXISTS (
      SELECT agency_id, reminder_no
      FROM public.reminders
      WHERE reminder_no IS NOT NULL AND TRIM(reminder_no) <> ''
      GROUP BY agency_id, reminder_no
      HAVING COUNT(*) > 1
    ) THEN
      CREATE UNIQUE INDEX idx_reminders_agency_reminder_no_unique
        ON public.reminders (agency_id, reminder_no)
        WHERE reminder_no IS NOT NULL AND TRIM(reminder_no) <> '';
    END IF;
  END IF;
END $$;

-- Expand allowed counter types in public.agency_counters
ALTER TABLE public.agency_counters
  ADD COLUMN IF NOT EXISTS last_value BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_val BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prefix TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.agency_counters
  DROP CONSTRAINT IF EXISTS agency_counters_counter_type_check;

ALTER TABLE public.agency_counters
  ADD CONSTRAINT agency_counters_counter_type_check CHECK (
    counter_type IN (
      'invoice',
      'client',
      'vendor',
      'party_client',
      'party_vendor',
      'voucher',
      'voucher_crv',
      'voucher_cpv',
      'voucher_uv',
      'voucher_hv',
      'voucher_tv',
      'receipt',
      'payment',
      'refund',
      'void',
      'transfer',
      'expense',
      'quotation',
      'query',
      'reminder',
      'sub_user'
    )
  );

-- ------------------------------------------------------------------------------
-- 3. MULTI-AGENCY RBAC & DEACTIVATED SUB-USER ENFORCEMENT
-- ------------------------------------------------------------------------------

-- Block deactivated sub-users even when profiles.agency_id is populated
CREATE OR REPLACE FUNCTION public.current_user_agency_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_agency_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  -- If user is a deactivated sub-user, immediately deny agency scope at RLS layer
  IF EXISTS (
    SELECT 1
    FROM public.sub_users su
    WHERE su.user_id = v_uid
      AND COALESCE(su.is_active, false) = false
  ) THEN
    RETURN NULL;
  END IF;

  SELECT agency_id INTO v_agency_id
  FROM public.profiles
  WHERE id = v_uid
  LIMIT 1;

  IF v_agency_id IS NULL THEN
    SELECT agency_id INTO v_agency_id
    FROM public.sub_users
    WHERE user_id = v_uid AND is_active = true
    LIMIT 1;
  END IF;

  RETURN v_agency_id;
END;
$$;

-- Security-definer check without policy recursion: is caller main agency owner / super_admin?
CREATE OR REPLACE FUNCTION public.is_agency_owner(_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.has_role(_user_id, 'super_admin'::public.app_role) THEN
    RETURN true;
  END IF;

  IF EXISTS (SELECT 1 FROM public.sub_users su WHERE su.user_id = _user_id) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = _user_id
      AND p.agency_id IS NOT NULL
  );
END;
$$;

-- Enforce module-level sub-user permissions server-side inside financial RPCs
CREATE OR REPLACE FUNCTION public.assert_module_permission(
  p_modules TEXT[],
  p_action TEXT DEFAULT 'write'
)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_sub RECORD;
  v_mod TEXT;
  v_mod_val JSONB;
BEGIN
  IF v_uid IS NULL
     OR public.is_privileged_db_context()
     OR public.has_role(v_uid, 'super_admin'::public.app_role) THEN
    RETURN;
  END IF;

  SELECT permissions, is_active
  INTO v_sub
  FROM public.sub_users
  WHERE user_id = v_uid
  LIMIT 1;

  -- Main agency owner (no sub_users row) always has full access to their agency
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF NOT COALESCE(v_sub.is_active, false) THEN
    RAISE EXCEPTION '403 Forbidden: Your sub-user account is inactive';
  END IF;

  IF v_sub.permissions IS NULL THEN
    RAISE EXCEPTION '403 Forbidden: You do not have permission for this action';
  END IF;

  FOREACH v_mod IN ARRAY p_modules LOOP
    v_mod_val := v_sub.permissions -> v_mod;
    IF v_mod_val IS NOT NULL THEN
      IF jsonb_typeof(v_mod_val) = 'boolean' AND (v_mod_val #>> '{}')::boolean = true THEN
        RETURN;
      END IF;
      IF jsonb_typeof(v_mod_val) = 'object'
         AND COALESCE((v_mod_val ->> p_action)::boolean, false) = true THEN
        RETURN;
      END IF;
    END IF;
  END LOOP;

  RAISE EXCEPTION '403 Forbidden: Missing % permission for requested module', p_action;
END;
$$;

-- Tighten sub_users RLS so staff sub-users cannot escalate or edit/delete sibling sub-users
DO $$
DECLARE
  v_pol RECORD;
BEGIN
  FOR v_pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sub_users'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.sub_users', v_pol.policyname);
  END LOOP;

  CREATE POLICY sub_users_strict_select ON public.sub_users
    FOR SELECT TO authenticated
    USING (
      user_id = auth.uid()
      OR (agency_id = public.current_user_agency_id() AND public.is_agency_owner(auth.uid()))
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    );

  CREATE POLICY sub_users_strict_insert ON public.sub_users
    FOR INSERT TO authenticated
    WITH CHECK (
      (agency_id = public.current_user_agency_id() AND public.is_agency_owner(auth.uid()))
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    );

  CREATE POLICY sub_users_strict_update ON public.sub_users
    FOR UPDATE TO authenticated
    USING (
      (agency_id = public.current_user_agency_id() AND public.is_agency_owner(auth.uid()))
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    )
    WITH CHECK (
      (agency_id = public.current_user_agency_id() AND public.is_agency_owner(auth.uid()))
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    );

  CREATE POLICY sub_users_strict_delete ON public.sub_users
    FOR DELETE TO authenticated
    USING (
      (agency_id = public.current_user_agency_id() AND public.is_agency_owner(auth.uid()))
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    );
END $$;

-- ------------------------------------------------------------------------------
-- 4. ROW-LOCKED ATOMIC COUNTER ENGINE + SEEDING + MANUAL UNIQUENESS CHECK
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.initialize_agency_counters()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.agency_counters (agency_id, counter_type, last_value, current_val, prefix, updated_at)
  VALUES
    (NEW.id, 'invoice', 0, 0, 'INV-', now()),
    (NEW.id, 'client', 0, 0, 'C-', now()),
    (NEW.id, 'vendor', 0, 0, 'V-', now()),
    (NEW.id, 'voucher', 0, 0, 'PV-', now()),
    (NEW.id, 'voucher_crv', 0, 0, 'CRV-', now()),
    (NEW.id, 'voucher_cpv', 0, 0, 'CPV-', now()),
    (NEW.id, 'voucher_uv', 0, 0, 'UV-', now()),
    (NEW.id, 'voucher_hv', 0, 0, 'HV-', now()),
    (NEW.id, 'voucher_tv', 0, 0, 'TV-', now()),
    (NEW.id, 'refund', 0, 0, 'RF-', now()),
    (NEW.id, 'void', 0, 0, 'VOID-', now()),
    (NEW.id, 'expense', 0, 0, 'EXP-', now()),
    (NEW.id, 'quotation', 0, 0, 'QT-', now()),
    (NEW.id, 'query', 0, 0, 'QRY-', now()),
    (NEW.id, 'reminder', 0, 0, 'REM-', now()),
    (NEW.id, 'transfer', 0, 0, 'TRF-', now()),
    (NEW.id, 'sub_user', 0, 0, 'SUB-', now())
  ON CONFLICT (agency_id, counter_type) DO NOTHING;

  RETURN NEW;
END;
$$;

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
  v_caller_agency UUID := public.current_user_agency_id();
  v_agency_code TEXT;
  v_digits INT;
  v_num BIGINT := COALESCE(p_val, 1);
BEGIN
  IF p_agency_id IS NOT NULL
     AND p_agency_id IS DISTINCT FROM v_caller_agency
     AND NOT public.is_privileged_db_context()
     AND NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION '403 Forbidden: Cross-agency sequence format denied';
  END IF;

  SELECT agency_code INTO v_agency_code
  FROM public.agencies
  WHERE id = COALESCE(p_agency_id, v_caller_agency);

  IF v_agency_code IS NULL OR TRIM(v_agency_code) = '' THEN
    v_agency_code := 'A00001';
  END IF;

  IF p_counter_type = 'invoice' THEN
    v_digits := GREATEST(8, LENGTH(v_num::TEXT));
    RETURN 'INV-' || v_agency_code || '-' || LPAD(v_num::TEXT, v_digits, '0');
  ELSIF p_counter_type IN ('client', 'party_client') THEN
    v_digits := GREATEST(6, LENGTH(v_num::TEXT));
    RETURN 'C-' || LPAD(v_num::TEXT, v_digits, '0');
  ELSIF p_counter_type IN ('vendor', 'party_vendor') THEN
    v_digits := GREATEST(6, LENGTH(v_num::TEXT));
    RETURN 'V-' || LPAD(v_num::TEXT, v_digits, '0');
  ELSIF p_counter_type = 'voucher' THEN
    v_digits := GREATEST(8, LENGTH(v_num::TEXT));
    RETURN 'PV-' || LPAD(v_num::TEXT, v_digits, '0');
  ELSIF p_counter_type = 'voucher_crv' THEN
    v_digits := GREATEST(8, LENGTH(v_num::TEXT));
    RETURN 'CRV-' || LPAD(v_num::TEXT, v_digits, '0');
  ELSIF p_counter_type = 'voucher_cpv' THEN
    v_digits := GREATEST(8, LENGTH(v_num::TEXT));
    RETURN 'CPV-' || LPAD(v_num::TEXT, v_digits, '0');
  ELSIF p_counter_type = 'voucher_uv' THEN
    v_digits := GREATEST(4, LENGTH(v_num::TEXT));
    RETURN 'UV-' || LPAD(v_num::TEXT, v_digits, '0');
  ELSIF p_counter_type = 'voucher_hv' THEN
    v_digits := GREATEST(4, LENGTH(v_num::TEXT));
    RETURN 'HV-' || LPAD(v_num::TEXT, v_digits, '0');
  ELSIF p_counter_type = 'voucher_tv' THEN
    v_digits := GREATEST(4, LENGTH(v_num::TEXT));
    RETURN 'TV-' || LPAD(v_num::TEXT, v_digits, '0');
  ELSIF p_counter_type = 'receipt' THEN
    v_digits := GREATEST(8, LENGTH(v_num::TEXT));
    RETURN 'RCP-' || LPAD(v_num::TEXT, v_digits, '0');
  ELSIF p_counter_type = 'payment' THEN
    v_digits := GREATEST(8, LENGTH(v_num::TEXT));
    RETURN 'PAY-' || LPAD(v_num::TEXT, v_digits, '0');
  ELSIF p_counter_type = 'refund' THEN
    v_digits := GREATEST(8, LENGTH(v_num::TEXT));
    RETURN 'RF-' || LPAD(v_num::TEXT, v_digits, '0');
  ELSIF p_counter_type = 'void' THEN
    v_digits := GREATEST(8, LENGTH(v_num::TEXT));
    RETURN 'VOID-' || LPAD(v_num::TEXT, v_digits, '0');
  ELSIF p_counter_type = 'expense' THEN
    v_digits := GREATEST(8, LENGTH(v_num::TEXT));
    RETURN 'EXP-' || LPAD(v_num::TEXT, v_digits, '0');
  ELSIF p_counter_type = 'quotation' THEN
    v_digits := GREATEST(8, LENGTH(v_num::TEXT));
    RETURN 'QT-' || LPAD(v_num::TEXT, v_digits, '0');
  ELSIF p_counter_type = 'query' THEN
    v_digits := GREATEST(6, LENGTH(v_num::TEXT));
    RETURN 'QRY-' || LPAD(v_num::TEXT, v_digits, '0');
  ELSIF p_counter_type = 'reminder' THEN
    v_digits := GREATEST(6, LENGTH(v_num::TEXT));
    RETURN 'REM-' || LPAD(v_num::TEXT, v_digits, '0');
  ELSIF p_counter_type = 'transfer' THEN
    v_digits := GREATEST(8, LENGTH(v_num::TEXT));
    RETURN 'TRF-' || LPAD(v_num::TEXT, v_digits, '0');
  ELSIF p_counter_type = 'sub_user' THEN
    v_digits := GREATEST(4, LENGTH(v_num::TEXT));
    RETURN 'SUB-' || v_agency_code || '-' || LPAD(v_num::TEXT, v_digits, '0');
  ELSE
    v_digits := GREATEST(6, LENGTH(v_num::TEXT));
    RETURN UPPER(p_counter_type) || '-' || LPAD(v_num::TEXT, v_digits, '0');
  END IF;
END;
$$;

-- Atomic row-locked counter increment (SELECT ... FOR UPDATE)
CREATE OR REPLACE FUNCTION public.next_number(
  p_agency_id UUID,
  p_counter_type TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_agency UUID := public.current_user_agency_id();
  v_effective_agency UUID;
  v_curr_val BIGINT;
  v_next_val BIGINT;
  v_pfx TEXT;
BEGIN
  IF p_agency_id IS NOT NULL
     AND p_agency_id IS DISTINCT FROM v_caller_agency
     AND NOT public.is_privileged_db_context()
     AND NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION '403 Forbidden: Cross-agency sequence access denied';
  END IF;

  v_effective_agency := COALESCE(p_agency_id, v_caller_agency);
  IF v_effective_agency IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Active agency context required';
  END IF;

  v_pfx := CASE p_counter_type
    WHEN 'invoice' THEN 'INV-'
    WHEN 'client' THEN 'C-'
    WHEN 'party_client' THEN 'C-'
    WHEN 'vendor' THEN 'V-'
    WHEN 'party_vendor' THEN 'V-'
    WHEN 'voucher' THEN 'PV-'
    WHEN 'voucher_crv' THEN 'CRV-'
    WHEN 'voucher_cpv' THEN 'CPV-'
    WHEN 'voucher_uv' THEN 'UV-'
    WHEN 'voucher_hv' THEN 'HV-'
    WHEN 'voucher_tv' THEN 'TV-'
    WHEN 'receipt' THEN 'RCP-'
    WHEN 'payment' THEN 'PAY-'
    WHEN 'refund' THEN 'RF-'
    WHEN 'void' THEN 'VOID-'
    WHEN 'expense' THEN 'EXP-'
    WHEN 'quotation' THEN 'QT-'
    WHEN 'query' THEN 'QRY-'
    WHEN 'reminder' THEN 'REM-'
    WHEN 'transfer' THEN 'TRF-'
    WHEN 'sub_user' THEN 'SUB-'
    ELSE UPPER(LEFT(COALESCE(p_counter_type, 'NUM'), 4)) || '-'
  END;

  -- Ensure counter row exists before row lock (blocks cleanly if concurrent txn initializes same row)
  INSERT INTO public.agency_counters (agency_id, counter_type, last_value, current_val, prefix, updated_at)
  VALUES (v_effective_agency, p_counter_type, 0, 0, v_pfx, now())
  ON CONFLICT (agency_id, counter_type) DO NOTHING;

  -- Lock counter row exclusively for the remainder of this transaction
  SELECT GREATEST(COALESCE(last_value, 0), COALESCE(current_val, 0))
  INTO v_curr_val
  FROM public.agency_counters
  WHERE agency_id = v_effective_agency
    AND counter_type = p_counter_type
  FOR UPDATE;

  v_next_val := COALESCE(v_curr_val, 0) + 1;

  UPDATE public.agency_counters
  SET last_value = v_next_val,
      current_val = v_next_val,
      prefix = CASE WHEN NULLIF(prefix, '') IS NULL THEN v_pfx ELSE prefix END,
      updated_at = now()
  WHERE agency_id = v_effective_agency
    AND counter_type = p_counter_type;

  RETURN v_next_val;
END;
$$;

CREATE OR REPLACE FUNCTION public.next_formatted_number(
  p_agency_id UUID,
  p_counter_type TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective_agency UUID := COALESCE(p_agency_id, public.current_user_agency_id());
  v_next_val BIGINT;
BEGIN
  v_next_val := public.next_number(v_effective_agency, p_counter_type);
  RETURN public.format_agency_number(v_effective_agency, p_counter_type, v_next_val);
END;
$$;

-- Internal collision checker per agency + counter_type
CREATE OR REPLACE FUNCTION public.is_document_number_taken(
  p_agency_id UUID,
  p_doc_type TEXT,
  p_number TEXT,
  p_exclude_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num TEXT := TRIM(COALESCE(p_number, ''));
  v_type TEXT := LOWER(TRIM(COALESCE(p_doc_type, '')));
BEGIN
  IF v_num = '' OR p_agency_id IS NULL THEN
    RETURN false;
  END IF;

  IF v_type IN ('invoice', 'booking_invoice') THEN
    RETURN EXISTS (
      SELECT 1 FROM public.booking_invoices
      WHERE agency_id = p_agency_id AND invoice_no = v_num
        AND (p_exclude_id IS NULL OR id <> p_exclude_id)
    ) OR EXISTS (
      SELECT 1 FROM public.invoices
      WHERE agency_id = p_agency_id AND invoice_number = v_num
        AND (p_exclude_id IS NULL OR id <> p_exclude_id)
    );
  ELSIF v_type IN ('voucher', 'voucher_crv', 'voucher_cpv', 'payment_voucher') THEN
    RETURN EXISTS (
      SELECT 1 FROM public.payment_vouchers
      WHERE agency_id = p_agency_id AND voucher_no = v_num
        AND (p_exclude_id IS NULL OR id <> p_exclude_id)
    );
  ELSIF v_type IN ('voucher_uv', 'voucher_hv', 'voucher_tv', 'travel_voucher') THEN
    RETURN EXISTS (
      SELECT 1 FROM public.vouchers
      WHERE agency_id = p_agency_id AND voucher_number = v_num
        AND (p_exclude_id IS NULL OR id <> p_exclude_id)
    );
  ELSIF v_type IN ('client', 'party_client') THEN
    RETURN EXISTS (
      SELECT 1 FROM public.parties
      WHERE agency_id = p_agency_id AND code = v_num
        AND (p_exclude_id IS NULL OR id <> p_exclude_id)
    ) OR EXISTS (
      SELECT 1 FROM public.clients
      WHERE agency_id = p_agency_id AND client_code = v_num
        AND (p_exclude_id IS NULL OR id <> p_exclude_id)
    );
  ELSIF v_type IN ('vendor', 'party_vendor') THEN
    RETURN EXISTS (
      SELECT 1 FROM public.parties
      WHERE agency_id = p_agency_id AND code = v_num
        AND (p_exclude_id IS NULL OR id <> p_exclude_id)
    ) OR EXISTS (
      SELECT 1 FROM public.vendors
      WHERE agency_id = p_agency_id AND vendor_code = v_num
        AND (p_exclude_id IS NULL OR id <> p_exclude_id)
    );
  ELSIF v_type IN ('refund', 'void') THEN
    RETURN EXISTS (
      SELECT 1 FROM public.refunds
      WHERE agency_id = p_agency_id AND refund_no = v_num
        AND (p_exclude_id IS NULL OR id <> p_exclude_id)
    ) OR EXISTS (
      SELECT 1 FROM public.refund_void_records
      WHERE agency_id = p_agency_id AND record_no = v_num
        AND (p_exclude_id IS NULL OR id <> p_exclude_id)
    );
  ELSIF v_type = 'expense' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.expenses
      WHERE agency_id = p_agency_id AND reference_number = v_num
        AND (p_exclude_id IS NULL OR id <> p_exclude_id)
    );
  ELSIF v_type = 'quotation' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.quotations
      WHERE agency_id = p_agency_id AND quotation_number = v_num
        AND (p_exclude_id IS NULL OR id <> p_exclude_id)
    );
  ELSIF v_type = 'reminder' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.reminders
      WHERE agency_id = p_agency_id AND reminder_no = v_num
        AND (p_exclude_id IS NULL OR id <> p_exclude_id)
    );
  ELSIF v_type = 'transfer' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.transactions
      WHERE agency_id = p_agency_id AND type = 'transfer' AND reference_no = v_num
        AND (p_exclude_id IS NULL OR id <> p_exclude_id)
    );
  ELSIF v_type = 'sub_user' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.sub_users
      WHERE sub_id_code = v_num
        AND (p_exclude_id IS NULL OR id <> p_exclude_id)
    );
  END IF;

  RETURN false;
END;
$$;

-- Advances counter atomically and skips any future number already occupied via Manual Override
CREATE OR REPLACE FUNCTION public.next_unused_agency_number(
  p_agency_id UUID,
  p_counter_type TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective_agency UUID := COALESCE(p_agency_id, public.current_user_agency_id());
  v_candidate TEXT;
  v_try INT := 0;
BEGIN
  LOOP
    v_try := v_try + 1;
    v_candidate := public.next_formatted_number(v_effective_agency, p_counter_type);

    EXIT WHEN NOT public.is_document_number_taken(v_effective_agency, p_counter_type, v_candidate, NULL)
           OR v_try >= 100;
  END LOOP;

  RETURN v_candidate;
END;
$$;

-- Read-only preview (does not advance counter; advances estimate past manually taken slots)
CREATE OR REPLACE FUNCTION public.preview_next_number(p_counter_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.current_user_agency_id();
  v_last BIGINT := 0;
  v_candidate TEXT;
  v_offset INT := 0;
BEGIN
  IF v_agency_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT GREATEST(COALESCE(last_value, 0), COALESCE(current_val, 0))
  INTO v_last
  FROM public.agency_counters
  WHERE agency_id = v_agency_id AND counter_type = p_counter_type;

  FOR v_offset IN 1..50 LOOP
    v_candidate := public.format_agency_number(v_agency_id, p_counter_type, COALESCE(v_last, 0) + v_offset);
    IF NOT public.is_document_number_taken(v_agency_id, p_counter_type, v_candidate, NULL) THEN
      RETURN v_candidate;
    END IF;
  END LOOP;

  RETURN public.format_agency_number(v_agency_id, p_counter_type, COALESCE(v_last, 0) + 1);
END;
$$;

-- Public frontend check for Manual Override mode
CREATE OR REPLACE FUNCTION public.check_document_number_available(
  p_doc_type TEXT,
  p_number TEXT,
  p_exclude_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_clean TEXT := TRIM(COALESCE(p_number, ''));
BEGIN
  IF v_clean = '' OR v_clean ~* '^(__AUTO__|preview|auto-generated)$' THEN
    RETURN false;
  END IF;

  RETURN NOT public.is_document_number_taken(v_agency_id, p_doc_type, v_clean, p_exclude_id);
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. SEED & RECONCILE ALL AGENCY_COUNTERS FROM EXISTING LIVE DATA (ALL AGENCIES)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  a RECORD;
  v_inv BIGINT;
  v_clt BIGINT;
  v_vnd BIGINT;
  v_pv BIGINT;
  v_crv BIGINT;
  v_cpv BIGINT;
  v_uv BIGINT;
  v_hv BIGINT;
  v_tv BIGINT;
  v_rf BIGINT;
  v_void BIGINT;
  v_exp BIGINT;
  v_qt BIGINT;
  v_rem BIGINT;
  v_trf BIGINT;
  v_sub BIGINT;
BEGIN
  FOR a IN SELECT id FROM public.agencies LOOP
    SELECT GREATEST(
      COALESCE((
        SELECT MAX((regexp_match(invoice_no, '([0-9]{1,9})$'))[1]::BIGINT)
        FROM public.booking_invoices
        WHERE agency_id = a.id
          AND invoice_no ~ '^INV-(A[0-9]+-)?[0-9]{1,9}$'
      ), 0),
      COALESCE((
        SELECT MAX((regexp_match(invoice_number, '([0-9]{1,9})$'))[1]::BIGINT)
        FROM public.invoices
        WHERE agency_id = a.id
          AND invoice_number ~ '^INV-([A-Z0-9]+-)?[0-9]{1,9}$'
      ), 0)
    ) INTO v_inv;

    SELECT GREATEST(
      COALESCE((
        SELECT MAX((regexp_match(code, '([0-9]{1,9})$'))[1]::BIGINT)
        FROM public.parties
        WHERE agency_id = a.id
          AND code ~ '^(C|CLT)-[0-9]{1,9}$'
      ), 0),
      COALESCE((
        SELECT MAX((regexp_match(client_code, '([0-9]{1,9})$'))[1]::BIGINT)
        FROM public.clients
        WHERE agency_id = a.id
          AND client_code ~ '^(C|CLT)-[0-9]{1,9}$'
      ), 0)
    ) INTO v_clt;

    SELECT GREATEST(
      COALESCE((
        SELECT MAX((regexp_match(code, '([0-9]{1,9})$'))[1]::BIGINT)
        FROM public.parties
        WHERE agency_id = a.id
          AND code ~ '^(V|VND)-[0-9]{1,9}$'
      ), 0),
      COALESCE((
        SELECT MAX((regexp_match(vendor_code, '([0-9]{1,9})$'))[1]::BIGINT)
        FROM public.vendors
        WHERE agency_id = a.id
          AND vendor_code ~ '^(V|VND)-[0-9]{1,9}$'
      ), 0)
    ) INTO v_vnd;

    SELECT COALESCE(MAX((regexp_match(voucher_no, '([0-9]{1,9})$'))[1]::BIGINT), 0)
    INTO v_pv
    FROM public.payment_vouchers
    WHERE agency_id = a.id AND voucher_no ~ '^PV-[0-9]{1,9}$';

    SELECT COALESCE(MAX((regexp_match(voucher_no, '([0-9]{1,9})$'))[1]::BIGINT), 0)
    INTO v_crv
    FROM public.payment_vouchers
    WHERE agency_id = a.id AND voucher_no ~ '^CRV-[0-9]{1,9}$';

    SELECT COALESCE(MAX((regexp_match(voucher_no, '([0-9]{1,9})$'))[1]::BIGINT), 0)
    INTO v_cpv
    FROM public.payment_vouchers
    WHERE agency_id = a.id AND voucher_no ~ '^CPV-[0-9]{1,9}$';

    SELECT COALESCE(MAX((regexp_match(voucher_number, '([0-9]{1,9})$'))[1]::BIGINT), 0)
    INTO v_uv
    FROM public.vouchers
    WHERE agency_id = a.id AND voucher_number ~ '^UV-[0-9]{1,9}$';

    SELECT COALESCE(MAX((regexp_match(voucher_number, '([0-9]{1,9})$'))[1]::BIGINT), 0)
    INTO v_hv
    FROM public.vouchers
    WHERE agency_id = a.id AND voucher_number ~ '^HV-[0-9]{1,9}$';

    SELECT COALESCE(MAX((regexp_match(voucher_number, '([0-9]{1,9})$'))[1]::BIGINT), 0)
    INTO v_tv
    FROM public.vouchers
    WHERE agency_id = a.id AND voucher_number ~ '^TV-[0-9]{1,9}$';

    SELECT GREATEST(
      COALESCE((
        SELECT MAX((regexp_match(refund_no, '([0-9]{1,9})$'))[1]::BIGINT)
        FROM public.refunds
        WHERE agency_id = a.id AND refund_no ~ '^(RF|REF)-[0-9]{1,9}$'
      ), 0),
      COALESCE((
        SELECT MAX((regexp_match(record_no, '([0-9]{1,9})$'))[1]::BIGINT)
        FROM public.refund_void_records
        WHERE agency_id = a.id AND record_no ~ '^(RF|REF)-[0-9]{1,9}$'
      ), 0)
    ) INTO v_rf;

    SELECT GREATEST(
      COALESCE((
        SELECT MAX((regexp_match(refund_no, '([0-9]{1,9})$'))[1]::BIGINT)
        FROM public.refunds
        WHERE agency_id = a.id AND refund_no ~ '^VOID-[0-9]{1,9}$'
      ), 0),
      COALESCE((
        SELECT MAX((regexp_match(record_no, '([0-9]{1,9})$'))[1]::BIGINT)
        FROM public.refund_void_records
        WHERE agency_id = a.id AND record_no ~ '^VOID-[0-9]{1,9}$'
      ), 0)
    ) INTO v_void;

    SELECT COALESCE(MAX((regexp_match(reference_number, '([0-9]{1,9})$'))[1]::BIGINT), 0)
    INTO v_exp
    FROM public.expenses
    WHERE agency_id = a.id AND reference_number ~ '^EXP-[0-9]{1,9}$';

    SELECT COALESCE(MAX((regexp_match(quotation_number, '([0-9]{1,9})$'))[1]::BIGINT), 0)
    INTO v_qt
    FROM public.quotations
    WHERE agency_id = a.id AND quotation_number ~ '^(QT|QUO)-[0-9]{1,9}$';

    SELECT COALESCE(MAX((regexp_match(reminder_no, '([0-9]{1,9})$'))[1]::BIGINT), 0)
    INTO v_rem
    FROM public.reminders
    WHERE agency_id = a.id AND reminder_no ~ '^REM-[0-9]{1,9}$';

    SELECT COALESCE(MAX((regexp_match(reference_no, '([0-9]{1,9})$'))[1]::BIGINT), 0)
    INTO v_trf
    FROM public.transactions
    WHERE agency_id = a.id AND type = 'transfer' AND reference_no ~ '^TRF-[0-9]{1,9}$';

    SELECT COALESCE(MAX((regexp_match(sub_id_code, '([0-9]{1,9})$'))[1]::BIGINT), 0)
    INTO v_sub
    FROM public.sub_users
    WHERE agency_id = a.id AND sub_id_code ~ '^SUB-[A-Z0-9]+-[0-9]{1,9}$';

    INSERT INTO public.agency_counters (agency_id, counter_type, last_value, current_val, prefix, updated_at)
    VALUES
      (a.id, 'invoice', v_inv, v_inv, 'INV-', now()),
      (a.id, 'client', v_clt, v_clt, 'C-', now()),
      (a.id, 'vendor', v_vnd, v_vnd, 'V-', now()),
      (a.id, 'voucher', v_pv, v_pv, 'PV-', now()),
      (a.id, 'voucher_crv', v_crv, v_crv, 'CRV-', now()),
      (a.id, 'voucher_cpv', v_cpv, v_cpv, 'CPV-', now()),
      (a.id, 'voucher_uv', v_uv, v_uv, 'UV-', now()),
      (a.id, 'voucher_hv', v_hv, v_hv, 'HV-', now()),
      (a.id, 'voucher_tv', v_tv, v_tv, 'TV-', now()),
      (a.id, 'refund', v_rf, v_rf, 'RF-', now()),
      (a.id, 'void', v_void, v_void, 'VOID-', now()),
      (a.id, 'expense', v_exp, v_exp, 'EXP-', now()),
      (a.id, 'quotation', v_qt, v_qt, 'QT-', now()),
      (a.id, 'query', 0, 0, 'QRY-', now()),
      (a.id, 'reminder', v_rem, v_rem, 'REM-', now()),
      (a.id, 'transfer', v_trf, v_trf, 'TRF-', now()),
      (a.id, 'sub_user', v_sub, v_sub, 'SUB-', now())
    ON CONFLICT (agency_id, counter_type) DO UPDATE
      SET last_value = GREATEST(COALESCE(public.agency_counters.last_value, 0), COALESCE(public.agency_counters.current_val, 0), EXCLUDED.last_value),
          current_val = GREATEST(COALESCE(public.agency_counters.last_value, 0), COALESCE(public.agency_counters.current_val, 0), EXCLUDED.current_val),
          prefix = CASE WHEN NULLIF(public.agency_counters.prefix, '') IS NULL THEN EXCLUDED.prefix ELSE public.agency_counters.prefix END,
          updated_at = now();
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 6. BEFORE INSERT AUTO-NUMBERING TRIGGERS ON ALL AUTO-NUMBERED TABLES
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assign_booking_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.invoice_no IS NULL
     OR TRIM(NEW.invoice_no) = ''
     OR NEW.invoice_no ~* '^(preview|__auto__|auto-generated)'
     OR NEW.invoice_no ~ '^INV-[0-9]{4,7}$' THEN
    NEW.invoice_no := public.next_unused_agency_number(NEW.agency_id, 'invoice');
  ELSE
    NEW.invoice_no := TRIM(NEW.invoice_no);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_payment_voucher_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctype TEXT;
BEGIN
  IF NEW.voucher_no IS NULL
     OR TRIM(NEW.voucher_no) = ''
     OR NEW.voucher_no ~* '^(preview|__auto__|auto-generated)'
     OR NEW.voucher_no ~ '^(PV|CRV|CPV)-[0-9]{4,7}$' THEN
    v_ctype := CASE
      WHEN LOWER(COALESCE(NEW.direction, '')) = 'received' THEN 'voucher_crv'
      WHEN LOWER(COALESCE(NEW.direction, '')) = 'paid' THEN 'voucher_cpv'
      ELSE 'voucher'
    END;
    NEW.voucher_no := public.next_unused_agency_number(NEW.agency_id, v_ctype);
  ELSE
    NEW.voucher_no := TRIM(NEW.voucher_no);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_party_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.code IS NULL
     OR TRIM(NEW.code) = ''
     OR NEW.code ~* '^(preview|__auto__|auto-generated)'
     OR NEW.code ~ '^(CLT|VND|PRT)-[0-9]{4,6}$' THEN
    IF LOWER(COALESCE(NEW.type, 'client')) = 'vendor' THEN
      NEW.code := public.next_unused_agency_number(NEW.agency_id, 'vendor');
    ELSE
      NEW.code := public.next_unused_agency_number(NEW.agency_id, 'client');
    END IF;
  ELSE
    NEW.code := TRIM(NEW.code);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_clients_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.client_code IS NULL
     OR TRIM(NEW.client_code) = ''
     OR NEW.client_code ~* '^(preview|__auto__|auto-generated)' THEN
    NEW.client_code := public.next_unused_agency_number(NEW.agency_id, 'client');
  ELSE
    NEW.client_code := TRIM(NEW.client_code);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_vendors_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.vendor_code IS NULL
     OR TRIM(NEW.vendor_code) = ''
     OR NEW.vendor_code ~* '^(preview|__auto__|auto-generated)' THEN
    NEW.vendor_code := public.next_unused_agency_number(NEW.agency_id, 'vendor');
  ELSE
    NEW.vendor_code := TRIM(NEW.vendor_code);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_refunds_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctype TEXT;
BEGIN
  IF NEW.refund_no IS NULL
     OR TRIM(NEW.refund_no) = ''
     OR NEW.refund_no ~* '^(preview|__auto__|auto-generated)' THEN
    v_ctype := CASE WHEN LOWER(COALESCE(NEW.refund_type, '')) = 'void' THEN 'void' ELSE 'refund' END;
    NEW.refund_no := public.next_unused_agency_number(NEW.agency_id, v_ctype);
  ELSE
    NEW.refund_no := TRIM(NEW.refund_no);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_refund_void_record_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctype TEXT;
BEGIN
  IF NEW.record_no IS NULL
     OR TRIM(NEW.record_no) = ''
     OR NEW.record_no ~* '^(preview|__auto__|auto-generated)' THEN
    v_ctype := CASE WHEN LOWER(COALESCE(NEW.action_type, '')) LIKE '%void%' THEN 'void' ELSE 'refund' END;
    NEW.record_no := public.next_unused_agency_number(NEW.agency_id, v_ctype);
  ELSE
    NEW.record_no := TRIM(NEW.record_no);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_refund_void_record_number ON public.refund_void_records;
CREATE TRIGGER trg_assign_refund_void_record_number
  BEFORE INSERT ON public.refund_void_records
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_refund_void_record_number();

CREATE OR REPLACE FUNCTION public.assign_expense_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.reference_number IS NULL
     OR TRIM(NEW.reference_number) = ''
     OR NEW.reference_number ~* '^(preview|__auto__|auto-generated)' THEN
    NEW.reference_number := public.next_unused_agency_number(NEW.agency_id, 'expense');
  ELSE
    NEW.reference_number := TRIM(NEW.reference_number);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_expense_number ON public.expenses;
CREATE TRIGGER trg_assign_expense_number
  BEFORE INSERT ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_expense_number();

CREATE OR REPLACE FUNCTION public.assign_quotation_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.quotation_number IS NULL
     OR TRIM(NEW.quotation_number) = ''
     OR NEW.quotation_number ~* '^(preview|__auto__|auto-generated)' THEN
    NEW.quotation_number := public.next_unused_agency_number(NEW.agency_id, 'quotation');
  ELSE
    NEW.quotation_number := TRIM(NEW.quotation_number);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_quotation_number ON public.quotations;
CREATE TRIGGER trg_assign_quotation_number
  BEFORE INSERT ON public.quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_quotation_number();

CREATE OR REPLACE FUNCTION public.assign_legacy_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.invoice_number IS NULL
     OR TRIM(NEW.invoice_number) = ''
     OR NEW.invoice_number ~* '^(preview|__auto__|auto-generated)' THEN
    NEW.invoice_number := public.next_unused_agency_number(NEW.agency_id, 'invoice');
  ELSE
    NEW.invoice_number := TRIM(NEW.invoice_number);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_legacy_invoice_number ON public.invoices;
CREATE TRIGGER trg_assign_legacy_invoice_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_legacy_invoice_number();

CREATE OR REPLACE FUNCTION public.assign_voucher_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctype TEXT;
BEGIN
  IF NEW.voucher_number IS NULL
     OR TRIM(NEW.voucher_number) = ''
     OR NEW.voucher_number ~* '^(preview|__auto__|auto-generated)' THEN
    v_ctype := CASE NEW.voucher_type
      WHEN 'Umrah' THEN 'voucher_uv'
      WHEN 'Hotel' THEN 'voucher_hv'
      ELSE 'voucher_tv'
    END;
    NEW.voucher_number := public.next_unused_agency_number(NEW.agency_id, v_ctype);
  ELSE
    NEW.voucher_number := TRIM(NEW.voucher_number);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_voucher_number ON public.vouchers;
CREATE TRIGGER trg_assign_voucher_number
  BEFORE INSERT ON public.vouchers
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_voucher_number();

CREATE OR REPLACE FUNCTION public.assign_reminder_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.reminder_no IS NULL
     OR TRIM(NEW.reminder_no) = ''
     OR NEW.reminder_no ~* '^(preview|__auto__|auto-generated)' THEN
    NEW.reminder_no := public.next_unused_agency_number(NEW.agency_id, 'reminder');
  ELSE
    NEW.reminder_no := TRIM(NEW.reminder_no);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_reminder_number ON public.reminders;
CREATE TRIGGER trg_assign_reminder_number
  BEFORE INSERT ON public.reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_reminder_number();

CREATE OR REPLACE FUNCTION public.assign_sub_user_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sub_id_code IS NULL
     OR TRIM(NEW.sub_id_code) = ''
     OR NEW.sub_id_code ~* '^(preview|__auto__|auto-generated)' THEN
    NEW.sub_id_code := public.next_unused_agency_number(NEW.agency_id, 'sub_user');
  ELSE
    NEW.sub_id_code := TRIM(NEW.sub_id_code);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_sub_user_code ON public.sub_users;
CREATE TRIGGER trg_assign_sub_user_code
  BEFORE INSERT ON public.sub_users
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_sub_user_code();

-- ------------------------------------------------------------------------------
-- 7. HARDEN FINANCIAL RPCs (ATOMIC NUMBERING + OPTIONAL MANUAL OVERRIDE + RBAC)
-- ------------------------------------------------------------------------------

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.proname IN (
        'save_booking_invoice_atomic',
        'save_booking_invoice',
        'save_payment_voucher_atomic',
        'save_payment_voucher',
        'record_refund',
        'record_expense',
        'record_payment',
        'record_transfer'
      )
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s)', r.proname, r.args);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.save_booking_invoice_atomic(
  p_invoice_no TEXT DEFAULT NULL,
  p_service TEXT DEFAULT 'Ticket',
  p_party_id UUID DEFAULT NULL,
  p_vendor_id UUID DEFAULT NULL,
  p_client_amount NUMERIC DEFAULT 0,
  p_vendor_payable NUMERIC DEFAULT 0,
  p_amount_paid NUMERIC DEFAULT 0,
  p_payment_mode TEXT DEFAULT 'cash',
  p_account_id UUID DEFAULT NULL,
  p_invoice_date DATE DEFAULT CURRENT_DATE,
  p_due_date DATE DEFAULT NULL,
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
  p_notes TEXT DEFAULT NULL,
  p_is_manual BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_invoice_id UUID;
  v_group_id UUID := gen_random_uuid();
  v_client_amt NUMERIC := COALESCE(p_client_amount, 0);
  v_vendor_amt NUMERIC := COALESCE(p_vendor_payable, 0);
  v_paid_amt NUMERIC := GREATEST(0, COALESCE(p_amount_paid, 0));
  v_profit NUMERIC;
  v_inv_no TEXT := NULLIF(TRIM(COALESCE(p_invoice_no, '')), '');
  v_acc_id UUID;
  v_voucher_id UUID;
  v_v_no TEXT;
  v_party_name TEXT := 'Client';
  v_vendor_name TEXT := 'Vendor';
  v_status TEXT := 'unpaid';
  v_inv_date DATE := COALESCE(p_invoice_date, public.karachi_today());
  v_due_date DATE := COALESCE(p_due_date, NULLIF(p_more_details->>'due_date', '')::date, v_inv_date);
BEGIN
  PERFORM public.assert_module_permission(ARRAY['bookings', 'invoices'], 'write');

  IF v_client_amt < 0 OR v_vendor_amt < 0 OR v_paid_amt < 0 THEN
    RAISE EXCEPTION 'Amounts cannot be negative';
  END IF;

  IF v_paid_amt > v_client_amt THEN
    RAISE EXCEPTION 'Amount paid cannot exceed total amount';
  END IF;

  IF p_party_id IS NOT NULL THEN
    SELECT name INTO v_party_name
    FROM public.parties
    WHERE id = p_party_id AND agency_id = v_agency_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION '403 Forbidden: Selected client does not belong to your agency';
    END IF;
  END IF;

  IF p_vendor_id IS NOT NULL THEN
    SELECT name INTO v_vendor_name
    FROM public.parties
    WHERE id = p_vendor_id AND agency_id = v_agency_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION '403 Forbidden: Selected vendor does not belong to your agency';
    END IF;
  END IF;

  IF COALESCE(p_is_manual, false) THEN
    IF v_inv_no IS NULL OR v_inv_no ~* '^(__AUTO__|preview|auto-generated)$' THEN
      RAISE EXCEPTION 'Please enter a valid custom invoice number';
    END IF;
  ELSE
    v_inv_no := public.next_unused_agency_number(v_agency_id, 'invoice');
  END IF;

  v_profit := v_client_amt - v_vendor_amt;

  IF v_paid_amt >= v_client_amt AND v_client_amt > 0 THEN
    v_status := 'paid';
  ELSIF v_paid_amt > 0 THEN
    v_status := 'partial';
  ELSE
    v_status := 'unpaid';
  END IF;

  INSERT INTO public.booking_invoices (
    agency_id, invoice_no, invoice_date, due_date, service, party_id, vendor_id,
    client_amount, vendor_payable, profit, paid_amount, payment_status,
    pnr, ticket_no, passport_no, passengers, currency, sar_rate, sar_amount,
    commission, wht, more_details, notes, is_void, created_by
  )
  VALUES (
    v_agency_id, v_inv_no, v_inv_date, v_due_date, COALESCE(NULLIF(TRIM(p_service), ''), 'Ticket'), p_party_id, p_vendor_id,
    v_client_amt, v_vendor_amt, v_profit, v_paid_amt, v_status,
    NULLIF(TRIM(COALESCE(p_pnr, '')), ''),
    NULLIF(TRIM(COALESCE(p_ticket_no, '')), ''),
    NULLIF(TRIM(COALESCE(p_passport_no, '')), ''),
    COALESCE(p_passengers, '[]'::jsonb), COALESCE(NULLIF(TRIM(p_currency), ''), 'PKR'),
    p_sar_rate, p_sar_amount, COALESCE(p_commission, 0), COALESCE(p_wht, 0),
    COALESCE(p_more_details, '{}'::jsonb), p_notes, false, auth.uid()
  )
  RETURNING id INTO v_invoice_id;

  IF v_client_amt > 0 THEN
    INSERT INTO public.central_journal_entries (
      agency_id, entry_group_id, entry_date, account_type, party_id, invoice_id, booking_id, debit, credit, description, created_by
    ) VALUES (
      v_agency_id, v_group_id, v_inv_date, 'receivable', p_party_id, v_invoice_id, v_invoice_id,
      v_client_amt, 0, 'Booking Invoice ' || v_inv_no || ' (' || COALESCE(v_party_name, 'Client') || ')', auth.uid()
    );

    INSERT INTO public.central_journal_entries (
      agency_id, entry_group_id, entry_date, account_type, invoice_id, booking_id, debit, credit, description, created_by
    ) VALUES (
      v_agency_id, v_group_id, v_inv_date, 'revenue', v_invoice_id, v_invoice_id,
      0, v_client_amt, 'Sales Revenue: ' || COALESCE(p_service, 'Booking') || ' (' || v_inv_no || ')', auth.uid()
    );
  END IF;

  IF v_vendor_amt > 0 THEN
    INSERT INTO public.central_journal_entries (
      agency_id, entry_group_id, entry_date, account_type, invoice_id, booking_id, debit, credit, description, created_by
    ) VALUES (
      v_agency_id, v_group_id, v_inv_date, 'expense', v_invoice_id, v_invoice_id,
      v_vendor_amt, 0, 'Cost of Service: ' || COALESCE(p_service, 'Booking') || ' (' || v_inv_no || ')', auth.uid()
    );

    IF p_vendor_id IS NOT NULL THEN
      INSERT INTO public.central_journal_entries (
        agency_id, entry_group_id, entry_date, account_type, party_id, invoice_id, booking_id, debit, credit, description, created_by
      ) VALUES (
        v_agency_id, v_group_id, v_inv_date, 'payable', p_vendor_id, v_invoice_id, v_invoice_id,
        0, v_vendor_amt, 'Vendor Payable: ' || v_inv_no || ' (' || COALESCE(v_vendor_name, 'Vendor') || ')', auth.uid()
      );
    END IF;
  END IF;

  IF v_paid_amt > 0 THEN
    v_acc_id := public.resolve_agency_account(v_agency_id, p_account_id, p_payment_mode, NULLIF(p_more_details->>'selected_bank', ''));
    v_v_no := public.next_unused_agency_number(v_agency_id, 'voucher_crv');

    INSERT INTO public.payment_vouchers (
      agency_id, voucher_no, voucher_date, direction, payment_mode, account_id,
      party_id, amount, is_adjustment, adjustment_reason, bank_name, reference_no, notes, is_void, created_by
    ) VALUES (
      v_agency_id, v_v_no, v_inv_date, 'received', LOWER(COALESCE(p_payment_mode, 'cash')), v_acc_id,
      p_party_id, v_paid_amt, false, NULL, NULLIF(p_more_details->>'selected_bank', ''), 'AT-BOOKING-' || v_inv_no,
      'Initial payment at booking for ' || v_inv_no, false, auth.uid()
    )
    RETURNING id INTO v_voucher_id;

    INSERT INTO public.invoice_allocations (
      agency_id, voucher_id, invoice_id, allocated_amount
    ) VALUES (
      v_agency_id, v_voucher_id, v_invoice_id, v_paid_amt
    );

    INSERT INTO public.central_journal_entries (
      agency_id, entry_group_id, entry_date, account_type, account_id, invoice_id, booking_id, voucher_id, debit, credit, description, created_by
    ) VALUES (
      v_agency_id, v_group_id, v_inv_date, 'cash_bank', v_acc_id, v_invoice_id, v_invoice_id, v_voucher_id,
      v_paid_amt, 0, 'Receipt ' || v_v_no || ' for ' || v_inv_no, auth.uid()
    );

    INSERT INTO public.central_journal_entries (
      agency_id, entry_group_id, entry_date, account_type, party_id, invoice_id, booking_id, voucher_id, debit, credit, description, created_by
    ) VALUES (
      v_agency_id, v_group_id, v_inv_date, 'receivable', p_party_id, v_invoice_id, v_invoice_id, v_voucher_id,
      0, v_paid_amt, 'Initial payment reduction for ' || v_inv_no, auth.uid()
    );

    INSERT INTO public.transactions (
      agency_id, date, type, party_id, party_type, booking_id, account_id,
      debit, credit, method, reference_no, category, notes, created_by
    ) VALUES (
      v_agency_id, v_inv_date, 'payment_in', p_party_id, 'client', v_invoice_id, v_acc_id,
      v_paid_amt, 0, LOWER(COALESCE(p_payment_mode, 'cash')), v_v_no, 'Booking Receipt',
      'Initial payment for ' || v_inv_no, auth.uid()
    );
  END IF;

  IF p_party_id IS NOT NULL THEN
    PERFORM public.recalculate_party_balance(p_party_id, v_agency_id);
  END IF;
  IF p_vendor_id IS NOT NULL THEN
    PERFORM public.recalculate_party_balance(p_vendor_id, v_agency_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_invoice_id,
    'invoice_id', v_invoice_id,
    'invoice_no', v_inv_no,
    'voucher_id', v_voucher_id,
    'voucher_no', v_v_no,
    'profit', v_profit,
    'payment_status', v_status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.save_booking_invoice(
  p_invoice_no TEXT DEFAULT NULL,
  p_service TEXT DEFAULT 'Ticket',
  p_party_id UUID DEFAULT NULL,
  p_vendor_id UUID DEFAULT NULL,
  p_client_amount NUMERIC DEFAULT 0,
  p_vendor_payable NUMERIC DEFAULT 0,
  p_amount_paid NUMERIC DEFAULT 0,
  p_payment_mode TEXT DEFAULT 'cash',
  p_account_id UUID DEFAULT NULL,
  p_invoice_date DATE DEFAULT CURRENT_DATE,
  p_due_date DATE DEFAULT NULL,
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
  p_notes TEXT DEFAULT NULL,
  p_is_manual BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.save_booking_invoice_atomic(
    p_invoice_no, p_service, p_party_id, p_vendor_id, p_client_amount,
    p_vendor_payable, p_amount_paid, p_payment_mode, p_account_id,
    p_invoice_date, p_due_date, p_pnr, p_ticket_no, p_passport_no,
    p_passengers, p_currency, p_sar_rate, p_sar_amount,
    p_commission, p_wht, p_more_details, p_notes, p_is_manual
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.save_payment_voucher_atomic(
  p_direction TEXT,
  p_amount NUMERIC,
  p_payment_mode TEXT DEFAULT 'cash',
  p_account_id UUID DEFAULT NULL,
  p_party_id UUID DEFAULT NULL,
  p_voucher_no TEXT DEFAULT NULL,
  p_voucher_date DATE DEFAULT CURRENT_DATE,
  p_reference_no TEXT DEFAULT NULL,
  p_is_adjustment BOOLEAN DEFAULT false,
  p_adjustment_reason TEXT DEFAULT NULL,
  p_bank_name TEXT DEFAULT NULL,
  p_invoice_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_is_manual BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_voucher_id UUID;
  v_group_id UUID := gen_random_uuid();
  v_v_no TEXT := NULLIF(TRIM(COALESCE(p_voucher_no, '')), '');
  v_acc_id UUID;
  v_rem_amount NUMERIC := p_amount;
  v_inv RECORD;
  v_alloc_amt NUMERIC;
  v_new_paid NUMERIC;
  v_party_name TEXT := 'Party';
  v_vdate DATE := COALESCE(p_voucher_date, public.karachi_today());
BEGIN
  PERFORM public.assert_module_permission(ARRAY['bookings', 'invoices', 'clients', 'vendors'], 'write');

  IF p_direction NOT IN ('received', 'paid') THEN
    RAISE EXCEPTION 'Invalid voucher direction: %', p_direction;
  END IF;

  IF COALESCE(p_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'Voucher amount must be greater than zero';
  END IF;

  IF p_party_id IS NOT NULL THEN
    SELECT name INTO v_party_name
    FROM public.parties
    WHERE id = p_party_id AND agency_id = v_agency_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION '403 Forbidden: Party does not belong to your active agency';
    END IF;
  END IF;

  IF NOT COALESCE(p_is_adjustment, false) THEN
    v_acc_id := public.resolve_agency_account(v_agency_id, p_account_id, p_payment_mode, p_bank_name);
  ELSE
    v_acc_id := p_account_id;
  END IF;

  IF COALESCE(p_is_manual, false) THEN
    IF v_v_no IS NULL OR v_v_no ~* '^(__AUTO__|preview|auto-generated)$' THEN
      RAISE EXCEPTION 'Please enter a valid custom voucher number';
    END IF;
  ELSE
    v_v_no := public.next_unused_agency_number(
      v_agency_id,
      CASE WHEN p_direction = 'received' THEN 'voucher_crv' ELSE 'voucher_cpv' END
    );
  END IF;

  INSERT INTO public.payment_vouchers (
    agency_id, voucher_no, voucher_date, direction, payment_mode, account_id,
    party_id, amount, is_adjustment, adjustment_reason, bank_name, reference_no, notes, is_void, created_by
  ) VALUES (
    v_agency_id, v_v_no, v_vdate, p_direction, LOWER(COALESCE(p_payment_mode, 'cash')), v_acc_id,
    p_party_id, p_amount, COALESCE(p_is_adjustment, false), p_adjustment_reason, p_bank_name, p_reference_no, p_notes, false, auth.uid()
  )
  RETURNING id INTO v_voucher_id;

  IF p_direction = 'received' THEN
    IF NOT COALESCE(p_is_adjustment, false) THEN
      INSERT INTO public.central_journal_entries (
        agency_id, entry_group_id, entry_date, account_type, account_id, voucher_id, debit, credit, description, created_by
      ) VALUES (
        v_agency_id, v_group_id, v_vdate, 'cash_bank', v_acc_id, v_voucher_id,
        p_amount, 0, 'Receipt Voucher ' || v_v_no || ' (' || COALESCE(v_party_name, 'Party') || ')', auth.uid()
      );

      INSERT INTO public.transactions (
        agency_id, date, type, party_id, party_type, booking_id, account_id,
        debit, credit, method, reference_no, category, notes, created_by
      ) VALUES (
        v_agency_id, v_vdate, 'payment_in', p_party_id, 'client', p_invoice_id, v_acc_id,
        p_amount, 0, LOWER(COALESCE(p_payment_mode, 'cash')), COALESCE(p_reference_no, v_v_no), 'Receipt Voucher', p_notes, auth.uid()
      );
    END IF;

    INSERT INTO public.central_journal_entries (
      agency_id, entry_group_id, entry_date, account_type, party_id, voucher_id, debit, credit, description, created_by
    ) VALUES (
      v_agency_id, v_group_id, v_vdate, 'receivable', p_party_id, v_voucher_id,
      0, p_amount, 'Payment from ' || COALESCE(v_party_name, 'Party') || ' (' || v_v_no || ')', auth.uid()
    );

    IF p_party_id IS NOT NULL OR p_invoice_id IS NOT NULL THEN
      FOR v_inv IN
        SELECT id, client_amount, paid_amount
        FROM public.booking_invoices
        WHERE agency_id = v_agency_id
          AND COALESCE(is_void, false) = false
          AND payment_status IN ('unpaid', 'partial')
          AND (
            id = p_invoice_id
            OR (p_party_id IS NOT NULL AND party_id = p_party_id)
          )
        ORDER BY CASE WHEN id = p_invoice_id THEN 0 ELSE 1 END, invoice_date ASC, created_at ASC
      LOOP
        EXIT WHEN v_rem_amount <= 0;
        v_alloc_amt := LEAST(v_rem_amount, GREATEST(0, COALESCE(v_inv.client_amount, 0) - COALESCE(v_inv.paid_amount, 0)));
        IF v_alloc_amt > 0 THEN
          v_new_paid := COALESCE(v_inv.paid_amount, 0) + v_alloc_amt;
          UPDATE public.booking_invoices
          SET paid_amount = v_new_paid,
              payment_status = CASE WHEN v_new_paid >= client_amount THEN 'paid' ELSE 'partial' END,
              updated_at = now()
          WHERE id = v_inv.id;

          INSERT INTO public.invoice_allocations (
            agency_id, voucher_id, invoice_id, allocated_amount
          ) VALUES (
            v_agency_id, v_voucher_id, v_inv.id, v_alloc_amt
          );

          v_rem_amount := v_rem_amount - v_alloc_amt;
        END IF;
      END LOOP;
    END IF;
  ELSE
    INSERT INTO public.central_journal_entries (
      agency_id, entry_group_id, entry_date, account_type, party_id, voucher_id, debit, credit, description, created_by
    ) VALUES (
      v_agency_id, v_group_id, v_vdate, 'payable', p_party_id, v_voucher_id,
      p_amount, 0, 'Payment to ' || COALESCE(v_party_name, 'Vendor') || ' (' || v_v_no || ')', auth.uid()
    );

    IF NOT COALESCE(p_is_adjustment, false) THEN
      INSERT INTO public.central_journal_entries (
        agency_id, entry_group_id, entry_date, account_type, account_id, voucher_id, debit, credit, description, created_by
      ) VALUES (
        v_agency_id, v_group_id, v_vdate, 'cash_bank', v_acc_id, v_voucher_id,
        0, p_amount, 'Payment Voucher ' || v_v_no, auth.uid()
      );

      INSERT INTO public.transactions (
        agency_id, date, type, party_id, party_type, booking_id, account_id,
        debit, credit, method, reference_no, category, notes, created_by
      ) VALUES (
        v_agency_id, v_vdate, 'payment_out', p_party_id, 'vendor', p_invoice_id, v_acc_id,
        0, p_amount, LOWER(COALESCE(p_payment_mode, 'cash')), COALESCE(p_reference_no, v_v_no), 'Vendor Payout', p_notes, auth.uid()
      );
    END IF;
  END IF;

  IF p_party_id IS NOT NULL THEN
    PERFORM public.recalculate_party_balance(p_party_id, v_agency_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_voucher_id,
    'voucher_id', v_voucher_id,
    'voucher_no', v_v_no,
    'amount', p_amount,
    'direction', p_direction,
    'account_id', v_acc_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.save_payment_voucher(
  p_direction TEXT,
  p_amount NUMERIC,
  p_payment_mode TEXT DEFAULT 'cash',
  p_account_id UUID DEFAULT NULL,
  p_party_id UUID DEFAULT NULL,
  p_voucher_no TEXT DEFAULT NULL,
  p_voucher_date DATE DEFAULT CURRENT_DATE,
  p_reference_no TEXT DEFAULT NULL,
  p_is_adjustment BOOLEAN DEFAULT false,
  p_adjustment_reason TEXT DEFAULT NULL,
  p_bank_name TEXT DEFAULT NULL,
  p_invoice_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_is_manual BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.save_payment_voucher_atomic(
    p_direction, p_amount, p_payment_mode, p_account_id, p_party_id,
    p_voucher_no, p_voucher_date, p_reference_no, p_is_adjustment,
    p_adjustment_reason, p_bank_name, p_invoice_id, p_notes, p_is_manual
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_refund(
  p_amount NUMERIC DEFAULT 0,
  p_account_id UUID DEFAULT NULL,
  p_party_id UUID DEFAULT NULL,
  p_party_type TEXT DEFAULT 'client',
  p_booking_id UUID DEFAULT NULL,
  p_date DATE DEFAULT CURRENT_DATE,
  p_method TEXT DEFAULT 'cash',
  p_reference_no TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_action_type TEXT DEFAULT 'refund',
  p_vendor_refund_amount NUMERIC DEFAULT 0,
  p_deductions NUMERIC DEFAULT 0,
  p_bank_name TEXT DEFAULT NULL,
  p_party_name TEXT DEFAULT NULL,
  p_invoice_search TEXT DEFAULT NULL,
  p_void_invoice BOOLEAN DEFAULT NULL,
  p_is_manual BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_acc_id UUID;
  v_ref_id UUID;
  v_group_id UUID := gen_random_uuid();
  v_ref_no TEXT := NULLIF(TRIM(COALESCE(p_reference_no, '')), '');
  v_rdate DATE := COALESCE(p_date, public.karachi_today());
  v_action TEXT := LOWER(COALESCE(p_action_type, 'refund'));
  v_inv public.booking_invoices%ROWTYPE;
  v_has_inv BOOLEAN := false;
  v_party_id UUID := p_party_id;
  v_vendor_id UUID := NULL;
  v_cash_refund NUMERIC := GREATEST(0, COALESCE(p_amount, 0));
  v_should_void BOOLEAN;
BEGIN
  PERFORM public.assert_module_permission(ARRAY['bookings', 'invoices', 'clients'], 'write');

  IF COALESCE(p_amount, 0) < 0 OR COALESCE(p_vendor_refund_amount, 0) < 0 OR COALESCE(p_deductions, 0) < 0 THEN
    RAISE EXCEPTION 'Amounts cannot be negative';
  END IF;

  IF p_booking_id IS NOT NULL THEN
    SELECT * INTO v_inv
    FROM public.booking_invoices
    WHERE id = p_booking_id AND agency_id = v_agency_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION '403 Forbidden: Booking invoice not found in your active agency';
    END IF;

    v_has_inv := true;
    v_party_id := COALESCE(v_party_id, v_inv.party_id);
    v_vendor_id := v_inv.vendor_id;
  END IF;

  IF v_party_id IS NOT NULL THEN
    PERFORM 1 FROM public.parties WHERE id = v_party_id AND agency_id = v_agency_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION '403 Forbidden: Party does not belong to your active agency';
    END IF;
  END IF;

  IF COALESCE(p_is_manual, false) THEN
    IF v_ref_no IS NULL OR v_ref_no ~* '^(__AUTO__|preview|auto-generated)$' THEN
      RAISE EXCEPTION 'Please enter a valid custom refund/void number';
    END IF;
  ELSE
    v_ref_no := public.next_unused_agency_number(
      v_agency_id,
      CASE WHEN v_action = 'void' THEN 'void' ELSE 'refund' END
    );
  END IF;

  IF v_cash_refund > 0 THEN
    v_acc_id := public.resolve_agency_account(v_agency_id, p_account_id, p_method, p_bank_name);
  END IF;

  v_should_void := COALESCE(
    p_void_invoice,
    v_action = 'void' OR (v_has_inv AND v_cash_refund >= COALESCE(v_inv.client_amount, 0))
  );

  INSERT INTO public.refunds (
    agency_id, client_id, booking_id, party_id, account_id, refund_no,
    refund_date, refund_amount, client_refund_amount, vendor_refund_amount,
    deductions, refund_type, payment_mode, bank_name, reason, notes,
    party_name, invoice_search, created_by
  ) VALUES (
    v_agency_id, v_party_id, p_booking_id, v_party_id, v_acc_id, v_ref_no,
    v_rdate, v_cash_refund, v_cash_refund, COALESCE(p_vendor_refund_amount, 0),
    COALESCE(p_deductions, 0), v_action, COALESCE(p_method, 'cash'), p_bank_name,
    p_reason, p_notes, p_party_name, p_invoice_search, auth.uid()
  )
  RETURNING id INTO v_ref_id;

  IF v_has_inv AND v_inv.id IS NOT NULL AND v_should_void THEN
    UPDATE public.booking_invoices
    SET is_void = true,
        payment_status = 'void',
        void_reason = COALESCE(p_reason, 'Voided / Refunded via ' || v_ref_no),
        voided_at = now(),
        voided_by = auth.uid(),
        updated_at = now()
    WHERE id = v_inv.id AND agency_id = v_agency_id;

    INSERT INTO public.refund_void_records (
      agency_id, record_no, action_type, invoice_id, party_id, vendor_id,
      client_refund_amount, vendor_refund_amount, reason, payment_mode, account_id, created_by
    ) VALUES (
      v_agency_id, v_ref_no, v_action, v_inv.id, v_party_id, v_vendor_id,
      v_cash_refund, COALESCE(p_vendor_refund_amount, 0), COALESCE(p_reason, 'Refund/Void'), COALESCE(p_method, 'cash'), v_acc_id, auth.uid()
    );
  END IF;

  IF v_cash_refund > 0 THEN
    INSERT INTO public.central_journal_entries (
      agency_id, entry_group_id, entry_date, account_type, party_id, invoice_id, booking_id, debit, credit, description, created_by
    ) VALUES (
      v_agency_id, v_group_id, v_rdate, 'revenue', v_party_id, p_booking_id, p_booking_id,
      v_cash_refund, 0, 'Refund / Void: ' || v_ref_no || COALESCE(' (' || p_reason || ')', ''), auth.uid()
    );

    INSERT INTO public.central_journal_entries (
      agency_id, entry_group_id, entry_date, account_type, account_id, invoice_id, booking_id, debit, credit, description, created_by
    ) VALUES (
      v_agency_id, v_group_id, v_rdate, 'cash_bank', v_acc_id, p_booking_id, p_booking_id,
      0, v_cash_refund, 'Refund Paid Out (' || v_ref_no || ')', auth.uid()
    );

    INSERT INTO public.transactions (
      agency_id, date, type, party_id, party_type, booking_id, account_id,
      debit, credit, method, reference_no, category, notes, created_by
    ) VALUES (
      v_agency_id, v_rdate, 'refund', v_party_id, COALESCE(p_party_type, 'client'), p_booking_id, v_acc_id,
      0, v_cash_refund, COALESCE(p_method, 'cash'), v_ref_no, 'Refund', COALESCE(p_notes, p_reason), auth.uid()
    );
  END IF;

  IF v_party_id IS NOT NULL THEN
    PERFORM public.recalculate_party_balance(v_party_id, v_agency_id);
  END IF;
  IF v_vendor_id IS NOT NULL THEN
    PERFORM public.recalculate_party_balance(v_vendor_id, v_agency_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'refund_id', v_ref_id,
    'refund_no', v_ref_no,
    'voided_invoice', v_should_void
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_expense(
  p_amount NUMERIC,
  p_account_id UUID DEFAULT NULL,
  p_category TEXT DEFAULT 'General Expense',
  p_date DATE DEFAULT CURRENT_DATE,
  p_method TEXT DEFAULT 'cash',
  p_reference_no TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_party_id UUID DEFAULT NULL,
  p_party_type TEXT DEFAULT NULL,
  p_bank_name TEXT DEFAULT NULL,
  p_is_manual BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_acc_id UUID;
  v_exp_id UUID;
  v_tx_id UUID;
  v_group_id UUID := gen_random_uuid();
  v_ref_no TEXT := NULLIF(TRIM(COALESCE(p_reference_no, '')), '');
  v_edate DATE := COALESCE(p_date, public.karachi_today());
BEGIN
  PERFORM public.assert_module_permission(ARRAY['expenses'], 'write');

  IF COALESCE(p_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'Expense amount must be greater than zero';
  END IF;

  IF p_party_id IS NOT NULL THEN
    PERFORM 1 FROM public.parties WHERE id = p_party_id AND agency_id = v_agency_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION '403 Forbidden: Party does not belong to your active agency';
    END IF;
  END IF;

  v_acc_id := public.resolve_agency_account(v_agency_id, p_account_id, p_method, p_bank_name);

  IF COALESCE(p_is_manual, false) THEN
    IF v_ref_no IS NULL OR v_ref_no ~* '^(__AUTO__|preview|auto-generated)$' THEN
      RAISE EXCEPTION 'Please enter a valid custom expense number';
    END IF;
  ELSE
    v_ref_no := public.next_unused_agency_number(v_agency_id, 'expense');
  END IF;

  INSERT INTO public.expenses (
    agency_id, expense_date, expense_type, amount, notes, payment_mode, bank_name, reference_number, is_paid
  ) VALUES (
    v_agency_id, v_edate, COALESCE(NULLIF(TRIM(p_category), ''), 'General Expense'), p_amount, p_notes,
    COALESCE(p_method, 'cash'), p_bank_name, v_ref_no, true
  )
  RETURNING id INTO v_exp_id;

  INSERT INTO public.central_journal_entries (
    agency_id, entry_group_id, entry_date, account_type, debit, credit, description, created_by
  ) VALUES (
    v_agency_id, v_group_id, v_edate, 'expense',
    p_amount, 0, 'Operating Expense: ' || COALESCE(p_category, 'Expense') || ' (' || v_ref_no || ')', auth.uid()
  );

  INSERT INTO public.central_journal_entries (
    agency_id, entry_group_id, entry_date, account_type, account_id, debit, credit, description, created_by
  ) VALUES (
    v_agency_id, v_group_id, v_edate, 'cash_bank', v_acc_id,
    0, p_amount, 'Expense Paid (' || v_ref_no || ')', auth.uid()
  );

  INSERT INTO public.transactions (
    agency_id, date, type, party_id, party_type, account_id,
    debit, credit, method, reference_no, category, notes, created_by
  ) VALUES (
    v_agency_id, v_edate, 'expense', p_party_id, p_party_type, v_acc_id,
    0, p_amount, COALESCE(p_method, 'cash'), v_ref_no, COALESCE(p_category, 'General Expense'), p_notes, auth.uid()
  )
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'expense_id', v_exp_id,
    'transaction_id', v_tx_id,
    'reference_no', v_ref_no,
    'account_id', v_acc_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_payment(
  p_direction TEXT,
  p_amount NUMERIC,
  p_account_id UUID DEFAULT NULL,
  p_party_id UUID DEFAULT NULL,
  p_party_type TEXT DEFAULT NULL,
  p_booking_id UUID DEFAULT NULL,
  p_date DATE DEFAULT CURRENT_DATE,
  p_method TEXT DEFAULT 'cash',
  p_reference_no TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_is_manual BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_dir TEXT := LOWER(COALESCE(p_direction, 'in'));
  v_tx_type TEXT;
  v_acc_id UUID;
  v_tx_id UUID;
  v_ref_no TEXT := NULLIF(TRIM(COALESCE(p_reference_no, '')), '');
  v_pdate DATE := COALESCE(p_date, public.karachi_today());
  v_method TEXT := LOWER(COALESCE(p_method, 'cash'));
  v_is_party BOOLEAN := false;
  v_voucher_res JSONB;
BEGIN
  PERFORM public.assert_module_permission(ARRAY['bookings', 'invoices', 'clients', 'vendors'], 'write');

  IF v_dir NOT IN ('in', 'out', 'received', 'paid') THEN
    RAISE EXCEPTION 'Invalid payment direction: %', p_direction;
  END IF;

  IF COALESCE(p_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  v_tx_type := CASE WHEN v_dir IN ('in', 'received') THEN 'payment_in' ELSE 'payment_out' END;

  IF p_party_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.parties WHERE id = p_party_id AND agency_id = v_agency_id
    ) INTO v_is_party;

    IF NOT v_is_party AND NOT (
      EXISTS (SELECT 1 FROM public.clients WHERE id = p_party_id AND agency_id = v_agency_id)
      OR EXISTS (SELECT 1 FROM public.vendors WHERE id = p_party_id AND agency_id = v_agency_id)
      OR EXISTS (SELECT 1 FROM public.b2b_agents WHERE id = p_party_id AND agency_id = v_agency_id)
    ) THEN
      RAISE EXCEPTION '403 Forbidden: Party does not belong to your active agency';
    END IF;
  END IF;

  IF v_is_party THEN
    v_voucher_res := public.save_payment_voucher_atomic(
      p_direction => CASE WHEN v_tx_type = 'payment_in' THEN 'received' ELSE 'paid' END,
      p_amount => p_amount,
      p_payment_mode => v_method,
      p_account_id => p_account_id,
      p_party_id => p_party_id,
      p_voucher_no => NULL,
      p_voucher_date => v_pdate,
      p_reference_no => v_ref_no,
      p_is_adjustment => false,
      p_adjustment_reason => NULL,
      p_bank_name => NULL,
      p_invoice_id => p_booking_id,
      p_notes => p_notes,
      p_is_manual => false
    );
    RETURN v_voucher_res;
  END IF;

  v_acc_id := public.resolve_agency_account(v_agency_id, p_account_id, v_method, NULL);

  IF COALESCE(p_is_manual, false) THEN
    IF v_ref_no IS NULL OR v_ref_no ~* '^(__AUTO__|preview|auto-generated)$' THEN
      RAISE EXCEPTION 'Please enter a valid custom reference number';
    END IF;
  ELSE
    v_ref_no := COALESCE(
      v_ref_no,
      public.next_unused_agency_number(
        v_agency_id,
        CASE WHEN v_tx_type = 'payment_in' THEN 'receipt' ELSE 'payment' END
      )
    );
  END IF;

  INSERT INTO public.transactions (
    agency_id, date, type, party_id, party_type, booking_id, account_id,
    debit, credit, method, reference_no, category, notes, created_by
  ) VALUES (
    v_agency_id,
    v_pdate,
    v_tx_type,
    p_party_id,
    p_party_type,
    p_booking_id,
    v_acc_id,
    CASE WHEN v_tx_type = 'payment_in' THEN p_amount ELSE 0 END,
    CASE WHEN v_tx_type = 'payment_out' THEN p_amount ELSE 0 END,
    v_method,
    v_ref_no,
    COALESCE(p_category, CASE WHEN v_tx_type = 'payment_in' THEN 'Payment Received' ELSE 'Payment Made' END),
    p_notes,
    auth.uid()
  )
  RETURNING id INTO v_tx_id;

  IF p_party_id IS NOT NULL THEN
    IF p_party_type = 'client' THEN
      UPDATE public.clients
      SET amount_paid = COALESCE(amount_paid, 0) + CASE WHEN v_tx_type = 'payment_in' THEN p_amount ELSE -p_amount END,
          updated_at = now()
      WHERE id = p_party_id AND agency_id = v_agency_id;
    ELSIF p_party_type = 'vendor' THEN
      UPDATE public.vendors
      SET amount_paid = COALESCE(amount_paid, 0) + CASE WHEN v_tx_type = 'payment_out' THEN p_amount ELSE -p_amount END,
          updated_at = now()
      WHERE id = p_party_id AND agency_id = v_agency_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'account_id', v_acc_id,
    'reference_no', v_ref_no
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_transfer(
  p_from_account_id UUID,
  p_to_account_id UUID,
  p_amount NUMERIC,
  p_date DATE DEFAULT CURRENT_DATE,
  p_reference_no TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_is_manual BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_from_name TEXT;
  v_to_name TEXT;
  v_tdate DATE := COALESCE(p_date, public.karachi_today());
  v_ref_no TEXT := NULLIF(TRIM(COALESCE(p_reference_no, '')), '');
  v_group_id UUID := gen_random_uuid();
  v_from_tx_id UUID;
  v_to_tx_id UUID;
BEGIN
  IF COALESCE(p_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be greater than zero';
  END IF;

  IF p_from_account_id IS NULL OR p_to_account_id IS NULL THEN
    RAISE EXCEPTION 'Source and destination accounts are required';
  END IF;

  IF p_from_account_id = p_to_account_id THEN
    RAISE EXCEPTION 'Source and destination accounts must be different';
  END IF;

  SELECT name INTO v_from_name
  FROM public.accounts
  WHERE id = p_from_account_id AND agency_id = v_agency_id AND active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION '403 Forbidden: Source account does not belong to your active agency';
  END IF;

  SELECT name INTO v_to_name
  FROM public.accounts
  WHERE id = p_to_account_id AND agency_id = v_agency_id AND active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION '403 Forbidden: Destination account does not belong to your active agency';
  END IF;

  IF COALESCE(p_is_manual, false) THEN
    IF v_ref_no IS NULL OR v_ref_no ~* '^(__AUTO__|preview|auto-generated)$' THEN
      RAISE EXCEPTION 'Please enter a valid custom transfer reference number';
    END IF;
  ELSE
    v_ref_no := COALESCE(v_ref_no, public.next_unused_agency_number(v_agency_id, 'transfer'));
  END IF;

  INSERT INTO public.transactions (
    agency_id, date, type, account_id, debit, credit, method, reference_no, category, notes, created_by
  ) VALUES (
    v_agency_id, v_tdate, 'transfer', p_from_account_id, 0, p_amount, 'transfer', v_ref_no, 'Internal Transfer',
    COALESCE(p_notes, 'Transfer to ' || v_to_name), auth.uid()
  )
  RETURNING id INTO v_from_tx_id;

  INSERT INTO public.transactions (
    agency_id, date, type, account_id, debit, credit, method, reference_no, category, notes, created_by
  ) VALUES (
    v_agency_id, v_tdate, 'transfer', p_to_account_id, p_amount, 0, 'transfer', v_ref_no, 'Internal Transfer',
    COALESCE(p_notes, 'Transfer from ' || v_from_name), auth.uid()
  )
  RETURNING id INTO v_to_tx_id;

  INSERT INTO public.central_journal_entries (
    agency_id, entry_group_id, entry_date, account_type, account_id, debit, credit, description, created_by
  ) VALUES
    (v_agency_id, v_group_id, v_tdate, 'cash_bank', p_from_account_id, 0, p_amount, 'Transfer out to ' || v_to_name || ' (' || v_ref_no || ')', auth.uid()),
    (v_agency_id, v_group_id, v_tdate, 'cash_bank', p_to_account_id, p_amount, 0, 'Transfer in from ' || v_from_name || ' (' || v_ref_no || ')', auth.uid());

  RETURN jsonb_build_object(
    'success', true,
    'reference_no', v_ref_no,
    'from_transaction_id', v_from_tx_id,
    'to_transaction_id', v_to_tx_id
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. SECURE FUNCTION EXECUTION GRANTS
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.is_agency_owner(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_agency_owner(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.assert_module_permission(TEXT[], TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_module_permission(TEXT[], TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.format_agency_number(UUID, TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.format_agency_number(UUID, TEXT, BIGINT) TO authenticated;

REVOKE ALL ON FUNCTION public.next_number(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_number(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.next_formatted_number(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_formatted_number(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.is_document_number_taken(UUID, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_document_number_taken(UUID, TEXT, TEXT, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.next_unused_agency_number(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_unused_agency_number(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.preview_next_number(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_next_number(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.check_document_number_available(TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_document_number_available(TEXT, TEXT, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.save_booking_invoice_atomic(TEXT, TEXT, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, UUID, DATE, DATE, TEXT, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_booking_invoice_atomic(TEXT, TEXT, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, UUID, DATE, DATE, TEXT, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB, TEXT, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.save_booking_invoice(TEXT, TEXT, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, UUID, DATE, DATE, TEXT, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_booking_invoice(TEXT, TEXT, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, UUID, DATE, DATE, TEXT, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB, TEXT, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.save_payment_voucher_atomic(TEXT, NUMERIC, TEXT, UUID, UUID, TEXT, DATE, TEXT, BOOLEAN, TEXT, TEXT, UUID, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_payment_voucher_atomic(TEXT, NUMERIC, TEXT, UUID, UUID, TEXT, DATE, TEXT, BOOLEAN, TEXT, TEXT, UUID, TEXT, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.save_payment_voucher(TEXT, NUMERIC, TEXT, UUID, UUID, TEXT, DATE, TEXT, BOOLEAN, TEXT, TEXT, UUID, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_payment_voucher(TEXT, NUMERIC, TEXT, UUID, UUID, TEXT, DATE, TEXT, BOOLEAN, TEXT, TEXT, UUID, TEXT, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.record_refund(NUMERIC, UUID, UUID, TEXT, UUID, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_refund(NUMERIC, UUID, UUID, TEXT, UUID, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.record_expense(NUMERIC, UUID, TEXT, DATE, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_expense(NUMERIC, UUID, TEXT, DATE, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.record_payment(TEXT, NUMERIC, UUID, UUID, TEXT, UUID, DATE, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_payment(TEXT, NUMERIC, UUID, UUID, TEXT, UUID, DATE, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.record_transfer(UUID, UUID, NUMERIC, DATE, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_transfer(UUID, UUID, NUMERIC, DATE, TEXT, TEXT, BOOLEAN) TO authenticated;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
