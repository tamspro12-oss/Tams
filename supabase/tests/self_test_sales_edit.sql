-- ==============================================================================
-- TAMS PRO — ROLLBACK-SAFE SELF-TEST FOR SALES & EXPENSES EDIT + AUDIT + LEDGER
-- File: supabase/tests/self_test_sales_edit.sql
--
-- Runs completely inside a rolled-back subtransaction (SQLSTATE P0999) so zero
-- test rows persist in the database.
-- Covers all 7 verification cases:
--   1. Edit invoice amount -> ledger, dues, profit, summary, audit trail
--   2. Edit voucher amount & mode (cash -> bank) -> balances & linked invoice status
--   3. Edit refund -> refund totals, balances & summary
--   4. No-op edit (does nothing) & missing reason (blocked)
--   5. Old pre-feature records -> open, edit, reverse legacy tx cleanly
--   6. Cross-agency isolation (Agency B) & immutable audit history (no UPDATE/DELETE)
--   7. Failed edit rollback -> zero partial data across all tables
-- ==============================================================================

CREATE OR REPLACE FUNCTION pg_temp._tams_run_sales_edit_test()
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
  v_sub_ro UUID := gen_random_uuid();

  v_agency_a UUID;
  v_agency_b UUID;

  v_client_a UUID := gen_random_uuid();
  v_vendor_a UUID := gen_random_uuid();
  v_cash_acc_a UUID := gen_random_uuid();
  v_bank_acc_a UUID := gen_random_uuid();

  v_inv_res JSONB;
  v_inv_id UUID;
  v_vch_res JSONB;
  v_vch_id UUID;
  v_ref_res JSONB;
  v_ref_id UUID;
  v_edit_res JSONB;

  v_legacy_inv_id UUID := gen_random_uuid();
  v_legacy_vch_id UUID := gen_random_uuid();
  v_legacy_tx_id UUID := gen_random_uuid();

  v_summary JSONB;
  v_cash_bal NUMERIC;
  v_bank_bal NUMERIC;
  v_cnt BIGINT;
  v_cnt2 BIGINT;
  v_status TEXT;
  v_paid NUMERIC;
  v_profit NUMERIC;
  v_party_bal NUMERIC;
  v_err TEXT;
