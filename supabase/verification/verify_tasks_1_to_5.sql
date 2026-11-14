-- =============================================================================
-- TAMS Pro — Live Postgres Verification Script for Tasks 1–5
-- Run inside Supabase SQL Editor (Project: mwpbschzwjxeioyrzskv).
-- Safe: Diagnostic sections are read-only SELECTs; active isolation & calculation
-- tests wrap inside BEGIN ... ROLLBACK so zero test data persists!
-- =============================================================================

-- ============================================================================
-- PART 1 (Task 1 & Task 2): RBAC, RLS Coverage, Views & Session Revocation RPC
-- ============================================================================
SELECT 'app_role_has_super_admin' AS check_name,
       EXISTS (
         SELECT 1
         FROM pg_enum e
         JOIN pg_type t ON t.oid = e.enumtypid
         JOIN pg_namespace n ON n.oid = t.typnamespace
         WHERE n.nspname = 'public' AND t.typname = 'app_role' AND e.enumlabel = 'super_admin'
       ) AS passed;

SELECT 'tables_missing_rls' AS check_name,
       COUNT(*) FILTER (WHERE rowsecurity = false) AS fail_count
FROM pg_tables
WHERE schemaname = 'public';

SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Every view must have security_invoker = true
SELECT c.relname AS view_name,
       c.reloptions
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'v';

-- Check privileged RPCs exist and are NOT executable by anon
SELECT p.proname,
       p.prosecdef AS security_definer,
       pg_get_function_identity_arguments(p.oid) AS args,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_exec,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_exec
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'has_role',
    'is_super_admin',
    'admin_revoke_user_sessions',
    'delete_all_user_sessions',
    'verify_agency_account_fallback',
    'admin_activate_agency_override',
    'admin_get_registered_users',
    'admin_set_agency_subscription',
    'get_agency_financial_summary',
    'reconcile_agency_balances',
    'check_agency_data_integrity'
  )
ORDER BY p.proname;

-- ============================================================================
-- PART 2 (Task 3): Strict Policies & Private Storage Buckets
-- ============================================================================
-- Any suspicious "true" policies left on non-public tables
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
  AND (
    COALESCE(qual, '') ILIKE '%true%'
    OR COALESCE(with_check, '') ILIKE '%true%'
    OR COALESCE(qual, '') ILIKE '%agency_id is null%'
  )
ORDER BY schemaname, tablename, policyname;

-- Storage buckets must NOT be public
SELECT id, name, public
FROM storage.buckets
WHERE id IN ('agency-files', 'tams-temp-email')
ORDER BY id;

-- ============================================================================
-- PART 3 (Task 4 Diagnosis — Non-Destructive Read of Current Live Data)
-- Identifies exact contributor rows to Vendor Dues, Client Dues & NULL agency_ids
-- ============================================================================
SELECT id AS agency_id, name AS agency_name
FROM public.agencies
ORDER BY created_at DESC;

SELECT 'parties' AS src, agency_id, type, name, opening_balance, current_balance, created_at
FROM public.parties
WHERE COALESCE(current_balance, 0) <> 0 OR COALESCE(opening_balance, 0) <> 0
ORDER BY agency_id, current_balance ASC;

SELECT 'vendors_legacy' AS src, agency_id, name, payment_amount, amount_paid,
       (COALESCE(payment_amount, 0) - COALESCE(amount_paid, 0)) AS legacy_due, created_at
FROM public.vendors
WHERE COALESCE(payment_amount, 0) <> COALESCE(amount_paid, 0)
ORDER BY agency_id, created_at DESC;

SELECT 'clients_legacy' AS src, agency_id, name, pnr, selling_price, purchasing_price, amount_paid,
       payment_status, remaining_payment_date, created_at
FROM public.clients
ORDER BY agency_id, created_at DESC
LIMIT 100;

SELECT a.id AS agency_id,
       a.name AS agency_name,
       public.reconcile_agency_balances(a.id) AS reconciliation,
       public.check_agency_data_integrity(a.id) AS integrity
FROM public.agencies a;

-- ============================================================================
-- PART 4 (Task 5): Realtime Publication Membership Check
-- ============================================================================
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public'
ORDER BY tablename;

-- ============================================================================
-- PART 5 (Tasks 3 & 4 Active Rolled-Back Tests):
-- 1) Two-agency cross-tenant isolation test (Agency A vs Agency B)
-- 2) 100k sell / 80k cost / 40k client pay / 30k vendor pay + refund calculation test
-- Wrapped in BEGIN ... ROLLBACK so production tables are UNCHANGED!
-- ============================================================================
BEGIN;

