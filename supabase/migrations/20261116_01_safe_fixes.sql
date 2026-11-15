-- ==============================================================================
-- TAMS PRO — SAFE HARDENING, LEDGER ATOMICITY, TEMPLATES, LICENSE & EMAIL VERIFY
-- File: supabase/migrations/20261116_01_safe_fixes.sql
--
-- STRICT RULES:
--   - 100% additive & idempotent (IF NOT EXISTS / CREATE OR REPLACE).
--   - Single transaction (BEGIN ... COMMIT).
--   - NEVER drops/truncates/deletes/overwrites user business data.
--   - Revokes PUBLIC & anon on every function; grants EXECUTE to authenticated only.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. PART 2 (EMAIL VERIFICATION) — SAFE ORDERED MIGRATION
--    Step A FIRST: Backfill existing NULL email_confirmed_at so zero existing users
--                  can ever be locked out.
--    Step B THEN:  Disable/neutralise the 20261111 auto-confirm trigger.
--    Step C:       Keep verify_agency_account_fallback uncallable by anon.
--    Step D:       Enforce default 'free' 14-day trial server-side on signup.
-- ------------------------------------------------------------------------------

UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    updated_at = NOW()
WHERE email_confirmed_at IS NULL;

CREATE OR REPLACE FUNCTION public.auto_confirm_agency_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Neutralised: real email confirmation is enforced on new signups.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_confirm_agency_signup ON auth.users;

REVOKE ALL ON FUNCTION public.verify_agency_account_fallback(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_agency_account_fallback(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_agency_id UUID;
  agency_name TEXT;
  v_phone TEXT;
  plan TEXT := 'free';
BEGIN
  agency_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'agency_name'), ''), 'My Agency');
  v_phone := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone_number', NEW.raw_user_meta_data->>'phone', '')), '');

  -- Always assign free 14-day trial server-side regardless of any client metadata.
  INSERT INTO public.agencies (
    name, email, contact_email, phone_number, contact_info,
    license_key, subscription_plan,
    license_expiry, license_status, license_active
  )
  VALUES (
    agency_name,
    NEW.email,
    NEW.email,
    v_phone,
    v_phone,
    'KEY-' || substr(md5(random()::text || COALESCE(NEW.id::text, '')), 1, 8),
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
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;


-- ------------------------------------------------------------------------------
-- 2. PART C — DB STORAGE FOR AGENCY TEMPLATES & PRESETS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.agency_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agency_templates_agency_key_unique UNIQUE (agency_id, key)
);

CREATE INDEX IF NOT EXISTS idx_agency_templates_agency_key
  ON public.agency_templates (agency_id, key);

