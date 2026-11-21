-- ==============================================================================
-- TAMS PRO — ADDITIVE SALES & EXPENSES EDIT, AUDIT TRAIL & LEDGER CORRECTION
-- File: supabase/migrations/20261121_03_sales_expenses_edit_audit.sql
--
-- CRITICAL SAFETY RULES:
--   - 100% ADDITIVE ONLY (never deletes, renames, or drops existing tables/columns/data)
--   - Backward-compatible with all existing records
--   - Strict agency isolation via InitPlan RLS + enforce_agency_isolation() + SECURITY DEFINER guards
--   - All edit RPCs run inside one atomic transaction with reversal + repost ledger entries
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. ADDITIVE NULLABLE/SAFE AUDIT METADATA COLUMNS ON MAIN TABLES
-- ------------------------------------------------------------------------------

ALTER TABLE public.booking_invoices
  ADD COLUMN IF NOT EXISTS is_edited BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS edit_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.payment_vouchers
  ADD COLUMN IF NOT EXISTS is_edited BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS edit_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS is_edited BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS edit_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.central_journal_entries
  ADD COLUMN IF NOT EXISTS refund_id UUID REFERENCES public.refunds(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reversed_entry_id UUID REFERENCES public.central_journal_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_reversal BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_central_journal_refund
  ON public.central_journal_entries (agency_id, refund_id);

CREATE INDEX IF NOT EXISTS idx_transactions_agency_ref
  ON public.transactions (agency_id, reference_no);


-- ------------------------------------------------------------------------------
-- 2. IMMUTABLE DOCUMENT EDIT HISTORY TABLE (INSERT-ONLY, STRICT AGENCY RLS)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.document_edit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('booking_invoice', 'payment_voucher', 'refund')),
  document_id UUID NOT NULL,
  document_no TEXT,
  edited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  edited_by_name TEXT,
  edited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT NOT NULL CHECK (LENGTH(TRIM(reason)) > 0),
  old_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  new_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  changed_fields TEXT[] NOT NULL DEFAULT '{}'::text[],
  affected_ledger BOOLEAN NOT NULL DEFAULT false,
  reversal_group_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_edit_history_agency_doc
  ON public.document_edit_history (agency_id, document_type, document_id, edited_at DESC);

CREATE INDEX IF NOT EXISTS idx_doc_edit_history_agency_edited_at
  ON public.document_edit_history (agency_id, edited_at DESC);

ALTER TABLE public.document_edit_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_edit_history_strict_select" ON public.document_edit_history;
CREATE POLICY "document_edit_history_strict_select"
  ON public.document_edit_history FOR SELECT TO authenticated
  USING (
    agency_id = (SELECT public.current_user_agency_id())
    OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
  );

DROP POLICY IF EXISTS "document_edit_history_strict_insert" ON public.document_edit_history;
CREATE POLICY "document_edit_history_strict_insert"
  ON public.document_edit_history FOR INSERT TO authenticated
  WITH CHECK (
    agency_id = (SELECT public.current_user_agency_id())
    OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
  );

-- Explicit insert-only protection (no UPDATE or DELETE allowed)
REVOKE UPDATE, DELETE ON public.document_edit_history FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.document_edit_history TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_document_edit_history_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION '403 Forbidden: Audit history is append-only and cannot be modified or deleted';
END;
$$;

DROP TRIGGER IF EXISTS trg_immutable_document_edit_history ON public.document_edit_history;
CREATE TRIGGER trg_immutable_document_edit_history
  BEFORE UPDATE OR DELETE ON public.document_edit_history
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_document_edit_history_mutation();

DROP TRIGGER IF EXISTS trg_isolation_document_edit_history ON public.document_edit_history;
CREATE TRIGGER trg_isolation_document_edit_history
  BEFORE INSERT ON public.document_edit_history
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_agency_isolation();

-- Realtime publication for live sync across tabs/devices
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.document_edit_history REPLICA IDENTITY FULL;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.document_edit_history;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;


