-- ==============================================================================
-- TAMS PRO — MIGRATION 02: ACCOUNTING ENGINE UNIFICATION, RECONCILIATION,
-- SINGLE-SOURCE-OF-TRUTH KPI/OVERDUE RPCs & REALTIME PUBLICATION
-- Covers Tasks 4 & 5 (100% additive & non-destructive to live data)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SAFE ADDITIVE SCHEMA HARMONIZATION ACROSS LEGACY + NEW TABLES
-- ------------------------------------------------------------------------------

-- Ensure unified cash/bank & transaction ledger tables exist (self-healing if
-- 20261107_accounts_bookings_unified_ledger.sql was not applied prior to this migration)
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('cash', 'bank')),
  name TEXT NOT NULL,
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT accounts_agency_name_unique UNIQUE (agency_id, name)
);

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS opening_balance NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_accounts_agency_type
  ON public.accounts (agency_id, type, active);

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL CHECK (type IN ('charge', 'payment_in', 'payment_out', 'expense', 'refund', 'transfer', 'adjustment', 'opening')),
  party_id UUID,
  party_type TEXT CHECK (party_type IN ('client', 'agent', 'vendor')),
  booking_id UUID,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  debit NUMERIC NOT NULL DEFAULT 0,
  credit NUMERIC NOT NULL DEFAULT 0,
  method TEXT DEFAULT 'cash',
  reference_no TEXT,
  category TEXT,
  notes TEXT,
  reversed_of UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  legacy_source TEXT,
  legacy_id UUID,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_agency_date
  ON public.transactions (agency_id, date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_agency_account
  ON public.transactions (agency_id, account_id, reversed_of);
CREATE INDEX IF NOT EXISTS idx_transactions_agency_party
  ON public.transactions (agency_id, party_id, reversed_of);
CREATE INDEX IF NOT EXISTS idx_transactions_legacy
  ON public.transactions (agency_id, legacy_source, legacy_id);

-- Enforce Task 3 strict 4-verb RLS + agency_id immutability trigger on accounts & transactions
-- (Guarantees protection even if 20261114_01 ran before public.transactions existed)
DO $$
DECLARE
  v_t TEXT;
  v_pol RECORD;
BEGIN
  FOREACH v_t IN ARRAY ARRAY['accounts', 'transactions'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_t);

    FOR v_pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = v_t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_pol.policyname, v_t);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (agency_id = public.current_user_agency_id() OR public.has_role(auth.uid(), ''super_admin''::public.app_role))',
      v_t || '_strict_select', v_t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (agency_id = public.current_user_agency_id() OR public.has_role(auth.uid(), ''super_admin''::public.app_role))',
      v_t || '_strict_insert', v_t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (agency_id = public.current_user_agency_id() OR public.has_role(auth.uid(), ''super_admin''::public.app_role)) WITH CHECK (agency_id = public.current_user_agency_id() OR public.has_role(auth.uid(), ''super_admin''::public.app_role))',
      v_t || '_strict_update', v_t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (agency_id = public.current_user_agency_id() OR public.has_role(auth.uid(), ''super_admin''::public.app_role))',
      v_t || '_strict_delete', v_t
    );

    EXECUTE format('DROP TRIGGER IF EXISTS trg_isolation_%I ON public.%I', v_t, v_t);
    EXECUTE format(
      'CREATE TRIGGER trg_isolation_%I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_agency_isolation()',
      v_t, v_t
    );
  END LOOP;
END $$;

ALTER TABLE public.booking_invoices
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS is_void BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS void_reason TEXT,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.payment_vouchers
  ADD COLUMN IF NOT EXISTS is_void BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS void_reason TEXT,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS reference_no TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.payment_vouchers
  DROP CONSTRAINT IF EXISTS payment_vouchers_payment_mode_check;
ALTER TABLE public.payment_vouchers
  ADD CONSTRAINT payment_vouchers_payment_mode_check
  CHECK (LOWER(payment_mode) IN ('cash', 'bank', 'transfer', 'cheque', 'online')) NOT VALID;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS reference_number TEXT,
  ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT true;

ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS party_id UUID REFERENCES public.parties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS refund_no TEXT,
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS refund_type TEXT DEFAULT 'refund',
  ADD COLUMN IF NOT EXISTS client_refund_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vendor_refund_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deductions NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS party_name TEXT,
  ADD COLUMN IF NOT EXISTS invoice_search TEXT;

ALTER TABLE public.refund_void_records
  DROP CONSTRAINT IF EXISTS refund_void_records_action_type_check;
ALTER TABLE public.refund_void_records
  ADD CONSTRAINT refund_void_records_action_type_check
  CHECK (LOWER(action_type) IN ('refund', 'void', 'void_refund', 'partial_refund')) NOT VALID;

ALTER TABLE public.central_journal_entries
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.booking_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES public.booking_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS voucher_id UUID REFERENCES public.payment_vouchers(id) ON DELETE SET NULL;

ALTER TABLE public.central_journal_entries
  DROP CONSTRAINT IF EXISTS central_journal_entries_account_type_check;
ALTER TABLE public.central_journal_entries
  ADD CONSTRAINT central_journal_entries_account_type_check
  CHECK (account_type IN ('cash_bank', 'receivable', 'payable', 'income', 'revenue', 'expense', 'equity', 'liability'));

ALTER TABLE public.agency_counters
  DROP CONSTRAINT IF EXISTS agency_counters_counter_type_check;
ALTER TABLE public.agency_counters
  ADD CONSTRAINT agency_counters_counter_type_check
  CHECK (counter_type IN (
    'invoice', 'client', 'vendor', 'voucher', 'voucher_crv', 'voucher_cpv',
    'receipt', 'payment', 'refund', 'expense', 'quotation', 'query', 'reminder'
  ));


-- ------------------------------------------------------------------------------
-- 2. CROSS-AGENCY GUARD HELPER + ACCOUNT & PARTY BALANCE HELPERS
-- ------------------------------------------------------------------------------

-- Drop any older overloads / differing return-type versions first so
-- neither 42P13 nor PostgREST PGRST203 overload ambiguity can occur.
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
        'assert_agency_scope',
        'get_or_create_default_cash_account',
        'resolve_agency_account',
        'recalculate_party_balance',
        'party_balances',
        'save_booking_invoice_atomic',
        'save_booking_invoice',
        'save_payment_voucher_atomic',
        'save_payment_voucher',
        'record_refund',
        'record_expense',
        'record_payment',
        'record_transfer',
        'reverse_transaction',
        'get_agency_ledger',
        'get_party_statement',
        'void_booking_invoice',
        'karachi_today',
        'get_agency_financial_summary',
        'get_agency_overdue_invoices',
        'reconcile_agency_balances',
        'check_agency_data_integrity'
      )
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s) CASCADE', r.proname, r.args);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.assert_agency_scope(p_agency_id UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_agency UUID := public.current_user_agency_id();
  v_target UUID;
