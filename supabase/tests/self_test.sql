-- ==============================================================================
-- TAMS PRO — ROLLBACK-SAFE SECURITY & ACCOUNTING SELF-TEST
-- File: supabase/tests/self_test.sql
--
-- HOW IT WORKS:
--   - Runs inside BEGIN ... ROLLBACK so ZERO test rows ever remain in the DB.
--   - Simulates real authenticated / anon sessions via JWT claims + SET LOCAL ROLE.
--   - Returns a single clean table: seq | test_name | PASS_or_FAIL | detail
--   - Every row MUST show 'PASS' before releasing frontend changes.
-- ==============================================================================

BEGIN;

CREATE TEMP TABLE _self_test_results (
  seq INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  test_name TEXT NOT NULL,
  pass_or_fail TEXT NOT NULL,
  detail TEXT
) ON COMMIT DROP;

DO $$
DECLARE
  -- Test actors
  v_user_a UUID := gen_random_uuid();
  v_user_b UUID := gen_random_uuid();
  v_sub_limited UUID := gen_random_uuid();
  v_sub_deactivated UUID := gen_random_uuid();
  v_unconfirmed_user UUID := gen_random_uuid();

  v_agency_a UUID;
  v_agency_b UUID;

  -- Seeded records for Agency A
  v_party_a UUID := gen_random_uuid();
  v_vendor_a UUID := gen_random_uuid();
  v_cash_acc_a UUID := gen_random_uuid();
  v_bank_acc_a UUID := gen_random_uuid();
  v_invoice_res JSONB;
  v_invoice_id_a UUID;
  v_voucher_res JSONB;
  v_voucher_id_a UUID;
  v_expense_res JSONB;
  v_refund_res JSONB;
  v_tx_id_a UUID;
  v_cash_entry_res JSONB;
  v_cash_entry_id_a UUID;
  v_cash_tx_id_a UUID;
  v_ob_res JSONB;
  v_ob_id_a UUID;
  v_bank_res JSONB;
  v_bank_id_a UUID;
  v_bank_linked_acc_id UUID;
  v_reminder_id_a UUID := gen_random_uuid();
  v_quotation_id_a UUID := gen_random_uuid();
  v_client_id_a UUID := gen_random_uuid();
  v_legacy_vendor_id_a UUID := gen_random_uuid();
  v_template_id_a UUID := gen_random_uuid();

  -- Scratch verification variables
  v_cnt BIGINT;
  v_cnt2 BIGINT;
  v_net NUMERIC;
  v_txt1 TEXT;
  v_txt2 TEXT;
  v_txt3 TEXT;
  v_bool BOOLEAN;
  v_err TEXT;
  v_isolated_fails TEXT := '';
  v_write_fails TEXT := '';
  v_tmp_summary JSONB;
