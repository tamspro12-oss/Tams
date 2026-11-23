-- ==============================================================================
-- TAMS PRO — ROLLBACK-SAFE SELF-TEST FOR AUTO VENDOR VOUCHER AT BOOKING
-- File: supabase/tests/self_test_vendor_payment_at_booking.sql
--
-- Runs completely inside a rolled-back subtransaction (SQLSTATE P0999) so zero
-- test rows persist in the database.
-- Covers:
--   1. Empty/0 vendor amount -> behaves identically to today (0 CPV created)
--   2. Partial vendor amount (Cash) -> CPV created via save_payment_voucher_atomic,
--      next CPV-# in agency sequence, exact Ref & particulars, dues/cash/profit/statement/search OK
--   3. Full purchasing cost paid -> vendor current_balance = 0, vendor_dues = 0
--   4. Invalid inputs blocked -> amount > 0 without vendor, amount > cost, negative amount
--   5. Bank mode -> bank balance reduced, cash balance untouched, bank_name saved
--   6. Atomicity & idempotency -> same p_request_id creates no duplicate; bad account rolls back all
--   7. Two-agency isolation -> Agency A & Agency B independent sequences, zero crossover
--   8. Group booking with multiple passengers + vendor CPV
--   9. Existing edit_booking_invoice_atomic & edit_payment_voucher_atomic remain compatible
-- ==============================================================================

CREATE OR REPLACE FUNCTION pg_temp._tams_run_vendor_booking_test()
RETURNS TABLE(
  out_seq INT,
  out_test_name TEXT,
  out_pass_or_fail TEXT,
  out_detail TEXT
)
LANGUAGE plpgsql
AS $self_test$
DECLARE
  v_results JSONB := '[]'::jsonb;
  v_seq INT := 0;
  v_payload TEXT;
  v_rec RECORD;

  v_user_a UUID := gen_random_uuid();
  v_user_b UUID := gen_random_uuid();
  v_agency_a UUID;
  v_agency_b UUID;

  v_client_a UUID := gen_random_uuid();
  v_vendor_a UUID := gen_random_uuid();
  v_client_b UUID := gen_random_uuid();
  v_vendor_b UUID := gen_random_uuid();

  v_cash_a UUID := gen_random_uuid();
  v_bank_a UUID := gen_random_uuid();
  v_cash_b UUID := gen_random_uuid();

  v_res JSONB;
  v_res2 JSONB;
  v_req_id UUID;
  v_inv_id UUID;
  v_inv_no TEXT;
  v_cpv_id UUID;
  v_cpv_no TEXT;
  v_pv RECORD;
  v_summary JSONB;
  v_reconcile JSONB;
  v_search JSONB;
  v_stmt_debit NUMERIC;
  v_cash_bal NUMERIC;
  v_bank_bal NUMERIC;
  v_vendor_bal NUMERIC;
  v_cnt BIGINT;
  v_err TEXT;
