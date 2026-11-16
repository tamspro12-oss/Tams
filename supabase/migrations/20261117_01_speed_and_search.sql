-- ==============================================================================
-- TAMS PRO — ADDITIVE SPEED, IDEMPOTENCY, ATOMIC SAVES & GLOBAL SEARCH MIGRATION
-- File: supabase/migrations/20261117_01_speed_and_search.sql
--
-- RULES:
--   - 100% ADDITIVE ONLY (never deletes, renames, or overwrites existing user data)
--   - Idempotent and runs inside a single transaction (BEGIN ... COMMIT)
--   - Safe re-run without side effects
--   - Strictly isolates tenant agencies and sub-user module permissions
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS & ADDITIVE COLUMNS / IDEMPOTENCY LOG
-- ------------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Ensure optional conversion / compatibility columns exist additively
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS converted_booking_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- Idempotency deduplication table (scoped per agency + client request_id UUID)
CREATE TABLE IF NOT EXISTS public.save_idempotency_logs (
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  operation TEXT NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (agency_id, request_id)
);

ALTER TABLE public.save_idempotency_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "save_idempotency_logs_agency_select" ON public.save_idempotency_logs;
CREATE POLICY "save_idempotency_logs_agency_select"
  ON public.save_idempotency_logs FOR SELECT TO authenticated
  USING (
    agency_id = public.current_user_agency_id()
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

-- Internal helper: lock + check cached idempotent response within transaction
CREATE OR REPLACE FUNCTION public._idempotency_check(
  p_agency_id UUID,
  p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cached JSONB;
BEGIN
  IF p_agency_id IS NULL OR p_request_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Serialize concurrent identical request_id retries within the same agency
  PERFORM pg_advisory_xact_lock(
    hashtext('idemp:' || p_agency_id::text || ':' || p_request_id::text)
  );

  SELECT response INTO v_cached
  FROM public.save_idempotency_logs
  WHERE agency_id = p_agency_id
    AND request_id = p_request_id;

  IF FOUND THEN
    RETURN v_cached || jsonb_build_object('idempotent_replay', true);
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public._idempotency_store(
  p_agency_id UUID,
  p_request_id UUID,
  p_operation TEXT,
  p_response JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_agency_id IS NULL OR p_request_id IS NULL OR p_response IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.save_idempotency_logs (agency_id, request_id, operation, response)
  VALUES (p_agency_id, p_request_id, COALESCE(p_operation, 'save'), p_response)
  ON CONFLICT (agency_id, request_id) DO NOTHING;
END;
$$;


-- ------------------------------------------------------------------------------
-- 2. ADDITIVE PERFORMANCE & SEARCH INDEXES (FAST QUERIES, RLS & GLOBAL SEARCH)
-- ------------------------------------------------------------------------------

-- RLS & auth helper fast lookups
CREATE INDEX IF NOT EXISTS idx_sub_users_user_active
  ON public.sub_users (user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_sub_users_agency_active
  ON public.sub_users (agency_id, is_active);

CREATE INDEX IF NOT EXISTS idx_profiles_agency_id
  ON public.profiles (agency_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_role
  ON public.user_roles (user_id, role);

-- Booking invoices composite indexes (listing newest first, balances, allocations)
CREATE INDEX IF NOT EXISTS idx_booking_invoices_agency_created
  ON public.booking_invoices (agency_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_booking_invoices_agency_date_created
  ON public.booking_invoices (agency_id, invoice_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_booking_invoices_party_status
  ON public.booking_invoices (agency_id, party_id, payment_status, invoice_date);

CREATE INDEX IF NOT EXISTS idx_booking_invoices_vendor_void
  ON public.booking_invoices (agency_id, vendor_id, is_void);

CREATE INDEX IF NOT EXISTS idx_booking_invoices_passport
  ON public.booking_invoices (agency_id, passport_no);

-- Payment vouchers composite indexes
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_agency_date_created
  ON public.payment_vouchers (agency_id, voucher_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_vouchers_party_direction
  ON public.payment_vouchers (agency_id, party_id, direction)
  WHERE COALESCE(is_void, false) = false;

CREATE INDEX IF NOT EXISTS idx_payment_vouchers_agency_account
  ON public.payment_vouchers (agency_id, account_id);

-- Allocations & ledger speed
CREATE INDEX IF NOT EXISTS idx_invoice_allocations_agency_invoice
  ON public.invoice_allocations (agency_id, invoice_id);

CREATE INDEX IF NOT EXISTS idx_invoice_allocations_agency_voucher
  ON public.invoice_allocations (agency_id, voucher_id);

CREATE INDEX IF NOT EXISTS idx_central_journal_invoice
  ON public.central_journal_entries (agency_id, invoice_id);

CREATE INDEX IF NOT EXISTS idx_central_journal_voucher
  ON public.central_journal_entries (agency_id, voucher_id);

CREATE INDEX IF NOT EXISTS idx_central_journal_account_date
  ON public.central_journal_entries (agency_id, account_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_agency_date_created
  ON public.transactions (agency_id, date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_agency_booking
  ON public.transactions (agency_id, booking_id);

-- Refunds, expenses, parties, legacy tables & idempotency
CREATE INDEX IF NOT EXISTS idx_refunds_agency_booking
  ON public.refunds (agency_id, booking_id);

CREATE INDEX IF NOT EXISTS idx_refunds_agency_party
  ON public.refunds (agency_id, party_id);

CREATE INDEX IF NOT EXISTS idx_refunds_agency_date_created
  ON public.refunds (agency_id, refund_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_refunds_agency_refund_no
  ON public.refunds (agency_id, refund_no);

CREATE INDEX IF NOT EXISTS idx_expenses_agency_date_created
  ON public.expenses (agency_id, expense_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_parties_agency_created
  ON public.parties (agency_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clients_agency_created
  ON public.clients (agency_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clients_agency_passport
  ON public.clients (agency_id, passport_number);

CREATE INDEX IF NOT EXISTS idx_clients_agency_phone
  ON public.clients (agency_id, contact_number);

CREATE INDEX IF NOT EXISTS idx_vendors_agency_created
  ON public.vendors (agency_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_agency_number
  ON public.invoices (agency_id, invoice_number);

CREATE INDEX IF NOT EXISTS idx_invoices_agency_created
  ON public.invoices (agency_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_save_idempotency_created
  ON public.save_idempotency_logs (created_at DESC);

-- Trigram GIN indexes (schema-safe search_path supporting both public and extensions)
DO $$
BEGIN
  PERFORM set_config('search_path', 'public, extensions', true);

  -- Parties searched columns
  CREATE INDEX IF NOT EXISTS idx_parties_trgm_name ON public.parties USING gin (name gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS idx_parties_trgm_code ON public.parties USING gin (code gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS idx_parties_trgm_phone ON public.parties USING gin (phone gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS idx_parties_trgm_whatsapp ON public.parties USING gin (whatsapp gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS idx_parties_trgm_passport ON public.parties USING gin (passport gin_trgm_ops);

  -- Booking invoices searched columns
  CREATE INDEX IF NOT EXISTS idx_booking_invoices_trgm_no ON public.booking_invoices USING gin (invoice_no gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS idx_booking_invoices_trgm_pnr ON public.booking_invoices USING gin (pnr gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS idx_booking_invoices_trgm_ticket ON public.booking_invoices USING gin (ticket_no gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS idx_booking_invoices_trgm_passport ON public.booking_invoices USING gin (passport_no gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS idx_booking_invoices_trgm_notes ON public.booking_invoices USING gin (notes gin_trgm_ops);

  -- Payment vouchers searched columns
  CREATE INDEX IF NOT EXISTS idx_payment_vouchers_trgm_no ON public.payment_vouchers USING gin (voucher_no gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS idx_payment_vouchers_trgm_ref ON public.payment_vouchers USING gin (reference_no gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS idx_payment_vouchers_trgm_notes ON public.payment_vouchers USING gin (notes gin_trgm_ops);

  -- Legacy clients, vendors, vouchers, invoices, refunds, expenses trigram indexes
  CREATE INDEX IF NOT EXISTS idx_clients_trgm_name ON public.clients USING gin (name gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS idx_clients_trgm_pnr ON public.clients USING gin (pnr gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS idx_clients_trgm_passport ON public.clients USING gin (passport_number gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS idx_clients_trgm_phone ON public.clients USING gin (contact_number gin_trgm_ops);

  CREATE INDEX IF NOT EXISTS idx_vendors_trgm_name ON public.vendors USING gin (name gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS idx_vendors_trgm_phone ON public.vendors USING gin (contact_number gin_trgm_ops);

  CREATE INDEX IF NOT EXISTS idx_vouchers_trgm_no ON public.vouchers USING gin (voucher_number gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS idx_vouchers_trgm_pax ON public.vouchers USING gin (passenger_name gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS idx_vouchers_trgm_pnr ON public.vouchers USING gin (pnr gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS idx_vouchers_trgm_ticket ON public.vouchers USING gin (ticket_number gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS idx_vouchers_trgm_passport ON public.vouchers USING gin (passenger_passport gin_trgm_ops);
END $$;


-- ------------------------------------------------------------------------------
-- 3. OPTIMIZE current_user_agency_id() (SINGLE sub_users INDEX LOOKUP)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_agency_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_sub_active BOOLEAN;
  v_sub_agency_id UUID;
  v_agency_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT su.is_active, su.agency_id
  INTO v_sub_active, v_sub_agency_id
  FROM public.sub_users su
  WHERE su.user_id = v_uid
  LIMIT 1;

  IF FOUND AND NOT COALESCE(v_sub_active, false) THEN
    RETURN NULL;
  END IF;

  SELECT p.agency_id
  INTO v_agency_id
  FROM public.profiles p
  WHERE p.id = v_uid
  LIMIT 1;

  IF v_agency_id IS NULL THEN
    v_agency_id := v_sub_agency_id;
  END IF;

  RETURN v_agency_id;
END;
$$;


-- ------------------------------------------------------------------------------
-- 4. DROP & RECREATE UPGRADED CORE FINANCIAL RPCs (WITH p_request_id IDEMPOTENCY)
--    Always drop exact existing overloads cleanly inside transaction so no PGRST203!
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
        'record_transfer',
        'add_cash_bank_entry_atomic',
        'upsert_opening_balance_atomic',
        'update_opening_balance_atomic',
        'upsert_agency_bank_atomic',
        'record_client_payment_atomic',
        'record_vendor_payout_atomic',
        'convert_query_to_booking_atomic',
        'save_party_atomic',
        'save_reminder_atomic',
        'save_client_booking_atomic',
        'save_vendor_atomic',
        'save_b2b_agent_atomic',
        'save_b2b_booking_atomic',
        'save_b2b_ledger_entry_atomic',
        'record_b2b_lumpsum_atomic',
        'save_voucher_atomic',
        'save_quotation_atomic',
        'save_query_atomic',
        'generate_client_invoice_atomic',
        'global_search'
      )
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s)', r.proname, r.args);
  END LOOP;
END $$;


-- 4A. SAVE BOOKING INVOICE ATOMIC (with p_request_id + single-trip uniqueness check)
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
  p_is_manual BOOLEAN DEFAULT false,
  p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_cached JSONB;
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
  v_result JSONB;
BEGIN
  PERFORM public.assert_module_permission(ARRAY['bookings', 'invoices'], 'write');

  IF NOT public.agency_license_ok(v_agency_id) THEN
    RAISE EXCEPTION 'Trial or license has expired. Please renew your plan to create new invoices. Reading and exporting remain available.';
  END IF;

  v_cached := public._idempotency_check(v_agency_id, p_request_id);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

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
    IF public.is_document_number_taken(v_agency_id, 'invoice', v_inv_no, NULL) THEN
      RAISE EXCEPTION 'Invoice number % already exists. Please use Auto or choose another number.', v_inv_no;
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

  v_result := jsonb_build_object(
    'success', true,
    'id', v_invoice_id,
    'invoice_id', v_invoice_id,
    'invoice_no', v_inv_no,
    'voucher_id', v_voucher_id,
    'voucher_no', v_v_no,
    'profit', v_profit,
    'payment_status', v_status
  );

  PERFORM public._idempotency_store(v_agency_id, p_request_id, 'save_booking_invoice', v_result);
  RETURN v_result;
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
  p_is_manual BOOLEAN DEFAULT false,
  p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.save_booking_invoice_atomic(
    p_invoice_no, p_service, p_party_id, p_vendor_id, p_client_amount, p_vendor_payable,
    p_amount_paid, p_payment_mode, p_account_id, p_invoice_date, p_due_date, p_pnr,
    p_ticket_no, p_passport_no, p_passengers, p_currency, p_sar_rate, p_sar_amount,
    p_commission, p_wht, p_more_details, p_notes, p_is_manual, p_request_id
  );
END;
$$;


-- 4B. SAVE PAYMENT VOUCHER ATOMIC (with p_request_id + single-trip uniqueness check)
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
  p_is_manual BOOLEAN DEFAULT false,
  p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_cached JSONB;
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
  v_ctype TEXT;
  v_result JSONB;
BEGIN
  PERFORM public.assert_module_permission(ARRAY['bookings', 'invoices', 'clients', 'vendors'], 'write');

  IF NOT public.agency_license_ok(v_agency_id) THEN
    RAISE EXCEPTION 'Trial or license has expired. Please renew your plan to create new payment vouchers. Reading and exporting remain available.';
  END IF;

  v_cached := public._idempotency_check(v_agency_id, p_request_id);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

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

  v_ctype := CASE WHEN p_direction = 'received' THEN 'voucher_crv' ELSE 'voucher_cpv' END;

  IF COALESCE(p_is_manual, false) THEN
    IF v_v_no IS NULL OR v_v_no ~* '^(__AUTO__|preview|auto-generated)$' THEN
      RAISE EXCEPTION 'Please enter a valid custom voucher number';
    END IF;
    IF public.is_document_number_taken(v_agency_id, v_ctype, v_v_no, NULL) THEN
      RAISE EXCEPTION 'Voucher number % already exists. Please use Auto or choose another number.', v_v_no;
    END IF;
  ELSE
    v_v_no := public.next_unused_agency_number(v_agency_id, v_ctype);
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

  v_result := jsonb_build_object(
    'success', true,
    'id', v_voucher_id,
    'voucher_id', v_voucher_id,
    'voucher_no', v_v_no,
    'amount', p_amount,
    'direction', p_direction,
    'account_id', v_acc_id
  );

  PERFORM public._idempotency_store(v_agency_id, p_request_id, 'save_payment_voucher', v_result);
  RETURN v_result;
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
  p_is_manual BOOLEAN DEFAULT false,
  p_request_id UUID DEFAULT NULL
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
    p_adjustment_reason, p_bank_name, p_invoice_id, p_notes, p_is_manual, p_request_id
  );
END;
$$;


-- 4C. RECORD REFUND / VOID ATOMIC (with p_request_id)
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
  p_is_manual BOOLEAN DEFAULT false,
  p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_cached JSONB;
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
  v_ctype TEXT;
  v_result JSONB;
BEGIN
  PERFORM public.assert_module_permission(ARRAY['bookings', 'invoices', 'clients'], 'write');

  IF NOT public.agency_license_ok(v_agency_id) THEN
    RAISE EXCEPTION 'Trial or license has expired. Please renew your plan to record refunds. Reading and exporting remain available.';
  END IF;

  v_cached := public._idempotency_check(v_agency_id, p_request_id);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

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

  v_ctype := CASE WHEN v_action = 'void' THEN 'void' ELSE 'refund' END;

  IF COALESCE(p_is_manual, false) THEN
    IF v_ref_no IS NULL OR v_ref_no ~* '^(__AUTO__|preview|auto-generated)$' THEN
      RAISE EXCEPTION 'Please enter a valid custom refund/void number';
    END IF;
    IF public.is_document_number_taken(v_agency_id, v_ctype, v_ref_no, NULL) THEN
      RAISE EXCEPTION 'Record number % already exists. Please use Auto or choose another number.', v_ref_no;
    END IF;
  ELSE
    v_ref_no := public.next_unused_agency_number(v_agency_id, v_ctype);
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

  v_result := jsonb_build_object(
    'success', true,
    'refund_id', v_ref_id,
    'refund_no', v_ref_no,
    'voided_invoice', v_should_void
  );

  PERFORM public._idempotency_store(v_agency_id, p_request_id, 'record_refund', v_result);
  RETURN v_result;
END;
$$;


-- 4D. RECORD EXPENSE (supports normal & recurring + p_request_id)
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
  p_is_manual BOOLEAN DEFAULT false,
  p_request_id UUID DEFAULT NULL,
  p_is_recurring BOOLEAN DEFAULT false,
  p_recurring_frequency TEXT DEFAULT NULL,
  p_recurring_parent_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_cached JSONB;
  v_acc_id UUID;
  v_exp_id UUID;
  v_tx_id UUID;
  v_group_id UUID := gen_random_uuid();
  v_ref_no TEXT := NULLIF(TRIM(COALESCE(p_reference_no, '')), '');
  v_edate DATE := COALESCE(p_date, public.karachi_today());
  v_is_rec BOOLEAN := COALESCE(p_is_recurring, false);
  v_freq TEXT := NULLIF(LOWER(TRIM(COALESCE(p_recurring_frequency, ''))), '');
  v_result JSONB;
BEGIN
  PERFORM public.assert_module_permission(ARRAY['expenses'], 'write');

  IF NOT public.agency_license_ok(v_agency_id) THEN
    RAISE EXCEPTION 'Trial or license has expired. Please renew your plan to record expenses. Reading and exporting remain available.';
  END IF;

  v_cached := public._idempotency_check(v_agency_id, p_request_id);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

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
    IF public.is_document_number_taken(v_agency_id, 'expense', v_ref_no, NULL) THEN
      RAISE EXCEPTION 'Expense number % already exists. Please use Auto or choose another number.', v_ref_no;
    END IF;
  ELSE
    v_ref_no := public.next_unused_agency_number(v_agency_id, 'expense');
  END IF;

  INSERT INTO public.expenses (
    agency_id, expense_date, expense_type, amount, notes, payment_mode, bank_name,
    reference_number, is_paid, is_recurring, recurring_frequency, recurring_parent_id
  ) VALUES (
    v_agency_id, v_edate, COALESCE(NULLIF(TRIM(p_category), ''), 'General Expense'), p_amount, p_notes,
    COALESCE(p_method, 'cash'), p_bank_name, v_ref_no, true, v_is_rec,
    CASE WHEN v_is_rec THEN COALESCE(v_freq, 'monthly') ELSE NULL END,
    p_recurring_parent_id
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

  v_result := jsonb_build_object(
    'success', true,
    'expense_id', v_exp_id,
    'transaction_id', v_tx_id,
    'reference_no', v_ref_no,
    'account_id', v_acc_id,
    'is_recurring', v_is_rec
  );

  PERFORM public._idempotency_store(v_agency_id, p_request_id, 'record_expense', v_result);
  RETURN v_result;
END;
$$;


-- 4E. RECORD PAYMENT (with p_request_id)
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
  p_is_manual BOOLEAN DEFAULT false,
  p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_cached JSONB;
  v_dir TEXT := LOWER(COALESCE(p_direction, 'in'));
  v_tx_type TEXT;
  v_acc_id UUID;
  v_tx_id UUID;
  v_ref_no TEXT := NULLIF(TRIM(COALESCE(p_reference_no, '')), '');
  v_pdate DATE := COALESCE(p_date, public.karachi_today());
  v_method TEXT := LOWER(COALESCE(p_method, 'cash'));
  v_is_party BOOLEAN := false;
  v_voucher_res JSONB;
  v_result JSONB;
BEGIN
  PERFORM public.assert_module_permission(ARRAY['bookings', 'invoices', 'clients', 'vendors'], 'write');

  IF NOT public.agency_license_ok(v_agency_id) THEN
    RAISE EXCEPTION 'Trial or license has expired. Please renew your plan to record payments. Reading and exporting remain available.';
  END IF;

  v_cached := public._idempotency_check(v_agency_id, p_request_id);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

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
      p_is_manual => false,
      p_request_id => p_request_id
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

  v_result := jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'account_id', v_acc_id,
    'reference_no', v_ref_no
  );

  PERFORM public._idempotency_store(v_agency_id, p_request_id, 'record_payment', v_result);
  RETURN v_result;
END;
$$;


-- 4F. RECORD TRANSFER (with p_request_id)
CREATE OR REPLACE FUNCTION public.record_transfer(
  p_from_account_id UUID,
  p_to_account_id UUID,
  p_amount NUMERIC,
  p_date DATE DEFAULT CURRENT_DATE,
  p_reference_no TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_is_manual BOOLEAN DEFAULT false,
  p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_cached JSONB;
  v_from_name TEXT;
  v_to_name TEXT;
  v_tdate DATE := COALESCE(p_date, public.karachi_today());
  v_ref_no TEXT := NULLIF(TRIM(COALESCE(p_reference_no, '')), '');
  v_group_id UUID := gen_random_uuid();
  v_from_tx_id UUID;
  v_to_tx_id UUID;
  v_result JSONB;
BEGIN
  PERFORM public.assert_module_permission(ARRAY['expenses', 'bookings', 'invoices'], 'write');

  IF NOT public.agency_license_ok(v_agency_id) THEN
    RAISE EXCEPTION 'Trial or license has expired. Please renew your plan to record transfers.';
  END IF;

  v_cached := public._idempotency_check(v_agency_id, p_request_id);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

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
    IF public.is_document_number_taken(v_agency_id, 'transfer', v_ref_no, NULL) THEN
      RAISE EXCEPTION 'Transfer reference % already exists. Please choose another.', v_ref_no;
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

  v_result := jsonb_build_object(
    'success', true,
    'reference_no', v_ref_no,
    'from_transaction_id', v_from_tx_id,
    'to_transaction_id', v_to_tx_id
  );

  PERFORM public._idempotency_store(v_agency_id, p_request_id, 'record_transfer', v_result);
  RETURN v_result;
END;
$$;


-- 4G. CASH/BANK ENTRY ATOMIC (with p_request_id)
CREATE OR REPLACE FUNCTION public.add_cash_bank_entry_atomic(
  p_entry_date TEXT DEFAULT NULL,
  p_entry_type TEXT DEFAULT 'cash_in',
  p_amount NUMERIC DEFAULT 0,
  p_payment_mode TEXT DEFAULT 'cash',
  p_bank_name TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_reference_number TEXT DEFAULT NULL,
  p_account_id UUID DEFAULT NULL,
  p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_cached JSONB;
  v_type TEXT := LOWER(TRIM(COALESCE(p_entry_type, 'cash_in')));
  v_date_text TEXT := COALESCE(NULLIF(TRIM(COALESCE(p_entry_date, '')), ''), to_char(public.karachi_today(), 'YYYY-MM-DD'));
  v_date DATE := COALESCE(public.safe_parse_date(v_date_text), public.karachi_today());
  v_mode TEXT := LOWER(TRIM(COALESCE(p_payment_mode, CASE WHEN v_type LIKE 'bank_%' THEN 'bank' ELSE 'cash' END)));
  v_acc_id UUID;
  v_entry public.cash_bank_entries%ROWTYPE;
  v_tx_id UUID;
  v_is_in BOOLEAN := v_type IN ('cash_in', 'bank_in');
  v_tx_type TEXT := CASE WHEN v_type IN ('cash_in', 'bank_in') THEN 'payment_in' ELSE 'expense' END;
  v_ref TEXT := NULLIF(TRIM(COALESCE(p_reference_number, '')), '');
  v_cat TEXT := COALESCE(NULLIF(TRIM(COALESCE(p_category, '')), ''), CASE WHEN v_is_in THEN 'Cash/Bank Receipt' ELSE 'Cash/Bank Out' END);
  v_result JSONB;
BEGIN
  PERFORM public.assert_module_permission(ARRAY['expenses', 'bookings', 'invoices'], 'write');

  v_cached := public._idempotency_check(v_agency_id, p_request_id);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  IF v_type NOT IN ('cash_in', 'cash_out', 'bank_in', 'bank_out', 'transfer') THEN
    RAISE EXCEPTION 'Invalid cash/bank entry type: %', p_entry_type;
  END IF;

  IF COALESCE(p_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  INSERT INTO public.cash_bank_entries (
    agency_id, entry_date, entry_type, amount, payment_mode, bank_name,
    category, description, reference_number
  ) VALUES (
    v_agency_id, v_date_text, v_type, p_amount, v_mode, NULLIF(TRIM(COALESCE(p_bank_name, '')), ''),
    p_category, p_description, v_ref
  )
  RETURNING * INTO v_entry;

  IF v_type <> 'transfer' THEN
    v_acc_id := public.resolve_agency_account(v_agency_id, p_account_id, v_mode, p_bank_name);

    INSERT INTO public.transactions (
      agency_id, date, type, account_id, debit, credit, method,
      reference_no, category, notes, legacy_source, legacy_id, created_by
    ) VALUES (
      v_agency_id,
      v_date,
      v_tx_type,
      v_acc_id,
      CASE WHEN v_is_in THEN p_amount ELSE 0 END,
      CASE WHEN v_is_in THEN 0 ELSE p_amount END,
      v_mode,
      v_ref,
      v_cat,
      p_description,
      'cash_bank_entries',
      v_entry.id,
      auth.uid()
    )
    RETURNING id INTO v_tx_id;

    UPDATE public.cash_bank_entries
    SET transaction_id = v_tx_id,
        updated_at = NOW()
    WHERE id = v_entry.id AND agency_id = v_agency_id
    RETURNING * INTO v_entry;
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'entry', to_jsonb(v_entry),
    'transaction_id', v_tx_id,
    'account_id', v_acc_id
  );

  PERFORM public._idempotency_store(v_agency_id, p_request_id, 'add_cash_bank_entry', v_result);
  RETURN v_result;
END;
$$;


-- 4H. OPENING BALANCES ATOMIC (upsert + update with p_request_id)
CREATE OR REPLACE FUNCTION public.upsert_opening_balance_atomic(
  p_party_type TEXT,
  p_party_id UUID,
  p_balance_type TEXT DEFAULT 'receivable',
  p_amount NUMERIC DEFAULT 0,
  p_as_of_date DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_cached JSONB;
  v_date DATE := COALESCE(p_as_of_date, public.karachi_today());
  v_amt NUMERIC := COALESCE(p_amount, 0);
  v_is_rec BOOLEAN := COALESCE(p_balance_type, 'receivable') = 'receivable';
  v_tx_party_type TEXT := CASE WHEN p_party_type = 'b2b_agent' THEN 'agent' ELSE p_party_type END;
  v_signed_ob NUMERIC;
  v_ob public.opening_balances%ROWTYPE;
  v_tx_id UUID;
  v_result JSONB;
BEGIN
  PERFORM public.assert_module_permission(ARRAY['clients', 'vendors', 'bookings', 'invoices'], 'write');

  v_cached := public._idempotency_check(v_agency_id, p_request_id);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  IF p_party_type NOT IN ('client', 'vendor', 'b2b_agent') THEN
    RAISE EXCEPTION 'Invalid party type: %', p_party_type;
  END IF;

  IF COALESCE(p_balance_type, 'receivable') NOT IN ('receivable', 'payable') THEN
    RAISE EXCEPTION 'Invalid balance type: %', p_balance_type;
  END IF;

  IF v_amt < 0 THEN
    RAISE EXCEPTION 'Opening balance cannot be negative';
  END IF;

  IF NOT (
    EXISTS (SELECT 1 FROM public.parties WHERE id = p_party_id AND agency_id = v_agency_id)
    OR EXISTS (SELECT 1 FROM public.clients WHERE id = p_party_id AND agency_id = v_agency_id)
    OR EXISTS (SELECT 1 FROM public.vendors WHERE id = p_party_id AND agency_id = v_agency_id)
    OR EXISTS (SELECT 1 FROM public.b2b_agents WHERE id = p_party_id AND agency_id = v_agency_id)
  ) THEN
    RAISE EXCEPTION '403 Forbidden: Party does not belong to your active agency';
  END IF;

  v_signed_ob := CASE WHEN v_is_rec THEN v_amt ELSE -v_amt END;

  INSERT INTO public.opening_balances (
    agency_id, party_type, party_id, balance_type, amount, as_of_date, notes
  ) VALUES (
    v_agency_id, p_party_type, p_party_id, COALESCE(p_balance_type, 'receivable'), v_amt, v_date, p_notes
  )
  ON CONFLICT (agency_id, party_type, party_id)
  DO UPDATE SET
    balance_type = EXCLUDED.balance_type,
    amount = EXCLUDED.amount,
    as_of_date = EXCLUDED.as_of_date,
    notes = EXCLUDED.notes,
    updated_at = NOW()
  RETURNING * INTO v_ob;

  SELECT id INTO v_tx_id
  FROM public.transactions
  WHERE agency_id = v_agency_id
    AND legacy_source IN ('opening_balance', 'opening_balances')
    AND legacy_id = v_ob.id
    AND reversed_of IS NULL
  LIMIT 1
  FOR UPDATE;

  IF v_tx_id IS NOT NULL THEN
    UPDATE public.transactions
    SET date = v_date,
        party_type = v_tx_party_type,
        debit = CASE WHEN v_is_rec THEN v_amt ELSE 0 END,
        credit = CASE WHEN v_is_rec THEN 0 ELSE v_amt END,
        notes = COALESCE(p_notes, 'Opening ' || COALESCE(p_balance_type, 'receivable') || ' balance'),
        updated_at = NOW()
    WHERE id = v_tx_id AND agency_id = v_agency_id;
  ELSE
    INSERT INTO public.transactions (
      agency_id, date, type, party_id, party_type, debit, credit,
      method, reference_no, category, notes, legacy_source, legacy_id, created_by
    ) VALUES (
      v_agency_id, v_date, 'opening', p_party_id, v_tx_party_type,
      CASE WHEN v_is_rec THEN v_amt ELSE 0 END,
      CASE WHEN v_is_rec THEN 0 ELSE v_amt END,
      'opening', 'OPENING-BAL', 'Opening Balance',
      COALESCE(p_notes, 'Opening ' || COALESCE(p_balance_type, 'receivable') || ' balance'),
      'opening_balance', v_ob.id, auth.uid()
    )
    RETURNING id INTO v_tx_id;
  END IF;

  IF EXISTS (SELECT 1 FROM public.parties WHERE id = p_party_id AND agency_id = v_agency_id) THEN
    UPDATE public.parties
    SET opening_balance = v_signed_ob,
        updated_at = NOW()
    WHERE id = p_party_id AND agency_id = v_agency_id;
    PERFORM public.recalculate_party_balance(p_party_id, v_agency_id);
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'opening_balance', to_jsonb(v_ob),
    'transaction_id', v_tx_id
  );

  PERFORM public._idempotency_store(v_agency_id, p_request_id, 'upsert_opening_balance', v_result);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_opening_balance_atomic(
  p_id UUID,
  p_amount NUMERIC,
  p_balance_type TEXT DEFAULT NULL,
  p_as_of_date DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_cached JSONB;
  v_ob public.opening_balances%ROWTYPE;
  v_tx_id UUID;
  v_btype TEXT;
  v_date DATE;
  v_amt NUMERIC := COALESCE(p_amount, 0);
  v_is_rec BOOLEAN;
  v_tx_party_type TEXT;
  v_signed_ob NUMERIC;
  v_result JSONB;
BEGIN
  PERFORM public.assert_module_permission(ARRAY['clients', 'vendors', 'bookings', 'invoices'], 'write');

  v_cached := public._idempotency_check(v_agency_id, p_request_id);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  IF v_amt < 0 THEN
    RAISE EXCEPTION 'Opening balance cannot be negative';
  END IF;

  SELECT * INTO v_ob
  FROM public.opening_balances
  WHERE id = p_id AND agency_id = v_agency_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '403 Forbidden: Opening balance record not found in your active agency';
  END IF;

  v_btype := COALESCE(NULLIF(TRIM(COALESCE(p_balance_type, '')), ''), v_ob.balance_type);
  IF v_btype NOT IN ('receivable', 'payable') THEN
    RAISE EXCEPTION 'Invalid balance type: %', v_btype;
  END IF;

  v_date := COALESCE(p_as_of_date, v_ob.as_of_date, public.karachi_today());
  v_is_rec := v_btype = 'receivable';
  v_tx_party_type := CASE WHEN v_ob.party_type = 'b2b_agent' THEN 'agent' ELSE v_ob.party_type END;
  v_signed_ob := CASE WHEN v_is_rec THEN v_amt ELSE -v_amt END;

  UPDATE public.opening_balances
  SET amount = v_amt,
      balance_type = v_btype,
      as_of_date = v_date,
      notes = COALESCE(p_notes, notes),
      updated_at = NOW()
  WHERE id = p_id AND agency_id = v_agency_id
  RETURNING * INTO v_ob;

  SELECT id INTO v_tx_id
  FROM public.transactions
  WHERE agency_id = v_agency_id
    AND legacy_source IN ('opening_balance', 'opening_balances')
    AND legacy_id = v_ob.id
    AND reversed_of IS NULL
  LIMIT 1
  FOR UPDATE;

  IF v_tx_id IS NOT NULL THEN
    UPDATE public.transactions
    SET date = v_date,
        party_type = v_tx_party_type,
        debit = CASE WHEN v_is_rec THEN v_amt ELSE 0 END,
        credit = CASE WHEN v_is_rec THEN 0 ELSE v_amt END,
        notes = COALESCE(p_notes, notes),
        updated_at = NOW()
    WHERE id = v_tx_id AND agency_id = v_agency_id;
  ELSE
    INSERT INTO public.transactions (
      agency_id, date, type, party_id, party_type, debit, credit,
      method, reference_no, category, notes, legacy_source, legacy_id, created_by
    ) VALUES (
      v_agency_id, v_date, 'opening', v_ob.party_id, v_tx_party_type,
      CASE WHEN v_is_rec THEN v_amt ELSE 0 END,
      CASE WHEN v_is_rec THEN 0 ELSE v_amt END,
      'opening', 'OPENING-BAL', 'Opening Balance',
      COALESCE(p_notes, 'Opening ' || v_btype || ' balance'),
      'opening_balance', v_ob.id, auth.uid()
    )
    RETURNING id INTO v_tx_id;
  END IF;

  IF EXISTS (SELECT 1 FROM public.parties WHERE id = v_ob.party_id AND agency_id = v_agency_id) THEN
    UPDATE public.parties
    SET opening_balance = v_signed_ob,
        updated_at = NOW()
    WHERE id = v_ob.party_id AND agency_id = v_agency_id;
    PERFORM public.recalculate_party_balance(v_ob.party_id, v_agency_id);
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'opening_balance', to_jsonb(v_ob),
    'transaction_id', v_tx_id
  );

  PERFORM public._idempotency_store(v_agency_id, p_request_id, 'update_opening_balance', v_result);
  RETURN v_result;
END;
$$;


-- 4I. AGENCY BANK UPSERT ATOMIC (with p_request_id)
CREATE OR REPLACE FUNCTION public.upsert_agency_bank_atomic(
  p_id UUID DEFAULT NULL,
  p_bank_name TEXT DEFAULT NULL,
  p_account_title TEXT DEFAULT NULL,
  p_account_number TEXT DEFAULT NULL,
  p_branch_name TEXT DEFAULT NULL,
  p_opening_balance NUMERIC DEFAULT 0,
  p_is_active BOOLEAN DEFAULT true,
  p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_cached JSONB;
  v_bank_name TEXT := NULLIF(TRIM(COALESCE(p_bank_name, '')), '');
  v_acc_no TEXT := NULLIF(TRIM(COALESCE(p_account_number, '')), '');
  v_acc_title TEXT := NULLIF(TRIM(COALESCE(p_account_title, '')), '');
  v_branch TEXT := NULLIF(TRIM(COALESCE(p_branch_name, '')), '');
  v_bal NUMERIC := COALESCE(p_opening_balance, 0);
  v_active BOOLEAN := COALESCE(p_is_active, true);
  v_old public.agency_banks%ROWTYPE;
  v_saved public.agency_banks%ROWTYPE;
  v_old_acc_name TEXT;
  v_new_acc_name TEXT;
  v_acc_id UUID;
  v_result JSONB;
BEGIN
  v_cached := public._idempotency_check(v_agency_id, p_request_id);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  IF v_bal < 0 THEN
    RAISE EXCEPTION 'Opening balance cannot be negative';
  END IF;

  IF p_id IS NULL THEN
    IF v_bank_name IS NULL THEN
      RAISE EXCEPTION 'Bank name is required';
    END IF;

    INSERT INTO public.agency_banks (
      agency_id, bank_name, account_title, account_number, branch_name, opening_balance, is_active
    ) VALUES (
      v_agency_id, v_bank_name, v_acc_title, v_acc_no, v_branch, v_bal, v_active
    )
    RETURNING * INTO v_saved;

    v_new_acc_name := CASE WHEN v_acc_no IS NOT NULL THEN v_bank_name || ' (' || v_acc_no || ')' ELSE v_bank_name END;

    SELECT id INTO v_acc_id
    FROM public.accounts
    WHERE agency_id = v_agency_id
      AND type = 'bank'
      AND (name = v_new_acc_name OR name = v_bank_name)
    LIMIT 1
    FOR UPDATE;

    IF v_acc_id IS NOT NULL THEN
      UPDATE public.accounts
      SET name = v_new_acc_name,
          opening_balance = v_bal,
          active = v_active,
          updated_at = NOW()
      WHERE id = v_acc_id AND agency_id = v_agency_id;
    ELSE
      INSERT INTO public.accounts (
        agency_id, type, name, opening_balance, active
      ) VALUES (
        v_agency_id, 'bank', v_new_acc_name, v_bal, v_active
      )
      RETURNING id INTO v_acc_id;
    END IF;
  ELSE
    SELECT * INTO v_old
    FROM public.agency_banks
    WHERE id = p_id AND agency_id = v_agency_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION '403 Forbidden: Bank account not found in your active agency';
    END IF;

    v_bank_name := COALESCE(v_bank_name, v_old.bank_name);
    v_acc_no := COALESCE(p_account_number, v_old.account_number);
    v_acc_title := COALESCE(p_account_title, v_old.account_title);
    v_branch := COALESCE(p_branch_name, v_old.branch_name);

    UPDATE public.agency_banks
    SET bank_name = v_bank_name,
        account_title = v_acc_title,
        account_number = v_acc_no,
        branch_name = v_branch,
        opening_balance = v_bal,
        is_active = v_active,
        updated_at = NOW()
    WHERE id = p_id AND agency_id = v_agency_id
    RETURNING * INTO v_saved;

    v_old_acc_name := CASE WHEN NULLIF(TRIM(COALESCE(v_old.account_number, '')), '') IS NOT NULL
                           THEN v_old.bank_name || ' (' || TRIM(v_old.account_number) || ')'
                           ELSE v_old.bank_name END;
    v_new_acc_name := CASE WHEN NULLIF(TRIM(COALESCE(v_saved.account_number, '')), '') IS NOT NULL
                           THEN v_saved.bank_name || ' (' || TRIM(v_saved.account_number) || ')'
                           ELSE v_saved.bank_name END;

    SELECT id INTO v_acc_id
    FROM public.accounts
    WHERE agency_id = v_agency_id
      AND type = 'bank'
      AND (name = v_old_acc_name OR name = v_old.bank_name OR name = v_new_acc_name)
    LIMIT 1
    FOR UPDATE;

    IF v_acc_id IS NOT NULL THEN
      UPDATE public.accounts
      SET name = v_new_acc_name,
          opening_balance = v_bal,
          active = v_active,
          updated_at = NOW()
      WHERE id = v_acc_id AND agency_id = v_agency_id;
    ELSE
      INSERT INTO public.accounts (
        agency_id, type, name, opening_balance, active
      ) VALUES (
        v_agency_id, 'bank', v_new_acc_name, v_bal, v_active
      )
      RETURNING id INTO v_acc_id;
    END IF;
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'bank', to_jsonb(v_saved),
    'account_id', v_acc_id
  );

  PERFORM public._idempotency_store(v_agency_id, p_request_id, 'upsert_agency_bank', v_result);
  RETURN v_result;
END;
$$;


-- ------------------------------------------------------------------------------
-- 5. NEW SINGLE-TRIP ATOMIC RPCS FOR ALL SECONDARY / LEGACY FORMS
-- ------------------------------------------------------------------------------

-- 5A. PARTY CREATE / UPDATE ATOMIC (single trip + code check + idempotency)
CREATE OR REPLACE FUNCTION public.save_party_atomic(
  p_id UUID DEFAULT NULL,
  p_type TEXT DEFAULT 'client',
  p_name TEXT DEFAULT NULL,
  p_code TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_whatsapp TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_cnic TEXT DEFAULT NULL,
  p_ntn TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_passport TEXT DEFAULT NULL,
  p_credit_limit NUMERIC DEFAULT 0,
  p_opening_balance NUMERIC DEFAULT 0,
  p_notes TEXT DEFAULT NULL,
  p_is_manual BOOLEAN DEFAULT false,
  p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_cached JSONB;
  v_name TEXT := NULLIF(TRIM(COALESCE(p_name, '')), '');
  v_type TEXT := LOWER(TRIM(COALESCE(p_type, 'client')));
  v_code TEXT := NULLIF(TRIM(COALESCE(p_code, '')), '');
  v_doc_type TEXT;
  v_saved public.parties%ROWTYPE;
  v_ob NUMERIC := COALESCE(p_opening_balance, 0);
  v_result JSONB;
BEGIN
  PERFORM public.assert_module_permission(ARRAY['clients', 'vendors', 'bookings', 'invoices'], 'write');

  v_cached := public._idempotency_check(v_agency_id, p_request_id);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Party name is required';
  END IF;

  IF v_type NOT IN ('client', 'vendor', 'both') THEN
    RAISE EXCEPTION 'Invalid party type: %', p_type;
  END IF;

  IF COALESCE(p_credit_limit, 0) < 0 THEN
    RAISE EXCEPTION 'Credit limit cannot be negative';
  END IF;

  v_doc_type := CASE WHEN v_type = 'vendor' THEN 'vendor' ELSE 'client' END;

  IF p_id IS NULL THEN
    IF COALESCE(p_is_manual, false) THEN
      IF v_code IS NULL OR v_code ~* '^(__AUTO__|preview|auto-generated)$' THEN
        RAISE EXCEPTION 'Please enter a valid custom code';
      END IF;
      IF public.is_document_number_taken(v_agency_id, v_doc_type, v_code, NULL) THEN
        RAISE EXCEPTION 'Code % already exists. Please use Auto or choose another.', v_code;
      END IF;
    ELSE
      v_code := public.next_unused_agency_number(v_agency_id, v_doc_type);
    END IF;

    INSERT INTO public.parties (
      agency_id, type, name, code, phone, whatsapp, city, address,
      cnic, ntn, email, passport, credit_limit, opening_balance, current_balance, notes, active
    ) VALUES (
      v_agency_id, v_type, v_name, v_code, p_phone, p_whatsapp, p_city, p_address,
      p_cnic, p_ntn, p_email, p_passport, COALESCE(p_credit_limit, 0), v_ob, v_ob, p_notes, true
    )
    RETURNING * INTO v_saved;
  ELSE
    SELECT * INTO v_saved
    FROM public.parties
    WHERE id = p_id AND agency_id = v_agency_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION '403 Forbidden: Party not found in your active agency';
    END IF;

    UPDATE public.parties
    SET type = v_type,
        name = v_name,
        phone = p_phone,
        whatsapp = p_whatsapp,
        city = p_city,
        address = p_address,
        cnic = p_cnic,
        ntn = p_ntn,
        email = p_email,
        passport = p_passport,
        credit_limit = COALESCE(p_credit_limit, 0),
        opening_balance = v_ob,
        notes = p_notes,
        updated_at = NOW()
    WHERE id = p_id AND agency_id = v_agency_id
    RETURNING * INTO v_saved;

    PERFORM public.recalculate_party_balance(v_saved.id, v_agency_id);
    SELECT * INTO v_saved FROM public.parties WHERE id = p_id;
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'party', to_jsonb(v_saved),
    'id', v_saved.id,
    'code', v_saved.code
  );

  PERFORM public._idempotency_store(v_agency_id, p_request_id, 'save_party', v_result);
  RETURN v_result;
END;
$$;


-- 5B. SAVE REMINDER ATOMIC
CREATE OR REPLACE FUNCTION public.save_reminder_atomic(
  p_title TEXT,
  p_type TEXT DEFAULT 'manual',
  p_remind_date DATE DEFAULT CURRENT_DATE,
  p_remind_time TIME DEFAULT '09:00:00',
  p_notes TEXT DEFAULT NULL,
  p_is_recurring_daily BOOLEAN DEFAULT false,
  p_reminder_no TEXT DEFAULT NULL,
  p_is_manual BOOLEAN DEFAULT false,
  p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_cached JSONB;
  v_title TEXT := NULLIF(TRIM(COALESCE(p_title, '')), '');
  v_no TEXT := NULLIF(TRIM(COALESCE(p_reminder_no, '')), '');
  v_row public.reminders%ROWTYPE;
  v_result JSONB;
BEGIN
  v_cached := public._idempotency_check(v_agency_id, p_request_id);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  IF v_title IS NULL THEN
    RAISE EXCEPTION 'Reminder title is required';
  END IF;

  IF COALESCE(p_is_manual, false) THEN
    IF v_no IS NULL OR v_no ~* '^(__AUTO__|preview|auto-generated)$' THEN
      RAISE EXCEPTION 'Please enter a valid custom reminder number';
    END IF;
    IF public.is_document_number_taken(v_agency_id, 'reminder', v_no, NULL) THEN
      RAISE EXCEPTION 'Reminder number % already exists. Please choose another.', v_no;
    END IF;
  ELSE
    v_no := public.next_unused_agency_number(v_agency_id, 'reminder');
  END IF;

  INSERT INTO public.reminders (
    user_id, agency_id, title, type, remind_date, remind_time,
    notes, is_recurring_daily, is_completed, reminder_no
  ) VALUES (
    auth.uid(),
    v_agency_id,
    v_title,
    CASE WHEN p_type IN ('flight', 'umrah', 'daily_expense', 'manual') THEN p_type ELSE 'manual' END,
    COALESCE(p_remind_date, public.karachi_today()),
    COALESCE(p_remind_time, '09:00:00'::time),
    NULLIF(TRIM(COALESCE(p_notes, '')), ''),
    COALESCE(p_is_recurring_daily, false),
    false,
    v_no
  )
  RETURNING * INTO v_row;

  v_result := jsonb_build_object(
    'success', true,
    'reminder', to_jsonb(v_row),
    'id', v_row.id,
    'reminder_no', v_row.reminder_no
  );

  PERFORM public._idempotency_store(v_agency_id, p_request_id, 'save_reminder', v_result);
  RETURN v_result;
END;
$$;


-- 5C. SAVE CLIENT BOOKING ATOMIC (consolidates clients + payment_history + opening_balance + query/quote link)
CREATE OR REPLACE FUNCTION public.save_client_booking_atomic(
  p_client_data JSONB,
  p_id UUID DEFAULT NULL,
  p_opening_balance_amount NUMERIC DEFAULT 0,
  p_opening_balance_type TEXT DEFAULT 'receivable',
  p_payment_mode TEXT DEFAULT 'cash',
  p_bank_name TEXT DEFAULT NULL,
  p_convert_query_id UUID DEFAULT NULL,
  p_convert_quote_id UUID DEFAULT NULL,
  p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_cached JSONB;
  v_name TEXT := NULLIF(TRIM(COALESCE(p_client_data->>'name', '')), '');
  v_sell NUMERIC := NULLIF(p_client_data->>'selling_price', '')::numeric;
  v_buy NUMERIC := NULLIF(p_client_data->>'purchasing_price', '')::numeric;
  v_pay_amt NUMERIC := COALESCE(NULLIF(p_client_data->>'payment_amount', '')::numeric, v_sell, 0);
  v_paid NUMERIC := GREATEST(0, COALESCE(NULLIF(p_client_data->>'amount_paid', '')::numeric, 0));
  v_vendor_id UUID := NULLIF(p_client_data->>'vendor_id', '')::uuid;
  v_op_amt NUMERIC := COALESCE(p_opening_balance_amount, 0);
  v_row public.clients%ROWTYPE;
  v_today DATE := public.karachi_today();
  v_status TEXT;
  v_result JSONB;
BEGIN
  PERFORM public.assert_module_permission(ARRAY['clients', 'bookings'], 'write');

  IF NOT public.agency_license_ok(v_agency_id) THEN
    RAISE EXCEPTION 'Trial or license has expired. Please renew your plan to save client bookings.';
  END IF;

  v_cached := public._idempotency_check(v_agency_id, p_request_id);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Client name is required';
  END IF;

  IF COALESCE(v_sell, 0) < 0 OR COALESCE(v_buy, 0) < 0 OR v_paid < 0 OR v_op_amt < 0 THEN
    RAISE EXCEPTION 'Amounts cannot be negative';
  END IF;

  v_status := COALESCE(
    NULLIF(TRIM(COALESCE(p_client_data->>'payment_status', '')), ''),
    CASE
      WHEN v_pay_amt > 0 AND v_paid >= v_pay_amt THEN 'Paid'
      WHEN v_paid > 0 THEN 'Partial'
      ELSE 'Pending'
    END
  );

  IF p_id IS NULL THEN
    INSERT INTO public.clients (
      agency_id, name, contact_number, contact_person, email, destination, airline, pnr,
      flight_date, name_update_date, remaining_payment_date, travel_type,
      purchasing_price, selling_price, payment_amount, amount_paid, payment_status,
      vendor_id, group_size, group_booking_type, passport_number, cnic,
      passengers_data, notes, converted_from_query_id, converted_from_quote_id
    ) VALUES (
      v_agency_id,
      v_name,
      NULLIF(TRIM(COALESCE(p_client_data->>'contact_number', '')), ''),
      NULLIF(TRIM(COALESCE(p_client_data->>'contact_person', '')), ''),
      NULLIF(TRIM(COALESCE(p_client_data->>'email', '')), ''),
      NULLIF(TRIM(COALESCE(p_client_data->>'destination', '')), ''),
      NULLIF(TRIM(COALESCE(p_client_data->>'airline', '')), ''),
      NULLIF(TRIM(COALESCE(p_client_data->>'pnr', '')), ''),
      NULLIF(TRIM(COALESCE(p_client_data->>'flight_date', '')), ''),
      NULLIF(TRIM(COALESCE(p_client_data->>'name_update_date', '')), '')::date,
      NULLIF(TRIM(COALESCE(p_client_data->>'remaining_payment_date', '')), '')::date,
      COALESCE(NULLIF(TRIM(COALESCE(p_client_data->>'travel_type', '')), ''), 'Ticket'),
      v_buy, v_sell, NULLIF(v_pay_amt, 0), v_paid, v_status,
      v_vendor_id,
      COALESCE(NULLIF(p_client_data->>'group_size', '')::int, 1),
      COALESCE(NULLIF(p_client_data->>'group_booking_type', ''), 'individual'),
      NULLIF(TRIM(COALESCE(p_client_data->>'passport_number', '')), ''),
      NULLIF(TRIM(COALESCE(p_client_data->>'cnic', '')), ''),
      COALESCE(p_client_data->'passengers_data', '[]'::jsonb),
      NULLIF(TRIM(COALESCE(p_client_data->>'notes', '')), ''),
      COALESCE(p_convert_query_id, NULLIF(p_client_data->>'converted_from_query_id', '')::uuid),
      COALESCE(p_convert_quote_id, NULLIF(p_client_data->>'converted_from_quote_id', '')::uuid)
    )
    RETURNING * INTO v_row;

    IF v_paid > 0 THEN
      INSERT INTO public.client_payment_history (
        client_id, agency_id, payment_amount, payment_type, payment_date, payment_mode, bank_name, notes
      ) VALUES (
        v_row.id,
        v_agency_id,
        v_paid,
        CASE WHEN v_pay_amt > 0 AND v_paid >= v_pay_amt THEN 'full' ELSE 'partial' END,
        v_today,
        COALESCE(NULLIF(LOWER(TRIM(COALESCE(p_payment_mode, ''))), ''), 'cash'),
        CASE WHEN LOWER(COALESCE(p_payment_mode, '')) = 'bank' THEN p_bank_name ELSE NULL END,
        'Initial payment of PKR ' || v_paid::text
      );
    END IF;
  ELSE
    SELECT * INTO v_row FROM public.clients WHERE id = p_id AND agency_id = v_agency_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION '403 Forbidden: Client booking not found in your active agency';
    END IF;

    UPDATE public.clients
    SET name = v_name,
        contact_number = COALESCE(NULLIF(TRIM(COALESCE(p_client_data->>'contact_number', '')), ''), contact_number),
        contact_person = COALESCE(NULLIF(TRIM(COALESCE(p_client_data->>'contact_person', '')), ''), contact_person),
        email = NULLIF(TRIM(COALESCE(p_client_data->>'email', '')), ''),
        destination = NULLIF(TRIM(COALESCE(p_client_data->>'destination', '')), ''),
        airline = NULLIF(TRIM(COALESCE(p_client_data->>'airline', '')), ''),
        pnr = NULLIF(TRIM(COALESCE(p_client_data->>'pnr', '')), ''),
        flight_date = NULLIF(TRIM(COALESCE(p_client_data->>'flight_date', '')), ''),
        name_update_date = NULLIF(TRIM(COALESCE(p_client_data->>'name_update_date', '')), '')::date,
        remaining_payment_date = NULLIF(TRIM(COALESCE(p_client_data->>'remaining_payment_date', '')), '')::date,
        travel_type = COALESCE(NULLIF(TRIM(COALESCE(p_client_data->>'travel_type', '')), ''), travel_type),
        purchasing_price = COALESCE(v_buy, purchasing_price),
        selling_price = COALESCE(v_sell, selling_price),
        payment_amount = COALESCE(NULLIF(v_pay_amt, 0), payment_amount),
        amount_paid = v_paid,
        payment_status = v_status,
        vendor_id = v_vendor_id,
        group_size = COALESCE(NULLIF(p_client_data->>'group_size', '')::int, group_size),
        group_booking_type = COALESCE(NULLIF(p_client_data->>'group_booking_type', ''), group_booking_type),
        passport_number = NULLIF(TRIM(COALESCE(p_client_data->>'passport_number', '')), ''),
        cnic = NULLIF(TRIM(COALESCE(p_client_data->>'cnic', '')), ''),
        passengers_data = COALESCE(p_client_data->'passengers_data', passengers_data),
        notes = NULLIF(TRIM(COALESCE(p_client_data->>'notes', '')), ''),
        updated_at = NOW()
    WHERE id = p_id AND agency_id = v_agency_id
    RETURNING * INTO v_row;
  END IF;

  IF v_op_amt > 0 THEN
    PERFORM public.upsert_opening_balance_atomic(
      'client',
      v_row.id,
      COALESCE(NULLIF(p_opening_balance_type, ''), 'receivable'),
      v_op_amt,
      v_today,
      'Client opening balance brought forward',
      NULL
    );
  END IF;

  IF COALESCE(p_convert_query_id, v_row.converted_from_query_id) IS NOT NULL THEN
    UPDATE public.queries
    SET status = 'completed',
        converted_booking_id = v_row.id,
        completed_at = COALESCE(completed_at, NOW()),
        updated_at = NOW()
    WHERE id = COALESCE(p_convert_query_id, v_row.converted_from_query_id)
      AND agency_id = v_agency_id;
  END IF;

  IF COALESCE(p_convert_quote_id, v_row.converted_from_quote_id) IS NOT NULL THEN
    UPDATE public.quotations
    SET status = 'accepted',
        converted_booking_id = v_row.id,
        updated_at = NOW()
    WHERE id = COALESCE(p_convert_quote_id, v_row.converted_from_quote_id)
      AND agency_id = v_agency_id;
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'client', to_jsonb(v_row),
    'id', v_row.id,
    'client_code', v_row.client_code
  );

  PERFORM public._idempotency_store(v_agency_id, p_request_id, 'save_client_booking', v_result);
  RETURN v_result;
END;
$$;


-- 5D. SAVE VENDOR ATOMIC (consolidates vendors + vendor_payment_history + opening_balance)
CREATE OR REPLACE FUNCTION public.save_vendor_atomic(
  p_vendor_data JSONB,
  p_id UUID DEFAULT NULL,
  p_opening_balance_amount NUMERIC DEFAULT 0,
  p_opening_balance_type TEXT DEFAULT 'payable',
  p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_cached JSONB;
  v_name TEXT := NULLIF(TRIM(COALESCE(p_vendor_data->>'name', '')), '');
  v_pay_amt NUMERIC := GREATEST(0, COALESCE(NULLIF(p_vendor_data->>'payment_amount', '')::numeric, 0));
  v_paid NUMERIC := GREATEST(0, COALESCE(NULLIF(p_vendor_data->>'amount_paid', '')::numeric, 0));
  v_op_amt NUMERIC := GREATEST(0, COALESCE(p_opening_balance_amount, 0));
  v_status TEXT;
  v_row public.vendors%ROWTYPE;
  v_today DATE := public.karachi_today();
  v_result JSONB;
BEGIN
  PERFORM public.assert_module_permission(ARRAY['vendors'], 'write');

  v_cached := public._idempotency_check(v_agency_id, p_request_id);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Vendor name is required';
  END IF;

  IF v_pay_amt > 0 AND v_paid > v_pay_amt THEN
    RAISE EXCEPTION 'Amount paid cannot exceed total payable amount';
  END IF;

  v_status := COALESCE(
    NULLIF(TRIM(COALESCE(p_vendor_data->>'payment_status', '')), ''),
    CASE
      WHEN v_pay_amt > 0 AND v_paid >= v_pay_amt THEN 'Paid'
      WHEN v_paid > 0 THEN 'Partial'
      ELSE 'Pending'
    END
  );

  IF p_id IS NULL THEN
    INSERT INTO public.vendors (
      agency_id, name, contact_person, contact_number, email, booking_date,
      payment_amount, amount_paid, payment_status, service_type, notes
    ) VALUES (
      v_agency_id,
      v_name,
      NULLIF(TRIM(COALESCE(p_vendor_data->>'contact_person', '')), ''),
      NULLIF(TRIM(COALESCE(p_vendor_data->>'contact_number', '')), ''),
      NULLIF(TRIM(COALESCE(p_vendor_data->>'email', '')), ''),
      NULLIF(TRIM(COALESCE(p_vendor_data->>'booking_date', '')), ''),
      v_pay_amt,
      v_paid,
      v_status,
      NULLIF(TRIM(COALESCE(p_vendor_data->>'service_type', '')), ''),
      NULLIF(TRIM(COALESCE(p_vendor_data->>'notes', '')), '')
    )
    RETURNING * INTO v_row;

    IF v_paid > 0 THEN
      INSERT INTO public.vendor_payment_history (
        vendor_id, agency_id, payment_amount, payment_type, payment_date, notes
      ) VALUES (
        v_row.id,
        v_agency_id,
        v_paid,
        CASE WHEN v_pay_amt > 0 AND v_paid >= v_pay_amt THEN 'full' ELSE 'partial' END,
        v_today,
        'Initial payment of PKR ' || v_paid::text
      );
    END IF;
  ELSE
    SELECT * INTO v_row FROM public.vendors WHERE id = p_id AND agency_id = v_agency_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION '403 Forbidden: Vendor not found in your active agency';
    END IF;

    UPDATE public.vendors
    SET name = v_name,
        contact_person = NULLIF(TRIM(COALESCE(p_vendor_data->>'contact_person', '')), ''),
        contact_number = NULLIF(TRIM(COALESCE(p_vendor_data->>'contact_number', '')), ''),
        email = NULLIF(TRIM(COALESCE(p_vendor_data->>'email', '')), ''),
        booking_date = NULLIF(TRIM(COALESCE(p_vendor_data->>'booking_date', '')), ''),
        payment_amount = v_pay_amt,
        amount_paid = v_paid,
        payment_status = v_status,
        service_type = NULLIF(TRIM(COALESCE(p_vendor_data->>'service_type', '')), ''),
        notes = NULLIF(TRIM(COALESCE(p_vendor_data->>'notes', '')), ''),
        updated_at = NOW()
    WHERE id = p_id AND agency_id = v_agency_id
    RETURNING * INTO v_row;
  END IF;

  IF v_op_amt > 0 THEN
    PERFORM public.upsert_opening_balance_atomic(
      'vendor',
      v_row.id,
      COALESCE(NULLIF(p_opening_balance_type, ''), 'payable'),
      v_op_amt,
      v_today,
      'Initial brought-forward opening balance',
      NULL
    );
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'vendor', to_jsonb(v_row),
    'id', v_row.id
  );

  PERFORM public._idempotency_store(v_agency_id, p_request_id, 'save_vendor', v_result);
  RETURN v_result;
END;
$$;


-- 5E. SAVE B2B AGENT ATOMIC
CREATE OR REPLACE FUNCTION public.save_b2b_agent_atomic(
  p_agent_data JSONB,
  p_id UUID DEFAULT NULL,
  p_opening_balance_amount NUMERIC DEFAULT 0,
  p_opening_balance_type TEXT DEFAULT 'receivable',
  p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_cached JSONB;
  v_name TEXT := NULLIF(TRIM(COALESCE(p_agent_data->>'agent_name', '')), '');
  v_op_amt NUMERIC := GREATEST(0, COALESCE(p_opening_balance_amount, 0));
  v_row public.b2b_agents%ROWTYPE;
  v_result JSONB;
BEGIN
  PERFORM public.assert_module_permission(ARRAY['bookings', 'clients'], 'write');

  v_cached := public._idempotency_check(v_agency_id, p_request_id);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Agent name is required';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.b2b_agents (
      agency_id, agent_name, business_name, email, phone, country, city,
      commission_type, commission_value, status, notes
    ) VALUES (
      v_agency_id,
      v_name,
      NULLIF(TRIM(COALESCE(p_agent_data->>'business_name', '')), ''),
      NULLIF(TRIM(COALESCE(p_agent_data->>'email', '')), ''),
      NULLIF(TRIM(COALESCE(p_agent_data->>'phone', '')), ''),
      NULLIF(TRIM(COALESCE(p_agent_data->>'country', '')), ''),
      NULLIF(TRIM(COALESCE(p_agent_data->>'city', '')), ''),
      COALESCE(NULLIF(p_agent_data->>'commission_type', ''), 'fixed'),
      NULLIF(p_agent_data->>'commission_value', '')::numeric,
      COALESCE(NULLIF(p_agent_data->>'status', ''), 'active'),
      NULLIF(TRIM(COALESCE(p_agent_data->>'notes', '')), '')
    )
    RETURNING * INTO v_row;
  ELSE
    SELECT * INTO v_row FROM public.b2b_agents WHERE id = p_id AND agency_id = v_agency_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION '403 Forbidden: B2B agent not found in your active agency';
    END IF;

    UPDATE public.b2b_agents
    SET agent_name = v_name,
        business_name = NULLIF(TRIM(COALESCE(p_agent_data->>'business_name', '')), ''),
        email = NULLIF(TRIM(COALESCE(p_agent_data->>'email', '')), ''),
        phone = NULLIF(TRIM(COALESCE(p_agent_data->>'phone', '')), ''),
        country = NULLIF(TRIM(COALESCE(p_agent_data->>'country', '')), ''),
        city = NULLIF(TRIM(COALESCE(p_agent_data->>'city', '')), ''),
        commission_type = COALESCE(NULLIF(p_agent_data->>'commission_type', ''), commission_type),
        commission_value = NULLIF(p_agent_data->>'commission_value', '')::numeric,
        status = COALESCE(NULLIF(p_agent_data->>'status', ''), status),
        notes = NULLIF(TRIM(COALESCE(p_agent_data->>'notes', '')), ''),
        updated_at = NOW()
    WHERE id = p_id AND agency_id = v_agency_id
    RETURNING * INTO v_row;
  END IF;

  IF v_op_amt > 0 THEN
    PERFORM public.upsert_opening_balance_atomic(
      'b2b_agent',
      v_row.id,
      COALESCE(NULLIF(p_opening_balance_type, ''), 'receivable'),
      v_op_amt,
      public.karachi_today(),
      'Initial brought-forward opening balance',
      NULL
    );
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'agent', to_jsonb(v_row),
    'id', v_row.id
  );

  PERFORM public._idempotency_store(v_agency_id, p_request_id, 'save_b2b_agent', v_result);
  RETURN v_result;
END;
$$;


-- 5F. SAVE B2B BOOKING ATOMIC (booking + auto debit/credit ledger in 1 atomic trip)
CREATE OR REPLACE FUNCTION public.save_b2b_booking_atomic(
  p_booking_data JSONB,
  p_id UUID DEFAULT NULL,
  p_amount_received NUMERIC DEFAULT 0,
  p_payment_mode TEXT DEFAULT 'cash',
  p_bank_name TEXT DEFAULT NULL,
  p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_cached JSONB;
  v_agent_id UUID := NULLIF(p_booking_data->>'agent_id', '')::uuid;
  v_vendor_id UUID := NULLIF(p_booking_data->>'vendor_id', '')::uuid;
  v_pax TEXT := NULLIF(TRIM(COALESCE(p_booking_data->>'passenger_name', '')), '');
  v_sell NUMERIC := COALESCE(NULLIF(p_booking_data->>'selling_price', '')::numeric, 0);
  v_buy NUMERIC := COALESCE(NULLIF(p_booking_data->>'purchasing_price', '')::numeric, 0);
  v_comm NUMERIC := COALESCE(NULLIF(p_booking_data->>'commission_amount', '')::numeric, 0);
  v_profit NUMERIC := COALESCE(NULLIF(p_booking_data->>'profit', '')::numeric, v_sell - v_buy - v_comm);
  v_rec NUMERIC := GREATEST(0, COALESCE(p_amount_received, 0));
  v_service_amt NUMERIC := GREATEST(0, v_sell - v_comm);
  v_pay_status TEXT;
  v_row public.b2b_bookings%ROWTYPE;
  v_ref TEXT;
  v_today_text TEXT := to_char(public.karachi_today(), 'YYYY-MM-DD');
  v_result JSONB;
BEGIN
  PERFORM public.assert_module_permission(ARRAY['bookings'], 'write');

  IF NOT public.agency_license_ok(v_agency_id) THEN
    RAISE EXCEPTION 'Trial or license has expired. Please renew your plan to create bookings.';
  END IF;

  v_cached := public._idempotency_check(v_agency_id, p_request_id);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  IF v_agent_id IS NULL THEN
    RAISE EXCEPTION 'Please select a B2B Agent';
  END IF;
  IF v_pax IS NULL THEN
    RAISE EXCEPTION 'Passenger / contact name is required';
  END IF;

  PERFORM 1 FROM public.b2b_agents WHERE id = v_agent_id AND agency_id = v_agency_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '403 Forbidden: B2B Agent does not belong to your active agency';
  END IF;

  IF v_sell < 0 OR v_buy < 0 OR v_comm < 0 OR v_rec < 0 THEN
    RAISE EXCEPTION 'Amounts cannot be negative';
  END IF;

  IF v_rec >= v_service_amt AND v_service_amt > 0 THEN
    v_pay_status := 'paid';
  ELSIF v_rec > 0 THEN
    v_pay_status := 'partial';
  ELSE
    v_pay_status := COALESCE(NULLIF(p_booking_data->>'payment_status', ''), 'pending');
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.b2b_bookings (
      agency_id, agent_id, vendor_id, pnr, passenger_name, passenger_passport,
      passenger_contact, destination, airline, flight_date,
      purchasing_price, selling_price, commission_amount, profit,
      booking_status, payment_status, notes
    ) VALUES (
      v_agency_id, v_agent_id, v_vendor_id,
      NULLIF(TRIM(COALESCE(p_booking_data->>'pnr', '')), ''),
      v_pax,
      NULLIF(TRIM(COALESCE(p_booking_data->>'passenger_passport', '')), ''),
      NULLIF(TRIM(COALESCE(p_booking_data->>'passenger_contact', '')), ''),
      NULLIF(TRIM(COALESCE(p_booking_data->>'destination', '')), ''),
      NULLIF(TRIM(COALESCE(p_booking_data->>'airline', '')), ''),
      NULLIF(TRIM(COALESCE(p_booking_data->>'flight_date', '')), ''),
      v_buy, v_sell, v_comm, v_profit,
      COALESCE(NULLIF(p_booking_data->>'booking_status', ''), 'confirmed'),
      v_pay_status,
      NULLIF(p_booking_data->>'notes', '')
    )
    RETURNING * INTO v_row;

    v_ref := COALESCE(NULLIF(TRIM(v_row.pnr), ''), v_row.passenger_name);

    IF v_service_amt > 0 THEN
      INSERT INTO public.b2b_ledger (
        agency_id, agent_id, entry_date, entry_type, amount, remarks
      ) VALUES (
        v_agency_id, v_agent_id, v_today_text, 'debit', v_service_amt,
        'Booking: ' || v_ref || ' - ' || v_pax || ' [Booking: ' || v_ref || ']'
      );
    END IF;

    IF v_rec > 0 THEN
      INSERT INTO public.b2b_ledger (
        agency_id, agent_id, entry_date, entry_type, amount, remarks, payment_mode, bank_name
      ) VALUES (
        v_agency_id, v_agent_id, v_today_text, 'credit', v_rec,
        'Payment received at booking [Booking: ' || v_ref || ']',
        COALESCE(NULLIF(LOWER(TRIM(COALESCE(p_payment_mode, ''))), ''), 'cash'),
        CASE WHEN LOWER(COALESCE(p_payment_mode, '')) = 'bank' THEN p_bank_name ELSE NULL END
      );
    END IF;
  ELSE
    SELECT * INTO v_row FROM public.b2b_bookings WHERE id = p_id AND agency_id = v_agency_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION '403 Forbidden: B2B Booking not found in your active agency';
    END IF;

    UPDATE public.b2b_bookings
    SET agent_id = v_agent_id,
        vendor_id = v_vendor_id,
        pnr = NULLIF(TRIM(COALESCE(p_booking_data->>'pnr', '')), ''),
        passenger_name = v_pax,
        passenger_passport = NULLIF(TRIM(COALESCE(p_booking_data->>'passenger_passport', '')), ''),
        passenger_contact = NULLIF(TRIM(COALESCE(p_booking_data->>'passenger_contact', '')), ''),
        destination = NULLIF(TRIM(COALESCE(p_booking_data->>'destination', '')), ''),
        airline = NULLIF(TRIM(COALESCE(p_booking_data->>'airline', '')), ''),
        flight_date = NULLIF(TRIM(COALESCE(p_booking_data->>'flight_date', '')), ''),
        purchasing_price = v_buy,
        selling_price = v_sell,
        commission_amount = v_comm,
        profit = v_profit,
        booking_status = COALESCE(NULLIF(p_booking_data->>'booking_status', ''), booking_status),
        payment_status = COALESCE(NULLIF(p_booking_data->>'payment_status', ''), payment_status),
        notes = p_booking_data->>'notes',
        updated_at = NOW()
    WHERE id = p_id AND agency_id = v_agency_id
    RETURNING * INTO v_row;
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'booking', to_jsonb(v_row),
    'id', v_row.id
  );

  PERFORM public._idempotency_store(v_agency_id, p_request_id, 'save_b2b_booking', v_result);
  RETURN v_result;
END;
$$;


-- 5F2. SAVE B2B LEDGER ENTRY ATOMIC (single entry + optional booking status recalc)
CREATE OR REPLACE FUNCTION public.save_b2b_ledger_entry_atomic(
  p_agent_id UUID,
  p_entry_date TEXT DEFAULT NULL,
  p_entry_type TEXT DEFAULT 'credit',
  p_amount NUMERIC DEFAULT 0,
  p_payment_mode TEXT DEFAULT 'cash',
  p_bank_name TEXT DEFAULT NULL,
  p_remarks TEXT DEFAULT NULL,
  p_id UUID DEFAULT NULL,
  p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_cached JSONB;
  v_date_text TEXT := COALESCE(NULLIF(TRIM(COALESCE(p_entry_date, '')), ''), to_char(public.karachi_today(), 'YYYY-MM-DD'));
  v_type TEXT := LOWER(TRIM(COALESCE(p_entry_type, 'credit')));
  v_mode TEXT := COALESCE(NULLIF(LOWER(TRIM(COALESCE(p_payment_mode, ''))), ''), 'cash');
  v_row public.b2b_ledger%ROWTYPE;
  v_booking_ref TEXT;
  v_booking RECORD;
  v_service_amt NUMERIC;
  v_paid_sum NUMERIC;
  v_new_status TEXT;
  v_result JSONB;
BEGIN
  PERFORM public.assert_module_permission(ARRAY['bookings'], 'write');

  IF NOT public.agency_license_ok(v_agency_id) THEN
    RAISE EXCEPTION 'Trial or license has expired. Please renew your plan to record ledger entries.';
  END IF;

  v_cached := public._idempotency_check(v_agency_id, p_request_id);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  IF COALESCE(p_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  IF v_type NOT IN ('debit', 'credit') THEN
    RAISE EXCEPTION 'Invalid ledger entry type: %', p_entry_type;
  END IF;

  PERFORM 1 FROM public.b2b_agents WHERE id = p_agent_id AND agency_id = v_agency_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '403 Forbidden: Agent does not belong to your active agency';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.b2b_ledger (
      agency_id, agent_id, entry_date, entry_type, amount, payment_mode, bank_name, remarks
    ) VALUES (
      v_agency_id, p_agent_id, v_date_text, v_type, p_amount,
      CASE WHEN v_type = 'credit' THEN v_mode ELSE NULL END,
      CASE WHEN v_type = 'credit' AND v_mode = 'bank' THEN p_bank_name ELSE NULL END,
      p_remarks
    )
    RETURNING * INTO v_row;
  ELSE
    SELECT * INTO v_row FROM public.b2b_ledger WHERE id = p_id AND agency_id = v_agency_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION '403 Forbidden: Ledger entry not found in your active agency';
    END IF;

    UPDATE public.b2b_ledger
    SET entry_date = v_date_text,
        entry_type = v_type,
        amount = p_amount,
        payment_mode = CASE WHEN v_type = 'credit' THEN v_mode ELSE NULL END,
        bank_name = CASE WHEN v_type = 'credit' AND v_mode = 'bank' THEN p_bank_name ELSE NULL END,
        remarks = p_remarks
    WHERE id = p_id AND agency_id = v_agency_id
    RETURNING * INTO v_row;
  END IF;

  -- Recalculate linked booking status if remarks reference [Booking: REF]
  IF v_row.entry_type = 'credit' AND v_row.remarks ~ '\[Booking:\s*[^\]]+\]' THEN
    v_booking_ref := substring(v_row.remarks FROM '\[Booking:\s*([^\]]+)\]');
    IF v_booking_ref IS NOT NULL AND TRIM(v_booking_ref) <> '' THEN
      FOR v_booking IN
        SELECT *
        FROM public.b2b_bookings
        WHERE agency_id = v_agency_id
          AND agent_id = p_agent_id
          AND (pnr = v_booking_ref OR passenger_name = v_booking_ref)
      LOOP
        v_service_amt := COALESCE(v_booking.selling_price, 0) - COALESCE(v_booking.commission_amount, 0);
        SELECT COALESCE(SUM(amount), 0) INTO v_paid_sum
        FROM public.b2b_ledger
        WHERE agency_id = v_agency_id
          AND agent_id = p_agent_id
          AND entry_type = 'credit'
          AND remarks LIKE '%[Booking: ' || v_booking_ref || ']%';

        v_new_status := CASE
          WHEN v_service_amt > 0 AND v_paid_sum >= v_service_amt THEN 'paid'
          WHEN v_paid_sum > 0 THEN 'partial'
          ELSE 'pending'
        END;

        IF v_booking.payment_status IS DISTINCT FROM v_new_status THEN
          UPDATE public.b2b_bookings
          SET payment_status = v_new_status,
              updated_at = NOW()
          WHERE id = v_booking.id AND agency_id = v_agency_id;
        END IF;
      END LOOP;
    END IF;
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'entry', to_jsonb(v_row),
    'id', v_row.id
  );

  PERFORM public._idempotency_store(v_agency_id, p_request_id, 'save_b2b_ledger_entry', v_result);
  RETURN v_result;
END;
$$;


-- 5G. RECORD B2B LUMPSUM ATOMIC (eliminates N sequential updates + split ledger + tx)
CREATE OR REPLACE FUNCTION public.record_b2b_lumpsum_atomic(
  p_agent_id UUID,
  p_total_amount NUMERIC,
  p_entry_date TEXT DEFAULT NULL,
  p_payment_mode TEXT DEFAULT 'cash',
  p_bank_name TEXT DEFAULT NULL,
  p_remarks TEXT DEFAULT NULL,
  p_allocations JSONB DEFAULT '[]'::jsonb,
  p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_cached JSONB;
  v_agent_name TEXT;
  v_date_text TEXT := COALESCE(NULLIF(TRIM(COALESCE(p_entry_date, '')), ''), to_char(public.karachi_today(), 'YYYY-MM-DD'));
  v_date DATE := COALESCE(public.safe_parse_date(v_date_text), public.karachi_today());
  v_mode TEXT := COALESCE(NULLIF(LOWER(TRIM(COALESCE(p_payment_mode, ''))), ''), 'cash');
  v_alloc JSONB;
  v_allocated_sum NUMERIC := 0;
  v_unallocated NUMERIC := 0;
  v_booking_id UUID;
  v_booking_ref TEXT;
  v_alloc_amt NUMERIC;
  v_status_after TEXT;
  v_entries_created INT := 0;
  v_prefix TEXT;
  v_result JSONB;
BEGIN
  PERFORM public.assert_module_permission(ARRAY['bookings'], 'write');

  IF NOT public.agency_license_ok(v_agency_id) THEN
    RAISE EXCEPTION 'Trial or license has expired. Please renew your plan to record payments.';
  END IF;

  v_cached := public._idempotency_check(v_agency_id, p_request_id);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  IF COALESCE(p_total_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  SELECT agent_name INTO v_agent_name
  FROM public.b2b_agents
  WHERE id = p_agent_id AND agency_id = v_agency_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '403 Forbidden: Agent does not belong to your active agency';
  END IF;

  v_prefix := CASE WHEN v_mode = 'bank' AND NULLIF(TRIM(COALESCE(p_bank_name, '')), '') IS NOT NULL
                   THEN '[' || TRIM(p_bank_name) || '] ' ELSE '' END;

  FOR v_alloc IN SELECT * FROM jsonb_array_elements(COALESCE(p_allocations, '[]'::jsonb)) LOOP
    v_alloc_amt := COALESCE((v_alloc->>'amount')::numeric, 0);
    IF v_alloc_amt > 0 THEN
      v_booking_id := NULLIF(v_alloc->>'bookingId', '')::uuid;
      v_booking_ref := COALESCE(NULLIF(v_alloc->>'bookingRef', ''), 'Booking');
      v_status_after := NULLIF(v_alloc->>'statusAfter', '');

      INSERT INTO public.b2b_ledger (
        agency_id, agent_id, entry_date, entry_type, amount, payment_mode, bank_name, remarks
      ) VALUES (
        v_agency_id, p_agent_id, v_date_text, 'credit', v_alloc_amt, v_mode,
        CASE WHEN v_mode = 'bank' THEN p_bank_name ELSE NULL END,
        v_prefix || COALESCE(NULLIF(TRIM(COALESCE(p_remarks, '')), ''), 'Lump sum allocated') || ' [Booking: ' || v_booking_ref || ']'
      );

      IF v_booking_id IS NOT NULL AND v_status_after IS NOT NULL THEN
        UPDATE public.b2b_bookings
        SET payment_status = v_status_after,
            updated_at = NOW()
        WHERE id = v_booking_id AND agency_id = v_agency_id AND agent_id = p_agent_id;
      END IF;

      v_allocated_sum := v_allocated_sum + v_alloc_amt;
      v_entries_created := v_entries_created + 1;
    END IF;
  END LOOP;

  v_unallocated := p_total_amount - v_allocated_sum;
  IF v_unallocated > 0 THEN
    INSERT INTO public.b2b_ledger (
      agency_id, agent_id, entry_date, entry_type, amount, payment_mode, bank_name, remarks
    ) VALUES (
      v_agency_id, p_agent_id, v_date_text, 'credit', v_unallocated, v_mode,
      CASE WHEN v_mode = 'bank' THEN p_bank_name ELSE NULL END,
      v_prefix || COALESCE(NULLIF(TRIM(COALESCE(p_remarks, '')), ''), 'Lump sum payment') || ' [Unallocated]'
    );
    v_entries_created := v_entries_created + 1;
  END IF;

  INSERT INTO public.transactions (
    agency_id, date, type, party_id, party_type, debit, credit, method, notes, created_by
  ) VALUES (
    v_agency_id, v_date, 'payment_in', p_agent_id, 'agent',
    p_total_amount, 0, v_mode,
    COALESCE(NULLIF(TRIM(COALESCE(p_remarks, '')), ''), 'B2B Lump Sum Payment from ' || v_agent_name),
    auth.uid()
  );

  v_result := jsonb_build_object(
    'success', true,
    'entries_created', v_entries_created,
    'total_amount', p_total_amount
  );

  PERFORM public._idempotency_store(v_agency_id, p_request_id, 'record_b2b_lumpsum', v_result);
  RETURN v_result;
END;
$$;


-- 5H. RECORD CLIENT PAYMENT ATOMIC (upgraded with idempotency + remaining check + transactions sync)
CREATE OR REPLACE FUNCTION public.record_client_payment_atomic(
  p_client_id UUID,
  p_amount NUMERIC,
  p_payment_mode TEXT DEFAULT 'cash',
  p_bank_name TEXT DEFAULT NULL,
  p_payment_date DATE DEFAULT CURRENT_DATE,
  p_notes TEXT DEFAULT NULL,
  p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_cached JSONB;
  v_client RECORD;
  v_new_amount_paid NUMERIC;
  v_total_receivable NUMERIC;
  v_payment_status TEXT;
  v_history_id UUID;
  v_pdate DATE := COALESCE(p_payment_date, public.karachi_today());
  v_mode TEXT := COALESCE(NULLIF(LOWER(TRIM(COALESCE(p_payment_mode, ''))), ''), 'cash');
  v_result JSONB;
BEGIN
  PERFORM public.assert_module_permission(ARRAY['clients', 'bookings'], 'write');

  IF NOT public.agency_license_ok(v_agency_id) THEN
    RAISE EXCEPTION 'Trial or license has expired. Please renew your plan to record payments.';
  END IF;

  v_cached := public._idempotency_check(v_agency_id, p_request_id);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  IF COALESCE(p_amount, 0) = 0 THEN
    RAISE EXCEPTION 'Payment amount cannot be zero';
  END IF;

  SELECT * INTO v_client
  FROM public.clients
  WHERE id = p_client_id AND agency_id = v_agency_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '403 Forbidden: Client booking not found in your active agency';
  END IF;

  v_new_amount_paid := COALESCE(v_client.amount_paid, 0) + p_amount;
  IF v_new_amount_paid < 0 THEN
    RAISE EXCEPTION 'Adjustment cannot make total paid negative';
  END IF;

  v_total_receivable := COALESCE(v_client.selling_price, v_client.payment_amount, 0);
  IF v_total_receivable > 0 AND p_amount > 0 AND v_new_amount_paid > v_total_receivable THEN
    RAISE EXCEPTION 'Payment amount exceeds remaining balance';
  END IF;

  IF v_total_receivable > 0 THEN
    IF v_new_amount_paid >= v_total_receivable THEN
      v_payment_status := 'Paid';
    ELSIF v_new_amount_paid > 0 THEN
      v_payment_status := 'Partial';
    ELSE
      v_payment_status := 'Pending';
    END IF;
  ELSE
    v_payment_status := CASE WHEN v_new_amount_paid > 0 THEN 'Paid' ELSE 'Pending' END;
  END IF;

  UPDATE public.clients
  SET amount_paid = v_new_amount_paid,
      payment_status = v_payment_status,
      updated_at = NOW()
  WHERE id = p_client_id AND agency_id = v_agency_id;

  IF p_amount > 0 THEN
    INSERT INTO public.client_payment_history (
      client_id, agency_id, payment_amount, payment_type, payment_date, payment_mode, bank_name, notes
    ) VALUES (
      p_client_id,
      v_agency_id,
      p_amount,
      CASE WHEN v_total_receivable > 0 AND v_new_amount_paid >= v_total_receivable THEN 'full' ELSE 'partial' END,
      v_pdate,
      v_mode,
      CASE WHEN v_mode = 'bank' THEN p_bank_name ELSE NULL END,
      COALESCE(p_notes, 'Payment of PKR ' || p_amount::text)
    )
    RETURNING id INTO v_history_id;

    INSERT INTO public.transactions (
      agency_id, date, type, party_id, party_type, booking_id,
      debit, credit, method, reference_no, notes, created_by
    ) VALUES (
      v_agency_id, v_pdate, 'payment_in', p_client_id, 'client', p_client_id,
      p_amount, 0, v_mode, v_client.pnr,
      COALESCE(p_notes, 'Payment for booking #' || COALESCE(v_client.pnr, v_client.name)),
      auth.uid()
    );
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'payment_id', v_history_id,
    'client_id', p_client_id,
    'total_paid', v_new_amount_paid,
    'payment_status', v_payment_status
  );

  PERFORM public._idempotency_store(v_agency_id, p_request_id, 'record_client_payment', v_result);
  RETURN v_result;
END;
$$;


-- 5I. RECORD VENDOR PAYOUT ATOMIC (upgraded with idempotency + remaining check + transactions sync)
CREATE OR REPLACE FUNCTION public.record_vendor_payout_atomic(
  p_vendor_id UUID,
  p_amount NUMERIC,
  p_payment_mode TEXT DEFAULT 'cash',
  p_bank_name TEXT DEFAULT NULL,
  p_payment_date DATE DEFAULT CURRENT_DATE,
  p_notes TEXT DEFAULT NULL,
  p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_cached JSONB;
  v_vendor RECORD;
  v_new_amount_paid NUMERIC;
  v_payment_status TEXT;
  v_history_id UUID;
  v_pdate DATE := COALESCE(p_payment_date, public.karachi_today());
  v_mode TEXT := COALESCE(NULLIF(LOWER(TRIM(COALESCE(p_payment_mode, ''))), ''), 'cash');
  v_note TEXT;
  v_result JSONB;
BEGIN
  PERFORM public.assert_module_permission(ARRAY['vendors'], 'write');

  IF NOT public.agency_license_ok(v_agency_id) THEN
    RAISE EXCEPTION 'Trial or license has expired. Please renew your plan to record vendor payouts.';
  END IF;

  v_cached := public._idempotency_check(v_agency_id, p_request_id);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  IF COALESCE(p_amount, 0) = 0 THEN
    RAISE EXCEPTION 'Payment amount cannot be zero';
  END IF;

  SELECT * INTO v_vendor
  FROM public.vendors
  WHERE id = p_vendor_id AND agency_id = v_agency_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '403 Forbidden: Vendor not found in your active agency';
  END IF;

  v_new_amount_paid := COALESCE(v_vendor.amount_paid, 0) + p_amount;
  IF v_new_amount_paid < 0 THEN
    RAISE EXCEPTION 'Adjustment would result in negative paid amount';
  END IF;

  IF COALESCE(v_vendor.payment_amount, 0) > 0 AND p_amount > 0 AND v_new_amount_paid > v_vendor.payment_amount THEN
    RAISE EXCEPTION 'Payment amount cannot exceed remaining balance';
  END IF;

  IF COALESCE(v_vendor.payment_amount, 0) > 0 THEN
    IF v_new_amount_paid >= v_vendor.payment_amount THEN
      v_payment_status := 'Paid';
    ELSIF v_new_amount_paid > 0 THEN
      v_payment_status := 'Partial';
    ELSE
      v_payment_status := 'Pending';
    END IF;
  ELSE
    v_payment_status := CASE WHEN v_new_amount_paid > 0 THEN 'Paid' ELSE 'Pending' END;
  END IF;

  v_note := COALESCE(
    p_notes,
    CASE WHEN p_amount >= 0 THEN 'Payment of PKR ' || p_amount::text
         ELSE 'Adjustment: PKR ' || p_amount::text || ' (correction/reversal)' END
  );

  INSERT INTO public.vendor_payment_history (
    vendor_id, agency_id, payment_amount, payment_type, payment_date, payment_mode, bank_name, notes
  ) VALUES (
    p_vendor_id,
    v_agency_id,
    p_amount,
    CASE WHEN COALESCE(v_vendor.payment_amount, 0) > 0 AND v_new_amount_paid >= v_vendor.payment_amount THEN 'full' ELSE 'partial' END,
    v_pdate,
    v_mode,
    CASE WHEN v_mode = 'bank' THEN p_bank_name ELSE NULL END,
    v_note
  )
  RETURNING id INTO v_history_id;

  UPDATE public.vendors
  SET amount_paid = v_new_amount_paid,
      payment_status = v_payment_status,
      updated_at = NOW()
  WHERE id = p_vendor_id AND agency_id = v_agency_id;

  INSERT INTO public.transactions (
    agency_id, date, type, party_id, party_type, debit, credit, method, notes, created_by
  ) VALUES (
    v_agency_id, v_pdate, 'payment_out', p_vendor_id, 'vendor',
    0, p_amount, v_mode, v_note, auth.uid()
  );

  v_result := jsonb_build_object(
    'success', true,
    'payment_id', v_history_id,
    'vendor_id', p_vendor_id,
    'total_paid', v_new_amount_paid,
    'payment_status', v_payment_status
  );

  PERFORM public._idempotency_store(v_agency_id, p_request_id, 'record_vendor_payout', v_result);
  RETURN v_result;
END;
$$;


-- 5J. SAVE VOUCHER ATOMIC (Travel / Umrah / Hotel vouchers + optional agent flag)
CREATE OR REPLACE FUNCTION public.save_voucher_atomic(
  p_voucher_data JSONB,
  p_id UUID DEFAULT NULL,
  p_is_manual BOOLEAN DEFAULT false,
  p_enable_agent_vouchers_id UUID DEFAULT NULL,
  p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_cached JSONB;
  v_vtype TEXT := COALESCE(NULLIF(TRIM(COALESCE(p_voucher_data->>'voucher_type', '')), ''), 'Umrah');
  v_pax TEXT := NULLIF(TRIM(COALESCE(p_voucher_data->>'passenger_name', '')), '');
  v_no TEXT := NULLIF(TRIM(COALESCE(p_voucher_data->>'voucher_number', '')), '');
  v_doc_type TEXT;
  v_row public.vouchers%ROWTYPE;
  v_result JSONB;
BEGIN
  PERFORM public.assert_module_permission(ARRAY['bookings', 'invoices'], 'write');

  v_cached := public._idempotency_check(v_agency_id, p_request_id);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  IF v_pax IS NULL THEN
    RAISE EXCEPTION 'Passenger name is required';
  END IF;

  v_doc_type := CASE
    WHEN v_vtype = 'Hotel' THEN 'voucher_hv'
    WHEN v_vtype = 'Ticket' THEN 'voucher_tv'
    ELSE 'voucher_uv'
  END;

  IF p_id IS NULL THEN
    IF COALESCE(p_is_manual, false) THEN
      IF v_no IS NULL OR v_no ~* '^(__AUTO__|preview|auto-generated)$' THEN
        RAISE EXCEPTION 'Please enter a valid custom voucher number';
      END IF;
      IF public.is_document_number_taken(v_agency_id, v_doc_type, v_no, NULL) THEN
        RAISE EXCEPTION 'Voucher number % already exists. Please use Auto or choose another.', v_no;
      END IF;
    ELSE
      v_no := public.next_unused_agency_number(v_agency_id, v_doc_type);
    END IF;

    INSERT INTO public.vouchers (
      agency_id, agent_id, booking_id, voucher_number, voucher_type, status,
      passenger_name, passenger_passport, passengers, contact_number,
      package_name, hotel_name, city, check_in, check_out, nights, room_type,
      number_of_rooms, meal_plan, hotel_confirmation_code, transport_details,
      visa_status, ziyarat_details, makkah_hotel, makkah_check_in, makkah_check_out, makkah_nights,
      madinah_hotel, madinah_check_in, madinah_check_out, madinah_nights,
      airline, flight_number, sector, departure_date, arrival_date, flight_class,
      baggage, pnr, ticket_number, remarks, terms_and_conditions, created_by
    ) VALUES (
      v_agency_id,
      NULLIF(p_voucher_data->>'agent_id', '')::uuid,
      NULLIF(p_voucher_data->>'booking_id', '')::uuid,
      v_no,
      v_vtype,
      COALESCE(NULLIF(p_voucher_data->>'status', ''), 'Issued'),
      v_pax,
      NULLIF(p_voucher_data->>'passenger_passport', ''),
      COALESCE(p_voucher_data->'passengers', '[]'::jsonb),
      NULLIF(p_voucher_data->>'contact_number', ''),
      NULLIF(p_voucher_data->>'package_name', ''),
      NULLIF(p_voucher_data->>'hotel_name', ''),
      NULLIF(p_voucher_data->>'city', ''),
      NULLIF(p_voucher_data->>'check_in', '')::date,
      NULLIF(p_voucher_data->>'check_out', '')::date,
      COALESCE(NULLIF(p_voucher_data->>'nights', '')::int, 0),
      NULLIF(p_voucher_data->>'room_type', ''),
      COALESCE(NULLIF(p_voucher_data->>'number_of_rooms', '')::int, 1),
      NULLIF(p_voucher_data->>'meal_plan', ''),
      NULLIF(p_voucher_data->>'hotel_confirmation_code', ''),
      NULLIF(p_voucher_data->>'transport_details', ''),
      NULLIF(p_voucher_data->>'visa_status', ''),
      NULLIF(p_voucher_data->>'ziyarat_details', ''),
      NULLIF(p_voucher_data->>'makkah_hotel', ''),
      NULLIF(p_voucher_data->>'makkah_check_in', '')::date,
      NULLIF(p_voucher_data->>'makkah_check_out', '')::date,
      NULLIF(p_voucher_data->>'makkah_nights', '')::int,
      NULLIF(p_voucher_data->>'madinah_hotel', ''),
      NULLIF(p_voucher_data->>'madinah_check_in', '')::date,
      NULLIF(p_voucher_data->>'madinah_check_out', '')::date,
      NULLIF(p_voucher_data->>'madinah_nights', '')::int,
      NULLIF(p_voucher_data->>'airline', ''),
      NULLIF(p_voucher_data->>'flight_number', ''),
      NULLIF(p_voucher_data->>'sector', ''),
      NULLIF(p_voucher_data->>'departure_date', '')::timestamptz,
      NULLIF(p_voucher_data->>'arrival_date', '')::timestamptz,
      COALESCE(NULLIF(p_voucher_data->>'flight_class', ''), 'Economy'),
      NULLIF(p_voucher_data->>'baggage', ''),
      NULLIF(p_voucher_data->>'pnr', ''),
      NULLIF(p_voucher_data->>'ticket_number', ''),
      NULLIF(p_voucher_data->>'remarks', ''),
      NULLIF(p_voucher_data->>'terms_and_conditions', ''),
      auth.uid()
    )
    RETURNING * INTO v_row;
  ELSE
    SELECT * INTO v_row FROM public.vouchers WHERE id = p_id AND agency_id = v_agency_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION '403 Forbidden: Voucher not found in your active agency';
    END IF;

    UPDATE public.vouchers
    SET agent_id = NULLIF(p_voucher_data->>'agent_id', '')::uuid,
        booking_id = NULLIF(p_voucher_data->>'booking_id', '')::uuid,
        voucher_type = v_vtype,
        status = COALESCE(NULLIF(p_voucher_data->>'status', ''), status),
        passenger_name = v_pax,
        passenger_passport = NULLIF(p_voucher_data->>'passenger_passport', ''),
        passengers = COALESCE(p_voucher_data->'passengers', passengers),
        contact_number = NULLIF(p_voucher_data->>'contact_number', ''),
        package_name = NULLIF(p_voucher_data->>'package_name', ''),
        hotel_name = NULLIF(p_voucher_data->>'hotel_name', ''),
        city = NULLIF(p_voucher_data->>'city', ''),
        check_in = NULLIF(p_voucher_data->>'check_in', '')::date,
        check_out = NULLIF(p_voucher_data->>'check_out', '')::date,
        nights = COALESCE(NULLIF(p_voucher_data->>'nights', '')::int, nights),
        room_type = NULLIF(p_voucher_data->>'room_type', ''),
        number_of_rooms = COALESCE(NULLIF(p_voucher_data->>'number_of_rooms', '')::int, number_of_rooms),
        meal_plan = NULLIF(p_voucher_data->>'meal_plan', ''),
        hotel_confirmation_code = NULLIF(p_voucher_data->>'hotel_confirmation_code', ''),
        transport_details = NULLIF(p_voucher_data->>'transport_details', ''),
        visa_status = NULLIF(p_voucher_data->>'visa_status', ''),
        ziyarat_details = NULLIF(p_voucher_data->>'ziyarat_details', ''),
        makkah_hotel = NULLIF(p_voucher_data->>'makkah_hotel', ''),
        makkah_check_in = NULLIF(p_voucher_data->>'makkah_check_in', '')::date,
        makkah_check_out = NULLIF(p_voucher_data->>'makkah_check_out', '')::date,
        makkah_nights = NULLIF(p_voucher_data->>'makkah_nights', '')::int,
        madinah_hotel = NULLIF(p_voucher_data->>'madinah_hotel', ''),
        madinah_check_in = NULLIF(p_voucher_data->>'madinah_check_in', '')::date,
        madinah_check_out = NULLIF(p_voucher_data->>'madinah_check_out', '')::date,
        madinah_nights = NULLIF(p_voucher_data->>'madinah_nights', '')::int,
        airline = NULLIF(p_voucher_data->>'airline', ''),
        flight_number = NULLIF(p_voucher_data->>'flight_number', ''),
        sector = NULLIF(p_voucher_data->>'sector', ''),
        departure_date = NULLIF(p_voucher_data->>'departure_date', '')::timestamptz,
        arrival_date = NULLIF(p_voucher_data->>'arrival_date', '')::timestamptz,
        flight_class = COALESCE(NULLIF(p_voucher_data->>'flight_class', ''), flight_class),
        baggage = NULLIF(p_voucher_data->>'baggage', ''),
        pnr = NULLIF(p_voucher_data->>'pnr', ''),
        ticket_number = NULLIF(p_voucher_data->>'ticket_number', ''),
        remarks = NULLIF(p_voucher_data->>'remarks', ''),
        terms_and_conditions = NULLIF(p_voucher_data->>'terms_and_conditions', ''),
        updated_at = NOW()
    WHERE id = p_id AND agency_id = v_agency_id
    RETURNING * INTO v_row;
  END IF;

  IF p_enable_agent_vouchers_id IS NOT NULL THEN
    UPDATE public.b2b_agents
    SET can_create_vouchers = true,
        updated_at = NOW()
    WHERE id = p_enable_agent_vouchers_id AND agency_id = v_agency_id;
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'voucher', to_jsonb(v_row),
    'id', v_row.id,
    'voucher_number', v_row.voucher_number
  );

  PERFORM public._idempotency_store(v_agency_id, p_request_id, 'save_voucher', v_result);
  RETURN v_result;
END;
$$;


-- 5K. SAVE QUOTATION ATOMIC
CREATE OR REPLACE FUNCTION public.save_quotation_atomic(
  p_quotation_data JSONB,
  p_id UUID DEFAULT NULL,
  p_is_manual BOOLEAN DEFAULT false,
  p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_cached JSONB;
  v_client_name TEXT := NULLIF(TRIM(COALESCE(p_quotation_data->>'client_name', '')), '');
  v_qno TEXT := NULLIF(TRIM(COALESCE(p_quotation_data->>'quotation_number', '')), '');
  v_row public.quotations%ROWTYPE;
  v_result JSONB;
BEGIN
  PERFORM public.assert_module_permission(ARRAY['queries', 'invoices', 'bookings'], 'write');

  v_cached := public._idempotency_check(v_agency_id, p_request_id);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  IF v_client_name IS NULL THEN
    RAISE EXCEPTION 'Client name is required';
  END IF;

  IF p_id IS NULL THEN
    IF COALESCE(p_is_manual, false) THEN
      IF v_qno IS NULL OR v_qno ~* '^(__AUTO__|preview|auto-generated)$' THEN
        RAISE EXCEPTION 'Please enter a valid custom quotation number';
      END IF;
      IF public.is_document_number_taken(v_agency_id, 'quotation', v_qno, NULL) THEN
        RAISE EXCEPTION 'Quotation number % already exists. Please use Auto or choose another.', v_qno;
      END IF;
    ELSE
      v_qno := public.next_unused_agency_number(v_agency_id, 'quotation');
    END IF;

    INSERT INTO public.quotations (
      agency_id, quotation_number, client_id, agent_id, client_name, client_phone, client_email,
      title, description, service_type, items, subtotal, discount, tax, total, currency,
      quotation_date, valid_until, status, notes, terms, source, source_ref, created_by
    ) VALUES (
      v_agency_id,
      v_qno,
      NULLIF(p_quotation_data->>'client_id', '')::uuid,
      NULLIF(p_quotation_data->>'agent_id', '')::uuid,
      v_client_name,
      NULLIF(p_quotation_data->>'client_phone', ''),
      NULLIF(p_quotation_data->>'client_email', ''),
      NULLIF(p_quotation_data->>'title', ''),
      NULLIF(p_quotation_data->>'description', ''),
      COALESCE(NULLIF(p_quotation_data->>'service_type', ''), 'Umrah'),
      COALESCE(p_quotation_data->'items', '[]'::jsonb),
      COALESCE(NULLIF(p_quotation_data->>'subtotal', '')::numeric, 0),
      COALESCE(NULLIF(p_quotation_data->>'discount', '')::numeric, 0),
      COALESCE(NULLIF(p_quotation_data->>'tax', '')::numeric, 0),
      COALESCE(NULLIF(p_quotation_data->>'total', '')::numeric, 0),
      COALESCE(NULLIF(p_quotation_data->>'currency', ''), 'PKR'),
      COALESCE(NULLIF(p_quotation_data->>'quotation_date', '')::date, public.karachi_today()),
      NULLIF(p_quotation_data->>'valid_until', '')::date,
      COALESCE(NULLIF(p_quotation_data->>'status', ''), 'draft'),
      NULLIF(p_quotation_data->>'notes', ''),
      NULLIF(p_quotation_data->>'terms', ''),
      NULLIF(p_quotation_data->>'source', ''),
      p_quotation_data->'source_ref',
      auth.uid()
    )
    RETURNING * INTO v_row;
  ELSE
    SELECT * INTO v_row FROM public.quotations WHERE id = p_id AND agency_id = v_agency_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION '403 Forbidden: Quotation not found in your active agency';
    END IF;

    UPDATE public.quotations
    SET client_id = NULLIF(p_quotation_data->>'client_id', '')::uuid,
        agent_id = NULLIF(p_quotation_data->>'agent_id', '')::uuid,
        client_name = v_client_name,
        client_phone = NULLIF(p_quotation_data->>'client_phone', ''),
        client_email = NULLIF(p_quotation_data->>'client_email', ''),
        title = NULLIF(p_quotation_data->>'title', ''),
        description = NULLIF(p_quotation_data->>'description', ''),
        service_type = COALESCE(NULLIF(p_quotation_data->>'service_type', ''), service_type),
        items = COALESCE(p_quotation_data->'items', items),
        subtotal = COALESCE(NULLIF(p_quotation_data->>'subtotal', '')::numeric, subtotal),
        discount = COALESCE(NULLIF(p_quotation_data->>'discount', '')::numeric, discount),
        tax = COALESCE(NULLIF(p_quotation_data->>'tax', '')::numeric, tax),
        total = COALESCE(NULLIF(p_quotation_data->>'total', '')::numeric, total),
        currency = COALESCE(NULLIF(p_quotation_data->>'currency', ''), currency),
        quotation_date = COALESCE(NULLIF(p_quotation_data->>'quotation_date', '')::date, quotation_date),
        valid_until = NULLIF(p_quotation_data->>'valid_until', '')::date,
        status = COALESCE(NULLIF(p_quotation_data->>'status', ''), status),
        notes = NULLIF(p_quotation_data->>'notes', ''),
        terms = NULLIF(p_quotation_data->>'terms', ''),
        source = COALESCE(NULLIF(p_quotation_data->>'source', ''), source),
        source_ref = COALESCE(p_quotation_data->'source_ref', source_ref),
        updated_at = NOW()
    WHERE id = p_id AND agency_id = v_agency_id
    RETURNING * INTO v_row;
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'quotation', to_jsonb(v_row),
    'id', v_row.id,
    'quotation_number', v_row.quotation_number
  );

  PERFORM public._idempotency_store(v_agency_id, p_request_id, 'save_quotation', v_result);
  RETURN v_result;
END;
$$;


-- 5L. SAVE QUERY ATOMIC
CREATE OR REPLACE FUNCTION public.save_query_atomic(
  p_query_data JSONB,
  p_id UUID DEFAULT NULL,
  p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_cached JSONB;
  v_cname TEXT := NULLIF(TRIM(COALESCE(p_query_data->>'client_name', '')), '');
  v_qtext TEXT := NULLIF(TRIM(COALESCE(p_query_data->>'query_text', '')), '');
  v_row public.queries%ROWTYPE;
  v_result JSONB;
BEGIN
  PERFORM public.assert_module_permission(ARRAY['queries'], 'write');

  v_cached := public._idempotency_check(v_agency_id, p_request_id);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  IF v_cname IS NULL THEN
    RAISE EXCEPTION 'Client name is required';
  END IF;
  IF v_qtext IS NULL THEN
    RAISE EXCEPTION 'Query details are required';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.queries (
      agency_id, client_name, contact_number, priority, query_text,
      status, assigned_to, due_date, notes
    ) VALUES (
      v_agency_id,
      v_cname,
      NULLIF(p_query_data->>'contact_number', ''),
      COALESCE(NULLIF(p_query_data->>'priority', ''), 'medium'),
      v_qtext,
      COALESCE(NULLIF(p_query_data->>'status', ''), 'pending'),
      NULLIF(p_query_data->>'assigned_to', ''),
      NULLIF(p_query_data->>'due_date', ''),
      NULLIF(p_query_data->>'notes', '')
    )
    RETURNING * INTO v_row;
  ELSE
    SELECT * INTO v_row FROM public.queries WHERE id = p_id AND agency_id = v_agency_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION '403 Forbidden: Query not found in your active agency';
    END IF;

    UPDATE public.queries
    SET client_name = v_cname,
        contact_number = NULLIF(p_query_data->>'contact_number', ''),
        priority = COALESCE(NULLIF(p_query_data->>'priority', ''), priority),
        query_text = v_qtext,
        status = COALESCE(NULLIF(p_query_data->>'status', ''), status),
        assigned_to = NULLIF(p_query_data->>'assigned_to', ''),
        due_date = NULLIF(p_query_data->>'due_date', ''),
        notes = NULLIF(p_query_data->>'notes', ''),
        updated_at = NOW()
    WHERE id = p_id AND agency_id = v_agency_id
    RETURNING * INTO v_row;
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'query', to_jsonb(v_row),
    'id', v_row.id
  );

  PERFORM public._idempotency_store(v_agency_id, p_request_id, 'save_query', v_result);
  RETURN v_result;
END;
$$;


-- 5M. CONVERT QUERY TO BOOKING ATOMIC (preserved with p_request_id)
CREATE OR REPLACE FUNCTION public.convert_query_to_booking_atomic(
  p_query_id UUID,
  p_selling_price NUMERIC DEFAULT NULL,
  p_amount_paid NUMERIC DEFAULT 0,
  p_payment_mode TEXT DEFAULT 'cash',
  p_vendor_id UUID DEFAULT NULL,
  p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_cached JSONB;
  v_query RECORD;
  v_booking_id UUID;
  v_selling_amount NUMERIC;
  v_result JSONB;
BEGIN
  PERFORM public.assert_module_permission(ARRAY['queries', 'clients', 'bookings'], 'write');

  v_cached := public._idempotency_check(v_agency_id, p_request_id);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  SELECT * INTO v_query
  FROM public.queries
  WHERE id = p_query_id AND agency_id = v_agency_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Query not found or access denied';
  END IF;

  IF v_query.converted_booking_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_converted', true,
      'booking_id', v_query.converted_booking_id
    );
  END IF;

  v_selling_amount := COALESCE(p_selling_price, 0);

  INSERT INTO public.clients (
    agency_id, name, contact_number, travel_type, destination, flight_date,
    payment_amount, amount_paid, payment_status, vendor_id, converted_from_query_id, notes
  ) VALUES (
    v_agency_id,
    v_query.client_name,
    v_query.contact_number,
    'Ticket',
    NULL,
    v_query.due_date,
    v_selling_amount,
    COALESCE(p_amount_paid, 0),
    CASE
      WHEN COALESCE(p_amount_paid, 0) >= v_selling_amount AND v_selling_amount > 0 THEN 'Paid'
      WHEN COALESCE(p_amount_paid, 0) > 0 THEN 'Partial'
      ELSE 'Pending'
    END,
    p_vendor_id,
    p_query_id,
    'Converted from Query #' || SUBSTRING(p_query_id::text, 1, 8) || COALESCE(E'\n' || v_query.query_text, '') || COALESCE(E'\n' || v_query.notes, '')
  )
  RETURNING id INTO v_booking_id;

  UPDATE public.queries
  SET status = 'completed',
      completed_at = NOW(),
      converted_booking_id = v_booking_id,
      updated_at = NOW()
  WHERE id = p_query_id AND agency_id = v_agency_id;

  IF COALESCE(p_amount_paid, 0) > 0 THEN
    INSERT INTO public.client_payment_history (
      client_id, agency_id, payment_amount, payment_type, payment_date, payment_mode, notes
    ) VALUES (
      v_booking_id,
      v_agency_id,
      p_amount_paid,
      CASE WHEN p_amount_paid >= v_selling_amount THEN 'full' ELSE 'partial' END,
      public.karachi_today(),
      COALESCE(p_payment_mode, 'cash'),
      'Initial payment on query conversion'
    );
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'already_converted', false,
    'booking_id', v_booking_id,
    'client_name', v_query.client_name
  );

  PERFORM public._idempotency_store(v_agency_id, p_request_id, 'convert_query_to_booking', v_result);
  RETURN v_result;
END;
$$;


-- 5N. GENERATE CLIENT PDF INVOICE ATOMIC (single trip replacing 4 sequential calls)
CREATE OR REPLACE FUNCTION public.generate_client_invoice_atomic(
  p_client_id UUID,
  p_invoice_number TEXT DEFAULT NULL,
  p_item_description TEXT DEFAULT NULL,
  p_additional_notes TEXT DEFAULT NULL,
  p_is_manual BOOLEAN DEFAULT false,
  p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_cached JSONB;
  v_client RECORD;
  v_inv_no TEXT := NULLIF(TRIM(COALESCE(p_invoice_number, '')), '');
  v_amt NUMERIC;
  v_paid NUMERIC;
  v_bal NUMERIC;
  v_row public.invoices%ROWTYPE;
  v_result JSONB;
BEGIN
  PERFORM public.assert_module_permission(ARRAY['invoices', 'bookings', 'clients'], 'write');

  IF NOT public.agency_license_ok(v_agency_id) THEN
    RAISE EXCEPTION 'Trial or license has expired. Please renew your plan to generate invoices.';
  END IF;

  v_cached := public._idempotency_check(v_agency_id, p_request_id);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  SELECT * INTO v_client
  FROM public.clients
  WHERE id = p_client_id AND agency_id = v_agency_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '403 Forbidden: Client booking not found in your active agency';
  END IF;

  IF COALESCE(p_is_manual, false) THEN
    IF v_inv_no IS NULL OR v_inv_no ~* '^(__AUTO__|preview|auto-generated)$' THEN
      RAISE EXCEPTION 'Please enter a valid custom invoice number';
    END IF;
    IF public.is_document_number_taken(v_agency_id, 'invoice', v_inv_no, NULL) THEN
      RAISE EXCEPTION 'Invoice number % already exists. Please choose another.', v_inv_no;
    END IF;
  ELSE
    v_inv_no := public.next_unused_agency_number(v_agency_id, 'invoice');
  END IF;

  v_amt := GREATEST(0, COALESCE(v_client.selling_price, v_client.payment_amount, 0));
  v_paid := GREATEST(0, COALESCE(v_client.amount_paid, 0));
  v_bal := GREATEST(0, v_amt - v_paid);

  INSERT INTO public.invoices (
    invoice_number, client_id, agency_id, generated_by,
    amount, amount_paid, balance_due, invoice_date, item_description, additional_notes, pdf_data
  ) VALUES (
    v_inv_no,
    p_client_id,
    v_agency_id,
    auth.uid(),
    v_amt,
    v_paid,
    v_bal,
    to_char(public.karachi_today(), 'YYYY-MM-DD'),
    COALESCE(NULLIF(TRIM(COALESCE(p_item_description, '')), ''), 'Travel Package'),
    NULLIF(TRIM(COALESCE(p_additional_notes, '')), ''),
    jsonb_build_object(
      'client_name', v_client.name,
      'destination', v_client.destination,
      'flight_date', v_client.flight_date,
      'pnr', v_client.pnr,
      'airline', v_client.airline
    )
  )
  RETURNING * INTO v_row;

  v_result := jsonb_build_object(
    'success', true,
    'invoice', to_jsonb(v_row),
    'invoice_number', v_row.invoice_number
  );

  PERFORM public._idempotency_store(v_agency_id, p_request_id, 'generate_client_invoice', v_result);
  RETURN v_result;
END;
$$;


-- ------------------------------------------------------------------------------
-- 6. GLOBAL SEARCH RPC (SECURITY INVOKER + RLS + EXPLICIT AGENCY FILTER + SUB-USER RBAC)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.global_search(
  query TEXT,
  limit_count INT DEFAULT 50,
  offset_count INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_agency_id UUID := public.current_user_agency_id();
  v_q TEXT := TRIM(COALESCE(query, ''));
  v_limit INT := LEAST(GREATEST(COALESCE(limit_count, 50), 1), 100);
  v_offset INT := GREATEST(COALESCE(offset_count, 0), 0);
  v_escaped TEXT;
  v_like TEXT;

  -- Caller permission flags
  v_is_super BOOLEAN := false;
  v_sub RECORD;
  v_has_sub BOOLEAN := false;
  v_can_clients BOOLEAN := false;
  v_can_vendors BOOLEAN := false;
  v_can_bookings BOOLEAN := false;
  v_can_invoices BOOLEAN := false;
  v_can_vouchers BOOLEAN := false;

  -- Result arrays & pagination
  v_parties JSONB := '[]'::jsonb;
  v_invoices JSONB := '[]'::jsonb;
  v_vouchers JSONB := '[]'::jsonb;
  v_parties_has_more BOOLEAN := false;
  v_invoices_has_more BOOLEAN := false;
  v_vouchers_has_more BOOLEAN := false;
  v_mod_val JSONB;
BEGIN
  -- Require authenticated caller belonging to an active agency with >= 2 search chars
  IF v_uid IS NULL OR v_agency_id IS NULL OR LENGTH(v_q) < 2 THEN
    RETURN jsonb_build_object(
      'query', v_q,
      'limit', v_limit,
      'offset', v_offset,
      'parties', '[]'::jsonb,
      'invoices', '[]'::jsonb,
      'vouchers', '[]'::jsonb,
      'has_more', false,
      'parties_has_more', false,
      'invoices_has_more', false,
      'vouchers_has_more', false
    );
  END IF;

  -- Determine caller module permissions (super_admin & main owner have full access)
  v_is_super := public.has_role(v_uid, 'super_admin'::public.app_role);

  IF NOT v_is_super THEN
    SELECT su.permissions, su.is_active
    INTO v_sub
    FROM public.sub_users su
    WHERE su.user_id = v_uid
    LIMIT 1;
    v_has_sub := FOUND;
  END IF;

  IF v_is_super OR NOT v_has_sub THEN
    v_can_clients := true;
    v_can_vendors := true;
    v_can_bookings := true;
    v_can_invoices := true;
    v_can_vouchers := true;
  ELSIF COALESCE(v_sub.is_active, false) AND v_sub.permissions IS NOT NULL THEN
    -- Evaluate each module read permission cleanly (boolean true OR {"read": true})
    v_mod_val := v_sub.permissions -> 'clients';
    v_can_clients := (jsonb_typeof(v_mod_val) = 'boolean' AND (v_mod_val #>> '{}')::boolean = true)
                     OR (jsonb_typeof(v_mod_val) = 'object' AND COALESCE((v_mod_val ->> 'read')::boolean, false) = true);

    v_mod_val := v_sub.permissions -> 'vendors';
    v_can_vendors := (jsonb_typeof(v_mod_val) = 'boolean' AND (v_mod_val #>> '{}')::boolean = true)
                     OR (jsonb_typeof(v_mod_val) = 'object' AND COALESCE((v_mod_val ->> 'read')::boolean, false) = true);

    v_mod_val := v_sub.permissions -> 'bookings';
    v_can_bookings := (jsonb_typeof(v_mod_val) = 'boolean' AND (v_mod_val #>> '{}')::boolean = true)
                      OR (jsonb_typeof(v_mod_val) = 'object' AND COALESCE((v_mod_val ->> 'read')::boolean, false) = true);

    v_mod_val := v_sub.permissions -> 'invoices';
    v_can_invoices := (jsonb_typeof(v_mod_val) = 'boolean' AND (v_mod_val #>> '{}')::boolean = true)
                      OR (jsonb_typeof(v_mod_val) = 'object' AND COALESCE((v_mod_val ->> 'read')::boolean, false) = true);

    IF v_sub.permissions ? 'vouchers' THEN
      v_mod_val := v_sub.permissions -> 'vouchers';
      v_can_vouchers := (jsonb_typeof(v_mod_val) = 'boolean' AND (v_mod_val #>> '{}')::boolean = true)
                        OR (jsonb_typeof(v_mod_val) = 'object' AND COALESCE((v_mod_val ->> 'read')::boolean, false) = true);
    ELSE
      v_can_vouchers := v_can_bookings OR v_can_invoices;
    END IF;
  END IF;

  -- Escape ILIKE metacharacters so '%' or '_' search literally
  v_escaped := regexp_replace(v_q, '([%_\\])', '\\\1', 'g');
  v_like := '%' || v_escaped || '%';

  -- 1) Matching Clients / Vendors (Parties)
  IF v_can_clients OR v_can_vendors THEN
    WITH matched_parties AS (
      SELECT
        p.id,
        p.name,
        p.type,
        p.code,
        p.phone,
        p.whatsapp,
        p.passport,
        p.current_balance,
        p.created_at,
        CASE WHEN LOWER(p.name) LIKE LOWER(v_escaped) || '%' ESCAPE '\' THEN 0 ELSE 1 END AS sort_priority
      FROM public.parties p
      WHERE p.agency_id = v_agency_id
        AND (
          (p.type = 'client' AND v_can_clients)
          OR (p.type = 'vendor' AND v_can_vendors)
          OR (p.type = 'both' AND (v_can_clients OR v_can_vendors))
        )
        AND (
          p.name ILIKE v_like ESCAPE '\'
          OR COALESCE(p.code, '') ILIKE v_like ESCAPE '\'
          OR COALESCE(p.phone, '') ILIKE v_like ESCAPE '\'
          OR COALESCE(p.whatsapp, '') ILIKE v_like ESCAPE '\'
          OR COALESCE(p.passport, '') ILIKE v_like ESCAPE '\'
        )
      ORDER BY sort_priority ASC, p.name ASC, p.created_at DESC
      LIMIT v_limit + 1 OFFSET v_offset
    ),
    paged_parties AS (
      SELECT * FROM matched_parties
      ORDER BY sort_priority ASC, name ASC, created_at DESC
      LIMIT v_limit
    )
    SELECT
      COALESCE(
        jsonb_agg(
          (to_jsonb(pp) - 'sort_priority' - 'created_at')
          ORDER BY pp.sort_priority ASC, pp.name ASC, pp.created_at DESC
        ),
        '[]'::jsonb
      ),
      (SELECT COUNT(*) > v_limit FROM matched_parties)
    INTO v_parties, v_parties_has_more
    FROM paged_parties pp;
  END IF;

  -- 2) Matching Booking Invoices (NEWEST FIRST down to oldest)
  IF v_can_bookings OR v_can_invoices THEN
    WITH matched_invoices AS (
      SELECT
        bi.id,
        bi.invoice_no,
        bi.invoice_date,
        bi.created_at,
        bi.party_id,
        COALESCE(cp.name, NULLIF(bi.more_details->>'client_name', ''), 'Walk-in Client') AS party_name,
        bi.vendor_id,
        vp.name AS vendor_name,
        bi.service,
        COALESCE(bi.client_amount, 0) AS total,
        COALESCE(bi.paid_amount, 0) AS paid,
        GREATEST(0, COALESCE(bi.client_amount, 0) - COALESCE(bi.paid_amount, 0)) AS remaining,
        bi.payment_status,
        bi.pnr,
        bi.ticket_no,
        bi.passport_no,
        bi.is_void
      FROM public.booking_invoices bi
      LEFT JOIN public.parties cp ON cp.id = bi.party_id AND cp.agency_id = v_agency_id
      LEFT JOIN public.parties vp ON vp.id = bi.vendor_id AND vp.agency_id = v_agency_id
      WHERE bi.agency_id = v_agency_id
        AND (
          bi.invoice_no ILIKE v_like ESCAPE '\'
          OR COALESCE(bi.pnr, '') ILIKE v_like ESCAPE '\'
          OR COALESCE(bi.ticket_no, '') ILIKE v_like ESCAPE '\'
          OR COALESCE(bi.passport_no, '') ILIKE v_like ESCAPE '\'
          OR COALESCE(bi.notes, '') ILIKE v_like ESCAPE '\'
          OR COALESCE(bi.passengers::text, '') ILIKE v_like ESCAPE '\'
          OR COALESCE(cp.name, '') ILIKE v_like ESCAPE '\'
          OR COALESCE(cp.code, '') ILIKE v_like ESCAPE '\'
          OR COALESCE(cp.phone, '') ILIKE v_like ESCAPE '\'
          OR COALESCE(cp.whatsapp, '') ILIKE v_like ESCAPE '\'
          OR COALESCE(cp.passport, '') ILIKE v_like ESCAPE '\'
          OR COALESCE(vp.name, '') ILIKE v_like ESCAPE '\'
          OR COALESCE(vp.code, '') ILIKE v_like ESCAPE '\'
          OR COALESCE(vp.phone, '') ILIKE v_like ESCAPE '\'
          OR COALESCE(vp.whatsapp, '') ILIKE v_like ESCAPE '\'
        )
      ORDER BY bi.invoice_date DESC NULLS LAST, bi.created_at DESC, bi.id DESC
      LIMIT v_limit + 1 OFFSET v_offset
    ),
    paged_invoices AS (
      SELECT * FROM matched_invoices
      ORDER BY invoice_date DESC NULLS LAST, created_at DESC, id DESC
      LIMIT v_limit
    )
    SELECT
      COALESCE(
        jsonb_agg(
          to_jsonb(pi)
          ORDER BY pi.invoice_date DESC NULLS LAST, pi.created_at DESC, pi.id DESC
        ),
        '[]'::jsonb
      ),
      (SELECT COUNT(*) > v_limit FROM matched_invoices)
    INTO v_invoices, v_invoices_has_more
    FROM paged_invoices pi;
  END IF;

  -- 3) Matching Payment Vouchers (NEWEST FIRST)
  IF v_can_vouchers THEN
    WITH matched_vouchers AS (
      SELECT
        pv.id,
        pv.voucher_no,
        pv.voucher_date,
        pv.created_at,
        pv.direction,
        pv.payment_mode,
        COALESCE(pv.amount, 0) AS amount,
        pv.party_id,
        COALESCE(pp.name, 'Party') AS party_name,
        pv.reference_no,
        pv.is_void
      FROM public.payment_vouchers pv
      LEFT JOIN public.parties pp ON pp.id = pv.party_id AND pp.agency_id = v_agency_id
      WHERE pv.agency_id = v_agency_id
        AND (
          pv.voucher_no ILIKE v_like ESCAPE '\'
          OR COALESCE(pv.reference_no, '') ILIKE v_like ESCAPE '\'
          OR COALESCE(pv.notes, '') ILIKE v_like ESCAPE '\'
          OR COALESCE(pp.name, '') ILIKE v_like ESCAPE '\'
          OR COALESCE(pp.code, '') ILIKE v_like ESCAPE '\'
          OR COALESCE(pp.phone, '') ILIKE v_like ESCAPE '\'
          OR COALESCE(pp.whatsapp, '') ILIKE v_like ESCAPE '\'
          OR COALESCE(pp.passport, '') ILIKE v_like ESCAPE '\'
        )
      ORDER BY pv.voucher_date DESC NULLS LAST, pv.created_at DESC, pv.id DESC
      LIMIT v_limit + 1 OFFSET v_offset
    ),
    paged_vouchers AS (
      SELECT * FROM matched_vouchers
      ORDER BY voucher_date DESC NULLS LAST, created_at DESC, id DESC
      LIMIT v_limit
    )
    SELECT
      COALESCE(
        jsonb_agg(
          to_jsonb(pv_row)
          ORDER BY pv_row.voucher_date DESC NULLS LAST, pv_row.created_at DESC, pv_row.id DESC
        ),
        '[]'::jsonb
      ),
      (SELECT COUNT(*) > v_limit FROM matched_vouchers)
    INTO v_vouchers, v_vouchers_has_more
    FROM paged_vouchers pv_row;
  END IF;

  RETURN jsonb_build_object(
    'query', v_q,
    'limit', v_limit,
    'offset', v_offset,
    'parties', v_parties,
    'invoices', v_invoices,
    'vouchers', v_vouchers,
    'has_more', (v_parties_has_more OR v_invoices_has_more OR v_vouchers_has_more),
    'parties_has_more', v_parties_has_more,
    'invoices_has_more', v_invoices_has_more,
    'vouchers_has_more', v_vouchers_has_more
  );
END;
$$;


-- ------------------------------------------------------------------------------
-- 7. STRICT PERMISSION GRANTS (REVOKE PUBLIC/ANON, GRANT TO AUTHENTICATED ONLY)
-- ------------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public._idempotency_check(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._idempotency_store(UUID, UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.current_user_agency_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_agency_id() TO authenticated;

REVOKE ALL ON FUNCTION public.save_booking_invoice_atomic(TEXT, TEXT, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, UUID, DATE, DATE, TEXT, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB, TEXT, BOOLEAN, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_booking_invoice_atomic(TEXT, TEXT, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, UUID, DATE, DATE, TEXT, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB, TEXT, BOOLEAN, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.save_booking_invoice(TEXT, TEXT, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, UUID, DATE, DATE, TEXT, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB, TEXT, BOOLEAN, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_booking_invoice(TEXT, TEXT, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, UUID, DATE, DATE, TEXT, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB, TEXT, BOOLEAN, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.save_payment_voucher_atomic(TEXT, NUMERIC, TEXT, UUID, UUID, TEXT, DATE, TEXT, BOOLEAN, TEXT, TEXT, UUID, TEXT, BOOLEAN, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_payment_voucher_atomic(TEXT, NUMERIC, TEXT, UUID, UUID, TEXT, DATE, TEXT, BOOLEAN, TEXT, TEXT, UUID, TEXT, BOOLEAN, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.save_payment_voucher(TEXT, NUMERIC, TEXT, UUID, UUID, TEXT, DATE, TEXT, BOOLEAN, TEXT, TEXT, UUID, TEXT, BOOLEAN, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_payment_voucher(TEXT, NUMERIC, TEXT, UUID, UUID, TEXT, DATE, TEXT, BOOLEAN, TEXT, TEXT, UUID, TEXT, BOOLEAN, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.record_refund(NUMERIC, UUID, UUID, TEXT, UUID, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_refund(NUMERIC, UUID, UUID, TEXT, UUID, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.record_expense(NUMERIC, UUID, TEXT, DATE, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, BOOLEAN, UUID, BOOLEAN, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_expense(NUMERIC, UUID, TEXT, DATE, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, BOOLEAN, UUID, BOOLEAN, TEXT, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.record_payment(TEXT, NUMERIC, UUID, UUID, TEXT, UUID, DATE, TEXT, TEXT, TEXT, TEXT, BOOLEAN, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_payment(TEXT, NUMERIC, UUID, UUID, TEXT, UUID, DATE, TEXT, TEXT, TEXT, TEXT, BOOLEAN, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.record_transfer(UUID, UUID, NUMERIC, DATE, TEXT, TEXT, BOOLEAN, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_transfer(UUID, UUID, NUMERIC, DATE, TEXT, TEXT, BOOLEAN, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.add_cash_bank_entry_atomic(TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_cash_bank_entry_atomic(TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.upsert_opening_balance_atomic(TEXT, UUID, TEXT, NUMERIC, DATE, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_opening_balance_atomic(TEXT, UUID, TEXT, NUMERIC, DATE, TEXT, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.update_opening_balance_atomic(UUID, NUMERIC, TEXT, DATE, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_opening_balance_atomic(UUID, NUMERIC, TEXT, DATE, TEXT, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.upsert_agency_bank_atomic(UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, BOOLEAN, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_agency_bank_atomic(UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, BOOLEAN, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.save_party_atomic(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, BOOLEAN, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_party_atomic(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, BOOLEAN, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.save_reminder_atomic(TEXT, TEXT, DATE, TIME, TEXT, BOOLEAN, TEXT, BOOLEAN, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_reminder_atomic(TEXT, TEXT, DATE, TIME, TEXT, BOOLEAN, TEXT, BOOLEAN, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.save_client_booking_atomic(JSONB, UUID, NUMERIC, TEXT, TEXT, TEXT, UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_client_booking_atomic(JSONB, UUID, NUMERIC, TEXT, TEXT, TEXT, UUID, UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.save_vendor_atomic(JSONB, UUID, NUMERIC, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_vendor_atomic(JSONB, UUID, NUMERIC, TEXT, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.save_b2b_agent_atomic(JSONB, UUID, NUMERIC, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_b2b_agent_atomic(JSONB, UUID, NUMERIC, TEXT, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.save_b2b_booking_atomic(JSONB, UUID, NUMERIC, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_b2b_booking_atomic(JSONB, UUID, NUMERIC, TEXT, TEXT, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.save_b2b_ledger_entry_atomic(UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_b2b_ledger_entry_atomic(UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.record_b2b_lumpsum_atomic(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT, JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_b2b_lumpsum_atomic(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT, JSONB, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.record_client_payment_atomic(UUID, NUMERIC, TEXT, TEXT, DATE, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_client_payment_atomic(UUID, NUMERIC, TEXT, TEXT, DATE, TEXT, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.record_vendor_payout_atomic(UUID, NUMERIC, TEXT, TEXT, DATE, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_vendor_payout_atomic(UUID, NUMERIC, TEXT, TEXT, DATE, TEXT, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.save_voucher_atomic(JSONB, UUID, BOOLEAN, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_voucher_atomic(JSONB, UUID, BOOLEAN, UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.save_quotation_atomic(JSONB, UUID, BOOLEAN, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_quotation_atomic(JSONB, UUID, BOOLEAN, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.save_query_atomic(JSONB, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_query_atomic(JSONB, UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.convert_query_to_booking_atomic(UUID, NUMERIC, NUMERIC, TEXT, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_query_to_booking_atomic(UUID, NUMERIC, NUMERIC, TEXT, UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.generate_client_invoice_atomic(UUID, TEXT, TEXT, TEXT, BOOLEAN, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_client_invoice_atomic(UUID, TEXT, TEXT, TEXT, BOOLEAN, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.global_search(TEXT, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.global_search(TEXT, INT, INT) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