BEGIN
  -- --------------------------------------------------------------------------
  -- CHECK 10 (PRE-CHECK): Pre-existing users & auto-confirm trigger state
  -- --------------------------------------------------------------------------
  SELECT COUNT(*) INTO v_cnt
  FROM auth.users
  WHERE email_confirmed_at IS NULL;

  SELECT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'auth'
      AND c.relname = 'users'
      AND t.tgname = 'trg_auto_confirm_agency_signup'
  ) INTO v_bool;

  IF v_cnt = 0 AND NOT v_bool THEN
    INSERT INTO _self_test_results (test_name, pass_or_fail, detail)
    VALUES ('10a. Existing users confirmed & auto-confirm trigger removed', 'PASS',
            'Unconfirmed existing users = 0; trg_auto_confirm_agency_signup absent');
  ELSE
    INSERT INTO _self_test_results (test_name, pass_or_fail, detail)
    VALUES ('10a. Existing users confirmed & auto-confirm trigger removed', 'FAIL',
            format('Unconfirmed=%s, auto_confirm_trigger_present=%s', v_cnt, v_bool));
  END IF;

  -- Test inserting a brand-new unconfirmed user leaves email_confirmed_at NULL
  INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
  VALUES (
    v_unconfirmed_user,
    'unconfirmed-' || v_unconfirmed_user::text || '@tamspro.test',
    '{"agency_name": "__SELF_TEST_UNCONFIRMED__", "full_name": "Unconfirmed User"}'::jsonb,
    NULL
  );

  SELECT (email_confirmed_at IS NULL) INTO v_bool
  FROM auth.users
  WHERE id = v_unconfirmed_user;

  IF COALESCE(v_bool, false) THEN
    INSERT INTO _self_test_results (test_name, pass_or_fail, detail)
    VALUES ('10b. New signup stays unconfirmed until email link clicked', 'PASS',
            'email_confirmed_at stayed NULL on insert');
  ELSE
    INSERT INTO _self_test_results (test_name, pass_or_fail, detail)
    VALUES ('10b. New signup stays unconfirmed until email link clicked', 'FAIL',
            'email_confirmed_at was unexpectedly auto-populated');
  END IF;

  -- --------------------------------------------------------------------------
  -- SETUP ACTORS: Agency A owner (passed fake yearly plan), Agency B owner,
  -- limited sub-user on Agency A, and deactivated sub-user on Agency A.
  -- --------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
  VALUES (
    v_user_a,
    'owner-a-' || v_user_a::text || '@tamspro.test',
    '{"agency_name": "__SELF_TEST_AGENCY_A__", "full_name": "Owner A", "subscription_plan": "yearly"}'::jsonb,
    NOW()
  );
  SELECT agency_id INTO v_agency_a FROM public.profiles WHERE id = v_user_a;

  INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
  VALUES (
    v_user_b,
    'owner-b-' || v_user_b::text || '@tamspro.test',
    '{"agency_name": "__SELF_TEST_AGENCY_B__", "full_name": "Owner B"}'::jsonb,
    NOW()
  );
  SELECT agency_id INTO v_agency_b FROM public.profiles WHERE id = v_user_b;

  INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
  VALUES (
    v_sub_limited,
    'sub-lim-' || v_sub_limited::text || '@tamspro.test',
    '{"agency_name": "__SELF_TEST_SUB_LIM__", "full_name": "Limited Sub"}'::jsonb,
    NOW()
  );
  UPDATE public.profiles SET agency_id = v_agency_a WHERE id = v_sub_limited;
  INSERT INTO public.sub_users (user_id, main_user_id, agency_id, sub_id_code, is_active, permissions)
  VALUES (
    v_sub_limited,
    v_user_a,
    v_agency_a,
    'SUB-LIM-' || substr(v_sub_limited::text, 1, 8),
    true,
    '{
      "dashboard": true,
      "bookings": {"read": true, "write": false, "delete": false},
      "vendors": {"read": false, "write": false, "delete": false},
      "clients": {"read": true, "write": false, "delete": false},
      "queries": {"read": false, "write": false, "delete": false},
      "expenses": {"read": false, "write": false, "delete": false},
      "reports": {"read": false},
      "invoices": {"read": true, "write": false, "delete": false},
      "settings": false
    }'::jsonb
  );

  INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
  VALUES (
    v_sub_deactivated,
    'sub-off-' || v_sub_deactivated::text || '@tamspro.test',
    '{"agency_name": "__SELF_TEST_SUB_OFF__", "full_name": "Deactivated Sub"}'::jsonb,
    NOW()
  );
  UPDATE public.profiles SET agency_id = v_agency_a WHERE id = v_sub_deactivated;
  INSERT INTO public.sub_users (user_id, main_user_id, agency_id, sub_id_code, is_active, permissions)
  VALUES (
    v_sub_deactivated,
    v_user_a,
    v_agency_a,
    'SUB-OFF-' || substr(v_sub_deactivated::text, 1, 8),
    false,
    '{
      "dashboard": true,
      "bookings": {"read": true, "write": true, "delete": true},
      "invoices": {"read": true, "write": true, "delete": true},
      "expenses": {"read": true, "write": true, "delete": true},
      "reports": {"read": true},
      "settings": true
    }'::jsonb
  );

  -- --------------------------------------------------------------------------
  -- CHECK 9b (PART 1): handle_new_user() ignored client 'yearly' plan metadata
  -- --------------------------------------------------------------------------
  SELECT subscription_plan INTO v_txt1 FROM public.agencies WHERE id = v_agency_a;
  IF v_txt1 = 'free' THEN
    INSERT INTO _self_test_results (test_name, pass_or_fail, detail)
    VALUES ('09a. Signup ignores paid plan metadata & starts free trial', 'PASS',
            'Agency A subscription_plan = free despite yearly metadata');
  ELSE
    INSERT INTO _self_test_results (test_name, pass_or_fail, detail)
    VALUES ('09a. Signup ignores paid plan metadata & starts free trial', 'FAIL',
            format('Expected free, got %s', COALESCE(v_txt1, 'NULL')));
  END IF;

  -- --------------------------------------------------------------------------
  -- CHECK 7: Sequential numbering, no duplicates, each new agency starts at 1
  -- --------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  v_txt1 := public.next_unused_agency_number(v_agency_a, 'invoice');
  v_txt2 := public.next_unused_agency_number(v_agency_a, 'invoice');

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_b, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_user_b::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  v_txt3 := public.next_unused_agency_number(v_agency_b, 'invoice');
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);

  IF v_txt1 ~ '-0001$' AND v_txt2 ~ '-0002$' AND v_txt1 <> v_txt2 AND v_txt3 ~ '-0001$' THEN
    INSERT INTO _self_test_results (test_name, pass_or_fail, detail)
    VALUES ('07. Numbering sequential, unique, each new agency starts at 1', 'PASS',
            format('A: %s -> %s ; B: %s', v_txt1, v_txt2, v_txt3));
  ELSE
    INSERT INTO _self_test_results (test_name, pass_or_fail, detail)
    VALUES ('07. Numbering sequential, unique, each new agency starts at 1', 'FAIL',
            format('Unexpected sequence: A1=%s, A2=%s, B1=%s', v_txt1, v_txt2, v_txt3));
  END IF;

  -- --------------------------------------------------------------------------
  -- SEED DATA FOR AGENCY A (as authenticated Owner A)
  -- --------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  INSERT INTO public.parties (id, agency_id, type, name, phone)
  VALUES (v_party_a, v_agency_a, 'client', 'Test Client A', '0300-0000001');

  INSERT INTO public.parties (id, agency_id, type, name, phone)
  VALUES (v_vendor_a, v_agency_a, 'vendor', 'Test Vendor A', '0300-0000002');

  INSERT INTO public.accounts (id, agency_id, type, name, opening_balance, active)
  VALUES (v_cash_acc_a, v_agency_a, 'cash', 'Main Cash A', 10000, true);

  INSERT INTO public.accounts (id, agency_id, type, name, opening_balance, active)
  VALUES (v_bank_acc_a, v_agency_a, 'bank', 'Test Bank Account A', 50000, true);

  v_invoice_res := public.save_booking_invoice_atomic(
    p_invoice_no := NULL,
    p_service := 'Ticket',
    p_party_id := v_party_a,
    p_vendor_id := v_vendor_a,
    p_client_amount := 20000,
    p_vendor_payable := 15000,
    p_amount_paid := 5000,
    p_payment_mode := 'cash',
    p_account_id := v_cash_acc_a,
    p_invoice_date := CURRENT_DATE
  );
  v_invoice_id_a := (v_invoice_res->>'invoice_id')::uuid;

  v_voucher_res := public.save_payment_voucher_atomic(
    p_direction := 'received',
    p_amount := 3000,
    p_payment_mode := 'cash',
    p_account_id := v_cash_acc_a,
    p_party_id := v_party_a,
    p_voucher_date := CURRENT_DATE,
    p_invoice_id := v_invoice_id_a
  );
  v_voucher_id_a := (v_voucher_res->>'voucher_id')::uuid;

  v_expense_res := public.record_expense(
    p_amount := 1200,
    p_account_id := v_cash_acc_a,
    p_category := 'Office Test',
    p_date := CURRENT_DATE,
    p_method := 'cash'
  );

  v_refund_res := public.record_refund(
    p_amount := 500,
    p_account_id := v_cash_acc_a,
    p_party_id := v_party_a,
    p_party_type := 'client',
    p_booking_id := v_invoice_id_a,
    p_date := CURRENT_DATE,
    p_method := 'cash',
    p_reason := 'Self test refund'
  );

  INSERT INTO public.agency_templates (id, agency_id, key, value)
  VALUES (v_template_id_a, v_agency_a, 'invoice_template', '{"companyName":"Agency A"}'::jsonb);

  INSERT INTO public.reminders (id, user_id, agency_id, title, type, remind_date)
  VALUES (v_reminder_id_a, v_user_a, v_agency_a, 'Secret Agency A Reminder', 'manual', CURRENT_DATE);

  INSERT INTO public.quotations (id, agency_id, quotation_number, client_name, items, subtotal, total)
  VALUES (v_quotation_id_a, v_agency_a, 'QT-TEST-0001', 'Quote Client A', '[]'::jsonb, 1000, 1000);

  INSERT INTO public.clients (id, agency_id, name, contact_number)
  VALUES (v_client_id_a, v_agency_a, 'Legacy Client A', '03001112223');

  INSERT INTO public.vendors (id, agency_id, name, contact_number)
  VALUES (v_legacy_vendor_id_a, v_agency_a, 'Legacy Vendor A', '03004445556');

  -- --------------------------------------------------------------------------
  -- CHECK 5: Deleting cash/bank entry atomically reverses ledger transaction
  -- --------------------------------------------------------------------------
  v_cash_entry_res := public.add_cash_bank_entry_atomic(
    p_entry_date := to_char(CURRENT_DATE, 'YYYY-MM-DD'),
    p_entry_type := 'cash_in',
    p_amount := 4500,
    p_payment_mode := 'cash',
    p_category := 'Test Deposit',
    p_description := 'Self-test cash entry',
    p_reference_number := 'CB-TEST-01',
    p_account_id := v_cash_acc_a
  );
  v_cash_entry_id_a := (v_cash_entry_res->'entry'->>'id')::uuid;
  v_cash_tx_id_a := (v_cash_entry_res->>'transaction_id')::uuid;

  PERFORM public.delete_cash_bank_entry_atomic(v_cash_entry_id_a);

  SELECT COUNT(*) INTO v_cnt FROM public.cash_bank_entries WHERE id = v_cash_entry_id_a;
  SELECT COALESCE(SUM(debit - credit), -999999), COUNT(*)
  INTO v_net, v_cnt2
  FROM public.transactions
  WHERE agency_id = v_agency_a
    AND (id = v_cash_tx_id_a OR reversed_of = v_cash_tx_id_a);

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);

  IF v_cnt = 0 AND v_cnt2 = 2 AND v_net = 0 THEN
    INSERT INTO _self_test_results (test_name, pass_or_fail, detail)
    VALUES ('05. Cash/bank entry delete atomically reverses transaction', 'PASS',
            'Entry deleted; original + reversal tx net = 0');
  ELSE
    INSERT INTO _self_test_results (test_name, pass_or_fail, detail)
    VALUES ('05. Cash/bank entry delete atomically reverses transaction', 'FAIL',
            format('entry_remaining=%s, tx_rows=%s, net=%s', v_cnt, v_cnt2, v_net));
  END IF;

  -- Keep one active cash entry on Agency A for Cross-Agency isolation testing
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  v_cash_entry_res := public.add_cash_bank_entry_atomic(
    p_entry_date := to_char(CURRENT_DATE, 'YYYY-MM-DD'),
    p_entry_type := 'cash_in',
    p_amount := 1500,
    p_payment_mode := 'cash',
    p_category := 'Isolation Seed',
    p_account_id := v_cash_acc_a
  );
  v_cash_entry_id_a := (v_cash_entry_res->'entry'->>'id')::uuid;

  -- --------------------------------------------------------------------------
  -- CHECK 6a: Opening balance update & delete atomically updates/reverses tx
  -- --------------------------------------------------------------------------
  v_ob_res := public.upsert_opening_balance_atomic(
    p_party_type := 'client',
    p_party_id := v_party_a,
    p_balance_type := 'receivable',
    p_amount := 5000,
    p_as_of_date := CURRENT_DATE,
    p_notes := 'Initial OB'
  );
  v_ob_id_a := (v_ob_res->'opening_balance'->>'id')::uuid;

  PERFORM public.update_opening_balance_atomic(
    p_id := v_ob_id_a,
    p_amount := 8500,
    p_balance_type := 'receivable',
    p_as_of_date := CURRENT_DATE,
    p_notes := 'Updated OB'
  );

  SELECT debit INTO v_net
  FROM public.transactions
  WHERE agency_id = v_agency_a
    AND legacy_source IN ('opening_balance', 'opening_balances')
    AND legacy_id = v_ob_id_a
    AND reversed_of IS NULL
  LIMIT 1;

  PERFORM public.delete_opening_balance_atomic(v_ob_id_a);

  SELECT COUNT(*) INTO v_cnt FROM public.opening_balances WHERE id = v_ob_id_a;
  SELECT COALESCE(SUM(debit - credit), -999999) INTO v_cnt2
  FROM public.transactions
  WHERE agency_id = v_agency_a
    AND legacy_id = v_ob_id_a;

  -- Re-insert one opening balance for Cross-Agency isolation check
  v_ob_res := public.upsert_opening_balance_atomic(
    p_party_type := 'client',
    p_party_id := v_party_a,
    p_balance_type := 'receivable',
    p_amount := 2200,
    p_as_of_date := CURRENT_DATE,
    p_notes := 'Isolation OB'
  );
  v_ob_id_a := (v_ob_res->'opening_balance'->>'id')::uuid;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);

  IF v_net = 8500 AND v_cnt = 0 AND v_cnt2 = 0 THEN
    INSERT INTO _self_test_results (test_name, pass_or_fail, detail)
    VALUES ('06a. Opening balance update & delete synced with ledger', 'PASS',
            'Update synced tx=8500; delete removed OB and netted tx=0');
  ELSE
    INSERT INTO _self_test_results (test_name, pass_or_fail, detail)
    VALUES ('06a. Opening balance update & delete synced with ledger', 'FAIL',
            format('after_update_tx=%s, ob_left=%s, net_after_del=%s', v_net, v_cnt, v_cnt2));
  END IF;

  -- --------------------------------------------------------------------------
  -- CHECK 6b: Agency bank upsert & delete atomically updates/deletes accounts
  -- --------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  v_bank_res := public.upsert_agency_bank_atomic(
    p_id := NULL,
    p_bank_name := 'Meezan Test Bank',
    p_account_title := 'Agency A Title',
    p_account_number := '9988',
    p_branch_name := 'Main Branch',
    p_opening_balance := 25000,
    p_is_active := true
  );
  v_bank_id_a := (v_bank_res->'bank'->>'id')::uuid;
  v_bank_linked_acc_id := (v_bank_res->>'account_id')::uuid;

  v_bank_res := public.upsert_agency_bank_atomic(
    p_id := v_bank_id_a,
    p_bank_name := 'Meezan Updated Bank',
    p_account_title := 'Agency A Title',
    p_account_number := '9988',
    p_branch_name := 'Main Branch',
    p_opening_balance := 40000,
    p_is_active := true
  );

  SELECT opening_balance INTO v_net FROM public.accounts WHERE id = v_bank_linked_acc_id;

  PERFORM public.delete_agency_bank_atomic(v_bank_id_a);

  SELECT COUNT(*) INTO v_cnt FROM public.agency_banks WHERE id = v_bank_id_a;
  SELECT COUNT(*) INTO v_cnt2 FROM public.accounts WHERE id = v_bank_linked_acc_id;

  -- Seed one agency bank for Cross-Agency isolation check
  v_bank_res := public.upsert_agency_bank_atomic(
    p_id := NULL,
    p_bank_name := 'Isolation Seed Bank',
    p_account_title := 'Seed',
    p_account_number := '1122',
    p_opening_balance := 1000,
    p_is_active := true
  );
  v_bank_id_a := (v_bank_res->'bank'->>'id')::uuid;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);

  IF v_net = 40000 AND v_cnt = 0 AND v_cnt2 = 0 THEN
    INSERT INTO _self_test_results (test_name, pass_or_fail, detail)
    VALUES ('06b. Agency bank upsert & delete synced with accounts', 'PASS',
            'Update synced accounts.opening_balance=40000; delete removed bank & unused account');
  ELSE
    INSERT INTO _self_test_results (test_name, pass_or_fail, detail)
    VALUES ('06b. Agency bank upsert & delete synced with accounts', 'FAIL',
            format('acc_bal_after_upd=%s, bank_left=%s, acc_left=%s', v_net, v_cnt, v_cnt2));
  END IF;

  -- Pick a live transaction id in Agency A for permission / isolation tests
  SELECT id INTO v_tx_id_a
  FROM public.transactions
  WHERE agency_id = v_agency_a AND reversed_of IS NULL
  LIMIT 1;

  -- --------------------------------------------------------------------------
  -- CHECK 1: Cross-agency isolation (Agency B cannot read or edit Agency A)
  -- --------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_b, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_user_b::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  SELECT COUNT(*) INTO v_cnt FROM public.agencies WHERE id = v_agency_a;
  IF v_cnt > 0 THEN v_isolated_fails := v_isolated_fails || 'agencies,'; END IF;
  SELECT COUNT(*) INTO v_cnt FROM public.parties WHERE agency_id = v_agency_a;
  IF v_cnt > 0 THEN v_isolated_fails := v_isolated_fails || 'parties,'; END IF;
  SELECT COUNT(*) INTO v_cnt FROM public.accounts WHERE agency_id = v_agency_a;
  IF v_cnt > 0 THEN v_isolated_fails := v_isolated_fails || 'accounts,'; END IF;
  SELECT COUNT(*) INTO v_cnt FROM public.booking_invoices WHERE agency_id = v_agency_a;
  IF v_cnt > 0 THEN v_isolated_fails := v_isolated_fails || 'booking_invoices,'; END IF;
  SELECT COUNT(*) INTO v_cnt FROM public.payment_vouchers WHERE agency_id = v_agency_a;
  IF v_cnt > 0 THEN v_isolated_fails := v_isolated_fails || 'payment_vouchers,'; END IF;
  SELECT COUNT(*) INTO v_cnt FROM public.expenses WHERE agency_id = v_agency_a;
  IF v_cnt > 0 THEN v_isolated_fails := v_isolated_fails || 'expenses,'; END IF;
  SELECT COUNT(*) INTO v_cnt FROM public.refunds WHERE agency_id = v_agency_a;
  IF v_cnt > 0 THEN v_isolated_fails := v_isolated_fails || 'refunds,'; END IF;
  SELECT COUNT(*) INTO v_cnt FROM public.transactions WHERE agency_id = v_agency_a;
  IF v_cnt > 0 THEN v_isolated_fails := v_isolated_fails || 'transactions,'; END IF;
  SELECT COUNT(*) INTO v_cnt FROM public.cash_bank_entries WHERE agency_id = v_agency_a;
  IF v_cnt > 0 THEN v_isolated_fails := v_isolated_fails || 'cash_bank_entries,'; END IF;
  SELECT COUNT(*) INTO v_cnt FROM public.opening_balances WHERE agency_id = v_agency_a;
  IF v_cnt > 0 THEN v_isolated_fails := v_isolated_fails || 'opening_balances,'; END IF;
  SELECT COUNT(*) INTO v_cnt FROM public.agency_banks WHERE agency_id = v_agency_a;
  IF v_cnt > 0 THEN v_isolated_fails := v_isolated_fails || 'agency_banks,'; END IF;
  SELECT COUNT(*) INTO v_cnt FROM public.agency_templates WHERE agency_id = v_agency_a;
  IF v_cnt > 0 THEN v_isolated_fails := v_isolated_fails || 'agency_templates,'; END IF;
  SELECT COUNT(*) INTO v_cnt FROM public.reminders WHERE agency_id = v_agency_a;
  IF v_cnt > 0 THEN v_isolated_fails := v_isolated_fails || 'reminders,'; END IF;
  SELECT COUNT(*) INTO v_cnt FROM public.quotations WHERE agency_id = v_agency_a;
  IF v_cnt > 0 THEN v_isolated_fails := v_isolated_fails || 'quotations,'; END IF;
  SELECT COUNT(*) INTO v_cnt FROM public.clients WHERE agency_id = v_agency_a;
  IF v_cnt > 0 THEN v_isolated_fails := v_isolated_fails || 'clients,'; END IF;
  SELECT COUNT(*) INTO v_cnt FROM public.vendors WHERE agency_id = v_agency_a;
  IF v_cnt > 0 THEN v_isolated_fails := v_isolated_fails || 'vendors,'; END IF;

  -- Cross-agency UPDATE / DELETE / INSERT attempts by Agency B against Agency A
  UPDATE public.parties SET name = 'PWNED' WHERE id = v_party_a;
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  IF v_cnt > 0 THEN v_write_fails := v_write_fails || 'upd_parties,'; END IF;

  DELETE FROM public.agency_templates WHERE id = v_template_id_a;
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  IF v_cnt > 0 THEN v_write_fails := v_write_fails || 'del_agency_templates,'; END IF;

  UPDATE public.booking_invoices SET notes = 'PWNED' WHERE id = v_invoice_id_a;
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  IF v_cnt > 0 THEN v_write_fails := v_write_fails || 'upd_booking_invoices,'; END IF;

  DELETE FROM public.reminders WHERE id = v_reminder_id_a;
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  IF v_cnt > 0 THEN v_write_fails := v_write_fails || 'del_reminders,'; END IF;

  BEGIN
    INSERT INTO public.agency_templates (agency_id, key, value)
    VALUES (v_agency_a, 'hacked', '{}'::jsonb);
    v_write_fails := v_write_fails || 'ins_agency_templates,';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    PERFORM public.delete_cash_bank_entry_atomic(v_cash_entry_id_a);
    v_write_fails := v_write_fails || 'rpc_del_cash_entry,';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    PERFORM public.delete_opening_balance_atomic(v_ob_id_a);
    v_write_fails := v_write_fails || 'rpc_del_ob,';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    PERFORM public.delete_agency_bank_atomic(v_bank_id_a);
    v_write_fails := v_write_fails || 'rpc_del_bank,';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);

  IF v_isolated_fails = '' THEN
    INSERT INTO _self_test_results (test_name, pass_or_fail, detail)
    VALUES ('01a. Cross-agency SELECT isolation across all 16 tables', 'PASS',
            'Agency B saw 0 Agency A rows across all tested tables');
  ELSE
    INSERT INTO _self_test_results (test_name, pass_or_fail, detail)
    VALUES ('01a. Cross-agency SELECT isolation across all 16 tables', 'FAIL',
            'Leaked tables: ' || v_isolated_fails);
  END IF;

  IF v_write_fails = '' THEN
    INSERT INTO _self_test_results (test_name, pass_or_fail, detail)
    VALUES ('01b. Cross-agency UPDATE/DELETE/INSERT & RPC blocked', 'PASS',
            'All cross-agency write and RPC attempts blocked');
  ELSE
    INSERT INTO _self_test_results (test_name, pass_or_fail, detail)
    VALUES ('01b. Cross-agency UPDATE/DELETE/INSERT & RPC blocked', 'FAIL',
            'Allowed writes: ' || v_write_fails);
  END IF;

  -- --------------------------------------------------------------------------
  -- CHECK 2: Limited sub-user cannot update agencies or call reverse/transfer
  -- --------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sub_limited, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_sub_limited::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  v_err := '';
  UPDATE public.agencies SET name = 'Subuser Modified' WHERE id = v_agency_a;
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  IF v_cnt > 0 THEN v_err := v_err || 'agencies_update_allowed,'; END IF;

  BEGIN
    PERFORM public.record_transfer(v_cash_acc_a, v_bank_acc_a, 100, CURRENT_DATE);
    v_err := v_err || 'record_transfer_allowed,';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    PERFORM public.reverse_transaction(v_tx_id_a, 'Should fail');
    v_err := v_err || 'reverse_transaction_allowed,';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);

  IF v_err = '' THEN
    INSERT INTO _self_test_results (test_name, pass_or_fail, detail)
    VALUES ('02. Limited sub-user blocked on agencies, transfer & reverse', 'PASS',
            'UPDATE agencies affected 0 rows; record_transfer & reverse_transaction denied');
  ELSE
    INSERT INTO _self_test_results (test_name, pass_or_fail, detail)
    VALUES ('02. Limited sub-user blocked on agencies, transfer & reverse', 'FAIL',
            'Unexpected permissions: ' || v_err);
  END IF;

  -- --------------------------------------------------------------------------
  -- CHECK 3: Deactivated sub-user loses all read & write access
  -- --------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sub_deactivated, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_sub_deactivated::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  v_err := '';
  IF public.current_user_agency_id() IS NOT NULL THEN
    v_err := v_err || 'agency_id_not_null,';
  END IF;

  SELECT COUNT(*) INTO v_cnt FROM public.booking_invoices WHERE agency_id = v_agency_a;
  IF v_cnt > 0 THEN v_err := v_err || 'read_invoices_allowed,'; END IF;

  BEGIN
    PERFORM public.save_booking_invoice_atomic(
      p_service := 'Ticket',
      p_party_id := v_party_a,
      p_client_amount := 100
    );
    v_err := v_err || 'write_invoice_allowed,';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);

  IF v_err = '' THEN
    INSERT INTO _self_test_results (test_name, pass_or_fail, detail)
    VALUES ('03. Deactivated sub-user loses all access', 'PASS',
            'current_user_agency_id() = NULL; 0 rows readable; financial RPC blocked');
  ELSE
    INSERT INTO _self_test_results (test_name, pass_or_fail, detail)
    VALUES ('03. Deactivated sub-user loses all access', 'FAIL',
            'Bypass details: ' || v_err);
  END IF;

  -- --------------------------------------------------------------------------
  -- CHECK 4: Expired agency blocked from financial writes, keeps READ/EXPORT
  --          + 3-day grace window & NULL expiry stay allowed
  -- --------------------------------------------------------------------------
  UPDATE public.agencies
  SET license_expiry = NOW() - INTERVAL '10 days'
  WHERE id = v_agency_a;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  v_err := '';

  BEGIN
    PERFORM public.save_booking_invoice_atomic(p_service := 'Ticket', p_party_id := v_party_a, p_client_amount := 500);
    v_err := v_err || 'invoice_allowed,';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    PERFORM public.save_payment_voucher_atomic(p_direction := 'received', p_amount := 500, p_account_id := v_cash_acc_a, p_party_id := v_party_a);
    v_err := v_err || 'voucher_allowed,';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    PERFORM public.record_expense(p_amount := 100, p_account_id := v_cash_acc_a);
    v_err := v_err || 'expense_allowed,';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    PERFORM public.record_refund(p_amount := 100, p_account_id := v_cash_acc_a, p_party_id := v_party_a);
    v_err := v_err || 'refund_allowed,';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    PERFORM public.record_payment(p_direction := 'in', p_amount := 100, p_account_id := v_cash_acc_a, p_party_id := v_party_a);
    v_err := v_err || 'payment_allowed,';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Read & export MUST remain allowed when expired
  SELECT COUNT(*) INTO v_cnt FROM public.booking_invoices WHERE agency_id = v_agency_a;
  v_tmp_summary := public.get_agency_financial_summary(NULL, NULL, v_agency_a);

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);

  -- Check 3-day grace window (2 days expired => ok) and NULL expiry (=> ok) as authenticated user
  UPDATE public.agencies SET license_expiry = NOW() - INTERVAL '2 days' WHERE id = v_agency_a;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
  v_bool := public.agency_license_ok(v_agency_a);
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);

  UPDATE public.agencies SET license_expiry = NULL WHERE id = v_agency_a;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
  v_bool := v_bool AND public.agency_license_ok(v_agency_a);
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);

  -- Restore healthy expiry
  UPDATE public.agencies SET license_expiry = NOW() + INTERVAL '14 days' WHERE id = v_agency_a;

  IF v_err = '' AND v_cnt >= 1 AND v_tmp_summary IS NOT NULL AND v_bool THEN
    INSERT INTO _self_test_results (test_name, pass_or_fail, detail)
    VALUES ('04. Expired license blocks writes only; reads/grace/NULL allowed', 'PASS',
            'All 5 write RPCs blocked at -10d; reads & summary worked; -2d grace & NULL ok');
  ELSE
    INSERT INTO _self_test_results (test_name, pass_or_fail, detail)
    VALUES ('04. Expired license blocks writes only; reads/grace/NULL allowed', 'FAIL',
            format('err=%s, readable_inv=%s, grace_and_null_ok=%s', v_err, v_cnt, v_bool));
  END IF;

  -- --------------------------------------------------------------------------
  -- CHECK 8: anon cannot call verify_agency_account_fallback
  -- --------------------------------------------------------------------------
  v_bool := has_function_privilege('anon', 'public.verify_agency_account_fallback(text)', 'EXECUTE');
  v_err := '';

  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  SET LOCAL ROLE anon;

  BEGIN
    PERFORM public.verify_agency_account_fallback('owner-a@tamspro.test');
    v_err := 'anon_call_succeeded';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);

  IF NOT v_bool AND v_err = '' THEN
    INSERT INTO _self_test_results (test_name, pass_or_fail, detail)
    VALUES ('08. anon cannot execute verify_agency_account_fallback', 'PASS',
            'EXECUTE privilege revoked from anon and call denied');
  ELSE
    INSERT INTO _self_test_results (test_name, pass_or_fail, detail)
    VALUES ('08. anon cannot execute verify_agency_account_fallback', 'FAIL',
            format('has_priv=%s, call_err=%s', v_bool, v_err));
  END IF;

  -- --------------------------------------------------------------------------
  -- CHECK 9b: Authenticated user cannot escalate profile/roles/billing columns
  -- --------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  v_err := '';

  BEGIN
    UPDATE public.profiles SET agency_id = v_agency_b WHERE id = v_user_a;
    v_err := v_err || 'profile_agency_tampered,';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    UPDATE public.profiles SET is_super_admin = true WHERE id = v_user_a;
    v_err := v_err || 'profile_super_admin_tampered,';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    INSERT INTO public.user_roles (user_id, role) VALUES (v_user_a, 'super_admin'::public.app_role);
    v_err := v_err || 'user_roles_tampered,';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    UPDATE public.agencies SET subscription_plan = 'yearly' WHERE id = v_agency_a;
    v_err := v_err || 'agency_plan_tampered,';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    UPDATE public.agencies SET license_expiry = NOW() + INTERVAL '999 days' WHERE id = v_agency_a;
    v_err := v_err || 'agency_expiry_tampered,';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    UPDATE public.agencies SET license_status = 'lifetime', license_active = true WHERE id = v_agency_a;
    v_err := v_err || 'agency_status_tampered,';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Verify Owner CAN update safe non-billing columns
  UPDATE public.agencies SET name = '__SELF_TEST_AGENCY_A_OK__' WHERE id = v_agency_a;
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  IF v_cnt <> 1 THEN v_err := v_err || 'owner_safe_update_failed,'; END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);

  IF v_err = '' THEN
    INSERT INTO _self_test_results (test_name, pass_or_fail, detail)
    VALUES ('09b. Privilege escalation & billing column tampering blocked', 'PASS',
            'profiles.agency_id/is_super_admin, user_roles & agencies billing protected; safe name update ok');
  ELSE
    INSERT INTO _self_test_results (test_name, pass_or_fail, detail)
    VALUES ('09b. Privilege escalation & billing column tampering blocked', 'FAIL',
            'Bypass details: ' || v_err);
  END IF;
END $$;

DO $$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT seq, test_name, pass_or_fail, detail
    FROM _self_test_results
    ORDER BY seq
  LOOP
    RAISE NOTICE '[%] % => % (%)', v_rec.seq, v_rec.test_name, v_rec.pass_or_fail, COALESCE(v_rec.detail, '');
  END LOOP;
END $$;

SELECT seq, test_name, pass_or_fail, detail
FROM _self_test_results
ORDER BY seq;

ROLLBACK;