-- ------------------------------------------------------------------------------
-- 3. INTERNAL EDITOR DISPLAY NAME HELPER
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._resolve_editor_name(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_name TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN 'System';
  END IF;

  SELECT COALESCE(
    NULLIF(TRIM(p.full_name), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
    NULLIF(split_part(COALESCE(u.email, ''), '@', 1), ''),
    'Agency User'
  )
  INTO v_name
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = p_user_id
  LIMIT 1;

  RETURN COALESCE(v_name, 'Agency User');
END;
$$;

REVOKE ALL ON FUNCTION public._resolve_editor_name(UUID) FROM PUBLIC, anon, authenticated;


-- ------------------------------------------------------------------------------
-- 4. ATOMIC EDIT RPC #1: EDIT BOOKING INVOICE
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.edit_booking_invoice_atomic(
  p_invoice_id UUID,
  p_reason TEXT,
  p_client_amount NUMERIC DEFAULT NULL,
  p_vendor_payable NUMERIC DEFAULT NULL,
  p_due_date DATE DEFAULT NULL,
  p_pnr TEXT DEFAULT NULL,
  p_ticket_no TEXT DEFAULT NULL,
  p_passport_no TEXT DEFAULT NULL,
  p_passengers JSONB DEFAULT NULL,
  p_more_details JSONB DEFAULT NULL,
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
  v_old public.booking_invoices%ROWTYPE;
  v_reason TEXT := TRIM(COALESCE(p_reason, ''));
  v_editor_name TEXT;

  v_old_client_amt NUMERIC;
  v_old_vendor_amt NUMERIC;
  v_new_client_amt NUMERIC;
  v_new_vendor_amt NUMERIC;
  v_paid_amt NUMERIC;
  v_new_profit NUMERIC;
  v_new_status TEXT;

  v_new_due_date DATE;
  v_new_pnr TEXT;
  v_new_ticket_no TEXT;
  v_new_passport_no TEXT;
  v_new_passengers JSONB;
  v_new_more_details JSONB;
  v_new_notes TEXT;

  v_old_diff JSONB := '{}'::jsonb;
  v_new_diff JSONB := '{}'::jsonb;
  v_changed_fields TEXT[] := '{}'::text[];
  v_affects_ledger BOOLEAN := false;

  v_rev_group_id UUID := gen_random_uuid();
  v_new_group_id UUID := gen_random_uuid();
  v_party_name TEXT := 'Client';
  v_vendor_name TEXT := 'Vendor';
  v_now TIMESTAMPTZ := now();
  v_result JSONB;
BEGIN
  PERFORM public.assert_module_permission(ARRAY['bookings', 'invoices'], 'write');

  IF NOT public.agency_license_ok(v_agency_id) THEN
    RAISE EXCEPTION 'Trial or license has expired. Please renew your plan to edit invoices. Viewing and exporting remain available.';
  END IF;

  v_cached := public._idempotency_check(v_agency_id, p_request_id);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  IF v_reason = '' THEN
    RAISE EXCEPTION 'Edit reason is required';
  END IF;

  SELECT * INTO v_old
  FROM public.booking_invoices
  WHERE id = p_invoice_id
    AND agency_id = v_agency_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '403 Forbidden: Booking invoice not found in your active agency';
  END IF;

  IF COALESCE(v_old.is_void, false) = true
     OR LOWER(COALESCE(v_old.payment_status, 'unpaid')) IN ('void', 'refunded', 'cancelled') THEN
    RAISE EXCEPTION 'Voided or refunded invoices cannot be edited';
  END IF;

  v_old_client_amt := COALESCE(v_old.client_amount, 0);
  v_old_vendor_amt := COALESCE(v_old.vendor_payable, 0);
  v_paid_amt := GREATEST(0, COALESCE(v_old.paid_amount, 0));

  v_new_client_amt := COALESCE(p_client_amount, v_old_client_amt);
  v_new_vendor_amt := COALESCE(p_vendor_payable, v_old_vendor_amt);

  IF v_new_client_amt <= 0 THEN
    RAISE EXCEPTION 'Total amount must be greater than zero';
  END IF;

  IF v_new_vendor_amt < 0 THEN
    RAISE EXCEPTION 'Amounts cannot be negative';
  END IF;

  IF v_new_client_amt < v_paid_amt THEN
    RAISE EXCEPTION 'Total amount (PKR %) cannot be less than the amount already paid (PKR %). Edit linked payment vouchers first.',
      v_new_client_amt, v_paid_amt;
  END IF;

  v_new_due_date := COALESCE(p_due_date, v_old.due_date);
  v_new_pnr := CASE WHEN p_pnr IS NOT NULL THEN NULLIF(TRIM(p_pnr), '') ELSE v_old.pnr END;
  v_new_ticket_no := CASE WHEN p_ticket_no IS NOT NULL THEN NULLIF(TRIM(p_ticket_no), '') ELSE v_old.ticket_no END;
  v_new_passport_no := CASE WHEN p_passport_no IS NOT NULL THEN NULLIF(TRIM(p_passport_no), '') ELSE v_old.passport_no END;
  v_new_passengers := COALESCE(p_passengers, COALESCE(v_old.passengers, '[]'::jsonb));
  v_new_more_details := COALESCE(p_more_details, COALESCE(v_old.more_details, '{}'::jsonb));
  v_new_notes := CASE WHEN p_notes IS NOT NULL THEN NULLIF(TRIM(p_notes), '') ELSE v_old.notes END;

  -- Build exact field diff (strictly editable fields)
  IF v_new_client_amt IS DISTINCT FROM v_old_client_amt THEN
    v_old_diff := v_old_diff || jsonb_build_object('client_amount', v_old_client_amt);
    v_new_diff := v_new_diff || jsonb_build_object('client_amount', v_new_client_amt);
    v_changed_fields := array_append(v_changed_fields, 'client_amount');
    v_affects_ledger := true;
  END IF;

  IF v_new_vendor_amt IS DISTINCT FROM v_old_vendor_amt THEN
    v_old_diff := v_old_diff || jsonb_build_object('vendor_payable', v_old_vendor_amt);
    v_new_diff := v_new_diff || jsonb_build_object('vendor_payable', v_new_vendor_amt);
    v_changed_fields := array_append(v_changed_fields, 'vendor_payable');
    v_affects_ledger := true;
  END IF;

  IF v_new_due_date IS DISTINCT FROM v_old.due_date THEN
    v_old_diff := v_old_diff || jsonb_build_object('due_date', v_old.due_date);
    v_new_diff := v_new_diff || jsonb_build_object('due_date', v_new_due_date);
    v_changed_fields := array_append(v_changed_fields, 'due_date');
  END IF;

  IF v_new_pnr IS DISTINCT FROM v_old.pnr THEN
    v_old_diff := v_old_diff || jsonb_build_object('pnr', v_old.pnr);
    v_new_diff := v_new_diff || jsonb_build_object('pnr', v_new_pnr);
    v_changed_fields := array_append(v_changed_fields, 'pnr');
  END IF;

  IF v_new_ticket_no IS DISTINCT FROM v_old.ticket_no THEN
    v_old_diff := v_old_diff || jsonb_build_object('ticket_no', v_old.ticket_no);
    v_new_diff := v_new_diff || jsonb_build_object('ticket_no', v_new_ticket_no);
    v_changed_fields := array_append(v_changed_fields, 'ticket_no');
  END IF;

  IF v_new_passport_no IS DISTINCT FROM v_old.passport_no THEN
    v_old_diff := v_old_diff || jsonb_build_object('passport_no', v_old.passport_no);
    v_new_diff := v_new_diff || jsonb_build_object('passport_no', v_new_passport_no);
    v_changed_fields := array_append(v_changed_fields, 'passport_no');
  END IF;

  IF v_new_passengers IS DISTINCT FROM COALESCE(v_old.passengers, '[]'::jsonb) THEN
    v_old_diff := v_old_diff || jsonb_build_object('passengers', COALESCE(v_old.passengers, '[]'::jsonb));
    v_new_diff := v_new_diff || jsonb_build_object('passengers', v_new_passengers);
    v_changed_fields := array_append(v_changed_fields, 'passengers');
  END IF;

  IF v_new_more_details IS DISTINCT FROM COALESCE(v_old.more_details, '{}'::jsonb) THEN
    v_old_diff := v_old_diff || jsonb_build_object('more_details', COALESCE(v_old.more_details, '{}'::jsonb));
    v_new_diff := v_new_diff || jsonb_build_object('more_details', v_new_more_details);
    v_changed_fields := array_append(v_changed_fields, 'more_details');
  END IF;

  IF v_new_notes IS DISTINCT FROM v_old.notes THEN
    v_old_diff := v_old_diff || jsonb_build_object('notes', v_old.notes);
    v_new_diff := v_new_diff || jsonb_build_object('notes', v_new_notes);
    v_changed_fields := array_append(v_changed_fields, 'notes');
  END IF;

  -- No-op check: do nothing if nothing changed
  IF COALESCE(array_length(v_changed_fields, 1), 0) = 0 THEN
    v_result := jsonb_build_object(
      'success', true,
      'no_changes', true,
      'invoice_id', v_old.id,
      'invoice_no', v_old.invoice_no
    );
    PERFORM public._idempotency_store(v_agency_id, p_request_id, 'edit_booking_invoice', v_result);
    RETURN v_result;
  END IF;

  v_new_profit := v_new_client_amt - v_new_vendor_amt;
  IF v_paid_amt >= v_new_client_amt AND v_new_client_amt > 0 THEN
    v_new_status := 'paid';
  ELSIF v_paid_amt > 0 THEN
    v_new_status := 'partial';
  ELSE
    v_new_status := 'unpaid';
  END IF;

  IF v_old.party_id IS NOT NULL THEN
    SELECT COALESCE(name, 'Client') INTO v_party_name
    FROM public.parties
    WHERE id = v_old.party_id AND agency_id = v_agency_id;
  END IF;

  IF v_old.vendor_id IS NOT NULL THEN
    SELECT COALESCE(name, 'Vendor') INTO v_vendor_name
    FROM public.parties
    WHERE id = v_old.vendor_id AND agency_id = v_agency_id;
  END IF;

  -- Ledger correction: never overwrite central_journal_entries — post reversing + new entries
  IF v_affects_ledger THEN
    IF v_old_client_amt > 0 THEN
      INSERT INTO public.central_journal_entries (
        agency_id, entry_group_id, entry_date, account_type, party_id,
        invoice_id, booking_id, debit, credit, description, is_reversal, created_by
      ) VALUES (
        v_agency_id, v_rev_group_id, v_old.invoice_date, 'receivable', v_old.party_id,
        v_old.id, v_old.id, 0, v_old_client_amt,
        'Reversal (Edit) Invoice ' || v_old.invoice_no || ' (' || COALESCE(v_party_name, 'Client') || ') — ' || v_reason,
        true, auth.uid()
      );

      INSERT INTO public.central_journal_entries (
        agency_id, entry_group_id, entry_date, account_type,
        invoice_id, booking_id, debit, credit, description, is_reversal, created_by
      ) VALUES (
        v_agency_id, v_rev_group_id, v_old.invoice_date, 'revenue',
        v_old.id, v_old.id, v_old_client_amt, 0,
        'Reversal (Edit) Sales Revenue: ' || COALESCE(v_old.service, 'Booking') || ' (' || v_old.invoice_no || ')',
        true, auth.uid()
      );
    END IF;

    IF v_old_vendor_amt > 0 THEN
      INSERT INTO public.central_journal_entries (
        agency_id, entry_group_id, entry_date, account_type,
        invoice_id, booking_id, debit, credit, description, is_reversal, created_by
      ) VALUES (
        v_agency_id, v_rev_group_id, v_old.invoice_date, 'expense',
        v_old.id, v_old.id, 0, v_old_vendor_amt,
        'Reversal (Edit) Cost of Service: ' || COALESCE(v_old.service, 'Booking') || ' (' || v_old.invoice_no || ')',
        true, auth.uid()
      );

      IF v_old.vendor_id IS NOT NULL THEN
        INSERT INTO public.central_journal_entries (
          agency_id, entry_group_id, entry_date, account_type, party_id,
          invoice_id, booking_id, debit, credit, description, is_reversal, created_by
        ) VALUES (
          v_agency_id, v_rev_group_id, v_old.invoice_date, 'payable', v_old.vendor_id,
          v_old.id, v_old.id, v_old_vendor_amt, 0,
          'Reversal (Edit) Vendor Payable: ' || v_old.invoice_no || ' (' || COALESCE(v_vendor_name, 'Vendor') || ')',
          true, auth.uid()
        );
      END IF;
    END IF;

    -- Post new corrected entries
    IF v_new_client_amt > 0 THEN
      INSERT INTO public.central_journal_entries (
        agency_id, entry_group_id, entry_date, account_type, party_id,
        invoice_id, booking_id, debit, credit, description, is_reversal, created_by
      ) VALUES (
        v_agency_id, v_new_group_id, v_old.invoice_date, 'receivable', v_old.party_id,
        v_old.id, v_old.id, v_new_client_amt, 0,
        'Edited Booking Invoice ' || v_old.invoice_no || ' (' || COALESCE(v_party_name, 'Client') || ')',
        false, auth.uid()
      );

      INSERT INTO public.central_journal_entries (
        agency_id, entry_group_id, entry_date, account_type,
        invoice_id, booking_id, debit, credit, description, is_reversal, created_by
      ) VALUES (
        v_agency_id, v_new_group_id, v_old.invoice_date, 'revenue',
        v_old.id, v_old.id, 0, v_new_client_amt,
        'Edited Sales Revenue: ' || COALESCE(v_old.service, 'Booking') || ' (' || v_old.invoice_no || ')',
        false, auth.uid()
      );
    END IF;

    IF v_new_vendor_amt > 0 THEN
      INSERT INTO public.central_journal_entries (
        agency_id, entry_group_id, entry_date, account_type,
        invoice_id, booking_id, debit, credit, description, is_reversal, created_by
      ) VALUES (
        v_agency_id, v_new_group_id, v_old.invoice_date, 'expense',
        v_old.id, v_old.id, v_new_vendor_amt, 0,
        'Edited Cost of Service: ' || COALESCE(v_old.service, 'Booking') || ' (' || v_old.invoice_no || ')',
        false, auth.uid()
      );

      IF v_old.vendor_id IS NOT NULL THEN
        INSERT INTO public.central_journal_entries (
          agency_id, entry_group_id, entry_date, account_type, party_id,
          invoice_id, booking_id, debit, credit, description, is_reversal, created_by
        ) VALUES (
          v_agency_id, v_new_group_id, v_old.invoice_date, 'payable', v_old.vendor_id,
          v_old.id, v_old.id, 0, v_new_vendor_amt,
          'Edited Vendor Payable: ' || v_old.invoice_no || ' (' || COALESCE(v_vendor_name, 'Vendor') || ')',
          false, auth.uid()
        );
      END IF;
    END IF;
  END IF;

  -- Update booking_invoices editable + derived fields (locked fields untouched)
  UPDATE public.booking_invoices
  SET client_amount = v_new_client_amt,
      vendor_payable = v_new_vendor_amt,
      profit = v_new_profit,
      payment_status = v_new_status,
      due_date = v_new_due_date,
      pnr = v_new_pnr,
      ticket_no = v_new_ticket_no,
      passport_no = v_new_passport_no,
      passengers = v_new_passengers,
      more_details = v_new_more_details,
      notes = v_new_notes,
      is_edited = true,
      edit_count = COALESCE(edit_count, 0) + 1,
      last_edited_at = v_now,
      last_edited_by = auth.uid(),
      updated_at = v_now
  WHERE id = v_old.id
    AND agency_id = v_agency_id;

  IF v_affects_ledger THEN
    IF v_old.party_id IS NOT NULL THEN
      PERFORM public.recalculate_party_balance(v_old.party_id, v_agency_id);
    END IF;
    IF v_old.vendor_id IS NOT NULL THEN
      PERFORM public.recalculate_party_balance(v_old.vendor_id, v_agency_id);
    END IF;
  END IF;

  v_editor_name := public._resolve_editor_name(auth.uid());

  INSERT INTO public.document_edit_history (
    agency_id, document_type, document_id, document_no,
    edited_by, edited_by_name, edited_at, reason,
    old_values, new_values, changed_fields, affected_ledger, reversal_group_id
  ) VALUES (
    v_agency_id, 'booking_invoice', v_old.id, v_old.invoice_no,
    auth.uid(), v_editor_name, v_now, v_reason,
    v_old_diff, v_new_diff, v_changed_fields, v_affects_ledger,
    CASE WHEN v_affects_ledger THEN v_rev_group_id ELSE NULL END
  );

  v_result := jsonb_build_object(
    'success', true,
    'no_changes', false,
    'invoice_id', v_old.id,
    'invoice_no', v_old.invoice_no,
    'client_amount', v_new_client_amt,
    'vendor_payable', v_new_vendor_amt,
    'paid_amount', v_paid_amt,
    'remaining_amount', GREATEST(0, v_new_client_amt - v_paid_amt),
    'profit', v_new_profit,
    'payment_status', v_new_status,
    'affected_ledger', v_affects_ledger,
    'changed_fields', v_changed_fields,
    'last_edited_at', v_now
  );

  PERFORM public._idempotency_store(v_agency_id, p_request_id, 'edit_booking_invoice', v_result);
  RETURN v_result;
END;
$$;


-- ------------------------------------------------------------------------------
-- 5. ATOMIC EDIT RPC #2: EDIT PAYMENT VOUCHER
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.edit_payment_voucher_atomic(
  p_voucher_id UUID,
  p_reason TEXT,
  p_amount NUMERIC DEFAULT NULL,
  p_payment_mode TEXT DEFAULT NULL,
  p_account_id UUID DEFAULT NULL,
  p_bank_name TEXT DEFAULT NULL,
  p_reference_no TEXT DEFAULT NULL,
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
  v_old public.payment_vouchers%ROWTYPE;
  v_reason TEXT := TRIM(COALESCE(p_reason, ''));
  v_editor_name TEXT;

  v_old_mode TEXT;
  v_new_mode TEXT;
  v_old_amount NUMERIC;
  v_new_amount NUMERIC;
  v_new_bank_name TEXT;
  v_new_account_id UUID;
  v_old_acc_name TEXT;
  v_new_acc_name TEXT;
  v_new_ref_no TEXT;
  v_new_notes TEXT;

  v_old_diff JSONB := '{}'::jsonb;
  v_new_diff JSONB := '{}'::jsonb;
  v_changed_fields TEXT[] := '{}'::text[];
  v_affects_ledger BOOLEAN := false;

  v_rev_group_id UUID := gen_random_uuid();
  v_new_group_id UUID := gen_random_uuid();
  v_party_name TEXT := 'Party';

  v_alloc RECORD;
  v_alloc_count INT := 0;
  v_total_capacity NUMERIC := 0;
  v_rem_to_alloc NUMERIC;
  v_new_alloc NUMERIC;
  v_new_paid NUMERIC;
  v_new_inv_status TEXT;
  v_first_linked_invoice_id UUID := NULL;
  v_linked_invoice_ids UUID[] := '{}'::uuid[];
  v_updated_invoice_ids UUID[] := '{}'::uuid[];

  v_orig_tx public.transactions%ROWTYPE;
  v_has_orig_tx BOOLEAN := false;
  v_rev_tx_id UUID;
  v_now TIMESTAMPTZ := now();
  v_result JSONB;
BEGIN
  PERFORM public.assert_module_permission(ARRAY['bookings', 'invoices', 'clients', 'vendors', 'payments'], 'write');

  IF NOT public.agency_license_ok(v_agency_id) THEN
    RAISE EXCEPTION 'Trial or license has expired. Please renew your plan to edit payment vouchers. Viewing and exporting remain available.';
  END IF;

  v_cached := public._idempotency_check(v_agency_id, p_request_id);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  IF v_reason = '' THEN
    RAISE EXCEPTION 'Edit reason is required';
  END IF;

  SELECT * INTO v_old
  FROM public.payment_vouchers
  WHERE id = p_voucher_id
    AND agency_id = v_agency_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '403 Forbidden: Payment voucher not found in your active agency';
  END IF;

  IF COALESCE(v_old.is_void, false) = true THEN
    RAISE EXCEPTION 'Voided payment vouchers cannot be edited';
  END IF;

  v_old_amount := COALESCE(v_old.amount, 0);
  v_new_amount := COALESCE(p_amount, v_old_amount);

  IF v_new_amount <= 0 THEN
    RAISE EXCEPTION 'Voucher amount must be greater than zero';
  END IF;

  v_old_mode := LOWER(COALESCE(v_old.payment_mode, 'cash'));
  v_new_mode := LOWER(COALESCE(NULLIF(TRIM(COALESCE(p_payment_mode, '')), ''), v_old_mode));

  IF v_new_mode NOT IN ('cash', 'bank', 'transfer') THEN
    RAISE EXCEPTION 'Invalid payment mode: %', v_new_mode;
  END IF;

  IF v_new_mode = 'cash' THEN
    v_new_bank_name := NULL;
  ELSIF p_bank_name IS NOT NULL THEN
    v_new_bank_name := NULLIF(TRIM(p_bank_name), '');
  ELSE
    v_new_bank_name := v_old.bank_name;
  END IF;

  IF NOT COALESCE(v_old.is_adjustment, false) THEN
    IF p_account_id IS NOT NULL THEN
      v_new_account_id := public.resolve_agency_account(v_agency_id, p_account_id, v_new_mode, v_new_bank_name);
    ELSIF v_new_mode IS DISTINCT FROM v_old_mode OR v_new_bank_name IS DISTINCT FROM v_old.bank_name OR v_old.account_id IS NULL THEN
      v_new_account_id := public.resolve_agency_account(v_agency_id, NULL, v_new_mode, v_new_bank_name);
    ELSE
      v_new_account_id := v_old.account_id;
    END IF;
  ELSE
    v_new_account_id := v_old.account_id;
  END IF;

  v_new_ref_no := CASE WHEN p_reference_no IS NOT NULL THEN NULLIF(TRIM(p_reference_no), '') ELSE v_old.reference_no END;
  v_new_notes := CASE WHEN p_notes IS NOT NULL THEN NULLIF(TRIM(p_notes), '') ELSE v_old.notes END;

  -- Resolve human-readable account names for audit trail
  IF v_old.account_id IS NOT NULL THEN
    SELECT name INTO v_old_acc_name FROM public.accounts WHERE id = v_old.account_id AND agency_id = v_agency_id;
  END IF;
  IF v_new_account_id IS NOT NULL THEN
    SELECT name INTO v_new_acc_name FROM public.accounts WHERE id = v_new_account_id AND agency_id = v_agency_id;
  END IF;

  -- Build field-level diff
  IF v_new_amount IS DISTINCT FROM v_old_amount THEN
    v_old_diff := v_old_diff || jsonb_build_object('amount', v_old_amount);
    v_new_diff := v_new_diff || jsonb_build_object('amount', v_new_amount);
    v_changed_fields := array_append(v_changed_fields, 'amount');
    v_affects_ledger := true;
  END IF;

  IF v_new_mode IS DISTINCT FROM v_old_mode THEN
    v_old_diff := v_old_diff || jsonb_build_object('payment_mode', v_old_mode);
    v_new_diff := v_new_diff || jsonb_build_object('payment_mode', v_new_mode);
    v_changed_fields := array_append(v_changed_fields, 'payment_mode');
    v_affects_ledger := true;
  END IF;

  IF v_new_account_id IS DISTINCT FROM v_old.account_id THEN
    v_old_diff := v_old_diff || jsonb_build_object('account_name', COALESCE(v_old_acc_name, v_old_mode));
    v_new_diff := v_new_diff || jsonb_build_object('account_name', COALESCE(v_new_acc_name, v_new_mode));
    v_changed_fields := array_append(v_changed_fields, 'account_id');
    v_affects_ledger := true;
  END IF;

  IF v_new_bank_name IS DISTINCT FROM v_old.bank_name THEN
    v_old_diff := v_old_diff || jsonb_build_object('bank_name', v_old.bank_name);
    v_new_diff := v_new_diff || jsonb_build_object('bank_name', v_new_bank_name);
    v_changed_fields := array_append(v_changed_fields, 'bank_name');
  END IF;

  IF v_new_ref_no IS DISTINCT FROM v_old.reference_no THEN
    v_old_diff := v_old_diff || jsonb_build_object('reference_no', v_old.reference_no);
    v_new_diff := v_new_diff || jsonb_build_object('reference_no', v_new_ref_no);
    v_changed_fields := array_append(v_changed_fields, 'reference_no');
  END IF;

  IF v_new_notes IS DISTINCT FROM v_old.notes THEN
    v_old_diff := v_old_diff || jsonb_build_object('notes', v_old.notes);
    v_new_diff := v_new_diff || jsonb_build_object('notes', v_new_notes);
    v_changed_fields := array_append(v_changed_fields, 'notes');
  END IF;

  -- No-op check
  IF COALESCE(array_length(v_changed_fields, 1), 0) = 0 THEN
    v_result := jsonb_build_object(
      'success', true,
      'no_changes', true,
      'voucher_id', v_old.id,
      'voucher_no', v_old.voucher_no
    );
    PERFORM public._idempotency_store(v_agency_id, p_request_id, 'edit_payment_voucher', v_result);
    RETURN v_result;
  END IF;

  IF v_old.party_id IS NOT NULL THEN
    SELECT COALESCE(name, 'Party') INTO v_party_name
    FROM public.parties
    WHERE id = v_old.party_id AND agency_id = v_agency_id;
  END IF;

  -- Linked invoice allocation validation & recalculation (when amount changes on received vouchers)
  SELECT ia.invoice_id
  INTO v_first_linked_invoice_id
  FROM public.invoice_allocations ia
  WHERE ia.agency_id = v_agency_id
    AND ia.voucher_id = v_old.id
  ORDER BY ia.created_at ASC
  LIMIT 1;

  IF v_old.direction = 'received' AND (v_new_amount IS DISTINCT FROM v_old_amount) THEN
    -- Lock all linked invoices + allocations and compute total remaining capacity
    FOR v_alloc IN
      SELECT
        ia.id AS alloc_id,
        ia.invoice_id,
        ia.allocated_amount,
        bi.client_amount,
        bi.paid_amount,
        bi.is_void,
        bi.payment_status,
        bi.invoice_date,
        bi.created_at
      FROM public.invoice_allocations ia
      JOIN public.booking_invoices bi
        ON bi.id = ia.invoice_id AND bi.agency_id = v_agency_id
      WHERE ia.agency_id = v_agency_id
        AND ia.voucher_id = v_old.id
      ORDER BY bi.invoice_date ASC, bi.created_at ASC, ia.created_at ASC
      FOR UPDATE OF bi
    LOOP
      v_alloc_count := v_alloc_count + 1;
      v_linked_invoice_ids := array_append(v_linked_invoice_ids, v_alloc.invoice_id);
      IF COALESCE(v_alloc.is_void, false) = true
         OR LOWER(COALESCE(v_alloc.payment_status, '')) IN ('void', 'refunded', 'cancelled') THEN
        RAISE EXCEPTION 'Cannot change amount on a voucher linked to a voided invoice';
      END IF;
      v_total_capacity := v_total_capacity + GREATEST(
        0,
        COALESCE(v_alloc.client_amount, 0) - GREATEST(0, COALESCE(v_alloc.paid_amount, 0) - COALESCE(v_alloc.allocated_amount, 0))
      );
    END LOOP;

    IF v_alloc_count > 0 THEN
      IF v_new_amount > v_total_capacity THEN
        RAISE EXCEPTION 'Edited voucher amount (PKR %) exceeds the unpaid total of the linked invoice(s) (PKR %).',
          v_new_amount, v_total_capacity;
      END IF;

      -- 1) Strip old allocations from linked invoices
      FOR v_alloc IN
        SELECT ia.invoice_id, ia.allocated_amount
        FROM public.invoice_allocations ia
        WHERE ia.agency_id = v_agency_id AND ia.voucher_id = v_old.id
      LOOP
        UPDATE public.booking_invoices
        SET paid_amount = GREATEST(0, COALESCE(paid_amount, 0) - COALESCE(v_alloc.allocated_amount, 0)),
            updated_at = v_now
        WHERE id = v_alloc.invoice_id AND agency_id = v_agency_id;
      END LOOP;

      DELETE FROM public.invoice_allocations
      WHERE agency_id = v_agency_id AND voucher_id = v_old.id;

      -- 2) Re-allocate v_new_amount FIFO across the previously linked invoices
      v_rem_to_alloc := v_new_amount;
      FOR v_alloc IN
        SELECT bi.id, bi.client_amount, bi.paid_amount
        FROM public.booking_invoices bi
        WHERE bi.agency_id = v_agency_id
          AND bi.id = ANY(v_linked_invoice_ids)
          AND COALESCE(bi.is_void, false) = false
          AND COALESCE(bi.payment_status, 'unpaid') NOT IN ('void', 'refunded', 'cancelled')
        ORDER BY CASE WHEN bi.id = v_first_linked_invoice_id THEN 0 ELSE 1 END, bi.invoice_date ASC, bi.created_at ASC
      LOOP
        IF v_rem_to_alloc > 0 THEN
          v_new_alloc := LEAST(
            v_rem_to_alloc,
            GREATEST(0, COALESCE(v_alloc.client_amount, 0) - COALESCE(v_alloc.paid_amount, 0))
          );
        ELSE
          v_new_alloc := 0;
        END IF;

        v_new_paid := COALESCE(v_alloc.paid_amount, 0) + v_new_alloc;
        v_new_inv_status := CASE
          WHEN v_new_paid >= COALESCE(v_alloc.client_amount, 0) AND COALESCE(v_alloc.client_amount, 0) > 0 THEN 'paid'
          WHEN v_new_paid > 0 THEN 'partial'
          ELSE 'unpaid'
        END;

        UPDATE public.booking_invoices
        SET paid_amount = v_new_paid,
            payment_status = v_new_inv_status,
            updated_at = v_now
        WHERE id = v_alloc.id AND agency_id = v_agency_id;

        IF v_new_alloc > 0 THEN
          INSERT INTO public.invoice_allocations (
            agency_id, voucher_id, invoice_id, allocated_amount
          ) VALUES (
            v_agency_id, v_old.id, v_alloc.id, v_new_alloc
          );
          v_rem_to_alloc := v_rem_to_alloc - v_new_alloc;
        END IF;

        v_updated_invoice_ids := array_append(v_updated_invoice_ids, v_alloc.id);
      END LOOP;
    END IF;
  END IF;

  -- Ledger correction: post reversing + new journal entries and reverse/repost cash-bank transaction
  IF v_affects_ledger THEN
    IF v_old.direction = 'received' THEN
      IF NOT COALESCE(v_old.is_adjustment, false) THEN
        INSERT INTO public.central_journal_entries (
          agency_id, entry_group_id, entry_date, account_type, account_id, voucher_id,
          debit, credit, description, is_reversal, created_by
        ) VALUES (
          v_agency_id, v_rev_group_id, v_old.voucher_date, 'cash_bank', v_old.account_id, v_old.id,
          0, v_old_amount,
          'Reversal (Edit) Receipt Voucher ' || v_old.voucher_no || ' — ' || v_reason,
          true, auth.uid()
        );
      END IF;

      INSERT INTO public.central_journal_entries (
        agency_id, entry_group_id, entry_date, account_type, party_id, voucher_id,
        debit, credit, description, is_reversal, created_by
      ) VALUES (
        v_agency_id, v_rev_group_id, v_old.voucher_date, 'receivable', v_old.party_id, v_old.id,
        v_old_amount, 0,
        'Reversal (Edit) Payment from ' || COALESCE(v_party_name, 'Party') || ' (' || v_old.voucher_no || ')',
        true, auth.uid()
      );

      -- Post new corrected entries
      IF NOT COALESCE(v_old.is_adjustment, false) THEN
        INSERT INTO public.central_journal_entries (
          agency_id, entry_group_id, entry_date, account_type, account_id, voucher_id,
          debit, credit, description, is_reversal, created_by
        ) VALUES (
          v_agency_id, v_new_group_id, v_old.voucher_date, 'cash_bank', v_new_account_id, v_old.id,
          v_new_amount, 0,
          'Edited Receipt Voucher ' || v_old.voucher_no || ' (' || COALESCE(v_party_name, 'Party') || ')',
          false, auth.uid()
        );
      END IF;

      INSERT INTO public.central_journal_entries (
        agency_id, entry_group_id, entry_date, account_type, party_id, voucher_id,
        debit, credit, description, is_reversal, created_by
      ) VALUES (
        v_agency_id, v_new_group_id, v_old.voucher_date, 'receivable', v_old.party_id, v_old.id,
        0, v_new_amount,
        'Edited Payment from ' || COALESCE(v_party_name, 'Party') || ' (' || v_old.voucher_no || ')',
        false, auth.uid()
      );
    ELSE
      -- direction = 'paid'
      INSERT INTO public.central_journal_entries (
        agency_id, entry_group_id, entry_date, account_type, party_id, voucher_id,
        debit, credit, description, is_reversal, created_by
      ) VALUES (
        v_agency_id, v_rev_group_id, v_old.voucher_date, 'payable', v_old.party_id, v_old.id,
        0, v_old_amount,
        'Reversal (Edit) Payment to ' || COALESCE(v_party_name, 'Vendor') || ' (' || v_old.voucher_no || ') — ' || v_reason,
        true, auth.uid()
      );

      IF NOT COALESCE(v_old.is_adjustment, false) THEN
        INSERT INTO public.central_journal_entries (
          agency_id, entry_group_id, entry_date, account_type, account_id, voucher_id,
          debit, credit, description, is_reversal, created_by
        ) VALUES (
          v_agency_id, v_rev_group_id, v_old.voucher_date, 'cash_bank', v_old.account_id, v_old.id,
          v_old_amount, 0,
          'Reversal (Edit) Payment Voucher ' || v_old.voucher_no,
          true, auth.uid()
        );
      END IF;

      -- Post new corrected entries
      INSERT INTO public.central_journal_entries (
        agency_id, entry_group_id, entry_date, account_type, party_id, voucher_id,
        debit, credit, description, is_reversal, created_by
      ) VALUES (
        v_agency_id, v_new_group_id, v_old.voucher_date, 'payable', v_old.party_id, v_old.id,
        v_new_amount, 0,
        'Edited Payment to ' || COALESCE(v_party_name, 'Vendor') || ' (' || v_old.voucher_no || ')',
        false, auth.uid()
      );

      IF NOT COALESCE(v_old.is_adjustment, false) THEN
        INSERT INTO public.central_journal_entries (
          agency_id, entry_group_id, entry_date, account_type, account_id, voucher_id,
          debit, credit, description, is_reversal, created_by
        ) VALUES (
          v_agency_id, v_new_group_id, v_old.voucher_date, 'cash_bank', v_new_account_id, v_old.id,
          0, v_new_amount,
          'Edited Payment Voucher ' || v_old.voucher_no,
          false, auth.uid()
        );
      END IF;
    END IF;

    -- Reverse original cash/bank transaction & post new active transaction
    IF NOT COALESCE(v_old.is_adjustment, false) THEN
      SELECT t.* INTO v_orig_tx
      FROM public.transactions t
      WHERE t.agency_id = v_agency_id
        AND t.reversed_of IS NULL
        AND (
          (t.legacy_source = 'payment_vouchers' AND t.legacy_id = v_old.id)
          OR (
            t.type = (CASE WHEN v_old.direction = 'received' THEN 'payment_in' ELSE 'payment_out' END)
            AND (
              t.reference_no = v_old.voucher_no
              OR (v_old.reference_no IS NOT NULL AND t.reference_no = v_old.reference_no)
            )
          )
        )
      ORDER BY
        CASE WHEN t.legacy_source = 'payment_vouchers' AND t.legacy_id = v_old.id THEN 0 ELSE 1 END,
        CASE WHEN t.party_id IS NOT DISTINCT FROM v_old.party_id THEN 0 ELSE 1 END,
        CASE WHEN t.account_id IS NOT DISTINCT FROM v_old.account_id THEN 0 ELSE 1 END,
        t.created_at DESC
      LIMIT 1
      FOR UPDATE;

      v_has_orig_tx := FOUND;

      IF v_has_orig_tx THEN
        INSERT INTO public.transactions (
          agency_id, date, type, party_id, party_type, booking_id, account_id,
          debit, credit, method, reference_no, category, notes, reversed_of,
          legacy_source, legacy_id, created_by
        ) VALUES (
          v_agency_id, v_old.voucher_date, 'adjustment', v_orig_tx.party_id, v_orig_tx.party_type,
          v_orig_tx.booking_id, v_orig_tx.account_id, v_orig_tx.credit, v_orig_tx.debit, v_orig_tx.method,
          'REV-' || COALESCE(v_orig_tx.reference_no, v_old.voucher_no),
          'Reversal', 'Edit Reversal (' || v_old.voucher_no || '): ' || v_reason,
          v_orig_tx.id, 'payment_vouchers', v_old.id, auth.uid()
        )
        RETURNING id INTO v_rev_tx_id;

        UPDATE public.transactions
        SET reversed_of = v_rev_tx_id,
            notes = COALESCE(NULLIF(notes, '') || ' | ', '') || 'REVERSED ON EDIT: ' || v_reason,
            updated_at = v_now
        WHERE id = v_orig_tx.id
          AND agency_id = v_agency_id;
      END IF;

      INSERT INTO public.transactions (
        agency_id, date, type, party_id, party_type, booking_id, account_id,
        debit, credit, method, reference_no, category, notes,
        legacy_source, legacy_id, created_by
      ) VALUES (
        v_agency_id,
        v_old.voucher_date,
        CASE WHEN v_old.direction = 'received' THEN 'payment_in' ELSE 'payment_out' END,
        v_old.party_id,
        CASE WHEN v_old.direction = 'received' THEN 'client' ELSE 'vendor' END,
        COALESCE(v_first_linked_invoice_id, CASE WHEN v_has_orig_tx THEN v_orig_tx.booking_id ELSE NULL END),
        v_new_account_id,
        CASE WHEN v_old.direction = 'received' THEN v_new_amount ELSE 0 END,
        CASE WHEN v_old.direction = 'paid' THEN v_new_amount ELSE 0 END,
        v_new_mode,
        COALESCE(v_new_ref_no, v_old.voucher_no),
        CASE WHEN v_old.direction = 'received' THEN 'Receipt Voucher' ELSE 'Vendor Payout' END,
        v_new_notes,
        'payment_vouchers',
        v_old.id,
        auth.uid()
      );
    END IF;
  ELSIF NOT COALESCE(v_old.is_adjustment, false) THEN
    -- Only reference_no or notes changed (amount/account/mode unchanged): update non-financial text on active tx if linked
    UPDATE public.transactions
    SET reference_no = COALESCE(v_new_ref_no, v_old.voucher_no),
        notes = v_new_notes,
        updated_at = v_now
    WHERE agency_id = v_agency_id
      AND reversed_of IS NULL
      AND (
        (legacy_source = 'payment_vouchers' AND legacy_id = v_old.id)
        OR (
          type = (CASE WHEN v_old.direction = 'received' THEN 'payment_in' ELSE 'payment_out' END)
          AND (reference_no = v_old.voucher_no OR (v_old.reference_no IS NOT NULL AND reference_no = v_old.reference_no))
        )
      );
  END IF;

  -- Update payment_vouchers editable + audit fields (locked fields untouched)
  UPDATE public.payment_vouchers
  SET amount = v_new_amount,
      payment_mode = v_new_mode,
      account_id = v_new_account_id,
      bank_name = v_new_bank_name,
      reference_no = v_new_ref_no,
      notes = v_new_notes,
      is_edited = true,
      edit_count = COALESCE(edit_count, 0) + 1,
      last_edited_at = v_now,
      last_edited_by = auth.uid(),
      updated_at = v_now
  WHERE id = v_old.id
    AND agency_id = v_agency_id;

  IF v_affects_ledger AND v_old.party_id IS NOT NULL THEN
    PERFORM public.recalculate_party_balance(v_old.party_id, v_agency_id);
  END IF;

  v_editor_name := public._resolve_editor_name(auth.uid());

  INSERT INTO public.document_edit_history (
    agency_id, document_type, document_id, document_no,
    edited_by, edited_by_name, edited_at, reason,
    old_values, new_values, changed_fields, affected_ledger, reversal_group_id
  ) VALUES (
    v_agency_id, 'payment_voucher', v_old.id, v_old.voucher_no,
    auth.uid(), v_editor_name, v_now, v_reason,
    v_old_diff, v_new_diff, v_changed_fields, v_affects_ledger,
    CASE WHEN v_affects_ledger THEN v_rev_group_id ELSE NULL END
  );

  v_result := jsonb_build_object(
    'success', true,
    'no_changes', false,
    'voucher_id', v_old.id,
    'voucher_no', v_old.voucher_no,
    'amount', v_new_amount,
    'payment_mode', v_new_mode,
    'account_id', v_new_account_id,
    'affected_ledger', v_affects_ledger,
    'updated_invoice_ids', v_updated_invoice_ids,
    'changed_fields', v_changed_fields,
    'last_edited_at', v_now
  );

  PERFORM public._idempotency_store(v_agency_id, p_request_id, 'edit_payment_voucher', v_result);
  RETURN v_result;
END;
$$;


-- ------------------------------------------------------------------------------
-- 6. ATOMIC EDIT RPC #3: EDIT REFUND / VOID
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.edit_refund_atomic(
  p_refund_id UUID,
  p_reason TEXT,
  p_refund_amount NUMERIC DEFAULT NULL,
  p_vendor_refund_amount NUMERIC DEFAULT NULL,
  p_deductions NUMERIC DEFAULT NULL,
  p_refund_reason TEXT DEFAULT NULL,
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
  v_old public.refunds%ROWTYPE;
  v_reason TEXT := TRIM(COALESCE(p_reason, ''));
  v_editor_name TEXT;

  v_old_client_amt NUMERIC;
  v_new_client_amt NUMERIC;
  v_old_vendor_amt NUMERIC;
  v_new_vendor_amt NUMERIC;
  v_old_deductions NUMERIC;
  v_new_deductions NUMERIC;
  v_new_refund_reason TEXT;
  v_new_notes TEXT;
  v_refund_type TEXT;
  v_acc_id UUID;
  v_party_id UUID;
  v_vendor_id UUID := NULL;
  v_inv public.booking_invoices%ROWTYPE;
  v_has_inv BOOLEAN := false;

  v_old_diff JSONB := '{}'::jsonb;
  v_new_diff JSONB := '{}'::jsonb;
  v_changed_fields TEXT[] := '{}'::text[];
  v_affects_ledger BOOLEAN := false;

  v_rev_group_id UUID := gen_random_uuid();
  v_new_group_id UUID := gen_random_uuid();
  v_orig_tx public.transactions%ROWTYPE;
  v_has_orig_tx BOOLEAN := false;
  v_rev_tx_id UUID;
  v_ref_no TEXT;
  v_now TIMESTAMPTZ := now();
  v_result JSONB;
BEGIN
  PERFORM public.assert_module_permission(ARRAY['bookings', 'invoices', 'clients'], 'write');

  IF NOT public.agency_license_ok(v_agency_id) THEN
    RAISE EXCEPTION 'Trial or license has expired. Please renew your plan to edit refunds. Viewing and exporting remain available.';
  END IF;

  v_cached := public._idempotency_check(v_agency_id, p_request_id);
  IF v_cached IS NOT NULL THEN
    RETURN v_cached;
  END IF;

  IF v_reason = '' THEN
    RAISE EXCEPTION 'Edit reason is required';
  END IF;

  SELECT * INTO v_old
  FROM public.refunds
  WHERE id = p_refund_id
    AND agency_id = v_agency_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '403 Forbidden: Refund record not found in your active agency';
  END IF;

  v_refund_type := LOWER(COALESCE(v_old.refund_type, 'refund'));
  v_old_client_amt := COALESCE(v_old.client_refund_amount, v_old.refund_amount, 0);
  v_new_client_amt := COALESCE(p_refund_amount, v_old_client_amt);
  v_old_vendor_amt := COALESCE(v_old.vendor_refund_amount, 0);
  v_new_vendor_amt := COALESCE(p_vendor_refund_amount, v_old_vendor_amt);
  v_old_deductions := COALESCE(v_old.deductions, 0);
  v_new_deductions := COALESCE(p_deductions, v_old_deductions);

  IF v_new_client_amt < 0 OR v_new_vendor_amt < 0 OR v_new_deductions < 0 THEN
    RAISE EXCEPTION 'Amounts cannot be negative';
  END IF;

  IF v_refund_type <> 'void' AND v_new_client_amt <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  IF v_old.booking_id IS NOT NULL THEN
    SELECT * INTO v_inv
    FROM public.booking_invoices
    WHERE id = v_old.booking_id
      AND agency_id = v_agency_id;

    IF FOUND THEN
      v_has_inv := true;
      v_vendor_id := v_inv.vendor_id;
      IF COALESCE(v_inv.client_amount, 0) > 0
         AND v_new_client_amt > COALESCE(v_inv.client_amount, 0)
         AND v_new_client_amt > v_old_client_amt THEN
        RAISE EXCEPTION 'Refund amount (PKR %) cannot exceed the original invoice total (PKR %).',
          v_new_client_amt, v_inv.client_amount;
      END IF;
    END IF;
  END IF;

  v_new_refund_reason := CASE
    WHEN p_refund_reason IS NOT NULL THEN NULLIF(TRIM(p_refund_reason), '')
    ELSE v_old.reason
  END;

  IF v_new_refund_reason IS NULL THEN
    RAISE EXCEPTION 'Please provide a refund or void reason';
  END IF;

  v_new_notes := CASE
    WHEN p_notes IS NOT NULL THEN NULLIF(TRIM(p_notes), '')
    ELSE v_old.notes
  END;

  -- Build field-level diff
  IF v_new_client_amt IS DISTINCT FROM v_old_client_amt THEN
    v_old_diff := v_old_diff || jsonb_build_object('refund_amount', v_old_client_amt);
    v_new_diff := v_new_diff || jsonb_build_object('refund_amount', v_new_client_amt);
    v_changed_fields := array_append(v_changed_fields, 'refund_amount');
    v_affects_ledger := true;
  END IF;

  IF v_new_vendor_amt IS DISTINCT FROM v_old_vendor_amt THEN
    v_old_diff := v_old_diff || jsonb_build_object('vendor_refund_amount', v_old_vendor_amt);
    v_new_diff := v_new_diff || jsonb_build_object('vendor_refund_amount', v_new_vendor_amt);
    v_changed_fields := array_append(v_changed_fields, 'vendor_refund_amount');
    v_affects_ledger := true;
  END IF;

  IF v_new_deductions IS DISTINCT FROM v_old_deductions THEN
    v_old_diff := v_old_diff || jsonb_build_object('deductions', v_old_deductions);
    v_new_diff := v_new_diff || jsonb_build_object('deductions', v_new_deductions);
    v_changed_fields := array_append(v_changed_fields, 'deductions');
  END IF;

  IF v_new_refund_reason IS DISTINCT FROM v_old.reason THEN
    v_old_diff := v_old_diff || jsonb_build_object('reason', v_old.reason);
    v_new_diff := v_new_diff || jsonb_build_object('reason', v_new_refund_reason);
    v_changed_fields := array_append(v_changed_fields, 'reason');
  END IF;

  IF v_new_notes IS DISTINCT FROM v_old.notes THEN
    v_old_diff := v_old_diff || jsonb_build_object('notes', v_old.notes);
    v_new_diff := v_new_diff || jsonb_build_object('notes', v_new_notes);
    v_changed_fields := array_append(v_changed_fields, 'notes');
  END IF;

  -- No-op check
  IF COALESCE(array_length(v_changed_fields, 1), 0) = 0 THEN
    v_result := jsonb_build_object(
      'success', true,
      'no_changes', true,
      'refund_id', v_old.id,
      'refund_no', COALESCE(v_old.refund_no, 'REF-' || UPPER(LEFT(v_old.id::text, 6)))
    );
    PERFORM public._idempotency_store(v_agency_id, p_request_id, 'edit_refund', v_result);
    RETURN v_result;
  END IF;

  v_party_id := COALESCE(v_old.party_id, v_old.client_id);
  v_ref_no := COALESCE(v_old.refund_no, 'REF-' || UPPER(LEFT(v_old.id::text, 6)));

  IF v_old.account_id IS NOT NULL THEN
    v_acc_id := v_old.account_id;
  ELSIF v_old_client_amt > 0 OR v_new_client_amt > 0 THEN
    v_acc_id := public.resolve_agency_account(v_agency_id, NULL, COALESCE(v_old.payment_mode, 'cash'), v_old.bank_name);
  ELSE
    v_acc_id := NULL;
  END IF;

  -- Ledger correction when monetary amounts changed
  IF v_affects_ledger THEN
    IF v_old_client_amt > 0 THEN
      INSERT INTO public.central_journal_entries (
        agency_id, entry_group_id, entry_date, account_type, party_id,
        invoice_id, booking_id, refund_id, debit, credit, description, is_reversal, created_by
      ) VALUES (
        v_agency_id, v_rev_group_id, v_old.refund_date, 'revenue', v_party_id,
        v_old.booking_id, v_old.booking_id, v_old.id, 0, v_old_client_amt,
        'Reversal (Edit) Refund / Void: ' || v_ref_no || ' — ' || v_reason,
        true, auth.uid()
      );

      INSERT INTO public.central_journal_entries (
        agency_id, entry_group_id, entry_date, account_type, account_id,
        invoice_id, booking_id, refund_id, debit, credit, description, is_reversal, created_by
      ) VALUES (
        v_agency_id, v_rev_group_id, v_old.refund_date, 'cash_bank', v_acc_id,
        v_old.booking_id, v_old.booking_id, v_old.id, v_old_client_amt, 0,
        'Reversal (Edit) Refund Paid Out (' || v_ref_no || ')',
        true, auth.uid()
      );
    END IF;

    IF v_new_client_amt > 0 THEN
      INSERT INTO public.central_journal_entries (
        agency_id, entry_group_id, entry_date, account_type, party_id,
        invoice_id, booking_id, refund_id, debit, credit, description, is_reversal, created_by
      ) VALUES (
        v_agency_id, v_new_group_id, v_old.refund_date, 'revenue', v_party_id,
        v_old.booking_id, v_old.booking_id, v_old.id, v_new_client_amt, 0,
        'Edited Refund / Void: ' || v_ref_no || COALESCE(' (' || v_new_refund_reason || ')', ''),
        false, auth.uid()
      );

      INSERT INTO public.central_journal_entries (
        agency_id, entry_group_id, entry_date, account_type, account_id,
        invoice_id, booking_id, refund_id, debit, credit, description, is_reversal, created_by
      ) VALUES (
        v_agency_id, v_new_group_id, v_old.refund_date, 'cash_bank', v_acc_id,
        v_old.booking_id, v_old.booking_id, v_old.id, 0, v_new_client_amt,
        'Edited Refund Paid Out (' || v_ref_no || ')',
        false, auth.uid()
      );
    END IF;

    -- Reverse original cash/bank refund transaction (if any) & post corrected active transaction
    IF v_old_client_amt IS DISTINCT FROM v_new_client_amt THEN
      SELECT t.* INTO v_orig_tx
      FROM public.transactions t
      WHERE t.agency_id = v_agency_id
        AND t.reversed_of IS NULL
        AND (
          (t.legacy_source = 'refunds' AND t.legacy_id = v_old.id)
          OR (
            t.type = 'refund'
            AND (
              (v_old.refund_no IS NOT NULL AND t.reference_no = v_old.refund_no)
              OR (v_old.booking_id IS NOT NULL AND t.booking_id = v_old.booking_id AND COALESCE(t.credit, 0) = v_old_client_amt)
            )
          )
        )
      ORDER BY
        CASE WHEN t.legacy_source = 'refunds' AND t.legacy_id = v_old.id THEN 0 ELSE 1 END,
        t.created_at DESC
      LIMIT 1
      FOR UPDATE;

      v_has_orig_tx := FOUND;

      IF v_has_orig_tx THEN
        INSERT INTO public.transactions (
          agency_id, date, type, party_id, party_type, booking_id, account_id,
          debit, credit, method, reference_no, category, notes, reversed_of,
          legacy_source, legacy_id, created_by
        ) VALUES (
          v_agency_id, v_old.refund_date, 'adjustment', v_orig_tx.party_id, v_orig_tx.party_type,
          v_orig_tx.booking_id, v_orig_tx.account_id, v_orig_tx.credit, v_orig_tx.debit, v_orig_tx.method,
          'REV-' || COALESCE(v_orig_tx.reference_no, v_ref_no),
          'Reversal', 'Edit Reversal (' || v_ref_no || '): ' || v_reason,
          v_orig_tx.id, 'refunds', v_old.id, auth.uid()
        )
        RETURNING id INTO v_rev_tx_id;

        UPDATE public.transactions
        SET reversed_of = v_rev_tx_id,
            notes = COALESCE(NULLIF(notes, '') || ' | ', '') || 'REVERSED ON EDIT: ' || v_reason,
            updated_at = v_now
        WHERE id = v_orig_tx.id
          AND agency_id = v_agency_id;
      END IF;

      IF v_new_client_amt > 0 THEN
        INSERT INTO public.transactions (
          agency_id, date, type, party_id, party_type, booking_id, account_id,
          debit, credit, method, reference_no, category, notes,
          legacy_source, legacy_id, created_by
        ) VALUES (
          v_agency_id,
          v_old.refund_date,
          'refund',
          v_party_id,
          'client',
          v_old.booking_id,
          v_acc_id,
          0,
          v_new_client_amt,
          LOWER(COALESCE(v_old.payment_mode, 'cash')),
          v_ref_no,
          'Refund',
          COALESCE(v_new_notes, v_new_refund_reason),
          'refunds',
          v_old.id,
          auth.uid()
        );
      END IF;
    END IF;
  END IF;

  -- Sync companion refund_void_records if one exists
  IF v_old.refund_no IS NOT NULL THEN
    UPDATE public.refund_void_records
    SET client_refund_amount = v_new_client_amt,
        vendor_refund_amount = v_new_vendor_amt,
        reason = v_new_refund_reason
    WHERE agency_id = v_agency_id
      AND record_no = v_old.refund_no;
  END IF;

  -- Update refunds editable + audit fields (locked fields untouched)
  UPDATE public.refunds
  SET refund_amount = v_new_client_amt,
      client_refund_amount = v_new_client_amt,
      vendor_refund_amount = v_new_vendor_amt,
      deductions = v_new_deductions,
      reason = v_new_refund_reason,
      notes = v_new_notes,
      account_id = v_acc_id,
      is_edited = true,
      edit_count = COALESCE(edit_count, 0) + 1,
      last_edited_at = v_now,
      last_edited_by = auth.uid(),
      updated_at = v_now
  WHERE id = v_old.id
    AND agency_id = v_agency_id;

  IF v_affects_ledger THEN
    IF v_party_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.parties WHERE id = v_party_id AND agency_id = v_agency_id
    ) THEN
      PERFORM public.recalculate_party_balance(v_party_id, v_agency_id);
    END IF;

    IF v_vendor_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.parties WHERE id = v_vendor_id AND agency_id = v_agency_id
    ) THEN
      PERFORM public.recalculate_party_balance(v_vendor_id, v_agency_id);
    END IF;
  END IF;

  v_editor_name := public._resolve_editor_name(auth.uid());

  INSERT INTO public.document_edit_history (
    agency_id, document_type, document_id, document_no,
    edited_by, edited_by_name, edited_at, reason,
    old_values, new_values, changed_fields, affected_ledger, reversal_group_id
  ) VALUES (
    v_agency_id, 'refund', v_old.id, v_ref_no,
    auth.uid(), v_editor_name, v_now, v_reason,
    v_old_diff, v_new_diff, v_changed_fields, v_affects_ledger,
    CASE WHEN v_affects_ledger THEN v_rev_group_id ELSE NULL END
  );

  v_result := jsonb_build_object(
    'success', true,
    'no_changes', false,
    'refund_id', v_old.id,
    'refund_no', v_ref_no,
    'refund_amount', v_new_client_amt,
    'vendor_refund_amount', v_new_vendor_amt,
    'deductions', v_new_deductions,
    'affected_ledger', v_affects_ledger,
    'changed_fields', v_changed_fields,
    'last_edited_at', v_now
  );

  PERFORM public._idempotency_store(v_agency_id, p_request_id, 'edit_refund', v_result);
  RETURN v_result;
END;
$$;


-- ------------------------------------------------------------------------------
-- 7. STRICT EXECUTE GRANTS & POSTGREST SCHEMA RELOAD
-- ------------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.prevent_document_edit_history_mutation() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.edit_booking_invoice_atomic(UUID, TEXT, NUMERIC, NUMERIC, DATE, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_booking_invoice_atomic(UUID, TEXT, NUMERIC, NUMERIC, DATE, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.edit_payment_voucher_atomic(UUID, TEXT, NUMERIC, TEXT, UUID, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_payment_voucher_atomic(UUID, TEXT, NUMERIC, TEXT, UUID, TEXT, TEXT, TEXT, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.edit_refund_atomic(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_refund_atomic(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