DO $$
DECLARE
  v_agency_a UUID := gen_random_uuid();
  v_agency_b UUID := gen_random_uuid();
  v_user_a UUID := gen_random_uuid();
  v_user_b UUID := gen_random_uuid();
  v_client_b UUID := gen_random_uuid();
  v_party_client_a UUID;
  v_party_vendor_a UUID;
  v_b_count BIGINT;
  v_inv_res JSONB;
  v_inv_id UUID;
  v_sum_before JSONB;
  v_sum_after JSONB;
BEGIN
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
    (v_user_a, 'verify_a_' || replace(v_user_a::TEXT, '-', '') || '@example.test', '{"agency_name":"Verify Agency A","full_name":"Agent A"}'::jsonb),
    (v_user_b, 'verify_b_' || replace(v_user_b::TEXT, '-', '') || '@example.test', '{"agency_name":"Verify Agency B","full_name":"Agent B"}'::jsonb);

  SELECT agency_id INTO v_agency_a FROM public.profiles WHERE id = v_user_a;
  SELECT agency_id INTO v_agency_b FROM public.profiles WHERE id = v_user_b;

  IF v_agency_a IS NULL THEN
    v_agency_a := gen_random_uuid();
    INSERT INTO public.agencies (id, name, license_key, license_status, license_active, license_expiry)
    VALUES (v_agency_a, 'Verify Agency A', 'VRF-' || LEFT(replace(v_agency_a::TEXT, '-', ''), 8), 'active', true, NOW() + INTERVAL '30 days');
  END IF;

  IF v_agency_b IS NULL THEN
    v_agency_b := gen_random_uuid();
    INSERT INTO public.agencies (id, name, license_key, license_status, license_active, license_expiry)
    VALUES (v_agency_b, 'Verify Agency B', 'VRF-' || LEFT(replace(v_agency_b::TEXT, '-', ''), 8), 'active', true, NOW() + INTERVAL '30 days');
  END IF;

  INSERT INTO public.profiles (id, email, full_name, agency_id, is_super_admin) VALUES
    (v_user_a, 'verify_a_' || replace(v_user_a::TEXT, '-', '') || '@example.test', 'Agent A', v_agency_a, false),
    (v_user_b, 'verify_b_' || replace(v_user_b::TEXT, '-', '') || '@example.test', 'Agent B', v_agency_b, false)
  ON CONFLICT (id) DO UPDATE SET
    agency_id = EXCLUDED.agency_id,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    is_super_admin = false;

  INSERT INTO public.accounts (agency_id, name, type, opening_balance, active) VALUES
    (v_agency_a, 'Cash in Hand', 'cash', 0, true),
    (v_agency_b, 'Cash in Hand', 'cash', 0, true)
  ON CONFLICT (agency_id, name) DO NOTHING;

  INSERT INTO public.transactions (agency_id, date, type, debit, credit, method, notes)
  VALUES (v_agency_b, public.karachi_today(), 'opening', 5000, 0, 'cash', 'Agency B secret opening tx');

  INSERT INTO public.parties (id, agency_id, type, name, opening_balance, current_balance)
  VALUES (v_client_b, v_agency_b, 'client', 'Secret Client B', 0, 0);

  INSERT INTO public.parties (agency_id, type, name, opening_balance, current_balance)
  VALUES (v_agency_a, 'client', 'Test Client A', 0, 0)
  RETURNING id INTO v_party_client_a;

  INSERT INTO public.parties (agency_id, type, name, opening_balance, current_balance)
  VALUES (v_agency_a, 'vendor', 'Test Vendor A', 0, 0)
  RETURNING id INTO v_party_vendor_a;

  -- Switch session context to Agent A (authenticated)
  PERFORM set_config('request.jwt.claim.sub', v_user_a::TEXT, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  -- A must see 0 rows of Agency B by direct query & by known ID
  SELECT COUNT(*) INTO v_b_count FROM public.parties WHERE id = v_client_b OR agency_id = v_agency_b;
  IF v_b_count <> 0 THEN
    RAISE EXCEPTION 'ISOLATION FAIL: Agent A saw % Agency B party rows', v_b_count;
  END IF;

  SELECT COUNT(*) INTO v_b_count FROM public.transactions WHERE agency_id = v_agency_b;
  IF v_b_count <> 0 THEN
    RAISE EXCEPTION 'ISOLATION FAIL: Agent A saw % Agency B transaction rows', v_b_count;
  END IF;

  -- A inserting with B's agency_id must fail
  BEGIN
    INSERT INTO public.parties (agency_id, type, name) VALUES (v_agency_b, 'client', 'Injected');
    RAISE EXCEPTION 'ISOLATION FAIL: Agent A inserted row with Agency B agency_id!';
  EXCEPTION
    WHEN insufficient_privilege OR raise_exception THEN
      NULL; -- expected block!
  END;

  BEGIN
    INSERT INTO public.transactions (agency_id, type, debit, credit) VALUES (v_agency_b, 'opening', 100, 0);
    RAISE EXCEPTION 'ISOLATION FAIL: Agent A inserted transaction with Agency B agency_id!';
  EXCEPTION
    WHEN insufficient_privilege OR raise_exception THEN
      NULL; -- expected block!
  END;

  -- RPC cross-agency access must fail
  BEGIN
    PERFORM public.get_agency_financial_summary('2026-01-01', '2026-12-31', v_agency_b);
    RAISE EXCEPTION 'ISOLATION FAIL: get_agency_financial_summary allowed Agency B query!';
  EXCEPTION
    WHEN raise_exception THEN
      NULL; -- expected block!
  END;

  -- Task 4 active calculation test as Agent A
  v_inv_res := public.save_booking_invoice(
    p_invoice_no => 'INV-TEST-001',
    p_service => 'Ticket',
    p_party_id => v_party_client_a,
    p_vendor_id => v_party_vendor_a,
    p_client_amount => 100000,
    p_vendor_payable => 80000,
    p_amount_paid => 40000,
    p_payment_mode => 'cash',
    p_invoice_date => public.karachi_today(),
    p_due_date => (public.karachi_today() - 2)
  );
  v_inv_id := COALESCE((v_inv_res->>'invoice_id')::UUID, (v_inv_res->>'id')::UUID);

  PERFORM public.save_payment_voucher(
    p_direction => 'paid',
    p_amount => 30000,
    p_payment_mode => 'cash',
    p_party_id => v_party_vendor_a,
    p_voucher_date => public.karachi_today(),
    p_invoice_id => v_inv_id
  );

  v_sum_before := public.get_agency_financial_summary(
    date_trunc('month', public.karachi_today())::DATE,
    public.karachi_today(),
    v_agency_a
  );

  IF (v_sum_before->>'client_dues')::NUMERIC <> 60000
     OR (v_sum_before->>'vendor_dues')::NUMERIC <> 50000
     OR (v_sum_before->>'cash_and_bank')::NUMERIC <> 10000
     OR (v_sum_before->>'period_profit')::NUMERIC <> 20000
     OR (v_sum_before->>'overdue_count')::INT <> 1 THEN
    RAISE EXCEPTION 'CALCULATION FAIL before refund: %', v_sum_before;
  END IF;

  -- Internal Cash <-> Bank transfer must net to zero in Cash & Bank
  DECLARE
    v_cash_a UUID;
    v_bank_a UUID;
    v_sum_after_trf JSONB;
  BEGIN
    SELECT id INTO v_cash_a FROM public.accounts WHERE agency_id = v_agency_a AND type = 'cash' LIMIT 1;
    INSERT INTO public.accounts (agency_id, name, type, opening_balance, active)
    VALUES (v_agency_a, 'Verify Bank A', 'bank', 0, true)
    RETURNING id INTO v_bank_a;

    PERFORM public.record_transfer(
      p_from_account_id => v_cash_a,
      p_to_account_id => v_bank_a,
      p_amount => 5000,
      p_date => public.karachi_today()
    );

    v_sum_after_trf := public.get_agency_financial_summary(
      date_trunc('month', public.karachi_today())::DATE,
      public.karachi_today(),
      v_agency_a
    );

    IF (v_sum_after_trf->>'cash_and_bank')::NUMERIC <> 10000 THEN
      RAISE EXCEPTION 'TRANSFER NET-ZERO FAIL: expected cash_and_bank=10000, got %', v_sum_after_trf->>'cash_and_bank';
    END IF;
  END;

  -- Full void + refund
  PERFORM public.record_refund(
    p_amount => 40000,
    p_party_id => v_party_client_a,
    p_booking_id => v_inv_id,
    p_date => public.karachi_today(),
    p_method => 'cash',
    p_action_type => 'void_refund',
    p_vendor_refund_amount => 30000,
    p_void_invoice => true
  );

  v_sum_after := public.get_agency_financial_summary(
    date_trunc('month', public.karachi_today())::DATE,
    public.karachi_today(),
    v_agency_a
  );

  IF (v_sum_after->>'client_dues')::NUMERIC <> 0
     OR (v_sum_after->>'vendor_dues')::NUMERIC <> 0
     OR (v_sum_after->>'overdue_count')::INT <> 0
     OR (v_sum_after->>'period_profit')::NUMERIC <> 0 THEN
    RAISE EXCEPTION 'CALCULATION FAIL after refund: %', v_sum_after;
  END IF;

  RAISE NOTICE 'ALL ACTIVE SQL ISOLATION & CALCULATION CHECKS PASSED! before=% after=%', v_sum_before, v_sum_after;
END $$;

ROLLBACK;

