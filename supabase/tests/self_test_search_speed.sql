-- ==============================================================================
-- TAMS PRO — ROLLBACK-SAFE SELF-TEST: GLOBAL SEARCH, RBAC, IDEMPOTENCY & SPEED
-- File: supabase/tests/self_test_search_speed.sql
--
-- HOW IT WORKS:
--   - Executes all creates/inserts/tests inside a transaction subtransaction
--     (BEGIN ... RAISE EXCEPTION USING ERRCODE = 'P0999' -> atomic ROLLBACK)
--     so ZERO fake agencies, users, invoices, vouchers, or logs persist in DB,
--     while still returning ONE clean result table directly in Supabase SQL Editor.
--   - Simulates two independent agencies (Agency A & Agency B), owners, and
--     permission-restricted / deactivated sub-users via JWT claims + SET LOCAL ROLE.
--   - Returns ONE result table: (test_name, PASS_or_FAIL, detail)
--   - Every row MUST show 'PASS' before releasing frontend changes.
-- ==============================================================================

CREATE OR REPLACE FUNCTION pg_temp._tams_run_search_speed_test()
RETURNS TABLE(
  out_seq INT,
  out_test_name TEXT,
  out_pass_or_fail TEXT,
  out_detail TEXT
)
LANGUAGE plpgsql
AS $test_suite$
DECLARE
  v_results JSONB := '[]'::jsonb;
  v_seq INT := 0;
  v_payload TEXT;
  v_rec RECORD;

  -- Fake users for Agency A and Agency B
  v_user_a UUID := gen_random_uuid();
  v_user_b UUID := gen_random_uuid();
  v_sub_clients_only UUID := gen_random_uuid();
  v_sub_vendors_only UUID := gen_random_uuid();
  v_sub_deactivated UUID := gen_random_uuid();

  v_agency_a UUID;
  v_agency_b UUID;

  -- Agency A entities
  v_cash_a UUID := gen_random_uuid();
  v_client_a UUID := gen_random_uuid();
  v_vendor_a UUID := gen_random_uuid();
  v_client_chrono_a UUID := gen_random_uuid();

  -- Agency B entities
  v_client_b UUID := gen_random_uuid();
  v_cash_b UUID := gen_random_uuid();

  -- Search & RPC outputs
  v_res JSONB;
  v_res2 JSONB;
  v_inv1 JSONB;
  v_inv2 JSONB;
  v_inv3 JSONB;
  v_vch1 JSONB;
  v_vch2 JSONB;

  -- Counts and assertions
  v_cnt1 BIGINT;
  v_cnt2 BIGINT;
  v_cnt_before_inv BIGINT;
  v_cnt_before_pv BIGINT;
  v_cnt_before_je BIGINT;
  v_cnt_before_tx BIGINT;
  v_cnt_before_alloc BIGINT;
  v_cnt_before_idemp BIGINT;
  v_cnt_after_inv BIGINT;
  v_cnt_after_pv BIGINT;
  v_cnt_after_je BIGINT;
  v_cnt_after_tx BIGINT;
  v_cnt_after_alloc BIGINT;
  v_cnt_after_idemp BIGINT;

  v_req_inv UUID := gen_random_uuid();
  v_req_pv UUID := gen_random_uuid();
  v_req_exp UUID := gen_random_uuid();

  v_err TEXT := '';
  v_detail TEXT := '';
  v_bool1 BOOLEAN;
  v_bool2 BOOLEAN;
  v_inv_dates TEXT[];
  v_vch_dates TEXT[];
