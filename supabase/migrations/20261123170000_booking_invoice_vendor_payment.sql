-- ==============================================================================
-- TAMS PRO — ADDITIVE AUTO VENDOR PAYMENT VOUCHER ON NEW BOOKING INVOICE
-- File: supabase/migrations/20261123170000_booking_invoice_vendor_payment.sql
--
-- RULES:
--   - 100% ADDITIVE ONLY (no table/column/schema/trigger/RLS changes; no data edits)
--   - Reuses existing public.save_payment_voucher_atomic(...) for vendor CPV creation
--   - Single transaction (BEGIN ... COMMIT) with exact overload cleanup (no PGRST203)
--   - Strict agency isolation, permission checks, and idempotency
-- ==============================================================================

BEGIN;

-- Drop exact existing overloads of save_booking_invoice_atomic / save_booking_invoice
-- before adding the optional 25th parameter (p_vendor_amount_paid NUMERIC DEFAULT 0).
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
      AND p.proname IN ('save_booking_invoice_atomic', 'save_booking_invoice')
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
  p_is_manual BOOLEAN DEFAULT false,
  p_request_id UUID DEFAULT NULL,
  p_vendor_amount_paid NUMERIC DEFAULT 0
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
  v_vendor_paid_amt NUMERIC := COALESCE(p_vendor_amount_paid, 0);
  v_profit NUMERIC;
  v_inv_no TEXT := NULLIF(TRIM(COALESCE(p_invoice_no, '')), '');
  v_acc_id UUID;
  v_voucher_id UUID;
  v_v_no TEXT;
  v_vendor_voucher_res JSONB;
  v_vendor_voucher_id UUID;
  v_vendor_v_no TEXT;
  v_vendor_ref TEXT;
  v_vendor_bank_name TEXT;
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

  IF v_client_amt < 0 OR v_vendor_amt < 0 OR COALESCE(p_amount_paid, 0) < 0 OR v_vendor_paid_amt < 0 THEN
    RAISE EXCEPTION 'Amounts cannot be negative';
  END IF;

  IF v_paid_amt > v_client_amt THEN
    RAISE EXCEPTION 'Amount paid cannot exceed total amount';
  END IF;

  IF v_vendor_paid_amt > 0 AND p_vendor_id IS NULL THEN
    RAISE EXCEPTION 'Please select a vendor when amount paid to vendor is greater than zero';
  END IF;

  IF v_vendor_paid_amt > v_vendor_amt THEN
    RAISE EXCEPTION 'Amount paid to vendor cannot exceed purchasing cost';
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

  -- Optional atomic Vendor Payment Voucher (CPV) via existing save_payment_voucher_atomic pipeline.
  -- p_request_id is passed as NULL so the inner voucher does not overwrite the outer invoice idempotency log.
  IF v_vendor_paid_amt > 0 THEN
    v_vendor_ref := 'AT-VENDOR-BOOKING-' || v_inv_no;
    v_vendor_bank_name := CASE
      WHEN LOWER(COALESCE(p_payment_mode, 'cash')) = 'cash' THEN NULL
      ELSE NULLIF(TRIM(COALESCE(p_more_details->>'selected_bank', '')), '')
    END;

    -- Idempotency check by agency + Ref/invoice
    SELECT pv.id, pv.voucher_no
    INTO v_vendor_voucher_id, v_vendor_v_no
    FROM public.payment_vouchers pv
    WHERE pv.agency_id = v_agency_id
      AND pv.reference_no = v_vendor_ref
      AND pv.direction = 'paid'
      AND COALESCE(pv.is_void, false) = false
    LIMIT 1;

    IF v_vendor_voucher_id IS NULL THEN
      v_vendor_voucher_res := public.save_payment_voucher_atomic(
        p_direction => 'paid',
        p_amount => v_vendor_paid_amt,
        p_payment_mode => LOWER(COALESCE(p_payment_mode, 'cash')),
        p_account_id => p_account_id,
        p_party_id => p_vendor_id,
        p_voucher_no => NULL,
        p_voucher_date => v_inv_date,
        p_reference_no => v_vendor_ref,
        p_is_adjustment => false,
        p_adjustment_reason => NULL,
        p_bank_name => v_vendor_bank_name,
        p_invoice_id => v_invoice_id,
        p_notes => 'Initial payment to vendor at booking for ' || v_inv_no,
        p_is_manual => false,
        p_request_id => NULL
      );

      v_vendor_voucher_id := (v_vendor_voucher_res->>'voucher_id')::UUID;
      v_vendor_v_no := v_vendor_voucher_res->>'voucher_no';
    END IF;
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
    'vendor_voucher_id', v_vendor_voucher_id,
    'vendor_voucher_no', v_vendor_v_no,
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
  p_request_id UUID DEFAULT NULL,
  p_vendor_amount_paid NUMERIC DEFAULT 0
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
    p_commission, p_wht, p_more_details, p_notes, p_is_manual, p_request_id,
    p_vendor_amount_paid
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_booking_invoice_atomic(TEXT, TEXT, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, UUID, DATE, DATE, TEXT, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB, TEXT, BOOLEAN, UUID, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_booking_invoice_atomic(TEXT, TEXT, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, UUID, DATE, DATE, TEXT, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB, TEXT, BOOLEAN, UUID, NUMERIC) TO authenticated;

REVOKE ALL ON FUNCTION public.save_booking_invoice(TEXT, TEXT, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, UUID, DATE, DATE, TEXT, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB, TEXT, BOOLEAN, UUID, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_booking_invoice(TEXT, TEXT, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, UUID, DATE, DATE, TEXT, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB, TEXT, BOOLEAN, UUID, NUMERIC) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