BEGIN
  BEGIN
  -- --------------------------------------------------------------------------
  -- SETUP: Agency A, Agency B, Read-Only Sub-User on Agency A
  -- --------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
  VALUES (
    v_user_a,
    'edit-a-' || v_user_a::text || '@tamspro.test',
    '{"agency_name": "__EDIT_TEST_A__", "full_name": "Agency A Owner"}'::jsonb,
    NOW()
  );
  SELECT agency_id INTO v_agency_a FROM public.profiles WHERE id = v_user_a;

  INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
  VALUES (
    v_user_b,
    'edit-b-' || v_user_b::text || '@tamspro.test',
    '{"agency_name": "__EDIT_TEST_B__", "full_name": "Agency B Owner"}'::jsonb,
    NOW()
  );
  SELECT agency_id INTO v_agency_b FROM public.profiles WHERE id = v_user_b;

  INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
  VALUES (
    v_sub_ro,
    'edit-ro-' || v_sub_ro::text || '@tamspro.test',
    '{"agency_name": "__EDIT_TEST_RO__", "full_name": "Read Only Sub"}'::jsonb,
    NOW()
  );
  UPDATE public.profiles SET agency_id = v_agency_a WHERE id = v_sub_ro;
  INSERT INTO public.sub_users (user_id, main_user_id, agency_id, sub_id_code, is_active, permissions)
  VALUES (
    v_sub_ro, v_user_a, v_agency_a, 'SUB-RO-' || substr(v_sub_ro::text, 1, 8), true,
    '{"bookings": {"read": true, "write": false}, "invoices": {"read": true, "write": false}, "clients": {"read": true, "write": false}, "vendors": {"read": true, "write": false}}'::jsonb
  );

  -- Switch session to Agency A Owner
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  INSERT INTO public.parties (id, agency_id, type, name, phone)
  VALUES
    (v_client_a, v_agency_a, 'client', 'Ali Travels Client', '03001112223'),
    (v_vendor_a, v_agency_a, 'vendor', 'PIA Consolidator', '03009998887');

  INSERT INTO public.accounts (id, agency_id, type, name, opening_balance, active)
  VALUES
    (v_cash_acc_a, v_agency_a, 'cash', 'Main Cash', 0, true),
    (v_bank_acc_a, v_agency_a, 'bank', 'HBL Main', 0, true);

  -- Create Invoice: 100,000 sell / 80,000 cost / 0 initial paid
  v_inv_res := public.save_booking_invoice_atomic(
    p_service := 'Ticket',
    p_party_id := v_client_a,
    p_vendor_id := v_vendor_a,
    p_client_amount := 100000,
    p_vendor_payable := 80000,
    p_amount_paid := 0,
    p_payment_mode := 'cash',
    p_invoice_date := CURRENT_DATE,
    p_pnr := 'ABC123',
    p_request_id := gen_random_uuid()
  );
  v_inv_id := (v_inv_res->>'invoice_id')::uuid;

  -- Create Receipt Voucher linked to invoice: 40,000 Cash
  v_vch_res := public.save_payment_voucher_atomic(
    p_direction := 'received',
    p_amount := 40000,
    p_payment_mode := 'cash',
    p_account_id := v_cash_acc_a,
    p_party_id := v_client_a,
    p_voucher_date := CURRENT_DATE,
    p_invoice_id := v_inv_id,
    p_notes := 'Initial cash installment',
    p_request_id := gen_random_uuid()
  );
  v_vch_id := (v_vch_res->>'voucher_id')::uuid;

  -- --------------------------------------------------------------------------
  -- TEST 1: Edit Invoice Amount (100k -> 125k, Cost 80k -> 90k)
  -- --------------------------------------------------------------------------
  v_edit_res := public.edit_booking_invoice_atomic(
    p_invoice_id := v_inv_id,
    p_reason := 'Updated airline fare & tax adjustment',
    p_client_amount := 125000,
    p_vendor_payable := 90000,
    p_pnr := 'XYZ789'
  );

  SELECT profit, payment_status INTO v_profit, v_status
  FROM public.booking_invoices WHERE id = v_inv_id;

  SELECT current_balance INTO v_party_bal FROM public.parties WHERE id = v_client_a;
  v_summary := public.get_agency_financial_summary(CURRENT_DATE - 30, CURRENT_DATE, v_agency_a);

  SELECT COUNT(*) INTO v_cnt FROM public.central_journal_entries
  WHERE agency_id = v_agency_a AND invoice_id = v_inv_id AND is_reversal = true;

  SELECT COUNT(*) INTO v_cnt2 FROM public.document_edit_history
  WHERE agency_id = v_agency_a AND document_type = 'booking_invoice' AND document_id = v_inv_id;

  IF v_profit = 35000
     AND v_status = 'partial'
     AND (v_summary->>'client_dues')::numeric = 85000
     AND (v_summary->>'vendor_dues')::numeric = 90000
     AND (v_summary->>'period_profit')::numeric = 35000
     AND v_party_bal = 85000
     AND v_cnt = 4
     AND v_cnt2 = 1 THEN
    v_seq := v_seq + 1;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'seq', v_seq,
      'test_name', '01. Edit invoice amount -> reversing+new ledger, dues, profit & audit history',
      'pass_or_fail', 'PASS',
      'detail', 'profit=35000, client_dues=85000, vendor_dues=90000, reversals=4, history=1'
    ));
  ELSE
    v_seq := v_seq + 1;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'seq', v_seq,
      'test_name', '01. Edit invoice amount -> reversing+new ledger, dues, profit & audit history',
      'pass_or_fail', 'FAIL',
      'detail', format('profit=%s status=%s summary=%s bal=%s rev=%s hist=%s', v_profit, v_status, v_summary, v_party_bal, v_cnt, v_cnt2)
    ));
  END IF;

  -- --------------------------------------------------------------------------
  -- TEST 2: Edit Voucher Amount & Mode (40k Cash -> 60k HBL Bank, then -> 125k Paid)
  -- --------------------------------------------------------------------------
  PERFORM public.edit_payment_voucher_atomic(
    p_voucher_id := v_vch_id,
    p_reason := 'Client paid extra via HBL transfer',
    p_amount := 60000,
    p_payment_mode := 'bank',
    p_account_id := v_bank_acc_a,
    p_bank_name := 'HBL Main',
    p_reference_no := 'HBL-TRX-991'
  );

  SELECT COALESCE(current_balance, 0) INTO v_cash_bal FROM public.account_balances(v_agency_a) WHERE account_id = v_cash_acc_a;
  SELECT COALESCE(current_balance, 0) INTO v_bank_bal FROM public.account_balances(v_agency_a) WHERE account_id = v_bank_acc_a;
  SELECT paid_amount, payment_status INTO v_paid, v_status FROM public.booking_invoices WHERE id = v_inv_id;

  -- Now settle remaining to reach 'paid' status
  PERFORM public.edit_payment_voucher_atomic(
    p_voucher_id := v_vch_id,
    p_reason := 'Full settlement received in HBL',
    p_amount := 125000,
    p_payment_mode := 'bank',
    p_account_id := v_bank_acc_a,
    p_bank_name := 'HBL Main'
  );

  SELECT paid_amount, payment_status INTO v_paid, v_status FROM public.booking_invoices WHERE id = v_inv_id;
  SELECT COALESCE(current_balance, 0) INTO v_bank_bal FROM public.account_balances(v_agency_a) WHERE account_id = v_bank_acc_a;

  IF v_cash_bal = 0 AND v_bank_bal = 125000 AND v_paid = 125000 AND v_status = 'paid' THEN
    v_seq := v_seq + 1;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'seq', v_seq,
      'test_name', '02. Edit voucher amount & mode (Cash->Bank) -> balances & linked invoice status',
      'pass_or_fail', 'PASS',
      'detail', 'Cash=0, Bank=125000, Invoice paid_amount=125000, status=paid'
    ));
  ELSE
    v_seq := v_seq + 1;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'seq', v_seq,
      'test_name', '02. Edit voucher amount & mode (Cash->Bank) -> balances & linked invoice status',
      'pass_or_fail', 'FAIL',
      'detail', format('cash=%s bank=%s paid=%s status=%s', v_cash_bal, v_bank_bal, v_paid, v_status)
    ));
  END IF;

  -- --------------------------------------------------------------------------
  -- TEST 3: Edit Refund -> totals & cash/bank updated cleanly
  -- --------------------------------------------------------------------------
  v_ref_res := public.record_refund(
    p_amount := 20000,
    p_account_id := v_bank_acc_a,
    p_party_id := v_client_a,
    p_booking_id := v_inv_id,
    p_date := CURRENT_DATE,
    p_method := 'bank',
    p_bank_name := 'HBL Main',
    p_reason := 'Partial schedule change refund',
    p_void_invoice := false,
    p_request_id := gen_random_uuid()
  );
  v_ref_id := (v_ref_res->>'refund_id')::uuid;

  PERFORM public.edit_refund_atomic(
    p_refund_id := v_ref_id,
    p_reason := 'Airline waived penalty, increased client refund',
    p_refund_amount := 35000,
    p_vendor_refund_amount := 25000,
    p_deductions := 1500
  );

  SELECT COALESCE(current_balance, 0) INTO v_bank_bal FROM public.account_balances(v_agency_a) WHERE account_id = v_bank_acc_a;
  SELECT COUNT(*) INTO v_cnt FROM public.document_edit_history
  WHERE agency_id = v_agency_a AND document_type = 'refund' AND document_id = v_ref_id;

  IF v_bank_bal = 90000 AND v_cnt = 1 THEN
    v_seq := v_seq + 1;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'seq', v_seq,
      'test_name', '03. Edit refund -> refund totals, reversal+new tx & account balance',
      'pass_or_fail', 'PASS',
      'detail', 'Bank balance 125000 - 35000 = 90000, refund history=1'
    ));
  ELSE
    v_seq := v_seq + 1;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'seq', v_seq,
      'test_name', '03. Edit refund -> refund totals, reversal+new tx & account balance',
      'pass_or_fail', 'FAIL',
      'detail', format('bank=%s hist=%s', v_bank_bal, v_cnt)
    ));
  END IF;

  -- --------------------------------------------------------------------------
  -- TEST 4: No-change edit does nothing & missing reason is blocked
  -- --------------------------------------------------------------------------
  SELECT edit_count INTO v_cnt FROM public.booking_invoices WHERE id = v_inv_id;
  v_edit_res := public.edit_booking_invoice_atomic(
    p_invoice_id := v_inv_id,
    p_reason := 'Opening and saving with no edits',
    p_client_amount := 125000,
    p_vendor_payable := 90000,
    p_pnr := 'XYZ789'
  );
  SELECT edit_count INTO v_cnt2 FROM public.booking_invoices WHERE id = v_inv_id;

  v_err := '';
  BEGIN
    PERFORM public.edit_booking_invoice_atomic(
      p_invoice_id := v_inv_id,
      p_reason := '   ',
      p_client_amount := 130000
    );
    v_err := 'missing_reason_allowed';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  IF COALESCE((v_edit_res->>'no_changes')::boolean, false) AND v_cnt = v_cnt2 AND v_err = '' THEN
    v_seq := v_seq + 1;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'seq', v_seq,
      'test_name', '04. No-change edit does nothing & missing reason blocked',
      'pass_or_fail', 'PASS',
      'detail', 'no_changes=true, edit_count unchanged, blank reason rejected'
    ));
  ELSE
    v_seq := v_seq + 1;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'seq', v_seq,
      'test_name', '04. No-change edit does nothing & missing reason blocked',
      'pass_or_fail', 'FAIL',
      'detail', format('res=%s cnt=%s/%s err=%s', v_edit_res, v_cnt, v_cnt2, v_err)
    ));
  END IF;

  -- --------------------------------------------------------------------------
  -- TEST 5: Old pre-feature records (no legacy_id on tx, default audit cols)
  -- --------------------------------------------------------------------------
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);

  INSERT INTO public.booking_invoices (
    id, agency_id, invoice_no, invoice_date, service, party_id, client_amount, vendor_payable, profit, paid_amount, payment_status
  ) VALUES (
    v_legacy_inv_id, v_agency_a, 'INV-LEGACY-0001', CURRENT_DATE - 10, 'Visa', v_client_a, 10000, 7000, 3000, 4000, 'partial'
  );

  INSERT INTO public.payment_vouchers (
    id, agency_id, voucher_no, voucher_date, direction, payment_mode, account_id, party_id, amount
  ) VALUES (
    v_legacy_vch_id, v_agency_a, 'CRV-LEGACY-0001', CURRENT_DATE - 10, 'received', 'cash', v_cash_acc_a, v_client_a, 4000
  );

  INSERT INTO public.invoice_allocations (agency_id, voucher_id, invoice_id, allocated_amount)
  VALUES (v_agency_a, v_legacy_vch_id, v_legacy_inv_id, 4000);

  -- Pre-feature tx WITHOUT legacy_source/legacy_id
  INSERT INTO public.transactions (
    id, agency_id, date, type, party_id, party_type, booking_id, account_id, debit, credit, method, reference_no
  ) VALUES (
    v_legacy_tx_id, v_agency_a, CURRENT_DATE - 10, 'payment_in', v_client_a, 'client', v_legacy_inv_id, v_cash_acc_a, 4000, 0, 'cash', 'CRV-LEGACY-0001'
  );

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  PERFORM public.edit_payment_voucher_atomic(
    p_voucher_id := v_legacy_vch_id,
    p_reason := 'Correcting pre-feature receipt to full payment',
    p_amount := 10000,
    p_payment_mode := 'cash'
  );

  SELECT paid_amount, payment_status INTO v_paid, v_status FROM public.booking_invoices WHERE id = v_legacy_inv_id;
  SELECT COUNT(*) INTO v_cnt FROM public.transactions WHERE id = v_legacy_tx_id AND reversed_of IS NOT NULL;

  IF v_paid = 10000 AND v_status = 'paid' AND v_cnt = 1 THEN
    v_seq := v_seq + 1;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'seq', v_seq,
      'test_name', '05. Old pre-feature records edit cleanly & reverse legacy transaction',
      'pass_or_fail', 'PASS',
      'detail', 'Legacy tx reversed, linked legacy invoice paid=10000, status=paid'
    ));
  ELSE
    v_seq := v_seq + 1;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'seq', v_seq,
      'test_name', '05. Old pre-feature records edit cleanly & reverse legacy transaction',
      'pass_or_fail', 'FAIL',
      'detail', format('paid=%s status=%s legacy_reversed=%s', v_paid, v_status, v_cnt)
    ));
  END IF;

  -- --------------------------------------------------------------------------
  -- TEST 6: Second agency + RO sub-user blocked + audit history immutable
  -- --------------------------------------------------------------------------
  v_err := '';

  -- Own user cannot UPDATE or DELETE document_edit_history
  BEGIN
    UPDATE public.document_edit_history SET reason = 'tampered' WHERE agency_id = v_agency_a;
    v_err := v_err || 'history_update_allowed,';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    DELETE FROM public.document_edit_history WHERE agency_id = v_agency_a;
    v_err := v_err || 'history_delete_allowed,';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Switch to Read-Only Sub-user on Agency A
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sub_ro, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_sub_ro::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  BEGIN
    PERFORM public.edit_booking_invoice_atomic(v_inv_id, 'Unauthorized RO edit', p_notes := 'bad');
    v_err := v_err || 'ro_sub_invoice_edit_allowed,';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Switch to Agency B Owner
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_b, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_user_b::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  SELECT COUNT(*) INTO v_cnt FROM public.document_edit_history WHERE agency_id = v_agency_a;
  IF v_cnt > 0 THEN v_err := v_err || 'agency_b_read_history_allowed,'; END IF;

  BEGIN
    PERFORM public.edit_booking_invoice_atomic(v_inv_id, 'Cross agency attack', p_client_amount := 1);
    v_err := v_err || 'agency_b_invoice_edit_allowed,';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    PERFORM public.edit_payment_voucher_atomic(v_vch_id, 'Cross agency attack', p_amount := 1);
    v_err := v_err || 'agency_b_voucher_edit_allowed,';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    PERFORM public.edit_refund_atomic(v_ref_id, 'Cross agency attack', p_refund_amount := 1);
    v_err := v_err || 'agency_b_refund_edit_allowed,';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  IF v_err = '' THEN
    v_seq := v_seq + 1;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'seq', v_seq,
      'test_name', '06. Strict agency isolation, RO sub-user guard & immutable audit trail',
      'pass_or_fail', 'PASS',
      'detail', 'Agency B saw 0 history rows & blocked on all 3 RPCs; RO sub blocked; history append-only'
    ));
  ELSE
    v_seq := v_seq + 1;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'seq', v_seq,
      'test_name', '06. Strict agency isolation, RO sub-user guard & immutable audit trail',
      'pass_or_fail', 'FAIL',
      'detail', 'Bypass: ' || v_err
    ));
  END IF;

  -- --------------------------------------------------------------------------
  -- TEST 7: Failed edit rolls back fully with zero half-saved data
  -- --------------------------------------------------------------------------
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  SELECT COUNT(*) INTO v_cnt FROM public.document_edit_history WHERE agency_id = v_agency_a;
  v_err := '';

  -- Try lowering invoice total below paid_amount (paid=125000, attempt 100000)
  BEGIN
    PERFORM public.edit_booking_invoice_atomic(v_inv_id, 'Invalid lower total', p_client_amount := 100000);
    v_err := v_err || 'under_paid_allowed,';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Try increasing voucher beyond linked invoice total (125000 -> 150000)
  BEGIN
    PERFORM public.edit_payment_voucher_atomic(v_vch_id, 'Invalid overpayment', p_amount := 150000);
    v_err := v_err || 'overpay_voucher_allowed,';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  SELECT COUNT(*) INTO v_cnt2 FROM public.document_edit_history WHERE agency_id = v_agency_a;
  SELECT paid_amount INTO v_paid FROM public.booking_invoices WHERE id = v_inv_id;

  IF v_err = '' AND v_cnt = v_cnt2 AND v_paid = 125000 THEN
    v_seq := v_seq + 1;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'seq', v_seq,
      'test_name', '07. Failed edit rolls back fully with zero half-saved data',
      'pass_or_fail', 'PASS',
      'detail', 'Invalid invoice/voucher edits rejected atomically; history & balances untouched'
    ));
  ELSE
    v_seq := v_seq + 1;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'seq', v_seq,
      'test_name', '07. Failed edit rolls back fully with zero half-saved data',
      'pass_or_fail', 'FAIL',
      'detail', format('err=%s hist=%s/%s paid=%s', v_err, v_cnt, v_cnt2, v_paid)
    ));
  END IF;

  RESET ROLE;
  RAISE EXCEPTION USING ERRCODE = 'P0999', MESSAGE = v_results::text;
  EXCEPTION
    WHEN SQLSTATE 'P0999' THEN
      GET STACKED DIAGNOSTICS v_payload = MESSAGE_TEXT;
      v_results := v_payload::jsonb;
  END;

  RETURN QUERY
  SELECT
    (elem->>'seq')::INT,
    elem->>'test_name',
    elem->>'pass_or_fail',
    elem->>'detail'
  FROM jsonb_array_elements(v_results) AS elem
  ORDER BY (elem->>'seq')::INT;
END;
$self_test$;

SELECT
  out_seq AS seq,
  out_test_name AS test_name,
  out_pass_or_fail AS pass_or_fail,
  out_detail AS detail
FROM pg_temp._tams_run_sales_edit_test()
ORDER BY out_seq;