BEGIN
  BEGIN
    -- ------------------------------------------------------------------------
    -- SETUP: Create two fake agencies (A and B), owners, and sub-users
    -- ------------------------------------------------------------------------
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
    VALUES (
      v_user_a,
      'speedtest-a-' || v_user_a::text || '@tamspro.test',
      '{"agency_name": "__TEST_SPEED_AGENCY_A__", "full_name": "Speed Test Owner A"}'::jsonb,
      NOW()
    );
    SELECT agency_id INTO v_agency_a FROM public.profiles WHERE id = v_user_a;

    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
    VALUES (
      v_user_b,
      'speedtest-b-' || v_user_b::text || '@tamspro.test',
      '{"agency_name": "__TEST_SPEED_AGENCY_B__", "full_name": "Speed Test Owner B"}'::jsonb,
      NOW()
    );
    SELECT agency_id INTO v_agency_b FROM public.profiles WHERE id = v_user_b;

    -- Sub-user 1 in Agency A: CLIENTS READ ONLY (no vendors, no bookings, no invoices)
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
    VALUES (
      v_sub_clients_only,
      'speedtest-sub1-' || v_sub_clients_only::text || '@tamspro.test',
      '{"agency_name": "__TEST_SUB_1__", "full_name": "Sub Clients Only"}'::jsonb,
      NOW()
    );
    UPDATE public.profiles SET agency_id = v_agency_a WHERE id = v_sub_clients_only;
    INSERT INTO public.sub_users (user_id, main_user_id, agency_id, sub_id_code, is_active, permissions)
    VALUES (
      v_sub_clients_only,
      v_user_a,
      v_agency_a,
      'SUB-C-' || substr(v_sub_clients_only::text, 1, 8),
      true,
      '{
        "dashboard": true,
        "clients": {"read": true, "write": false, "delete": false},
        "vendors": {"read": false, "write": false, "delete": false},
        "bookings": {"read": false, "write": false, "delete": false},
        "invoices": {"read": false, "write": false, "delete": false},
        "expenses": {"read": false, "write": false, "delete": false},
        "reports": {"read": false},
        "settings": false
      }'::jsonb
    );

    -- Sub-user 2 in Agency A: VENDORS READ ONLY (no clients, no bookings, no invoices)
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
    VALUES (
      v_sub_vendors_only,
      'speedtest-sub2-' || v_sub_vendors_only::text || '@tamspro.test',
      '{"agency_name": "__TEST_SUB_2__", "full_name": "Sub Vendors Only"}'::jsonb,
      NOW()
    );
    UPDATE public.profiles SET agency_id = v_agency_a WHERE id = v_sub_vendors_only;
    INSERT INTO public.sub_users (user_id, main_user_id, agency_id, sub_id_code, is_active, permissions)
    VALUES (
      v_sub_vendors_only,
      v_user_a,
      v_agency_a,
      'SUB-V-' || substr(v_sub_vendors_only::text, 1, 8),
      true,
      '{
        "dashboard": true,
        "clients": {"read": false, "write": false, "delete": false},
        "vendors": {"read": true, "write": false, "delete": false},
        "bookings": {"read": false, "write": false, "delete": false},
        "invoices": {"read": false, "write": false, "delete": false},
        "expenses": {"read": false, "write": false, "delete": false},
        "reports": {"read": false},
        "settings": false
      }'::jsonb
    );

    -- Deactivated sub-user in Agency A (even with all modules true)
    INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
    VALUES (
      v_sub_deactivated,
      'speedtest-sub3-' || v_sub_deactivated::text || '@tamspro.test',
      '{"agency_name": "__TEST_SUB_OFF__", "full_name": "Sub Disabled"}'::jsonb,
      NOW()
    );
    UPDATE public.profiles SET agency_id = v_agency_a WHERE id = v_sub_deactivated;
    INSERT INTO public.sub_users (user_id, main_user_id, agency_id, sub_id_code, is_active, permissions)
    VALUES (
      v_sub_deactivated,
      v_user_a,
      v_agency_a,
      'SUB-X-' || substr(v_sub_deactivated::text, 1, 8),
      false,
      '{
        "dashboard": true,
        "clients": {"read": true},
        "vendors": {"read": true},
        "bookings": {"read": true},
        "invoices": {"read": true}
      }'::jsonb
    );

    -- Ensure cash accounts exist for Agency A and Agency B
    INSERT INTO public.accounts (id, agency_id, type, name, opening_balance, active)
    VALUES (v_cash_a, v_agency_a, 'cash', 'Test Cash Drawer A', 100000, true)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.accounts (id, agency_id, type, name, opening_balance, active)
    VALUES (v_cash_b, v_agency_b, 'cash', 'Test Cash Drawer B', 50000, true)
    ON CONFLICT DO NOTHING;

    -- Seed parties in Agency A and Agency B as Owner A / Owner B
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    SET LOCAL ROLE authenticated;

    INSERT INTO public.parties (id, agency_id, type, name, code, phone, passport)
    VALUES
      (v_client_a, v_agency_a, 'client', 'AlphaSearch Client Zainab', 'C-TEST-901', '0300-9911223', 'AB998877'),
      (v_vendor_a, v_agency_a, 'vendor', 'AlphaSearch Airline Vendor', 'V-TEST-902', '0321-8877665', NULL),
      (v_client_chrono_a, v_agency_a, 'client', 'ChronoOrder Traveller', 'C-TEST-903', '0333-1122334', 'CHR12345');

    -- Create invoices with distinct dates for ordering + search checks
    v_inv1 := public.save_booking_invoice_atomic(
      p_service => 'Ticket',
      p_party_id => v_client_chrono_a,
      p_vendor_id => v_vendor_a,
      p_client_amount => 50000,
      p_vendor_payable => 42000,
      p_amount_paid => 10000,
      p_payment_mode => 'cash',
      p_account_id => v_cash_a,
      p_invoice_date => DATE '2026-01-10',
      p_pnr => 'PNRALPHA10',
      p_ticket_no => 'TKTALPHA10',
      p_passport_no => 'PKCHRONO10',
      p_notes => 'AlphaSearch Oldest Invoice'
    );

    v_inv2 := public.save_booking_invoice_atomic(
      p_service => 'Umrah',
      p_party_id => v_client_chrono_a,
      p_vendor_id => v_vendor_a,
      p_client_amount => 120000,
      p_vendor_payable => 100000,
      p_amount_paid => 20000,
      p_payment_mode => 'cash',
      p_account_id => v_cash_a,
      p_invoice_date => DATE '2026-11-16',
      p_pnr => 'PNRALPHA99',
      p_ticket_no => 'TKTALPHA99',
      p_passport_no => 'PKCHRONO99',
      p_notes => 'AlphaSearch Newest Invoice'
    );

    v_inv3 := public.save_booking_invoice_atomic(
      p_service => 'Visa',
      p_party_id => v_client_chrono_a,
      p_vendor_id => v_vendor_a,
      p_client_amount => 80000,
      p_vendor_payable => 65000,
      p_amount_paid => 0,
      p_payment_mode => 'cash',
      p_account_id => v_cash_a,
      p_invoice_date => DATE '2026-06-15',
      p_pnr => 'PNRMIDDLE',
      p_ticket_no => 'TKTMIDDLE',
      p_passport_no => 'AB998877',
      p_notes => 'AlphaSearch Middle Invoice'
    );

    -- Create vouchers on different dates
    v_vch1 := public.save_payment_voucher_atomic(
      p_direction => 'received',
      p_amount => 5000,
      p_payment_mode => 'cash',
      p_account_id => v_cash_a,
      p_party_id => v_client_chrono_a,
      p_voucher_date => DATE '2026-02-01',
      p_reference_no => 'ALPHASEARCH-REF-OLD',
      p_notes => 'Older voucher AlphaSearch'
    );

    v_vch2 := public.save_payment_voucher_atomic(
      p_direction => 'received',
      p_amount => 15000,
      p_payment_mode => 'cash',
      p_account_id => v_cash_a,
      p_party_id => v_client_chrono_a,
      p_voucher_date => DATE '2026-11-16',
      p_reference_no => 'ALPHASEARCH-REF-NEW',
      p_notes => 'Newer voucher AlphaSearch'
    );

    -- Seed Agency B private party
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_b, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', v_user_b::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    SET LOCAL ROLE authenticated;

    INSERT INTO public.parties (id, agency_id, type, name, code, phone)
    VALUES (v_client_b, v_agency_b, 'client', 'BetaAgency Only Client', 'C-BETA-001', '0345-0000001');

    -- ------------------------------------------------------------------------
    -- TEST 1: Agency B can NEVER see Agency A in global_search
    -- ------------------------------------------------------------------------
    v_err := '';
    IF jsonb_array_length(COALESCE((public.global_search('AlphaSearch'))->'parties', '[]'::jsonb)) > 0
       OR jsonb_array_length(COALESCE((public.global_search('AlphaSearch'))->'invoices', '[]'::jsonb)) > 0
       OR jsonb_array_length(COALESCE((public.global_search('AlphaSearch'))->'vouchers', '[]'::jsonb)) > 0 THEN
      v_err := v_err || 'name_leak,';
    END IF;
    IF jsonb_array_length(COALESCE((public.global_search('PNRALPHA99'))->'invoices', '[]'::jsonb)) > 0 THEN
      v_err := v_err || 'pnr_leak,';
    END IF;
    IF jsonb_array_length(COALESCE((public.global_search('TKTALPHA99'))->'invoices', '[]'::jsonb)) > 0 THEN
      v_err := v_err || 'ticket_leak,';
    END IF;
    IF jsonb_array_length(COALESCE((public.global_search('AB998877'))->'invoices', '[]'::jsonb)) > 0
       OR jsonb_array_length(COALESCE((public.global_search('AB998877'))->'parties', '[]'::jsonb)) > 0 THEN
      v_err := v_err || 'passport_leak,';
    END IF;
    IF jsonb_array_length(COALESCE((public.global_search('0300-9911223'))->'parties', '[]'::jsonb)) > 0 THEN
      v_err := v_err || 'phone_leak,';
    END IF;

    -- Also verify Owner A DOES find their own records
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    SET LOCAL ROLE authenticated;

    v_res := public.global_search('AlphaSearch');
    IF jsonb_array_length(COALESCE(v_res->'parties', '[]'::jsonb)) < 2
       OR jsonb_array_length(COALESCE(v_res->'invoices', '[]'::jsonb)) < 3
       OR jsonb_array_length(COALESCE(v_res->'vouchers', '[]'::jsonb)) < 2 THEN
      v_err := v_err || 'owner_a_missing_own_results,';
    END IF;

    -- Confirm Owner A cannot see Agency B
    IF jsonb_array_length(COALESCE((public.global_search('BetaAgency'))->'parties', '[]'::jsonb)) > 0 THEN
      v_err := v_err || 'owner_a_saw_agency_b,';
    END IF;

    v_seq := v_seq + 1;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'seq', v_seq,
      'test_name', '01. Agency B can never see Agency A in global_search',
      'pass_or_fail', CASE WHEN v_err = '' THEN 'PASS' ELSE 'FAIL' END,
      'detail', CASE WHEN v_err = ''
                     THEN 'Agency B got 0 rows across name/PNR/ticket/passport/phone; Owner A saw only Agency A records'
                     ELSE 'Failures: ' || v_err END
    ));

    -- ------------------------------------------------------------------------
    -- TEST 2: Sub-user without module permission gets NO results from that module
    -- ------------------------------------------------------------------------
    v_err := '';
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sub_clients_only, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', v_sub_clients_only::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    SET LOCAL ROLE authenticated;

    v_res := public.global_search('AlphaSearch');
    IF jsonb_array_length(COALESCE(v_res->'invoices', '[]'::jsonb)) <> 0 THEN
      v_err := v_err || 'sub1_saw_invoices,';
    END IF;
    IF jsonb_array_length(COALESCE(v_res->'vouchers', '[]'::jsonb)) <> 0 THEN
      v_err := v_err || 'sub1_saw_vouchers,';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(v_res->'parties', '[]'::jsonb)) elem
      WHERE elem->>'type' = 'vendor'
    ) THEN
      v_err := v_err || 'sub1_saw_vendor_party,';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(v_res->'parties', '[]'::jsonb)) elem
      WHERE elem->>'type' = 'client'
    ) THEN
      v_err := v_err || 'sub1_missed_allowed_client,';
    END IF;

    -- Switch to Sub-user 2 (vendors only)
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sub_vendors_only, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', v_sub_vendors_only::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    SET LOCAL ROLE authenticated;

    v_res := public.global_search('AlphaSearch');
    IF jsonb_array_length(COALESCE(v_res->'invoices', '[]'::jsonb)) <> 0
       OR jsonb_array_length(COALESCE(v_res->'vouchers', '[]'::jsonb)) <> 0 THEN
      v_err := v_err || 'sub2_saw_invoices_or_vouchers,';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(v_res->'parties', '[]'::jsonb)) elem
      WHERE elem->>'type' = 'client'
    ) THEN
      v_err := v_err || 'sub2_saw_client_party,';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(v_res->'parties', '[]'::jsonb)) elem
      WHERE elem->>'type' = 'vendor'
    ) THEN
      v_err := v_err || 'sub2_missed_allowed_vendor,';
    END IF;

    -- Switch to deactivated sub-user
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_sub_deactivated, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', v_sub_deactivated::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    SET LOCAL ROLE authenticated;

    v_res := public.global_search('AlphaSearch');
    IF jsonb_array_length(COALESCE(v_res->'parties', '[]'::jsonb)) <> 0
       OR jsonb_array_length(COALESCE(v_res->'invoices', '[]'::jsonb)) <> 0
       OR jsonb_array_length(COALESCE(v_res->'vouchers', '[]'::jsonb)) <> 0 THEN
      v_err := v_err || 'deactivated_sub_got_results,';
    END IF;

    v_seq := v_seq + 1;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'seq', v_seq,
      'test_name', '02. Sub-user without module permission gets 0 results from disallowed modules',
      'pass_or_fail', CASE WHEN v_err = '' THEN 'PASS' ELSE 'FAIL' END,
      'detail', CASE WHEN v_err = ''
                     THEN 'Clients-only saw only clients; Vendors-only saw only vendors; Inactive sub-user saw 0 rows'
                     ELSE 'Failures: ' || v_err END
    ));

    -- ------------------------------------------------------------------------
    -- TEST 3: Results ordered NEWEST FIRST (invoices & vouchers + accurate remaining)
    -- ------------------------------------------------------------------------
    v_err := '';
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    SET LOCAL ROLE authenticated;

    v_res := public.global_search('ChronoOrder');
    SELECT array_agg(elem->>'invoice_date')
    INTO v_inv_dates
    FROM jsonb_array_elements(COALESCE(v_res->'invoices', '[]'::jsonb)) elem;

    SELECT array_agg(elem->>'voucher_date')
    INTO v_vch_dates
    FROM jsonb_array_elements(COALESCE(v_res->'vouchers', '[]'::jsonb)) elem;

    IF v_inv_dates IS DISTINCT FROM ARRAY['2026-11-16', '2026-06-15', '2026-01-10'] THEN
      v_err := v_err || format('invoice_order=%s,', COALESCE(v_inv_dates::text, 'NULL'));
    END IF;

    -- Paid invoices (v_inv2 on 2026-11-16 and v_inv1 on 2026-01-10) also auto-post CRV vouchers
    -- alongside standalone vouchers (2026-11-16 and 2026-02-01); all 4 must return newest first.
    IF v_vch_dates IS DISTINCT FROM ARRAY['2026-11-16', '2026-11-16', '2026-02-01', '2026-01-10'] THEN
      v_err := v_err || format('voucher_order=%s,', COALESCE(v_vch_dates::text, 'NULL'));
    END IF;

    -- Also verify voucher reference search returns standalone vouchers strictly newest first
    SELECT array_agg(elem->>'voucher_date')
    INTO v_vch_dates
    FROM jsonb_array_elements(COALESCE((public.global_search('ALPHASEARCH-REF'))->'vouchers', '[]'::jsonb)) elem;
    IF v_vch_dates IS DISTINCT FROM ARRAY['2026-11-16', '2026-02-01'] THEN
      v_err := v_err || format('voucher_ref_order=%s,', COALESCE(v_vch_dates::text, 'NULL'));
    END IF;

    -- Verify total/paid/remaining projection on middle invoice (total 80000, paid 0, remaining 80000)
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_res->'invoices') elem
      WHERE elem->>'pnr' = 'PNRMIDDLE'
        AND (elem->>'total')::numeric = 80000
        AND (elem->>'paid')::numeric = 0
        AND (elem->>'remaining')::numeric = 80000
    ) THEN
      v_err := v_err || 'missing_expected_amounts,';
    END IF;

    v_seq := v_seq + 1;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'seq', v_seq,
      'test_name', '03. global_search results ordered newest first with accurate invoice amounts',
      'pass_or_fail', CASE WHEN v_err = '' THEN 'PASS' ELSE 'FAIL' END,
      'detail', CASE WHEN v_err = ''
                     THEN format('Invoices=%s ; Vouchers=%s', v_inv_dates::text, v_vch_dates::text)
                     ELSE 'Failures: ' || v_err END
    ));

    -- ------------------------------------------------------------------------
    -- TEST 4: Repeated save with same p_request_id creates NO duplicate
    -- ------------------------------------------------------------------------
    v_err := '';
    SELECT COUNT(*) INTO v_cnt_before_inv FROM public.booking_invoices WHERE agency_id = v_agency_a;
    SELECT COUNT(*) INTO v_cnt_before_pv FROM public.payment_vouchers WHERE agency_id = v_agency_a;

    v_res := public.save_booking_invoice_atomic(
      p_service => 'Ticket',
      p_party_id => v_client_a,
      p_vendor_id => v_vendor_a,
      p_client_amount => 45000,
      p_vendor_payable => 38000,
      p_amount_paid => 15000,
      p_payment_mode => 'cash',
      p_account_id => v_cash_a,
      p_invoice_date => DATE '2026-11-16',
      p_pnr => 'IDEMP99',
      p_request_id => v_req_inv
    );

    -- Retry exact same call with exact same p_request_id
    v_res2 := public.save_booking_invoice_atomic(
      p_service => 'Ticket',
      p_party_id => v_client_a,
      p_vendor_id => v_vendor_a,
      p_client_amount => 45000,
      p_vendor_payable => 38000,
      p_amount_paid => 15000,
      p_payment_mode => 'cash',
      p_account_id => v_cash_a,
      p_invoice_date => DATE '2026-11-16',
      p_pnr => 'IDEMP99',
      p_request_id => v_req_inv
    );

    SELECT COUNT(*) INTO v_cnt_after_inv FROM public.booking_invoices WHERE agency_id = v_agency_a;
    -- Wait: save_booking_invoice with amount_paid=15000 creates 1 voucher too
    SELECT COUNT(*) INTO v_cnt_after_pv FROM public.payment_vouchers WHERE agency_id = v_agency_a;

    IF v_cnt_after_inv - v_cnt_before_inv <> 1 THEN
      v_err := v_err || format('inv_delta=%s,', v_cnt_after_inv - v_cnt_before_inv);
    END IF;
    IF v_cnt_after_pv - v_cnt_before_pv <> 1 THEN
      v_err := v_err || format('init_pv_delta=%s,', v_cnt_after_pv - v_cnt_before_pv);
    END IF;
    IF (v_res->>'invoice_id') IS DISTINCT FROM (v_res2->>'invoice_id')
       OR COALESCE((v_res2->>'idempotent_replay')::boolean, false) = false THEN
      v_err := v_err || 'inv_replay_mismatch,';
    END IF;

    -- Test repeated payment voucher save with same p_request_id
    v_cnt_before_pv := v_cnt_after_pv;
    v_res := public.save_payment_voucher_atomic(
      p_direction => 'received',
      p_amount => 10000,
      p_payment_mode => 'cash',
      p_account_id => v_cash_a,
      p_party_id => v_client_a,
      p_voucher_date => DATE '2026-11-16',
      p_notes => 'Idempotent voucher',
      p_request_id => v_req_pv
    );
    v_res2 := public.save_payment_voucher_atomic(
      p_direction => 'received',
      p_amount => 10000,
      p_payment_mode => 'cash',
      p_account_id => v_cash_a,
      p_party_id => v_client_a,
      p_voucher_date => DATE '2026-11-16',
      p_notes => 'Idempotent voucher',
      p_request_id => v_req_pv
    );
    SELECT COUNT(*) INTO v_cnt_after_pv FROM public.payment_vouchers WHERE agency_id = v_agency_a;

    IF v_cnt_after_pv - v_cnt_before_pv <> 1
       OR (v_res->>'voucher_id') IS DISTINCT FROM (v_res2->>'voucher_id')
       OR COALESCE((v_res2->>'idempotent_replay')::boolean, false) = false THEN
      v_err := v_err || 'pv_replay_failed,';
    END IF;

    -- Test repeated expense save with same p_request_id
    SELECT COUNT(*) INTO v_cnt1 FROM public.expenses WHERE agency_id = v_agency_a;
    v_res := public.record_expense(
      p_amount => 2500,
      p_account_id => v_cash_a,
      p_category => 'Office Tea',
      p_date => DATE '2026-11-16',
      p_method => 'cash',
      p_request_id => v_req_exp
    );
    v_res2 := public.record_expense(
      p_amount => 2500,
      p_account_id => v_cash_a,
      p_category => 'Office Tea',
      p_date => DATE '2026-11-16',
      p_method => 'cash',
      p_request_id => v_req_exp
    );
    SELECT COUNT(*) INTO v_cnt2 FROM public.expenses WHERE agency_id = v_agency_a;

    IF v_cnt2 - v_cnt1 <> 1
       OR (v_res->>'expense_id') IS DISTINCT FROM (v_res2->>'expense_id') THEN
      v_err := v_err || 'exp_replay_failed,';
    END IF;

    v_seq := v_seq + 1;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'seq', v_seq,
      'test_name', '04. Repeated save with same request_id creates zero duplicates',
      'pass_or_fail', CASE WHEN v_err = '' THEN 'PASS' ELSE 'FAIL' END,
      'detail', CASE WHEN v_err = ''
                     THEN 'Invoice, voucher & expense replayed exact original IDs with delta = 1 each'
                     ELSE 'Failures: ' || v_err END
    ));

    -- ------------------------------------------------------------------------
    -- TEST 5: Failed saves leave ZERO partial rows (atomic rollback)
    -- ------------------------------------------------------------------------
    v_err := '';
    SELECT COUNT(*) INTO v_cnt_before_inv FROM public.booking_invoices WHERE agency_id = v_agency_a;
    SELECT COUNT(*) INTO v_cnt_before_pv FROM public.payment_vouchers WHERE agency_id = v_agency_a;
    SELECT COUNT(*) INTO v_cnt_before_je FROM public.central_journal_entries WHERE agency_id = v_agency_a;
    SELECT COUNT(*) INTO v_cnt_before_tx FROM public.transactions WHERE agency_id = v_agency_a;
    SELECT COUNT(*) INTO v_cnt_before_alloc FROM public.invoice_allocations WHERE agency_id = v_agency_a;
    SELECT COUNT(*) INTO v_cnt_before_idemp FROM public.save_idempotency_logs WHERE agency_id = v_agency_a;

    -- Case A: Invoice save fails because amount_paid > client_amount
    v_bool1 := false;
    BEGIN
      PERFORM public.save_booking_invoice_atomic(
        p_service => 'Ticket',
        p_party_id => v_client_a,
        p_vendor_id => v_vendor_a,
        p_client_amount => 10000,
        p_vendor_payable => 8000,
        p_amount_paid => 25000,
        p_payment_mode => 'cash',
        p_account_id => v_cash_a,
        p_request_id => gen_random_uuid()
      );
      v_err := v_err || 'invalid_paid_gt_total_did_not_fail,';
    EXCEPTION WHEN OTHERS THEN
      v_bool1 := true;
    END;

    -- Case B: Voucher save fails because party belongs to Agency B
    v_bool2 := false;
    BEGIN
      PERFORM public.save_payment_voucher_atomic(
        p_direction => 'received',
        p_amount => 5000,
        p_payment_mode => 'cash',
        p_account_id => v_cash_a,
        p_party_id => v_client_b,
        p_request_id => gen_random_uuid()
      );
      v_err := v_err || 'cross_agency_party_did_not_fail,';
    EXCEPTION WHEN OTHERS THEN
      v_bool2 := true;
    END;

    SELECT COUNT(*) INTO v_cnt_after_inv FROM public.booking_invoices WHERE agency_id = v_agency_a;
    SELECT COUNT(*) INTO v_cnt_after_pv FROM public.payment_vouchers WHERE agency_id = v_agency_a;
    SELECT COUNT(*) INTO v_cnt_after_je FROM public.central_journal_entries WHERE agency_id = v_agency_a;
    SELECT COUNT(*) INTO v_cnt_after_tx FROM public.transactions WHERE agency_id = v_agency_a;
    SELECT COUNT(*) INTO v_cnt_after_alloc FROM public.invoice_allocations WHERE agency_id = v_agency_a;
    SELECT COUNT(*) INTO v_cnt_after_idemp FROM public.save_idempotency_logs WHERE agency_id = v_agency_a;

    IF NOT v_bool1 OR NOT v_bool2
       OR v_cnt_after_inv <> v_cnt_before_inv
       OR v_cnt_after_pv <> v_cnt_before_pv
       OR v_cnt_after_je <> v_cnt_before_je
       OR v_cnt_after_tx <> v_cnt_before_tx
       OR v_cnt_after_alloc <> v_cnt_before_alloc
       OR v_cnt_after_idemp <> v_cnt_before_idemp THEN
      v_err := v_err || format(
        'partial_rows_detected(inv:%s->%s,pv:%s->%s,je:%s->%s,tx:%s->%s,idemp:%s->%s)',
        v_cnt_before_inv, v_cnt_after_inv,
        v_cnt_before_pv, v_cnt_after_pv,
        v_cnt_before_je, v_cnt_after_je,
        v_cnt_before_tx, v_cnt_after_tx,
        v_cnt_before_idemp, v_cnt_after_idemp
      );
    END IF;

    v_seq := v_seq + 1;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'seq', v_seq,
      'test_name', '05. Failed saves leave zero partial rows',
      'pass_or_fail', CASE WHEN v_err = '' THEN 'PASS' ELSE 'FAIL' END,
      'detail', CASE WHEN v_err = ''
                     THEN 'All 6 ledger & save tables kept identical row counts after rolled-back failures'
                     ELSE 'Failures: ' || v_err END
    ));

    -- ------------------------------------------------------------------------
    -- TEST 6: Security grants & pg_trgm / index presence
    -- ------------------------------------------------------------------------
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', '', true);

    v_err := '';
    IF pg_catalog.has_function_privilege('anon', 'public.global_search(text, integer, integer)', 'EXECUTE') THEN
      v_err := v_err || 'anon_can_exec_global_search,';
    END IF;
    IF NOT pg_catalog.has_function_privilege('authenticated', 'public.global_search(text, integer, integer)', 'EXECUTE') THEN
      v_err := v_err || 'authenticated_cannot_exec_global_search,';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
      v_err := v_err || 'pg_trgm_missing,';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_parties_trgm_name'
    ) OR NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_booking_invoices_trgm_no'
    ) OR NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_payment_vouchers_party_direction'
    ) OR NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_sub_users_user_active'
    ) THEN
      v_err := v_err || 'required_indexes_missing,';
    END IF;

    v_seq := v_seq + 1;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'seq', v_seq,
      'test_name', '06. Function execute grants & search/speed indexes verified',
      'pass_or_fail', CASE WHEN v_err = '' THEN 'PASS' ELSE 'FAIL' END,
      'detail', CASE WHEN v_err = ''
                     THEN 'anon revoked, authenticated granted, pg_trgm + composite/trigram indexes present'
                     ELSE 'Failures: ' || v_err END
    ));

    -- Force complete subtransaction ROLLBACK so zero test records ever persist
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
$test_suite$;

SELECT
  out_test_name AS test_name,
  out_pass_or_fail AS "PASS_or_FAIL",
  out_detail AS detail
FROM pg_temp._tams_run_search_speed_test()
ORDER BY out_seq;

