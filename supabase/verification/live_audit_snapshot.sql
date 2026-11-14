-- =============================================================================
-- TAMS Pro — Single-Result Live Audit Snapshot (Read-Only)
-- Run inside Supabase SQL Editor to see ALL security, RLS, view, storage,
-- NULL-agency, reconciliation, and Vendor/Client dues contributor rows in ONE table.
-- =============================================================================

SELECT section, status, details
FROM (
  -- 1. Core RBAC & enum checks
  SELECT
    10 AS sort_order,
    '01_rbac_and_rls' AS section,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = 'app_role' AND e.enumlabel = 'super_admin'
      )
      AND (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false) = 0
      THEN 'PASS'
      ELSE 'FAIL'
    END AS status,
    jsonb_build_object(
      'super_admin_enum_exists', EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = 'app_role' AND e.enumlabel = 'super_admin'
      ),
      'super_admin_role_count', (
        SELECT COUNT(*) FROM public.user_roles WHERE role = 'super_admin'::public.app_role
      ),
      'tables_missing_rls_count', (
        SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false
      ),
      'tables_missing_rls', COALESCE((
        SELECT jsonb_agg(tablename ORDER BY tablename)
        FROM pg_tables
        WHERE schemaname = 'public' AND rowsecurity = false
      ), '[]'::jsonb),
      'public_views_missing_security_invoker', COALESCE((
        SELECT jsonb_agg(c.relname ORDER BY c.relname)
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'v'
          AND NOT ('security_invoker=true' = ANY(COALESCE(c.reloptions, ARRAY[]::text[])))
      ), '[]'::jsonb)
    ) AS details

  UNION ALL

  -- 2. Suspicious policies, storage bucket publicity, and anon RPC exposure
  SELECT
    20 AS sort_order,
    '02_policies_buckets_rpcs' AS section,
    CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname IN ('public', 'storage')
          AND (
            LOWER(COALESCE(qual, '')) ~ '\mtrue\M'
            OR LOWER(COALESCE(with_check, '')) ~ '\mtrue\M'
            OR COALESCE(qual, '') ILIKE '%agency_id is null%'
          )
      )
      AND NOT EXISTS (
        SELECT 1 FROM storage.buckets
        WHERE id IN ('agency-files', 'tams-temp-email') AND public = true
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prokind = 'f'
          AND p.proname IN (
            'has_role', 'is_super_admin', 'is_privileged_db_context', 'enforce_agency_isolation',
            'account_balances', 'format_agency_number', 'next_number', 'next_formatted_number',
            'preview_next_number', 'get_user_active_sessions', 'admin_revoke_user_sessions',
            'delete_all_user_sessions', 'verify_agency_account_fallback',
            'admin_activate_agency_override', 'admin_get_registered_users',
            'admin_set_agency_subscription', 'get_agency_financial_summary',
            'reconcile_agency_balances', 'check_agency_data_integrity'
          )
          AND has_function_privilege('anon', p.oid, 'EXECUTE')
      )
      THEN 'PASS'
      ELSE 'CHECK'
    END AS status,
    jsonb_build_object(
      'suspicious_policies', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'schema', schemaname,
          'table', tablename,
          'policy', policyname,
          'cmd', cmd,
          'qual', qual,
          'with_check', with_check
        ))
        FROM pg_policies
        WHERE schemaname IN ('public', 'storage')
          AND (
            LOWER(COALESCE(qual, '')) ~ '\mtrue\M'
            OR LOWER(COALESCE(with_check, '')) ~ '\mtrue\M'
            OR COALESCE(qual, '') ILIKE '%agency_id is null%'
          )
      ), '[]'::jsonb),
      'storage_buckets', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'public', public) ORDER BY id)
        FROM storage.buckets
        WHERE id IN ('agency-files', 'tams-temp-email')
      ), '[]'::jsonb),
      'anon_executable_public_functions', COALESCE((
        SELECT jsonb_agg(p.proname ORDER BY p.proname)
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prokind = 'f'
          AND has_function_privilege('anon', p.oid, 'EXECUTE')
      ), '[]'::jsonb),
      'realtime_tables_count', (
        SELECT COUNT(*) FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      )
    ) AS details

  UNION ALL

  -- 3. NULL agency_id audit counts across core business tables
  SELECT
    30 AS sort_order,
    '03_null_agency_id_counts' AS section,
    'INFO' AS status,
    jsonb_build_object(
      'clients_null_agency', (SELECT COUNT(*) FROM public.clients WHERE agency_id IS NULL),
      'vendors_null_agency', (SELECT COUNT(*) FROM public.vendors WHERE agency_id IS NULL),
      'expenses_null_agency', (SELECT COUNT(*) FROM public.expenses WHERE agency_id IS NULL),
      'refunds_null_agency', (SELECT COUNT(*) FROM public.refunds WHERE agency_id IS NULL),
      'parties_null_agency', (SELECT COUNT(*) FROM public.parties WHERE agency_id IS NULL),
      'booking_invoices_null_agency', (SELECT COUNT(*) FROM public.booking_invoices WHERE agency_id IS NULL),
      'payment_vouchers_null_agency', (SELECT COUNT(*) FROM public.payment_vouchers WHERE agency_id IS NULL),
      'accounts_null_agency', (SELECT COUNT(*) FROM public.accounts WHERE agency_id IS NULL),
      'transactions_null_agency', (SELECT COUNT(*) FROM public.transactions WHERE agency_id IS NULL),
      'profiles_null_agency', (SELECT COUNT(*) FROM public.profiles WHERE agency_id IS NULL)
    ) AS details

  UNION ALL

  -- 4. Per-agency balance reconciliation & integrity summary
  SELECT
    40 AS sort_order,
    '04_agency_reconciliation' AS section,
    'INFO' AS status,
    jsonb_build_object(
      'agency_id', a.id,
      'agency_name', a.name,
      'agency_code', a.agency_code,
      'summary', public.get_agency_financial_summary(date_trunc('month', public.karachi_today())::DATE, public.karachi_today(), a.id),
      'reconciliation', public.reconcile_agency_balances(a.id),
      'integrity', public.check_agency_data_integrity(a.id)
    ) AS details
  FROM public.agencies a

  UNION ALL

  -- 5. Exact Vendor Dues contributors (new booking_invoices/parties + legacy vendors table)
  SELECT
    50 AS sort_order,
    '05_vendor_dues_contributors' AS section,
    'INFO' AS status,
    jsonb_build_object(
      'parties_vendor_balances', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', p.id,
          'agency_id', p.agency_id,
          'type', p.type,
          'name', p.name,
          'opening_balance', p.opening_balance,
          'current_balance', p.current_balance,
          'created_at', p.created_at
        ) ORDER BY p.agency_id, p.current_balance ASC)
        FROM public.parties p
        WHERE p.type IN ('vendor', 'both')
          AND (COALESCE(p.current_balance, 0) <> 0 OR COALESCE(p.opening_balance, 0) <> 0)
      ), '[]'::jsonb),
      'legacy_vendors_unpaid', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', v.id,
          'agency_id', v.agency_id,
          'name', v.name,
          'payment_amount', v.payment_amount,
          'amount_paid', v.amount_paid,
          'unpaid_due', GREATEST(0, COALESCE(v.payment_amount, 0) - COALESCE(v.amount_paid, 0)),
          'payment_status', v.payment_status,
          'created_at', v.created_at
        ) ORDER BY v.agency_id, GREATEST(0, COALESCE(v.payment_amount, 0) - COALESCE(v.amount_paid, 0)) DESC)
        FROM public.vendors v
        WHERE COALESCE(v.payment_amount, 0) <> COALESCE(v.amount_paid, 0)
      ), '[]'::jsonb),
      'booking_invoices_with_vendor_payable', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', bi.id,
          'agency_id', bi.agency_id,
          'invoice_no', bi.invoice_no,
          'vendor_id', bi.vendor_id,
          'vendor_payable', bi.vendor_payable,
          'is_void', bi.is_void,
          'payment_status', bi.payment_status,
          'invoice_date', bi.invoice_date,
          'created_at', bi.created_at
        ) ORDER BY bi.agency_id, bi.created_at DESC)
        FROM public.booking_invoices bi
        WHERE COALESCE(bi.vendor_payable, 0) > 0
      ), '[]'::jsonb)
    ) AS details

  UNION ALL

  -- 6. Client Dues & Overdue Invoices (new booking_invoices + legacy clients like FAIZAN ALI)
  SELECT
    60 AS sort_order,
    '06_client_dues_and_overdue' AS section,
    'INFO' AS status,
    jsonb_build_object(
      'booking_invoices_unpaid', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', bi.id,
          'agency_id', bi.agency_id,
          'invoice_no', bi.invoice_no,
          'party_id', bi.party_id,
          'client_amount', bi.client_amount,
          'paid_amount', bi.paid_amount,
          'balance_due', GREATEST(0, COALESCE(bi.client_amount, 0) - COALESCE(bi.paid_amount, 0)),
          'due_date', bi.due_date,
          'is_void', bi.is_void,
          'payment_status', bi.payment_status,
          'created_at', bi.created_at
        ) ORDER BY bi.agency_id, bi.created_at DESC)
        FROM public.booking_invoices bi
        WHERE COALESCE(bi.client_amount, 0) <> COALESCE(bi.paid_amount, 0)
      ), '[]'::jsonb),
      'legacy_clients_unpaid', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', c.id,
          'agency_id', c.agency_id,
          'name', c.name,
          'pnr', c.pnr,
          'selling_price', c.selling_price,
          'purchasing_price', c.purchasing_price,
          'amount_paid', c.amount_paid,
          'balance_due', GREATEST(0, COALESCE(c.selling_price, 0) - COALESCE(c.amount_paid, 0)),
          'remaining_payment_date', c.remaining_payment_date,
          'flight_date', c.flight_date,
          'payment_status', c.payment_status,
          'created_at', c.created_at
        ) ORDER BY c.agency_id, c.created_at DESC)
        FROM public.clients c
        WHERE COALESCE(c.selling_price, 0) <> COALESCE(c.amount_paid, 0)
      ), '[]'::jsonb)
    ) AS details
) snapshot
ORDER BY sort_order, section;