ALTER TABLE public.agency_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agency_templates_strict_select" ON public.agency_templates;
CREATE POLICY "agency_templates_strict_select"
  ON public.agency_templates FOR SELECT TO authenticated
  USING (
    agency_id = public.current_user_agency_id()
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

DROP POLICY IF EXISTS "agency_templates_strict_insert" ON public.agency_templates;
CREATE POLICY "agency_templates_strict_insert"
  ON public.agency_templates FOR INSERT TO authenticated
  WITH CHECK (
    agency_id = public.current_user_agency_id()
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

DROP POLICY IF EXISTS "agency_templates_strict_update" ON public.agency_templates;
CREATE POLICY "agency_templates_strict_update"
  ON public.agency_templates FOR UPDATE TO authenticated
  USING (
    agency_id = public.current_user_agency_id()
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    agency_id = public.current_user_agency_id()
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

DROP POLICY IF EXISTS "agency_templates_strict_delete" ON public.agency_templates;
CREATE POLICY "agency_templates_strict_delete"
  ON public.agency_templates FOR DELETE TO authenticated
  USING (
    agency_id = public.current_user_agency_id()
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

DROP TRIGGER IF EXISTS trg_isolation_agency_templates ON public.agency_templates;
CREATE TRIGGER trg_isolation_agency_templates
  BEFORE INSERT OR UPDATE ON public.agency_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_agency_isolation();


-- ------------------------------------------------------------------------------
-- 3. PART F — OWNER-ONLY AGENCY UPDATE POLICY (KEEPS BILLING COLUMN TRIGGER)
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "agencies_update_own_or_super_admin" ON public.agencies;
CREATE POLICY "agencies_update_own_or_super_admin"
  ON public.agencies FOR UPDATE TO authenticated
  USING (
    (id = public.current_user_agency_id() AND public.is_agency_owner(auth.uid()))
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    (id = public.current_user_agency_id() AND public.is_agency_owner(auth.uid()))
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );


-- ------------------------------------------------------------------------------
-- 4. PART E — SERVER-SIDE TRIAL / LICENSE GRACE CHECK (WRITE RPCs ONLY)
--    True if:
--      - super_admin or privileged DB context
--      - agency_id or agency row or license_expiry is missing / NULL
--      - license_expiry is within 3 days past expiry (now() - 3 days)
--    Never blocks reads or exports. Not placed on table RLS policies.
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.agency_license_ok(p_agency_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID;
  v_expiry TIMESTAMPTZ;
BEGIN
  IF public.is_privileged_db_context()
     OR public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RETURN true;
  END IF;

  v_agency_id := COALESCE(p_agency_id, public.current_user_agency_id());
  IF v_agency_id IS NULL THEN
    RETURN true;
  END IF;

  SELECT license_expiry
  INTO v_expiry
  FROM public.agencies
  WHERE id = v_agency_id;

  IF NOT FOUND OR v_expiry IS NULL THEN
    RETURN true;
  END IF;

  RETURN v_expiry >= (NOW() - INTERVAL '3 days');
END;
$$;


-- ------------------------------------------------------------------------------
-- 5. PART E & PART F — UPDATE CORE FINANCIAL WRITE RPCs
--    - save_booking_invoice_atomic / save_payment_voucher_atomic / record_refund
--      record_expense / record_payment enforce agency_license_ok(v_agency_id)
--    - record_transfer & reverse_transaction enforce assert_module_permission
-- ------------------------------------------------------------------------------

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

  IF NOT public.agency_license_ok(v_agency_id) THEN
    RAISE EXCEPTION 'Trial or license has expired. Please renew your plan to create new invoices. Reading and exporting remain available.';
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

  IF NOT public.agency_license_ok(v_agency_id) THEN
    RAISE EXCEPTION 'Trial or license has expired. Please renew your plan to create new payment vouchers. Reading and exporting remain available.';
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

  IF NOT public.agency_license_ok(v_agency_id) THEN
    RAISE EXCEPTION 'Trial or license has expired. Please renew your plan to record refunds. Reading and exporting remain available.';
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

  IF NOT public.agency_license_ok(v_agency_id) THEN
    RAISE EXCEPTION 'Trial or license has expired. Please renew your plan to record expenses. Reading and exporting remain available.';
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

  IF NOT public.agency_license_ok(v_agency_id) THEN
    RAISE EXCEPTION 'Trial or license has expired. Please renew your plan to record payments. Reading and exporting remain available.';
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
  PERFORM public.assert_module_permission(ARRAY['expenses', 'bookings', 'invoices'], 'write');

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
  PERFORM public.assert_module_permission(ARRAY['bookings', 'invoices', 'expenses'], 'delete');

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


-- ------------------------------------------------------------------------------
-- 6. PART A — ATOMIC CASH / BANK ENTRY CREATE + DELETE WITH LEDGER REVERSAL
-- ------------------------------------------------------------------------------

ALTER TABLE public.cash_bank_entries
  ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.add_cash_bank_entry_atomic(
  p_entry_date TEXT DEFAULT NULL,
  p_entry_type TEXT DEFAULT 'cash_in',
  p_amount NUMERIC DEFAULT 0,
  p_payment_mode TEXT DEFAULT 'cash',
  p_bank_name TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_reference_number TEXT DEFAULT NULL,
  p_account_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
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
BEGIN
  PERFORM public.assert_module_permission(ARRAY['expenses', 'bookings', 'invoices'], 'write');

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

  RETURN jsonb_build_object(
    'success', true,
    'entry', to_jsonb(v_entry),
    'transaction_id', v_tx_id,
    'account_id', v_acc_id
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.delete_cash_bank_entry_atomic(p_entry_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_entry public.cash_bank_entries%ROWTYPE;
  v_tx public.transactions%ROWTYPE;
  v_rev_id UUID;
  v_reversed_ids UUID[] := ARRAY[]::UUID[];
  v_entry_date DATE;
  v_is_in BOOLEAN;
BEGIN
  PERFORM public.assert_module_permission(ARRAY['expenses', 'bookings', 'invoices'], 'delete');

  SELECT * INTO v_entry
  FROM public.cash_bank_entries
  WHERE id = p_entry_id AND agency_id = v_agency_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '403 Forbidden: Cash/bank entry not found in your active agency';
  END IF;

  v_entry_date := public.safe_parse_date(v_entry.entry_date);
  v_is_in := v_entry.entry_type IN ('cash_in', 'bank_in');

  -- 1. Primary deterministic matches (linked transaction_id or legacy reference)
  FOR v_tx IN
    SELECT *
    FROM public.transactions t
    WHERE t.agency_id = v_agency_id
      AND t.reversed_of IS NULL
      AND (
        (v_entry.transaction_id IS NOT NULL AND t.id = v_entry.transaction_id)
        OR (t.legacy_source IN ('cash_bank_entries', 'cash_bank_entry') AND t.legacy_id = v_entry.id)
      )
    FOR UPDATE
  LOOP
    INSERT INTO public.transactions (
      agency_id, date, type, party_id, party_type, booking_id, account_id,
      debit, credit, method, reference_no, category, notes, reversed_of,
      legacy_source, legacy_id, created_by
    ) VALUES (
      v_agency_id, public.karachi_today(), 'adjustment', v_tx.party_id, v_tx.party_type,
      v_tx.booking_id, v_tx.account_id, v_tx.credit, v_tx.debit, v_tx.method,
      CASE WHEN v_tx.reference_no IS NOT NULL THEN 'REV-' || v_tx.reference_no ELSE NULL END,
      'Reversal', 'Reversal: Deleted cash/bank entry', v_tx.id,
      'cash_bank_entries_reversal', v_entry.id, auth.uid()
    )
    RETURNING id INTO v_rev_id;

    UPDATE public.transactions
    SET reversed_of = v_rev_id,
        notes = COALESCE(NULLIF(notes, '') || ' | ', '') || 'REVERSED: Entry deleted',
        updated_at = NOW()
    WHERE id = v_tx.id AND agency_id = v_agency_id;

    v_reversed_ids := array_append(v_reversed_ids, v_tx.id);
  END LOOP;

  -- 2. Fallback match for legacy entries saved before transaction_id linking
  IF COALESCE(array_length(v_reversed_ids, 1), 0) = 0
     AND v_entry.entry_type IN ('cash_in', 'cash_out', 'bank_in', 'bank_out') THEN
    SELECT * INTO v_tx
    FROM public.transactions t
    WHERE t.agency_id = v_agency_id
      AND t.reversed_of IS NULL
      AND (v_entry_date IS NULL OR t.date = v_entry_date)
      AND (
        (v_is_in AND t.type = 'payment_in' AND t.debit = v_entry.amount AND t.credit = 0)
        OR (NOT v_is_in AND t.type IN ('expense', 'payment_out') AND t.credit = v_entry.amount AND t.debit = 0)
      )
      AND (
        NULLIF(TRIM(COALESCE(v_entry.reference_number, '')), '') IS NULL
        OR t.reference_no = TRIM(v_entry.reference_number)
      )
    ORDER BY
      CASE WHEN NULLIF(TRIM(COALESCE(v_entry.reference_number, '')), '') IS NOT NULL
                AND t.reference_no = TRIM(v_entry.reference_number) THEN 0 ELSE 1 END,
      ABS(EXTRACT(EPOCH FROM (t.created_at - v_entry.created_at))) ASC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      INSERT INTO public.transactions (
        agency_id, date, type, party_id, party_type, booking_id, account_id,
        debit, credit, method, reference_no, category, notes, reversed_of,
        legacy_source, legacy_id, created_by
      ) VALUES (
        v_agency_id, public.karachi_today(), 'adjustment', v_tx.party_id, v_tx.party_type,
        v_tx.booking_id, v_tx.account_id, v_tx.credit, v_tx.debit, v_tx.method,
        CASE WHEN v_tx.reference_no IS NOT NULL THEN 'REV-' || v_tx.reference_no ELSE NULL END,
        'Reversal', 'Reversal: Deleted cash/bank entry', v_tx.id,
        'cash_bank_entries_reversal', v_entry.id, auth.uid()
      )
      RETURNING id INTO v_rev_id;

      UPDATE public.transactions
      SET reversed_of = v_rev_id,
          notes = COALESCE(NULLIF(notes, '') || ' | ', '') || 'REVERSED: Entry deleted',
          updated_at = NOW()
      WHERE id = v_tx.id AND agency_id = v_agency_id;

      v_reversed_ids := array_append(v_reversed_ids, v_tx.id);
    END IF;
  END IF;

  DELETE FROM public.cash_bank_entries
  WHERE id = p_entry_id AND agency_id = v_agency_id;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_entry_id', p_entry_id,
    'reversed_transaction_ids', v_reversed_ids
  );
END;
$$;


-- ------------------------------------------------------------------------------
-- 7. PART B — ATOMIC OPENING BALANCE & AGENCY BANK RPCs
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.upsert_opening_balance_atomic(
  p_party_type TEXT,
  p_party_id UUID,
  p_balance_type TEXT,
  p_amount NUMERIC,
  p_as_of_date DATE DEFAULT CURRENT_DATE,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_ob public.opening_balances%ROWTYPE;
  v_tx_id UUID;
  v_tx_party_type TEXT := CASE WHEN p_party_type = 'b2b_agent' THEN 'agent' ELSE p_party_type END;
  v_is_rec BOOLEAN := LOWER(COALESCE(p_balance_type, 'receivable')) = 'receivable';
  v_amt NUMERIC := COALESCE(p_amount, 0);
  v_date DATE := COALESCE(p_as_of_date, public.karachi_today());
  v_signed_ob NUMERIC := CASE WHEN v_is_rec THEN v_amt ELSE -v_amt END;
BEGIN
  IF p_party_type NOT IN ('client', 'vendor', 'b2b_agent') THEN
    RAISE EXCEPTION 'Invalid party type: %', p_party_type;
  END IF;

  IF p_balance_type NOT IN ('receivable', 'payable') THEN
    RAISE EXCEPTION 'Invalid balance type: %', p_balance_type;
  END IF;

  IF v_amt < 0 THEN
    RAISE EXCEPTION 'Opening balance cannot be negative';
  END IF;

  IF p_party_id IS NULL THEN
    RAISE EXCEPTION 'Party ID is required';
  END IF;

  INSERT INTO public.opening_balances (
    agency_id, party_type, party_id, balance_type, amount, as_of_date, notes
  ) VALUES (
    v_agency_id, p_party_type, p_party_id, p_balance_type, v_amt, v_date, p_notes
  )
  ON CONFLICT (agency_id, party_type, party_id) DO UPDATE SET
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
        party_id = p_party_id,
        party_type = v_tx_party_type,
        debit = CASE WHEN v_is_rec THEN v_amt ELSE 0 END,
        credit = CASE WHEN v_is_rec THEN 0 ELSE v_amt END,
        notes = COALESCE(p_notes, 'Opening ' || p_balance_type || ' balance'),
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
      COALESCE(p_notes, 'Opening ' || p_balance_type || ' balance'),
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

  RETURN jsonb_build_object(
    'success', true,
    'opening_balance', to_jsonb(v_ob),
    'transaction_id', v_tx_id
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.update_opening_balance_atomic(
  p_id UUID,
  p_amount NUMERIC,
  p_balance_type TEXT DEFAULT NULL,
  p_as_of_date DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_ob public.opening_balances%ROWTYPE;
  v_tx_id UUID;
  v_btype TEXT;
  v_date DATE;
  v_amt NUMERIC := COALESCE(p_amount, 0);
  v_is_rec BOOLEAN;
  v_tx_party_type TEXT;
  v_signed_ob NUMERIC;
BEGIN
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
        debit = CASE WHEN v_is_rec THEN v_amt ELSE 0 END,
        credit = CASE WHEN v_is_rec THEN 0 ELSE v_amt END,
        notes = COALESCE(p_notes, 'Opening ' || v_btype || ' balance'),
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
      COALESCE(v_ob.notes, 'Opening ' || v_btype || ' balance'),
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

  RETURN jsonb_build_object(
    'success', true,
    'opening_balance', to_jsonb(v_ob),
    'transaction_id', v_tx_id
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.delete_opening_balance_atomic(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_ob public.opening_balances%ROWTYPE;
  v_tx public.transactions%ROWTYPE;
  v_rev_id UUID;
  v_reversed_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  SELECT * INTO v_ob
  FROM public.opening_balances
  WHERE id = p_id AND agency_id = v_agency_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '403 Forbidden: Opening balance record not found in your active agency';
  END IF;

  FOR v_tx IN
    SELECT *
    FROM public.transactions
    WHERE agency_id = v_agency_id
      AND legacy_source IN ('opening_balance', 'opening_balances')
      AND legacy_id = v_ob.id
      AND reversed_of IS NULL
    FOR UPDATE
  LOOP
    INSERT INTO public.transactions (
      agency_id, date, type, party_id, party_type, debit, credit,
      method, reference_no, category, notes, reversed_of,
      legacy_source, legacy_id, created_by
    ) VALUES (
      v_agency_id, public.karachi_today(), 'adjustment', v_tx.party_id, v_tx.party_type,
      v_tx.credit, v_tx.debit, v_tx.method,
      CASE WHEN v_tx.reference_no IS NOT NULL THEN 'REV-' || v_tx.reference_no ELSE 'REV-OPENING-BAL' END,
      'Reversal', 'Reversal: Opening balance deleted', v_tx.id,
      'opening_balance_reversal', v_ob.id, auth.uid()
    )
    RETURNING id INTO v_rev_id;

    UPDATE public.transactions
    SET reversed_of = v_rev_id,
        notes = COALESCE(NULLIF(notes, '') || ' | ', '') || 'REVERSED: Opening balance deleted',
        updated_at = NOW()
    WHERE id = v_tx.id AND agency_id = v_agency_id;

    v_reversed_ids := array_append(v_reversed_ids, v_tx.id);
  END LOOP;

  IF EXISTS (SELECT 1 FROM public.parties WHERE id = v_ob.party_id AND agency_id = v_agency_id) THEN
    UPDATE public.parties
    SET opening_balance = 0,
        updated_at = NOW()
    WHERE id = v_ob.party_id AND agency_id = v_agency_id;
    PERFORM public.recalculate_party_balance(v_ob.party_id, v_agency_id);
  END IF;

  DELETE FROM public.opening_balances
  WHERE id = p_id AND agency_id = v_agency_id;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_opening_balance_id', p_id,
    'reversed_transaction_ids', v_reversed_ids
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.upsert_agency_bank_atomic(
  p_id UUID DEFAULT NULL,
  p_bank_name TEXT DEFAULT NULL,
  p_account_title TEXT DEFAULT NULL,
  p_account_number TEXT DEFAULT NULL,
  p_branch_name TEXT DEFAULT NULL,
  p_opening_balance NUMERIC DEFAULT 0,
  p_is_active BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
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
BEGIN
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
    v_acc_no := COALESCE(v_acc_no, CASE WHEN p_account_number IS NOT NULL THEN NULL ELSE v_old.account_number END);
    v_old_acc_name := CASE WHEN NULLIF(TRIM(COALESCE(v_old.account_number, '')), '') IS NOT NULL
                           THEN v_old.bank_name || ' (' || TRIM(v_old.account_number) || ')'
                           ELSE v_old.bank_name END;
    v_new_acc_name := CASE WHEN v_acc_no IS NOT NULL THEN v_bank_name || ' (' || v_acc_no || ')' ELSE v_bank_name END;

    UPDATE public.agency_banks
    SET bank_name = v_bank_name,
        account_title = COALESCE(v_acc_title, CASE WHEN p_account_title IS NOT NULL THEN NULL ELSE account_title END),
        account_number = v_acc_no,
        branch_name = COALESCE(v_branch, CASE WHEN p_branch_name IS NOT NULL THEN NULL ELSE branch_name END),
        opening_balance = COALESCE(p_opening_balance, opening_balance),
        is_active = COALESCE(p_is_active, is_active),
        updated_at = NOW()
    WHERE id = p_id AND agency_id = v_agency_id
    RETURNING * INTO v_saved;

    SELECT id INTO v_acc_id
    FROM public.accounts
    WHERE agency_id = v_agency_id
      AND type = 'bank'
      AND (name = v_old_acc_name OR name = v_old.bank_name)
    LIMIT 1
    FOR UPDATE;

    IF v_acc_id IS NOT NULL THEN
      UPDATE public.accounts
      SET name = v_new_acc_name,
          opening_balance = COALESCE(v_saved.opening_balance, 0),
          active = COALESCE(v_saved.is_active, true),
          updated_at = NOW()
      WHERE id = v_acc_id AND agency_id = v_agency_id;
    ELSE
      INSERT INTO public.accounts (
        agency_id, type, name, opening_balance, active
      ) VALUES (
        v_agency_id, 'bank', v_new_acc_name, COALESCE(v_saved.opening_balance, 0), COALESCE(v_saved.is_active, true)
      )
      RETURNING id INTO v_acc_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'bank', to_jsonb(v_saved),
    'account_id', v_acc_id
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.delete_agency_bank_atomic(p_bank_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_id UUID := public.assert_agency_scope(NULL);
  v_bank public.agency_banks%ROWTYPE;
  v_full_name TEXT;
  v_acc_id UUID;
  v_account_action TEXT := 'none';
  v_has_refs BOOLEAN := false;
BEGIN
  SELECT * INTO v_bank
  FROM public.agency_banks
  WHERE id = p_bank_id AND agency_id = v_agency_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '403 Forbidden: Bank account not found in your active agency';
  END IF;

  v_full_name := CASE WHEN NULLIF(TRIM(COALESCE(v_bank.account_number, '')), '') IS NOT NULL
                      THEN v_bank.bank_name || ' (' || TRIM(v_bank.account_number) || ')'
                      ELSE v_bank.bank_name END;

  SELECT id INTO v_acc_id
  FROM public.accounts
  WHERE agency_id = v_agency_id
    AND type = 'bank'
    AND (name = v_full_name OR name = v_bank.bank_name)
  LIMIT 1
  FOR UPDATE;

  DELETE FROM public.agency_banks
  WHERE id = p_bank_id AND agency_id = v_agency_id;

  IF v_acc_id IS NOT NULL THEN
    v_has_refs := (
      EXISTS (SELECT 1 FROM public.transactions WHERE account_id = v_acc_id)
      OR EXISTS (SELECT 1 FROM public.central_journal_entries WHERE account_id = v_acc_id)
      OR EXISTS (SELECT 1 FROM public.payment_vouchers WHERE account_id = v_acc_id)
      OR EXISTS (SELECT 1 FROM public.refunds WHERE account_id = v_acc_id)
    );

    IF v_has_refs THEN
      UPDATE public.accounts
      SET active = false,
          opening_balance = 0,
          updated_at = NOW()
      WHERE id = v_acc_id AND agency_id = v_agency_id;
      v_account_action := 'deactivated';
    ELSE
      DELETE FROM public.accounts
      WHERE id = v_acc_id AND agency_id = v_agency_id;
      v_account_action := 'deleted';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_bank_id', p_bank_id,
    'account_id', v_acc_id,
    'account_action', v_account_action
  );
END;
$$;


-- ------------------------------------------------------------------------------
-- 8. SECURE GRANTS ON ALL NEW & UPDATED FUNCTIONS (NO ANON EXECUTION)
-- ------------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.auto_confirm_agency_signup() FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.agency_license_ok(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agency_license_ok(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.save_booking_invoice_atomic(TEXT, TEXT, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, UUID, DATE, DATE, TEXT, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_booking_invoice_atomic(TEXT, TEXT, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, UUID, DATE, DATE, TEXT, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB, TEXT, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.save_payment_voucher_atomic(TEXT, NUMERIC, TEXT, UUID, UUID, TEXT, DATE, TEXT, BOOLEAN, TEXT, TEXT, UUID, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_payment_voucher_atomic(TEXT, NUMERIC, TEXT, UUID, UUID, TEXT, DATE, TEXT, BOOLEAN, TEXT, TEXT, UUID, TEXT, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.record_refund(NUMERIC, UUID, UUID, TEXT, UUID, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_refund(NUMERIC, UUID, UUID, TEXT, UUID, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.record_expense(NUMERIC, UUID, TEXT, DATE, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_expense(NUMERIC, UUID, TEXT, DATE, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.record_payment(TEXT, NUMERIC, UUID, UUID, TEXT, UUID, DATE, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_payment(TEXT, NUMERIC, UUID, UUID, TEXT, UUID, DATE, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.record_transfer(UUID, UUID, NUMERIC, DATE, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_transfer(UUID, UUID, NUMERIC, DATE, TEXT, TEXT, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.reverse_transaction(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverse_transaction(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.add_cash_bank_entry_atomic(TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_cash_bank_entry_atomic(TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_cash_bank_entry_atomic(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_cash_bank_entry_atomic(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.upsert_opening_balance_atomic(TEXT, UUID, TEXT, NUMERIC, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_opening_balance_atomic(TEXT, UUID, TEXT, NUMERIC, DATE, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.update_opening_balance_atomic(UUID, NUMERIC, TEXT, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_opening_balance_atomic(UUID, NUMERIC, TEXT, DATE, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_opening_balance_atomic(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_opening_balance_atomic(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.upsert_agency_bank_atomic(UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_agency_bank_atomic(UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_agency_bank_atomic(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_agency_bank_atomic(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