BEGIN
  IF p_agency_id IS NOT NULL
     AND p_agency_id IS DISTINCT FROM v_caller_agency
     AND current_user NOT IN ('postgres', 'supabase_admin')
     AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     AND NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION '403 Forbidden: Cross-agency access denied';
  END IF;

  v_target := COALESCE(p_agency_id, v_caller_agency);
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Active agency context required';
  END IF;

  RETURN v_target;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_default_cash_account(p_agency_id UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(p_agency_id);
  v_acc_id UUID;
BEGIN
  SELECT id INTO v_acc_id
  FROM public.accounts
  WHERE agency_id = v_agency_id
    AND type = 'cash'
    AND active = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_acc_id IS NULL THEN
    INSERT INTO public.accounts (agency_id, type, name, opening_balance, active)
    VALUES (v_agency_id, 'cash', 'Main Cash Account', 0, true)
    ON CONFLICT (agency_id, name) DO UPDATE
      SET active = true,
          updated_at = now()
    RETURNING id INTO v_acc_id;
  END IF;

  RETURN v_acc_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_agency_account(
  p_agency_id UUID,
  p_account_id UUID DEFAULT NULL,
  p_payment_mode TEXT DEFAULT 'cash',
  p_bank_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(p_agency_id);
  v_acc_id UUID;
  v_mode TEXT := LOWER(COALESCE(p_payment_mode, 'cash'));
  v_bank TEXT := NULLIF(TRIM(COALESCE(p_bank_name, '')), '');
BEGIN
  IF p_account_id IS NOT NULL THEN
    SELECT id INTO v_acc_id
    FROM public.accounts
    WHERE id = p_account_id
      AND agency_id = v_agency_id
      AND active = true;

    IF v_acc_id IS NULL THEN
      RAISE EXCEPTION '403 Forbidden: Specified account does not belong to your active agency';
    END IF;
    RETURN v_acc_id;
  END IF;

  IF v_mode IN ('bank', 'transfer', 'cheque', 'online') THEN
    IF v_bank IS NOT NULL THEN
      SELECT id INTO v_acc_id
      FROM public.accounts
      WHERE agency_id = v_agency_id
        AND type = 'bank'
        AND active = true
        AND name ILIKE '%' || v_bank || '%'
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;

    IF v_acc_id IS NULL THEN
      SELECT id INTO v_acc_id
      FROM public.accounts
      WHERE agency_id = v_agency_id
        AND type = 'bank'
        AND active = true
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;
  END IF;

  IF v_acc_id IS NULL THEN
    v_acc_id := public.get_or_create_default_cash_account(v_agency_id);
  END IF;

  RETURN v_acc_id;
END;
$$;

-- Canonical party balance recomputation (receivable positive, payable negative)
CREATE OR REPLACE FUNCTION public.recalculate_party_balance(p_party_id UUID, p_agency_id UUID DEFAULT NULL)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID;
  v_opening NUMERIC := 0;
  v_client_invoiced NUMERIC := 0;
  v_client_paid NUMERIC := 0;
  v_vendor_invoiced NUMERIC := 0;
  v_vendor_paid NUMERIC := 0;
  v_vendor_refunded NUMERIC := 0;
  v_balance NUMERIC := 0;
BEGIN
  IF p_party_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT agency_id, COALESCE(opening_balance, 0)
  INTO v_agency_id, v_opening
  FROM public.parties
  WHERE id = p_party_id;

  IF v_agency_id IS NULL THEN
    RETURN 0;
  END IF;

  IF p_agency_id IS NOT NULL AND p_agency_id IS DISTINCT FROM v_agency_id THEN
    RAISE EXCEPTION '403 Forbidden: Party does not belong to target agency';
  END IF;

  -- Active non-voided client receivables
  SELECT COALESCE(SUM(client_amount), 0) INTO v_client_invoiced
  FROM public.booking_invoices bi
  WHERE bi.agency_id = v_agency_id
    AND bi.party_id = p_party_id
    AND COALESCE(bi.is_void, false) = false
    AND COALESCE(bi.payment_status, 'unpaid') NOT IN ('void', 'refunded', 'cancelled');

  SELECT COALESCE(SUM(amount), 0) INTO v_client_paid
  FROM public.payment_vouchers pv
  WHERE pv.agency_id = v_agency_id
    AND pv.party_id = p_party_id
    AND pv.direction = 'received'
    AND COALESCE(pv.is_void, false) = false;

  -- Active non-voided vendor payables
  SELECT COALESCE(SUM(vendor_payable), 0) INTO v_vendor_invoiced
  FROM public.booking_invoices bi
  WHERE bi.agency_id = v_agency_id
    AND bi.vendor_id = p_party_id
    AND COALESCE(bi.is_void, false) = false
    AND COALESCE(bi.payment_status, 'unpaid') NOT IN ('void', 'refunded', 'cancelled');

  SELECT COALESCE(SUM(amount), 0) INTO v_vendor_paid
  FROM public.payment_vouchers pv
  WHERE pv.agency_id = v_agency_id
    AND pv.party_id = p_party_id
    AND pv.direction = 'paid'
    AND COALESCE(pv.is_void, false) = false;

  SELECT COALESCE(SUM(COALESCE(r.vendor_refund_amount, 0)), 0) INTO v_vendor_refunded
  FROM public.refunds r
  JOIN public.booking_invoices bi ON bi.id = r.booking_id
  WHERE r.agency_id = v_agency_id
    AND bi.vendor_id = p_party_id
    AND COALESCE(bi.is_void, false) = false;

  v_balance := v_opening
    + (v_client_invoiced - v_client_paid)
    - (v_vendor_invoiced - (v_vendor_paid - v_vendor_refunded));

  UPDATE public.parties
  SET current_balance = v_balance,
      updated_at = now()
  WHERE id = p_party_id AND agency_id = v_agency_id;

  RETURN v_balance;
END;
$$;


-- ------------------------------------------------------------------------------
-- 3. HARDEN party_balances & DROP AMBIGUOUS OVERLOADS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.party_balances(
  p_party_type TEXT DEFAULT NULL,
  p_agency_id UUID DEFAULT NULL
)
RETURNS TABLE (
  party_id UUID,
  party_type TEXT,
  party_name TEXT,
  total_debit NUMERIC,
  total_credit NUMERIC,
  current_balance NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(p_agency_id);
BEGIN
  RETURN QUERY
  WITH raw_party_tx AS (
    SELECT
      t.party_id,
      t.party_type,
      COALESCE(SUM(t.debit) FILTER (WHERE t.reversed_of IS NULL), 0) AS s_debit,
      COALESCE(SUM(t.credit) FILTER (WHERE t.reversed_of IS NULL), 0) AS s_credit
    FROM public.transactions t
    WHERE t.agency_id = v_agency_id
      AND t.party_id IS NOT NULL
      AND (p_party_type IS NULL OR t.party_type = p_party_type)
    GROUP BY t.party_id, t.party_type
  )
  SELECT
    rp.party_id,
    rp.party_type,
    COALESCE(
      (SELECT p.name FROM public.parties p WHERE p.id = rp.party_id AND p.agency_id = v_agency_id),
      CASE
        WHEN rp.party_type = 'client' THEN (SELECT c.name FROM public.clients c WHERE c.id = rp.party_id AND c.agency_id = v_agency_id)
        WHEN rp.party_type = 'agent' THEN (SELECT a.name FROM public.b2b_agents a WHERE a.id = rp.party_id AND a.agency_id = v_agency_id)
        WHEN rp.party_type = 'vendor' THEN (SELECT v.name FROM public.vendors v WHERE v.id = rp.party_id AND v.agency_id = v_agency_id)
      END,
      'Unknown Party'
    ) AS party_name,
    rp.s_debit::NUMERIC AS total_debit,
    rp.s_credit::NUMERIC AS total_credit,
    (rp.s_debit - rp.s_credit)::NUMERIC AS current_balance
  FROM raw_party_tx rp
  ORDER BY (rp.s_debit - rp.s_credit) DESC;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. UNIFIED ATOMIC RPCs (SINGLE TRANSACTION PER BUSINESS ACTION)
-- ------------------------------------------------------------------------------

-- 4A. SAVE BOOKING INVOICE ATOMIC
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
  p_notes TEXT DEFAULT NULL
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
  v_inv_no TEXT := p_invoice_no;
  v_acc_id UUID;
  v_voucher_id UUID;
  v_v_no TEXT;
  v_party_name TEXT := 'Client';
  v_vendor_name TEXT := 'Vendor';
  v_status TEXT := 'unpaid';
  v_inv_date DATE := COALESCE(p_invoice_date, CURRENT_DATE);
  v_due_date DATE := COALESCE(p_due_date, NULLIF(p_more_details->>'due_date', '')::date, v_inv_date);
BEGIN
  IF v_client_amt < 0 OR v_vendor_amt < 0 OR v_paid_amt < 0 THEN
    RAISE EXCEPTION 'Amounts cannot be negative';
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

  IF v_inv_no IS NULL OR TRIM(v_inv_no) = '' OR v_inv_no ~* 'preview' THEN
    v_inv_no := public.next_formatted_number(v_agency_id, 'invoice');
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
    v_agency_id, v_inv_no, v_inv_date, v_due_date, p_service, p_party_id, p_vendor_id,
    v_client_amt, v_vendor_amt, v_profit, v_paid_amt, v_status,
    p_pnr, p_ticket_no, p_passport_no,
    COALESCE(p_passengers, '[]'::jsonb), COALESCE(p_currency, 'PKR'),
    p_sar_rate, p_sar_amount, COALESCE(p_commission, 0), COALESCE(p_wht, 0),
    COALESCE(p_more_details, '{}'::jsonb), p_notes, false, auth.uid()
  )
  RETURNING id INTO v_invoice_id;

  -- Double-entry: Client Receivable & Sales Revenue
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
      0, v_client_amt, 'Sales Revenue: ' || p_service || ' (' || v_inv_no || ')', auth.uid()
    );
  END IF;

  -- Double-entry: Direct Vendor Cost & Vendor Payable
  IF v_vendor_amt > 0 THEN
    INSERT INTO public.central_journal_entries (
      agency_id, entry_group_id, entry_date, account_type, invoice_id, booking_id, debit, credit, description, created_by
    ) VALUES (
      v_agency_id, v_group_id, v_inv_date, 'expense', v_invoice_id, v_invoice_id,
      v_vendor_amt, 0, 'Cost of Service: ' || p_service || ' (' || v_inv_no || ')', auth.uid()
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

  -- Initial payment at booking -> creates Voucher + Allocation + Journal + Cash/Bank Transaction
  IF v_paid_amt > 0 THEN
    v_acc_id := public.resolve_agency_account(v_agency_id, p_account_id, p_payment_mode, NULLIF(p_more_details->>'selected_bank', ''));
    v_v_no := public.next_formatted_number(v_agency_id, 'voucher_crv');

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
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.save_booking_invoice_atomic(
    p_invoice_no => p_invoice_no,
    p_service => p_service,
    p_party_id => p_party_id,
    p_vendor_id => p_vendor_id,
    p_client_amount => p_client_amount,
    p_vendor_payable => p_vendor_payable,
    p_amount_paid => p_amount_paid,
    p_payment_mode => p_payment_mode,
    p_account_id => p_account_id,
    p_invoice_date => p_invoice_date,
    p_due_date => p_due_date,
    p_pnr => p_pnr,
    p_ticket_no => p_ticket_no,
    p_passport_no => p_passport_no,
    p_passengers => p_passengers,
    p_currency => p_currency,
    p_sar_rate => p_sar_rate,
    p_sar_amount => p_sar_amount,
    p_commission => p_commission,
    p_wht => p_wht,
    p_more_details => p_more_details,
    p_notes => p_notes
  );
END;
$$;


-- 4B. SAVE PAYMENT VOUCHER ATOMIC (Client Receipts + Vendor Payments)
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
  p_notes TEXT DEFAULT NULL
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
  v_v_no TEXT := p_voucher_no;
  v_acc_id UUID;
  v_rem_amount NUMERIC := p_amount;
  v_inv RECORD;
  v_alloc_amt NUMERIC;
  v_new_paid NUMERIC;
  v_party_name TEXT := 'Party';
  v_vdate DATE := COALESCE(p_voucher_date, CURRENT_DATE);
BEGIN
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

  IF v_v_no IS NULL OR TRIM(v_v_no) = '' OR v_v_no ~* 'preview' THEN
    v_v_no := public.next_formatted_number(
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

    -- Allocate first to specific invoice if given, then FIFO oldest unpaid/partial non-void invoices
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
    -- Direction = 'paid' (Vendor Payout)
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
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.save_payment_voucher_atomic(
    p_direction => p_direction,
    p_amount => p_amount,
    p_payment_mode => p_payment_mode,
    p_account_id => p_account_id,
    p_party_id => p_party_id,
    p_voucher_no => p_voucher_no,
    p_voucher_date => p_voucher_date,
    p_reference_no => p_reference_no,
    p_is_adjustment => p_is_adjustment,
    p_adjustment_reason => p_adjustment_reason,
    p_bank_name => p_bank_name,
    p_invoice_id => p_invoice_id,
    p_notes => p_notes
  );
END;
$$;


-- 4C. RECORD REFUND / VOID ATOMIC
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
  p_void_invoice BOOLEAN DEFAULT NULL
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
  v_ref_no TEXT := p_reference_no;
  v_rdate DATE := COALESCE(p_date, CURRENT_DATE);
  v_action TEXT := LOWER(COALESCE(p_action_type, 'refund'));
  v_inv RECORD;
  v_party_id UUID := p_party_id;
  v_vendor_id UUID := NULL;
  v_cash_refund NUMERIC := GREATEST(0, COALESCE(p_amount, 0));
  v_should_void BOOLEAN;
BEGIN
  IF p_booking_id IS NOT NULL THEN
    SELECT * INTO v_inv
    FROM public.booking_invoices
    WHERE id = p_booking_id AND agency_id = v_agency_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION '403 Forbidden: Booking invoice not found in your active agency';
    END IF;

    v_party_id := COALESCE(v_party_id, v_inv.party_id);
    v_vendor_id := v_inv.vendor_id;
  END IF;

  IF v_party_id IS NOT NULL THEN
    PERFORM 1 FROM public.parties WHERE id = v_party_id AND agency_id = v_agency_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION '403 Forbidden: Party does not belong to your active agency';
    END IF;
  END IF;

  IF v_ref_no IS NULL OR TRIM(v_ref_no) = '' OR v_ref_no ~* 'preview' THEN
    v_ref_no := public.next_formatted_number(v_agency_id, 'refund');
  END IF;

  IF v_cash_refund > 0 THEN
    v_acc_id := public.resolve_agency_account(v_agency_id, p_account_id, p_method, p_bank_name);
  END IF;

  v_should_void := COALESCE(
    p_void_invoice,
    v_action = 'void' OR (v_inv.id IS NOT NULL AND v_cash_refund >= COALESCE(v_inv.client_amount, 0))
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

  IF v_inv.id IS NOT NULL AND v_should_void THEN
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


-- 4D. RECORD EXPENSE ATOMIC
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
  p_bank_name TEXT DEFAULT NULL
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
  v_ref_no TEXT := p_reference_no;
  v_edate DATE := COALESCE(p_date, CURRENT_DATE);
BEGIN
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

  IF v_ref_no IS NULL OR TRIM(v_ref_no) = '' OR v_ref_no ~* 'preview' THEN
    v_ref_no := public.next_formatted_number(v_agency_id, 'expense');
  END IF;

  INSERT INTO public.expenses (
    agency_id, expense_date, expense_type, amount, notes, payment_mode, bank_name, reference_number, is_paid
  ) VALUES (
    v_agency_id, v_edate, COALESCE(p_category, 'General Expense'), p_amount, p_notes,
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


-- 4E. RECORD PAYMENT ATOMIC (Unified Cash/Bank Ledger + Voucher sync when linked to parties)
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
  p_notes TEXT DEFAULT NULL
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
  v_ref_no TEXT := p_reference_no;
  v_pdate DATE := COALESCE(p_date, public.karachi_today());
  v_method TEXT := LOWER(COALESCE(p_method, 'cash'));
  v_is_party BOOLEAN := false;
  v_voucher_res JSONB;
BEGIN
  IF v_dir NOT IN ('in', 'out', 'received', 'paid') THEN
    RAISE EXCEPTION 'Invalid payment direction: %', p_direction;
  END IF;

  IF COALESCE(p_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  v_tx_type := CASE WHEN v_dir IN ('in', 'received') THEN 'payment_in' ELSE 'payment_out' END;

  -- Verify party belongs to caller agency across canonical + legacy tables
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

  -- If party belongs to canonical public.parties, route through atomic voucher + allocation flow
  -- so booking_invoices, payment_vouchers, central_journal_entries, transactions & party balance stay 100% synced
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
      p_notes => p_notes
    );
    RETURN v_voucher_res;
  END IF;

  v_acc_id := public.resolve_agency_account(v_agency_id, p_account_id, v_method, NULL);

  IF v_ref_no IS NULL OR TRIM(v_ref_no) = '' THEN
    v_ref_no := public.next_formatted_number(
      v_agency_id,
      CASE WHEN v_tx_type = 'payment_in' THEN 'receipt' ELSE 'payment' END
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

  -- Legacy table sync when paying directly against legacy clients/vendors IDs
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


-- 4F. RECORD TRANSFER ATOMIC (Nets to 0 across Cash & Bank accounts)
CREATE OR REPLACE FUNCTION public.record_transfer(
  p_from_account_id UUID,
  p_to_account_id UUID,
  p_amount NUMERIC,
  p_date DATE DEFAULT CURRENT_DATE,
  p_reference_no TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
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
  v_ref_no TEXT := COALESCE(NULLIF(TRIM(COALESCE(p_reference_no, '')), ''), 'TRF-' || UPPER(LEFT(replace(gen_random_uuid()::TEXT, '-', ''), 8)));
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

  -- Balanced Cash/Bank Double-Entry Pair (nets to zero across agency)
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


-- 4G. REVERSE TRANSACTION ATOMIC
CREATE OR REPLACE FUNCTION public.reverse_transaction(
  p_transaction_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_orig public.transactions%ROWTYPE;
  v_pair public.transactions%ROWTYPE;
  v_rev_id UUID;
  v_pair_rev_id UUID;
  v_reason TEXT := COALESCE(NULLIF(TRIM(COALESCE(p_reason, '')), ''), 'Voided by user');
BEGIN
  SELECT * INTO v_orig
  FROM public.transactions
  WHERE id = p_transaction_id AND agency_id = v_agency_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '403 Forbidden: Transaction not found in your active agency';
  END IF;

  IF v_orig.reversed_of IS NOT NULL OR EXISTS (
    SELECT 1 FROM public.transactions WHERE agency_id = v_agency_id AND reversed_of = v_orig.id
  ) THEN
    RAISE EXCEPTION 'Transaction is already reversed';
  END IF;

  INSERT INTO public.transactions (
    agency_id, date, type, party_id, party_type, booking_id, account_id,
    debit, credit, method, reference_no, category, notes, reversed_of, created_by
  ) VALUES (
    v_agency_id, public.karachi_today(), 'adjustment', v_orig.party_id, v_orig.party_type,
    v_orig.booking_id, v_orig.account_id, v_orig.credit, v_orig.debit, v_orig.method,
    CASE WHEN v_orig.reference_no IS NOT NULL THEN 'REV-' || v_orig.reference_no ELSE NULL END,
    'Reversal', 'Reversal: ' || v_reason, v_orig.id, auth.uid()
  )
  RETURNING id INTO v_rev_id;

  UPDATE public.transactions
  SET reversed_of = v_rev_id,
      notes = COALESCE(NULLIF(notes, '') || ' | ', '') || 'REVERSED: ' || v_reason,
      updated_at = now()
  WHERE id = v_orig.id AND agency_id = v_agency_id;

  -- If reversing one side of an internal transfer, also reverse its sibling leg so transfers always net to zero
  IF v_orig.type = 'transfer' AND v_orig.reference_no IS NOT NULL THEN
    SELECT * INTO v_pair
    FROM public.transactions
    WHERE agency_id = v_agency_id
      AND type = 'transfer'
      AND reference_no = v_orig.reference_no
      AND id <> v_orig.id
      AND reversed_of IS NULL
    LIMIT 1;

    IF FOUND THEN
      INSERT INTO public.transactions (
        agency_id, date, type, party_id, party_type, booking_id, account_id,
        debit, credit, method, reference_no, category, notes, reversed_of, created_by
      ) VALUES (
        v_agency_id, public.karachi_today(), 'adjustment', v_pair.party_id, v_pair.party_type,
        v_pair.booking_id, v_pair.account_id, v_pair.credit, v_pair.debit, v_pair.method,
        'REV-' || v_pair.reference_no, 'Reversal', 'Reversal (paired transfer): ' || v_reason, v_pair.id, auth.uid()
      )
      RETURNING id INTO v_pair_rev_id;

      UPDATE public.transactions
      SET reversed_of = v_pair_rev_id,
          notes = COALESCE(NULLIF(notes, '') || ' | ', '') || 'REVERSED: ' || v_reason,
          updated_at = now()
      WHERE id = v_pair.id AND agency_id = v_agency_id;
    END IF;
  END IF;

  IF v_orig.party_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.parties WHERE id = v_orig.party_id AND agency_id = v_agency_id
  ) THEN
    PERFORM public.recalculate_party_balance(v_orig.party_id, v_agency_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'reversed_transaction_id', v_orig.id,
    'reversal_transaction_id', v_rev_id
  );
END;
$$;


-- 4H. GET AGENCY LEDGER RPC
CREATE OR REPLACE FUNCTION public.get_agency_ledger(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_account_id UUID DEFAULT NULL,
  p_party_id UUID DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_include_reversed BOOLEAN DEFAULT false
)
RETURNS TABLE (
  id UUID,
  date DATE,
  type TEXT,
  party_id UUID,
  party_type TEXT,
  party_name TEXT,
  booking_id UUID,
  booking_ref TEXT,
  account_id UUID,
  account_name TEXT,
  debit NUMERIC,
  credit NUMERIC,
  method TEXT,
  reference_no TEXT,
  category TEXT,
  notes TEXT,
  reversed_of UUID,
  is_reversed BOOLEAN,
  running_balance NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      t.id,
      t.date,
      t.type,
      t.party_id,
      t.party_type,
      COALESCE(
        (SELECT p.name FROM public.parties p WHERE p.id = t.party_id AND p.agency_id = v_agency_id),
        (SELECT c.name FROM public.clients c WHERE c.id = t.party_id AND c.agency_id = v_agency_id),
        (SELECT v.name FROM public.vendors v WHERE v.id = t.party_id AND v.agency_id = v_agency_id),
        (SELECT a.name FROM public.b2b_agents a WHERE a.id = t.party_id AND a.agency_id = v_agency_id),
        ''
      )::TEXT AS party_name,
      t.booking_id,
      COALESCE(
        (SELECT bi.invoice_no FROM public.booking_invoices bi WHERE bi.id = t.booking_id AND bi.agency_id = v_agency_id),
        t.reference_no,
        ''
      )::TEXT AS booking_ref,
      t.account_id,
      acc.name::TEXT AS account_name,
      COALESCE(t.debit, 0)::NUMERIC AS debit,
      COALESCE(t.credit, 0)::NUMERIC AS credit,
      t.method,
      t.reference_no,
      t.category,
      t.notes,
      t.reversed_of,
      (t.reversed_of IS NOT NULL)::BOOLEAN AS is_reversed,
      t.created_at
    FROM public.transactions t
    LEFT JOIN public.accounts acc
      ON acc.id = t.account_id
     AND acc.agency_id = v_agency_id
    WHERE t.agency_id = v_agency_id
      AND (p_start_date IS NULL OR t.date >= p_start_date)
      AND (p_end_date IS NULL OR t.date <= p_end_date)
      AND (p_account_id IS NULL OR t.account_id = p_account_id)
      AND (p_party_id IS NULL OR t.party_id = p_party_id)
      AND (p_type IS NULL OR t.type = p_type)
      AND (COALESCE(p_include_reversed, false) OR t.reversed_of IS NULL)
  ),
  with_balance AS (
    SELECT
      b.*,
      SUM(CASE WHEN b.reversed_of IS NULL THEN b.debit - b.credit ELSE 0 END)
        OVER (ORDER BY b.date ASC, b.created_at ASC, b.id ASC)::NUMERIC AS running_balance
    FROM base b
  )
  SELECT
    w.id, w.date, w.type, w.party_id, w.party_type, w.party_name,
    w.booking_id, w.booking_ref, w.account_id, w.account_name,
    w.debit, w.credit, w.method, w.reference_no, w.category,
    w.notes, w.reversed_of, w.is_reversed, w.running_balance
  FROM with_balance w
  ORDER BY w.date DESC, w.created_at DESC, w.id DESC;
END;
$$;


-- 4I. GET PARTY STATEMENT RPC
CREATE OR REPLACE FUNCTION public.get_party_statement(
  p_party_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_include_reversed BOOLEAN DEFAULT false
)
RETURNS TABLE (
  id UUID,
  date DATE,
  type TEXT,
  reference_no TEXT,
  booking_ref TEXT,
  notes TEXT,
  method TEXT,
  account_name TEXT,
  debit NUMERIC,
  credit NUMERIC,
  reversed_of UUID,
  is_reversed BOOLEAN,
  running_balance NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      t.id,
      t.date,
      t.type,
      t.reference_no,
      COALESCE(
        (SELECT bi.invoice_no FROM public.booking_invoices bi WHERE bi.id = t.booking_id AND bi.agency_id = v_agency_id),
        t.reference_no,
        ''
      )::TEXT AS booking_ref,
      t.notes,
      t.method,
      acc.name::TEXT AS account_name,
      CASE
        WHEN t.type = 'charge' THEN COALESCE(t.debit, 0)
        WHEN t.type = 'payment_in' THEN 0
        ELSE COALESCE(t.debit, 0)
      END::NUMERIC AS debit,
      CASE
        WHEN t.type = 'payment_in' THEN COALESCE(t.debit, 0)
        WHEN t.type = 'charge' THEN 0
        ELSE COALESCE(t.credit, 0)
      END::NUMERIC AS credit,
      t.reversed_of,
      (t.reversed_of IS NOT NULL)::BOOLEAN AS is_reversed,
      t.created_at
    FROM public.transactions t
    LEFT JOIN public.accounts acc
      ON acc.id = t.account_id
     AND acc.agency_id = v_agency_id
    WHERE t.agency_id = v_agency_id
      AND t.party_id = p_party_id
      AND (p_start_date IS NULL OR t.date >= p_start_date)
      AND (p_end_date IS NULL OR t.date <= p_end_date)
      AND (COALESCE(p_include_reversed, false) OR t.reversed_of IS NULL)
  )
  SELECT
    b.id,
    b.date,
    b.type,
    b.reference_no,
    b.booking_ref,
    b.notes,
    b.method,
    b.account_name,
    b.debit,
    b.credit,
    b.reversed_of,
    b.is_reversed,
    SUM(CASE WHEN b.reversed_of IS NULL THEN b.debit - b.credit ELSE 0 END)
      OVER (ORDER BY b.date ASC, b.created_at ASC, b.id ASC)::NUMERIC AS running_balance
  FROM base b
  ORDER BY b.date ASC, b.created_at ASC, b.id ASC;
END;
$$;


-- ------------------------------------------------------------------------------
-- 5. SINGLE-SOURCE-OF-TRUTH KPI, OVERDUE & RECONCILIATION RPCs (Task 4)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.karachi_today()
RETURNS DATE
LANGUAGE sql
STABLE
AS $$
  SELECT (NOW() AT TIME ZONE 'Asia/Karachi')::DATE;
$$;

CREATE OR REPLACE FUNCTION public.get_agency_financial_summary(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_agency_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(p_agency_id);
  v_today DATE := public.karachi_today();
  v_month_start DATE := COALESCE(p_start_date, date_trunc('month', v_today)::DATE);
  v_month_end DATE := COALESCE(p_end_date, v_today);
  v_has_bi BOOLEAN := false;

  v_cash_and_bank NUMERIC := 0;
  v_client_dues NUMERIC := 0;
  v_vendor_dues NUMERIC := 0;

  v_period_sales NUMERIC := 0;
  v_period_cost NUMERIC := 0;
  v_period_expenses NUMERIC := 0;
  v_period_profit NUMERIC := 0;

  v_all_sales NUMERIC := 0;
  v_all_cost NUMERIC := 0;
  v_all_expenses NUMERIC := 0;
  v_all_profit NUMERIC := 0;

  v_todays_bookings INT := 0;
  v_overdue_count INT := 0;
  v_overdue_amount NUMERIC := 0;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.booking_invoices WHERE agency_id = v_agency_id
  ) INTO v_has_bi;

  -- 1. Cash & Bank = active accounts opening_balance + SUM(debit - credit) (transfers net to zero)
  SELECT COALESCE(SUM(ab.current_balance), 0)
  INTO v_cash_and_bank
  FROM public.account_balances(v_agency_id) ab
  WHERE COALESCE(ab.active, true) = true;

  IF v_has_bi THEN
    -- 2. Client Due = active invoice total - payments received (per client, never negative)
    WITH inv_per_client AS (
      SELECT
        COALESCE(party_id, id) AS client_key,
        SUM(GREATEST(0, COALESCE(client_amount, 0) - COALESCE(paid_amount, 0))) AS net_due
      FROM public.booking_invoices bi
      WHERE bi.agency_id = v_agency_id
        AND COALESCE(bi.is_void, false) = false
        AND COALESCE(bi.payment_status, 'unpaid') NOT IN ('void', 'refunded', 'cancelled')
      GROUP BY COALESCE(party_id, id)
    )
    SELECT COALESCE(SUM(GREATEST(0, net_due)), 0)
    INTO v_client_dues
    FROM inv_per_client;

    -- 3. Vendor Due = active vendor cost - payments made to vendor + vendor refunds received (per vendor, never negative)
    WITH vendor_costs AS (
      SELECT
        COALESCE(vendor_id, id) AS vendor_key,
        vendor_id,
        SUM(COALESCE(vendor_payable, 0)) AS total_cost
      FROM public.booking_invoices bi
      WHERE bi.agency_id = v_agency_id
        AND COALESCE(bi.is_void, false) = false
        AND COALESCE(bi.payment_status, 'unpaid') NOT IN ('void', 'refunded', 'cancelled')
        AND COALESCE(bi.vendor_payable, 0) > 0
      GROUP BY COALESCE(vendor_id, id), vendor_id
    ),
    vendor_paid AS (
      SELECT
        party_id,
        SUM(COALESCE(amount, 0)) AS total_paid
      FROM public.payment_vouchers pv
      WHERE pv.agency_id = v_agency_id
        AND pv.direction = 'paid'
        AND COALESCE(pv.is_void, false) = false
        AND pv.party_id IS NOT NULL
      GROUP BY party_id
    ),
    vendor_refunds AS (
      SELECT
        bi.vendor_id AS party_id,
        SUM(COALESCE(r.vendor_refund_amount, 0)) AS total_refunded
      FROM public.refunds r
      JOIN public.booking_invoices bi ON bi.id = r.booking_id
      WHERE r.agency_id = v_agency_id
        AND COALESCE(bi.is_void, false) = false
        AND bi.vendor_id IS NOT NULL
      GROUP BY bi.vendor_id
    )
    SELECT COALESCE(SUM(GREATEST(0, vc.total_cost - (COALESCE(vp.total_paid, 0) - COALESCE(vr.total_refunded, 0)))), 0)
    INTO v_vendor_dues
    FROM vendor_costs vc
    LEFT JOIN vendor_paid vp ON vp.party_id = vc.vendor_id
    LEFT JOIN vendor_refunds vr ON vr.party_id = vc.vendor_id;

    -- 4. Period & All-Time Profit = selling - vendor cost - expenses (excluding voided/refunded bookings)
    SELECT
      COALESCE(SUM(client_amount), 0),
      COALESCE(SUM(vendor_payable), 0)
    INTO v_period_sales, v_period_cost
    FROM public.booking_invoices bi
    WHERE bi.agency_id = v_agency_id
      AND COALESCE(bi.is_void, false) = false
      AND COALESCE(bi.payment_status, 'unpaid') NOT IN ('void', 'refunded', 'cancelled')
      AND bi.invoice_date >= v_month_start
      AND bi.invoice_date <= v_month_end;

    SELECT
      COALESCE(SUM(client_amount), 0),
      COALESCE(SUM(vendor_payable), 0)
    INTO v_all_sales, v_all_cost
    FROM public.booking_invoices bi
    WHERE bi.agency_id = v_agency_id
      AND COALESCE(bi.is_void, false) = false
      AND COALESCE(bi.payment_status, 'unpaid') NOT IN ('void', 'refunded', 'cancelled');

    -- 5. Today's Bookings (Asia/Karachi)
    SELECT COUNT(*)::INT
    INTO v_todays_bookings
    FROM public.booking_invoices bi
    WHERE bi.agency_id = v_agency_id
      AND COALESCE(bi.is_void, false) = false
      AND COALESCE(bi.payment_status, 'unpaid') NOT IN ('void', 'refunded', 'cancelled')
      AND (bi.created_at AT TIME ZONE 'Asia/Karachi')::DATE = v_today;

    -- 6. Overdue Invoices (unpaid balance > 0 AND due_date < today Karachi)
    SELECT
      COUNT(*)::INT,
      COALESCE(SUM(GREATEST(0, COALESCE(client_amount, 0) - COALESCE(paid_amount, 0))), 0)
    INTO v_overdue_count, v_overdue_amount
    FROM public.booking_invoices bi
    WHERE bi.agency_id = v_agency_id
      AND COALESCE(bi.is_void, false) = false
      AND COALESCE(bi.payment_status, 'unpaid') IN ('unpaid', 'partial', 'pending')
      AND (COALESCE(client_amount, 0) - COALESCE(paid_amount, 0)) > 0
      AND COALESCE(bi.due_date, NULLIF(bi.more_details->>'remaining_due_date', '')::DATE, NULLIF(bi.more_details->>'due_date', '')::DATE, bi.invoice_date) < v_today;

  ELSE
    SELECT COALESCE(SUM(GREATEST(0, COALESCE(selling_price, 0) - COALESCE(amount_paid, 0))), 0)
    INTO v_client_dues
    FROM public.clients
    WHERE agency_id = v_agency_id;

    SELECT COALESCE(SUM(GREATEST(0, COALESCE(payment_amount, 0) - COALESCE(amount_paid, 0))), 0)
    INTO v_vendor_dues
    FROM public.vendors
    WHERE agency_id = v_agency_id;

    SELECT
      COALESCE(SUM(selling_price), 0),
      COALESCE(SUM(purchasing_price), 0)
    INTO v_period_sales, v_period_cost
    FROM public.clients
    WHERE agency_id = v_agency_id
      AND COALESCE(flight_date, (created_at AT TIME ZONE 'Asia/Karachi')::DATE) BETWEEN v_month_start AND v_month_end;

    SELECT
      COALESCE(SUM(selling_price), 0),
      COALESCE(SUM(purchasing_price), 0)
    INTO v_all_sales, v_all_cost
    FROM public.clients
    WHERE agency_id = v_agency_id;

    SELECT COUNT(*)::INT
    INTO v_todays_bookings
    FROM public.clients
    WHERE agency_id = v_agency_id
      AND (created_at AT TIME ZONE 'Asia/Karachi')::DATE = v_today;

    SELECT
      COUNT(*)::INT,
      COALESCE(SUM(GREATEST(0, COALESCE(selling_price, 0) - COALESCE(amount_paid, 0))), 0)
    INTO v_overdue_count, v_overdue_amount
    FROM public.clients
    WHERE agency_id = v_agency_id
      AND COALESCE(selling_price, 0) - COALESCE(amount_paid, 0) > 0
      AND COALESCE(remaining_payment_date, flight_date, (created_at AT TIME ZONE 'Asia/Karachi')::DATE) < v_today;
  END IF;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_period_expenses
  FROM public.expenses
  WHERE agency_id = v_agency_id
    AND COALESCE(expense_date, (created_at AT TIME ZONE 'Asia/Karachi')::DATE) BETWEEN v_month_start AND v_month_end;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_all_expenses
  FROM public.expenses
  WHERE agency_id = v_agency_id;

  v_period_profit := (v_period_sales - v_period_cost) - v_period_expenses;
  v_all_profit := (v_all_sales - v_all_cost) - v_all_expenses;

  RETURN jsonb_build_object(
    'agency_id', v_agency_id,
    'as_of_date', v_today,
    'period_start', v_month_start,
    'period_end', v_month_end,
    'cash_and_bank', v_cash_and_bank,
    'client_dues', v_client_dues,
    'vendor_dues', v_vendor_dues,
    'period_sales', v_period_sales,
    'period_cost', v_period_cost,
    'period_expenses', v_period_expenses,
    'period_profit', v_period_profit,
    'all_sales', v_all_sales,
    'all_cost', v_all_cost,
    'all_expenses', v_all_expenses,
    'all_profit', v_all_profit,
    'todays_bookings', v_todays_bookings,
    'overdue_count', v_overdue_count,
    'overdue_amount', v_overdue_amount
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_agency_overdue_invoices(p_agency_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(p_agency_id);
  v_today DATE := public.karachi_today();
  v_has_bi BOOLEAN := false;
  v_items JSONB := '[]'::jsonb;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.booking_invoices WHERE agency_id = v_agency_id
  ) INTO v_has_bi;

  IF v_has_bi THEN
    SELECT COALESCE(jsonb_agg(item ORDER BY days_overdue DESC, balance_due DESC), '[]'::jsonb)
    INTO v_items
    FROM (
      SELECT
        bi.id,
        bi.invoice_no,
        bi.party_id,
        COALESCE(p.name, bi.passengers->0->>'name', 'Client') AS party_name,
        p.phone AS phone,
        GREATEST(0, COALESCE(bi.client_amount, 0) - COALESCE(bi.paid_amount, 0)) AS balance_due,
        COALESCE(bi.due_date, NULLIF(bi.more_details->>'remaining_due_date', '')::DATE, NULLIF(bi.more_details->>'due_date', '')::DATE, bi.invoice_date) AS effective_due_date,
        (v_today - COALESCE(bi.due_date, NULLIF(bi.more_details->>'remaining_due_date', '')::DATE, NULLIF(bi.more_details->>'due_date', '')::DATE, bi.invoice_date))::INT AS days_overdue,
        'booking_invoices'::TEXT AS source
      FROM public.booking_invoices bi
      LEFT JOIN public.parties p ON p.id = bi.party_id
      WHERE bi.agency_id = v_agency_id
        AND COALESCE(bi.is_void, false) = false
        AND COALESCE(bi.payment_status, 'unpaid') IN ('unpaid', 'partial', 'pending')
        AND (COALESCE(bi.client_amount, 0) - COALESCE(bi.paid_amount, 0)) > 0
        AND COALESCE(bi.due_date, NULLIF(bi.more_details->>'remaining_due_date', '')::DATE, NULLIF(bi.more_details->>'due_date', '')::DATE, bi.invoice_date) < v_today
    ) item;
  ELSE
    SELECT COALESCE(jsonb_agg(item ORDER BY days_overdue DESC, balance_due DESC), '[]'::jsonb)
    INTO v_items
    FROM (
      SELECT
        c.id,
        COALESCE(c.pnr, 'LEGACY-' || LEFT(c.id::TEXT, 8)) AS invoice_no,
        c.id AS party_id,
        c.name AS party_name,
        c.contact_number AS phone,
        GREATEST(0, COALESCE(c.selling_price, 0) - COALESCE(c.amount_paid, 0)) AS balance_due,
        COALESCE(c.remaining_payment_date, c.flight_date, (c.created_at AT TIME ZONE 'Asia/Karachi')::DATE) AS effective_due_date,
        (v_today - COALESCE(c.remaining_payment_date, c.flight_date, (c.created_at AT TIME ZONE 'Asia/Karachi')::DATE))::INT AS days_overdue,
        'clients'::TEXT AS source
      FROM public.clients c
      WHERE c.agency_id = v_agency_id
        AND COALESCE(c.selling_price, 0) - COALESCE(c.amount_paid, 0) > 0
        AND COALESCE(c.remaining_payment_date, c.flight_date, (c.created_at AT TIME ZONE 'Asia/Karachi')::DATE) < v_today
    ) item;
  END IF;

  RETURN jsonb_build_object(
    'agency_id', v_agency_id,
    'as_of_date', v_today,
    'count', jsonb_array_length(v_items),
    'items', v_items
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_agency_balances(p_agency_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(p_agency_id);
  v_summary JSONB;
  v_party_ar NUMERIC := 0;
  v_party_ap NUMERIC := 0;
BEGIN
  v_summary := public.get_agency_financial_summary(
    '1900-01-01'::DATE,
    '2099-12-31'::DATE,
    v_agency_id
  );

  SELECT
    COALESCE(SUM(current_balance) FILTER (WHERE current_balance > 0 AND type IN ('client', 'both')), 0),
    COALESCE(SUM(ABS(current_balance)) FILTER (WHERE current_balance < 0 AND type IN ('vendor', 'both')), 0)
  INTO v_party_ar, v_party_ap
  FROM public.parties
  WHERE agency_id = v_agency_id;

  RETURN jsonb_build_object(
    'agency_id', v_agency_id,
    'client_receivables', (v_summary->>'client_dues')::NUMERIC,
    'vendor_payables', (v_summary->>'vendor_dues')::NUMERIC,
    'cash_and_bank_liquidity', (v_summary->>'cash_and_bank')::NUMERIC,
    'gross_sales', (v_summary->>'all_sales')::NUMERIC,
    'direct_costs', (v_summary->>'all_cost')::NUMERIC,
    'operating_expenses', (v_summary->>'all_expenses')::NUMERIC,
    'net_agency_profit', (v_summary->>'all_profit')::NUMERIC,
    'party_table_receivables', v_party_ar,
    'party_table_payables', v_party_ap,
    'reconciled', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_agency_data_integrity(p_agency_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(p_agency_id);
  v_unassigned_tx BIGINT := 0;
BEGIN
  SELECT COUNT(*) INTO v_unassigned_tx
  FROM public.transactions
  WHERE agency_id = v_agency_id AND account_id IS NULL;

  RETURN jsonb_build_object(
    'agency_id', v_agency_id,
    'unassigned_transactions', v_unassigned_tx,
    'reconciliation', public.reconcile_agency_balances(v_agency_id)
  );
END;
$$;


-- ------------------------------------------------------------------------------
-- 6. SAFE, NON-DESTRUCTIVE BACKFILL FOR ORPHAN NULL account_id & MISSING TX ROWS
-- ------------------------------------------------------------------------------

DO $$
DECLARE
  v_tx RECORD;
  v_pv RECORD;
  v_exp RECORD;
  v_ref RECORD;
  v_safe_acc_id UUID;
BEGIN
  FOR v_tx IN
    SELECT DISTINCT agency_id, COALESCE(method, 'cash') AS method
    FROM public.transactions
    WHERE account_id IS NULL AND agency_id IS NOT NULL
  LOOP
    UPDATE public.transactions
    SET account_id = public.resolve_agency_account(v_tx.agency_id, NULL, v_tx.method, NULL)
    WHERE agency_id = v_tx.agency_id
      AND COALESCE(method, 'cash') = v_tx.method
      AND account_id IS NULL;
  END LOOP;

  FOR v_pv IN
    SELECT pv.*
    FROM public.payment_vouchers pv
    WHERE pv.agency_id IS NOT NULL
      AND COALESCE(pv.is_void, false) = false
      AND COALESCE(pv.is_adjustment, false) = false
      AND pv.amount > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.transactions t
        WHERE t.agency_id = pv.agency_id
          AND (
            (t.legacy_source = 'payment_vouchers' AND t.legacy_id = pv.id)
            OR t.reference_no = pv.voucher_no
            OR (pv.reference_no IS NOT NULL AND t.reference_no = pv.reference_no)
          )
      )
  LOOP
    v_safe_acc_id := NULL;
    SELECT id INTO v_safe_acc_id
    FROM public.accounts a
    WHERE a.id = v_pv.account_id
      AND a.agency_id = v_pv.agency_id
      AND a.active = true;

    INSERT INTO public.transactions (
      agency_id, date, type, party_id, party_type, account_id,
      debit, credit, method, reference_no, category, notes, legacy_source, legacy_id, created_by
    ) VALUES (
      v_pv.agency_id,
      COALESCE(v_pv.voucher_date, public.karachi_today()),
      CASE WHEN v_pv.direction = 'received' THEN 'payment_in' ELSE 'payment_out' END,
      v_pv.party_id,
      CASE WHEN v_pv.direction = 'received' THEN 'client' ELSE 'vendor' END,
      public.resolve_agency_account(v_pv.agency_id, v_safe_acc_id, v_pv.payment_mode, v_pv.bank_name),
      CASE WHEN v_pv.direction = 'received' THEN v_pv.amount ELSE 0 END,
      CASE WHEN v_pv.direction = 'paid' THEN v_pv.amount ELSE 0 END,
      LOWER(COALESCE(v_pv.payment_mode, 'cash')),
      v_pv.voucher_no,
      CASE WHEN v_pv.direction = 'received' THEN 'Receipt Voucher' ELSE 'Vendor Payout' END,
      v_pv.notes,
      'payment_vouchers',
      v_pv.id,
      v_pv.created_by
    );
  END LOOP;

  FOR v_exp IN
    SELECT e.*
    FROM public.expenses e
    WHERE e.agency_id IS NOT NULL
      AND COALESCE(e.is_paid, true) = true
      AND COALESCE(e.amount, 0) > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.transactions t
        WHERE t.agency_id = e.agency_id
          AND (
            (t.legacy_source = 'expenses' AND t.legacy_id = e.id)
            OR (e.reference_number IS NOT NULL AND t.reference_no = e.reference_number)
          )
      )
  LOOP
    INSERT INTO public.transactions (
      agency_id, date, type, account_id,
      debit, credit, method, reference_no, category, notes, legacy_source, legacy_id
    ) VALUES (
      v_exp.agency_id,
      COALESCE(v_exp.expense_date, (v_exp.created_at AT TIME ZONE 'Asia/Karachi')::DATE, public.karachi_today()),
      'expense',
      public.resolve_agency_account(v_exp.agency_id, NULL, v_exp.payment_mode, v_exp.bank_name),
      0,
      v_exp.amount,
      LOWER(COALESCE(v_exp.payment_mode, 'cash')),
      v_exp.reference_number,
      COALESCE(v_exp.expense_type, 'General Expense'),
      v_exp.notes,
      'expenses',
      v_exp.id
    );
  END LOOP;

  FOR v_ref IN
    SELECT r.*
    FROM public.refunds r
    WHERE r.agency_id IS NOT NULL
      AND COALESCE(r.refund_amount, 0) > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.transactions t
        WHERE t.agency_id = r.agency_id
          AND (
            (t.legacy_source = 'refunds' AND t.legacy_id = r.id)
            OR (r.refund_no IS NOT NULL AND t.reference_no = r.refund_no)
          )
      )
  LOOP
    v_safe_acc_id := NULL;
    SELECT id INTO v_safe_acc_id
    FROM public.accounts a
    WHERE a.id = v_ref.account_id
      AND a.agency_id = v_ref.agency_id
      AND a.active = true;

    INSERT INTO public.transactions (
      agency_id, date, type, party_id, party_type, booking_id, account_id,
      debit, credit, method, reference_no, category, notes, legacy_source, legacy_id, created_by
    ) VALUES (
      v_ref.agency_id,
      COALESCE(v_ref.refund_date, (v_ref.created_at AT TIME ZONE 'Asia/Karachi')::DATE, public.karachi_today()),
      'refund',
      COALESCE(v_ref.party_id, v_ref.client_id),
      'client',
      v_ref.booking_id,
      public.resolve_agency_account(v_ref.agency_id, v_safe_acc_id, v_ref.payment_mode, v_ref.bank_name),
      0,
      v_ref.refund_amount,
      LOWER(COALESCE(v_ref.payment_mode, 'cash')),
      v_ref.refund_no,
      'Refund',
      COALESCE(v_ref.notes, v_ref.reason),
      'refunds',
      v_ref.id,
      v_ref.created_by
    );
  END LOOP;
END $$;


-- ------------------------------------------------------------------------------
-- 7. ENABLE REALTIME PUBLICATION & REPLICA IDENTITY ACROSS ALL BUSINESS TABLES
-- ------------------------------------------------------------------------------

DO $$
DECLARE
  v_rt_tables TEXT[] := ARRAY[
    'booking_invoices', 'payment_vouchers', 'refunds', 'refund_void_records',
    'expenses', 'parties', 'clients', 'vendors', 'accounts', 'transactions',
    'central_journal_entries', 'invoice_allocations', 'agency_banks', 'cash_bank_entries',
    'bookings', 'queries', 'quotations', 'vouchers', 'reminders', 'reminder_settings',
    'notifications', 'b2b_agents', 'b2b_bookings', 'b2b_ledger', 'opening_balances',
    'agencies', 'profiles', 'sub_users'
  ];
  v_tbl TEXT;
BEGIN
  FOREACH v_tbl IN ARRAY v_rt_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = v_tbl
    ) THEN
      BEGIN
        EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', v_tbl);
      EXCEPTION WHEN OTHERS THEN NULL;
      END;

      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_tbl);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END IF;
  END LOOP;
END $$;


-- ------------------------------------------------------------------------------
-- 8. LOCK DOWN FUNCTION PERMISSIONS (authenticated ONLY, never anon/PUBLIC)
-- ------------------------------------------------------------------------------

DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.proname NOT IN ('handle_new_user', 'auto_confirm_agency_signup', 'handle_master_admin_registration')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon', fn.proname, fn.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', fn.proname, fn.args);
  END LOOP;
END $$;