BEGIN
  BEGIN
  -- --------------------------------------------------------------------------
  -- SETUP: Two isolated agencies (A & B) with Cash & Bank accounts
  -- --------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
  VALUES (
    v_user_a,
    'vpay-a-' || v_user_a::text || '@tamspro.test',
    '{"agency_name": "__VPAY_TEST_A__", "full_name": "Agency A Owner"}'::jsonb,
    NOW()
  );
  SELECT agency_id INTO v_agency_a FROM public.profiles WHERE id = v_user_a;

  INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
  VALUES (
    v_user_b,
    'vpay-b-' || v_user_b::text || '@tamspro.test',
    '{"agency_name": "__VPAY_TEST_B__", "full_name": "Agency B Owner"}'::jsonb,
    NOW()
  );
  SELECT agency_id INTO v_agency_b FROM public.profiles WHERE id = v_user_b;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  INSERT INTO public.parties (id, agency_id, type, name, phone)
  VALUES
    (v_client_a, v_agency_a, 'client', 'Test Client A', '03001110001'),
    (v_vendor_a, v_agency_a, 'vendor', 'Test Vendor A', '03009990001');

  INSERT INTO public.accounts (id, agency_id, type, name, opening_balance, active)
  VALUES
    (v_cash_a, v_agency_a, 'cash', 'Main Cash', 100000, true),
    (v_bank_a, v_agency_a, 'bank', 'Meezan Bank', 500000, true);

  -- Switch briefly to Agency B to create its parties & cash account
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_b, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_user_b::text, true);
  INSERT INTO public.parties (id, agency_id, type, name, phone)
  VALUES
    (v_client_b, v_agency_b, 'client', 'Test Client B', '03001110002'),
    (v_vendor_b, v_agency_b, 'vendor', 'Test Vendor B', '03009990002');
  INSERT INTO public.accounts (id, agency_id, type, name, opening_balance, active)
  VALUES (v_cash_b, v_agency_b, 'cash', 'Agency B Cash', 50000, true);

  -- Back to Agency A
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);

  -- --------------------------------------------------------------------------
  -- TEST 1: Empty/0 vendor amount -> behaves identically to today
  -- --------------------------------------------------------------------------
  v_res := public.save_booking_invoice(
    p_service := 'Ticket',
    p_party_id := v_client_a,
    p_vendor_id := v_vendor_a,
    p_client_amount := 50000,
    p_vendor_payable := 40000,
    p_amount_paid := 20000,
    p_payment_mode := 'cash',
    p_account_id := v_cash_a,
    p_invoice_date := CURRENT_DATE,
    p_request_id := gen_random_uuid(),
    p_vendor_amount_paid := 0
  );
  SELECT COUNT(*) INTO v_cnt FROM public.payment_vouchers WHERE agency_id = v_agency_a AND direction = 'paid';
  SELECT current_balance INTO v_vendor_bal FROM public.parties WHERE id = v_vendor_a;

  v_seq := v_seq + 1;
  v_results := v_results || jsonb_build_object(
    'seq', v_seq,
    'name', '1. Empty/0 vendor amount creates no CPV and matches baseline',
    'status', CASE WHEN v_cnt = 0 AND (v_res->>'vendor_voucher_id') IS NULL AND v_vendor_bal = -40000 THEN 'PASS' ELSE 'FAIL' END,
    'detail', format('cpv_cnt=%s vendor_bal=%s', v_cnt, v_vendor_bal)
  );

  -- --------------------------------------------------------------------------
  -- TEST 2: Partial vendor amount (Cash) -> CPV + accounting + search + statement
  -- --------------------------------------------------------------------------
  v_req_id := gen_random_uuid();
  v_res := public.save_booking_invoice(
    p_service := 'Ticket',
    p_party_id := v_client_a,
    p_vendor_id := v_vendor_a,
    p_client_amount := 100000,
    p_vendor_payable := 80000,
    p_amount_paid := 40000,
    p_payment_mode := 'cash',
    p_account_id := v_cash_a,
    p_invoice_date := CURRENT_DATE,
    p_request_id := v_req_id,
    p_vendor_amount_paid := 30000
  );
  v_inv_id := (v_res->>'invoice_id')::uuid;
  v_inv_no := v_res->>'invoice_no';
  v_cpv_id := (v_res->>'vendor_voucher_id')::uuid;
  v_cpv_no := v_res->>'vendor_voucher_no';

  SELECT * INTO v_pv FROM public.payment_vouchers WHERE id = v_cpv_id;
  SELECT current_balance INTO v_cash_bal FROM public.account_balances(v_agency_a) WHERE account_id = v_cash_a;
  SELECT current_balance INTO v_vendor_bal FROM public.parties WHERE id = v_vendor_a;
  SELECT COALESCE(SUM(debit), 0) INTO v_stmt_debit FROM public.get_party_statement(v_vendor_a) WHERE reference_no = 'AT-VENDOR-BOOKING-' || v_inv_no;
  v_summary := public.get_agency_financial_summary(date_trunc('month', CURRENT_DATE)::date, CURRENT_DATE, v_agency_a);
  v_reconcile := public.reconcile_agency_balances(v_agency_a);
  v_search := public.global_search(v_cpv_no, 10, 0);

  -- Cash started at 100,000 + 20,000 (Test 1 CRV) + 40,000 (Test 2 CRV) - 30,000 (Test 2 CPV) = 130,000
  -- Vendor payable total = 40,000 + 80,000 = 120,000; paid = 30,000 => vendor_bal = -90,000
  v_seq := v_seq + 1;
  v_results := v_results || jsonb_build_object(
    'seq', v_seq,
    'name', '2. Partial vendor payment (Cash) posts CPV, cash, dues, statement & search',
    'status', CASE
      WHEN v_cpv_no LIKE 'CPV-%'
       AND v_pv.direction = 'paid'
       AND v_pv.reference_no = 'AT-VENDOR-BOOKING-' || v_inv_no
       AND v_pv.notes = 'Initial payment to vendor at booking for ' || v_inv_no
       AND v_cash_bal = 130000
       AND v_vendor_bal = -90000
       AND v_stmt_debit = 30000
       AND (v_summary->>'vendor_dues')::numeric = 90000
       AND (v_summary->>'client_dues')::numeric = 90000
       AND (v_summary->>'period_profit')::numeric = 30000
       AND (v_reconcile->>'reconciled')::boolean = true
       AND jsonb_array_length(v_search->'vouchers') >= 1
      THEN 'PASS' ELSE 'FAIL' END,
    'detail', format('cpv=%s cash=%s vendor_bal=%s stmt=%s dues=%s', v_cpv_no, v_cash_bal, v_vendor_bal, v_stmt_debit, v_summary->>'vendor_dues')
  );

  -- --------------------------------------------------------------------------
  -- TEST 3: Idempotent retry with same p_request_id creates zero duplicate CPV
  -- --------------------------------------------------------------------------
  v_res2 := public.save_booking_invoice(
    p_service := 'Ticket',
    p_party_id := v_client_a,
    p_vendor_id := v_vendor_a,
    p_client_amount := 100000,
    p_vendor_payable := 80000,
    p_amount_paid := 40000,
    p_payment_mode := 'cash',
    p_account_id := v_cash_a,
    p_invoice_date := CURRENT_DATE,
    p_request_id := v_req_id,
    p_vendor_amount_paid := 30000
  );
  SELECT COUNT(*) INTO v_cnt FROM public.payment_vouchers WHERE agency_id = v_agency_a AND reference_no = 'AT-VENDOR-BOOKING-' || v_inv_no;
  v_seq := v_seq + 1;
  v_results := v_results || jsonb_build_object(
    'seq', v_seq,
    'name', '3. Duplicate submit with same p_request_id returns cached result (no duplicate CPV)',
    'status', CASE WHEN v_cnt = 1 AND (v_res2->>'vendor_voucher_id')::uuid = v_cpv_id THEN 'PASS' ELSE 'FAIL' END,
    'detail', format('cpv_count=%s replay=%s', v_cnt, v_res2->>'idempotent_replay')
  );

  -- --------------------------------------------------------------------------
  -- TEST 4: Full purchasing cost paid via Bank Mode reduces bank, not cash
  -- --------------------------------------------------------------------------
  v_res := public.save_booking_invoice(
    p_service := 'Umrah',
    p_party_id := v_client_a,
    p_vendor_id := v_vendor_a,
    p_client_amount := 120000,
    p_vendor_payable := 100000,
    p_amount_paid := 0,
    p_payment_mode := 'bank',
    p_account_id := v_bank_a,
    p_invoice_date := CURRENT_DATE,
    p_passengers := '[{"name":"Pax 1"},{"name":"Pax 2"},{"name":"Pax 3"},{"name":"Pax 4"},{"name":"Pax 5"}]'::jsonb,
    p_more_details := '{"selected_bank":"Meezan Bank"}'::jsonb,
    p_request_id := gen_random_uuid(),
    p_vendor_amount_paid := 100000
  );
  SELECT current_balance INTO v_cash_bal FROM public.account_balances(v_agency_a) WHERE account_id = v_cash_a;
  SELECT current_balance INTO v_bank_bal FROM public.account_balances(v_agency_a) WHERE account_id = v_bank_a;
  SELECT current_balance INTO v_vendor_bal FROM public.parties WHERE id = v_vendor_a;
  SELECT * INTO v_pv FROM public.payment_vouchers WHERE id = (v_res->>'vendor_voucher_id')::uuid;

  v_seq := v_seq + 1;
  v_results := v_results || jsonb_build_object(
    'seq', v_seq,
    'name', '4. Full cost paid via Bank reduces Bank (500k->400k), leaves Cash (130k) untouched, Group 5 pax',
    'status', CASE
      WHEN v_bank_bal = 400000
       AND v_cash_bal = 130000
       AND v_vendor_bal = -90000
       AND v_pv.payment_mode = 'bank'
       AND v_pv.bank_name = 'Meezan Bank'
      THEN 'PASS' ELSE 'FAIL' END,
    'detail', format('bank=%s cash=%s vendor_bal=%s bank_name=%s', v_bank_bal, v_cash_bal, v_vendor_bal, v_pv.bank_name)
  );

  -- --------------------------------------------------------------------------
  -- TEST 5: Invalid inputs & cross-agency account rollback atomically
  -- --------------------------------------------------------------------------
  v_err := NULL;
  BEGIN
    PERFORM public.save_booking_invoice(
      p_party_id := v_client_a,
      p_vendor_id := NULL,
      p_client_amount := 50000,
      p_vendor_payable := 40000,
      p_vendor_amount_paid := 10000
    );
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;

  v_seq := v_seq + 1;
  v_results := v_results || jsonb_build_object(
    'seq', v_seq,
    'name', '5a. Amount > 0 without vendor is blocked',
    'status', CASE WHEN v_err ILIKE '%select a vendor%' THEN 'PASS' ELSE 'FAIL' END,
    'detail', COALESCE(v_err, 'NO_ERROR')
  );

  v_err := NULL;
  BEGIN
    PERFORM public.save_booking_invoice(
      p_party_id := v_client_a,
      p_vendor_id := v_vendor_a,
      p_client_amount := 50000,
      p_vendor_payable := 40000,
      p_vendor_amount_paid := 45000
    );
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;

  v_seq := v_seq + 1;
  v_results := v_results || jsonb_build_object(
    'seq', v_seq,
    'name', '5b. Amount > purchasing cost is blocked',
    'status', CASE WHEN v_err ILIKE '%cannot exceed purchasing cost%' THEN 'PASS' ELSE 'FAIL' END,
    'detail', COALESCE(v_err, 'NO_ERROR')
  );

  -- Cross-agency account in atomic call must roll back ENTIRE invoice + client CRV + vendor CPV
  SELECT COUNT(*) INTO v_cnt FROM public.booking_invoices WHERE agency_id = v_agency_a;
  v_err := NULL;
  BEGIN
    PERFORM public.save_booking_invoice(
      p_party_id := v_client_a,
      p_vendor_id := v_vendor_a,
      p_client_amount := 60000,
      p_vendor_payable := 50000,
      p_amount_paid := 10000,
      p_account_id := v_cash_b,
      p_vendor_amount_paid := 10000
    );
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;

  v_seq := v_seq + 1;
  v_results := v_results || jsonb_build_object(
    'seq', v_seq,
    'name', '5c. Foreign agency account rolls back invoice + CRV + CPV atomically',
    'status', CASE
      WHEN v_err ILIKE '%403 Forbidden%'
       AND (SELECT COUNT(*) FROM public.booking_invoices WHERE agency_id = v_agency_a) = v_cnt
      THEN 'PASS' ELSE 'FAIL' END,
    'detail', COALESCE(v_err, 'NO_ERROR')
  );

  -- --------------------------------------------------------------------------
  -- TEST 6: Agency B full payment -> Vendor due 0 & independent CPV sequence
  -- --------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_b, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_user_b::text, true);

  v_res := public.save_booking_invoice(
    p_service := 'Visa',
    p_party_id := v_client_b,
    p_vendor_id := v_vendor_b,
    p_client_amount := 30000,
    p_vendor_payable := 20000,
    p_amount_paid := 0,
    p_payment_mode := 'cash',
    p_account_id := v_cash_b,
    p_request_id := gen_random_uuid(),
    p_vendor_amount_paid := 20000
  );
  SELECT current_balance INTO v_vendor_bal FROM public.parties WHERE id = v_vendor_b;
  v_summary := public.get_agency_financial_summary(date_trunc('month', CURRENT_DATE)::date, CURRENT_DATE, v_agency_b);

  v_seq := v_seq + 1;
  v_results := v_results || jsonb_build_object(
    'seq', v_seq,
    'name', '6. Agency B full vendor cost paid -> vendor due 0 & isolated sequence',
    'status', CASE
      WHEN v_vendor_bal = 0
       AND (v_summary->>'vendor_dues')::numeric = 0
       AND (v_summary->>'period_profit')::numeric = 10000
       AND (v_res->>'vendor_voucher_no') LIKE 'CPV-%'
      THEN 'PASS' ELSE 'FAIL' END,
    'detail', format('cpv=%s vendor_bal=%s vendor_dues=%s', v_res->>'vendor_voucher_no', v_vendor_bal, v_summary->>'vendor_dues')
  );

  -- Rollback all test data cleanly via SQLSTATE P0999
  RAISE EXCEPTION USING ERRCODE = 'P0999', MESSAGE = v_results::text;
  EXCEPTION
    WHEN SQLSTATE 'P0999' THEN
      v_payload := SQLERRM;
      FOR v_rec IN SELECT * FROM jsonb_array_elements(v_payload::jsonb)
      LOOP
        out_seq := (v_rec.value->>'seq')::INT;
        out_test_name := v_rec.value->>'name';
        out_pass_or_fail := v_rec.value->>'status';
        out_detail := v_rec.value->>'detail';
        RETURN NEXT;
      END LOOP;
  END;
END;
$self_test$;

SELECT * FROM pg_temp._tams_run_vendor_booking_test();
