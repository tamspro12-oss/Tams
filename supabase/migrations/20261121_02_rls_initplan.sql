-- REVIEW AND TEST BEFORE RUNNING
-- ==============================================================================
-- TAMS PRO — RLS INITPLAN OPTIMIZATION
-- File: supabase/migrations/20261121_02_rls_initplan.sql
--
-- Wraps auth.uid(), public.current_user_agency_id(), public.has_role(), and
-- public.is_agency_owner() in (SELECT ...) InitPlans so Postgres evaluates
-- them once per query instead of per scanned row, while preserving identical
-- strict multi-tenant and super_admin security semantics.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. ADMIN-ONLY TABLES
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "user_roles_select_own_or_super_admin" ON public.user_roles;
CREATE POLICY "user_roles_select_own_or_super_admin"
  ON public.user_roles FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
  );

DROP POLICY IF EXISTS "user_roles_super_admin_insert" ON public.user_roles;
CREATE POLICY "user_roles_super_admin_insert"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)));

DROP POLICY IF EXISTS "user_roles_super_admin_update" ON public.user_roles;
CREATE POLICY "user_roles_super_admin_update"
  ON public.user_roles FOR UPDATE TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)));

DROP POLICY IF EXISTS "user_roles_super_admin_delete" ON public.user_roles;
CREATE POLICY "user_roles_super_admin_delete"
  ON public.user_roles FOR DELETE TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)));

DROP POLICY IF EXISTS "admin_audit_logs_super_admin_only" ON public.admin_audit_logs;
CREATE POLICY "admin_audit_logs_super_admin_only"
  ON public.admin_audit_logs FOR ALL TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)));

-- ------------------------------------------------------------------------------
-- 2. AGENCIES & PROFILES
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "agencies_select_own_or_super_admin" ON public.agencies;
CREATE POLICY "agencies_select_own_or_super_admin"
  ON public.agencies FOR SELECT TO authenticated
  USING (
    id = (SELECT public.current_user_agency_id())
    OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
  );

DROP POLICY IF EXISTS "agencies_update_own_or_super_admin" ON public.agencies;
CREATE POLICY "agencies_update_own_or_super_admin"
  ON public.agencies FOR UPDATE TO authenticated
  USING (
    (id = (SELECT public.current_user_agency_id()) AND (SELECT public.is_agency_owner((SELECT auth.uid()))))
    OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
  )
  WITH CHECK (
    (id = (SELECT public.current_user_agency_id()) AND (SELECT public.is_agency_owner((SELECT auth.uid()))))
    OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
  );

DROP POLICY IF EXISTS "agencies_insert_super_admin_only" ON public.agencies;
CREATE POLICY "agencies_insert_super_admin_only"
  ON public.agencies FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)));

DROP POLICY IF EXISTS "agencies_delete_super_admin_only" ON public.agencies;
CREATE POLICY "agencies_delete_super_admin_only"
  ON public.agencies FOR DELETE TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)));

DROP POLICY IF EXISTS "profiles_select_agency_or_super_admin" ON public.profiles;
CREATE POLICY "profiles_select_agency_or_super_admin"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR agency_id = (SELECT public.current_user_agency_id())
    OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
  );

DROP POLICY IF EXISTS "profiles_update_self_or_super_admin" ON public.profiles;
CREATE POLICY "profiles_update_self_or_super_admin"
  ON public.profiles FOR UPDATE TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
  )
  WITH CHECK (
    id = (SELECT auth.uid())
    OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
  );

DROP POLICY IF EXISTS "profiles_insert_super_admin_only" ON public.profiles;
CREATE POLICY "profiles_insert_super_admin_only"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)));

-- ------------------------------------------------------------------------------
-- 3. DUAL-SCOPED & SUB_USERS & FEATURE TABLES
-- ------------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'google_drive_tokens'
  ) THEN
    DROP POLICY IF EXISTS "google_drive_tokens_strict_isolation" ON public.google_drive_tokens;
    CREATE POLICY "google_drive_tokens_strict_isolation"
      ON public.google_drive_tokens FOR ALL TO authenticated
      USING (
        user_id = (SELECT auth.uid())
        AND agency_id = (SELECT public.current_user_agency_id())
      )
      WITH CHECK (
        user_id = (SELECT auth.uid())
        AND agency_id = (SELECT public.current_user_agency_id())
      );
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'policy_acknowledgments'
  ) THEN
    DROP POLICY IF EXISTS "policy_acknowledgments_strict_isolation" ON public.policy_acknowledgments;
    CREATE POLICY "policy_acknowledgments_strict_isolation"
      ON public.policy_acknowledgments FOR ALL TO authenticated
      USING (
        user_id = (SELECT auth.uid())
        AND (agency_id IS NULL OR agency_id = (SELECT public.current_user_agency_id()))
      )
      WITH CHECK (
        user_id = (SELECT auth.uid())
        AND (agency_id IS NULL OR agency_id = (SELECT public.current_user_agency_id()))
      );
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'agency_templates'
  ) THEN
    DROP POLICY IF EXISTS "agency_templates_strict_select" ON public.agency_templates;
    CREATE POLICY "agency_templates_strict_select"
      ON public.agency_templates FOR SELECT TO authenticated
      USING (
        agency_id = (SELECT public.current_user_agency_id())
        OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
      );

    DROP POLICY IF EXISTS "agency_templates_strict_insert" ON public.agency_templates;
    CREATE POLICY "agency_templates_strict_insert"
      ON public.agency_templates FOR INSERT TO authenticated
      WITH CHECK (
        agency_id = (SELECT public.current_user_agency_id())
        OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
      );

    DROP POLICY IF EXISTS "agency_templates_strict_update" ON public.agency_templates;
    CREATE POLICY "agency_templates_strict_update"
      ON public.agency_templates FOR UPDATE TO authenticated
      USING (
        agency_id = (SELECT public.current_user_agency_id())
        OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
      )
      WITH CHECK (
        agency_id = (SELECT public.current_user_agency_id())
        OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
      );

    DROP POLICY IF EXISTS "agency_templates_strict_delete" ON public.agency_templates;
    CREATE POLICY "agency_templates_strict_delete"
      ON public.agency_templates FOR DELETE TO authenticated
      USING (
        agency_id = (SELECT public.current_user_agency_id())
        OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
      );
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'save_idempotency_logs'
  ) THEN
    DROP POLICY IF EXISTS "save_idempotency_logs_agency_select" ON public.save_idempotency_logs;
    CREATE POLICY "save_idempotency_logs_agency_select"
      ON public.save_idempotency_logs FOR SELECT TO authenticated
      USING (
        agency_id = (SELECT public.current_user_agency_id())
        OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
      );
  END IF;
END $$;

DROP POLICY IF EXISTS "sub_users_select_strict" ON public.sub_users;
DROP POLICY IF EXISTS "sub_users_insert_strict" ON public.sub_users;
DROP POLICY IF EXISTS "sub_users_update_strict" ON public.sub_users;
DROP POLICY IF EXISTS "sub_users_delete_strict" ON public.sub_users;
DROP POLICY IF EXISTS sub_users_strict_select ON public.sub_users;
DROP POLICY IF EXISTS sub_users_strict_insert ON public.sub_users;
DROP POLICY IF EXISTS sub_users_strict_update ON public.sub_users;
DROP POLICY IF EXISTS sub_users_strict_delete ON public.sub_users;

CREATE POLICY sub_users_strict_select ON public.sub_users
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (
      agency_id = (SELECT public.current_user_agency_id())
      AND (SELECT public.is_agency_owner((SELECT auth.uid())))
    )
    OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
  );

CREATE POLICY sub_users_strict_insert ON public.sub_users
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      agency_id = (SELECT public.current_user_agency_id())
      AND (SELECT public.is_agency_owner((SELECT auth.uid())))
    )
    OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
  );

CREATE POLICY sub_users_strict_update ON public.sub_users
  FOR UPDATE TO authenticated
  USING (
    (
      agency_id = (SELECT public.current_user_agency_id())
      AND (SELECT public.is_agency_owner((SELECT auth.uid())))
    )
    OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
  )
  WITH CHECK (
    (
      agency_id = (SELECT public.current_user_agency_id())
      AND (SELECT public.is_agency_owner((SELECT auth.uid())))
    )
    OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
  );

CREATE POLICY sub_users_strict_delete ON public.sub_users
  FOR DELETE TO authenticated
  USING (
    (
      agency_id = (SELECT public.current_user_agency_id())
      AND (SELECT public.is_agency_owner((SELECT auth.uid())))
    )
    OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
  );

-- ------------------------------------------------------------------------------
-- 4. ALL AGENCY-SCOPED TABLES (UNIFORM INITPLAN ISOLATION)
-- ------------------------------------------------------------------------------

DO $$
DECLARE
  v_tables TEXT[] := ARRAY[
    'clients', 'bookings', 'expenses', 'vendors',
    'client_payment_history', 'vendor_payment_history',
    'invoices', 'queries', 'files', 'email_logs',
    'b2b_agents', 'b2b_bookings', 'b2b_ledger',
    'cash_bank_entries', 'agency_banks', 'refunds', 'opening_balances',
    'quotations', 'vouchers', 'reminders', 'reminder_settings',
    'notifications', 'agency_whatsapp_settings',
    'accounts', 'transactions', 'parties', 'booking_invoices',
    'payment_vouchers', 'invoice_allocations', 'refund_void_records',
    'central_journal_entries', 'agency_counters', 'error_logs'
  ];
  v_t TEXT;
  v_pol RECORD;
BEGIN
  FOREACH v_t IN ARRAY v_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = v_t
    ) THEN
      FOR v_pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = v_t
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_pol.policyname, v_t);
      END LOOP;

      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (agency_id = (SELECT public.current_user_agency_id()) OR (SELECT public.has_role((SELECT auth.uid()), ''super_admin''::public.app_role)))',
        v_t || '_strict_select', v_t
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (agency_id = (SELECT public.current_user_agency_id()) OR (SELECT public.has_role((SELECT auth.uid()), ''super_admin''::public.app_role)))',
        v_t || '_strict_insert', v_t
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (agency_id = (SELECT public.current_user_agency_id()) OR (SELECT public.has_role((SELECT auth.uid()), ''super_admin''::public.app_role))) WITH CHECK (agency_id = (SELECT public.current_user_agency_id()) OR (SELECT public.has_role((SELECT auth.uid()), ''super_admin''::public.app_role)))',
        v_t || '_strict_update', v_t
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (agency_id = (SELECT public.current_user_agency_id()) OR (SELECT public.has_role((SELECT auth.uid()), ''super_admin''::public.app_role)))',
        v_t || '_strict_delete', v_t
      );
    END IF;
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 5. STORAGE BUCKET OBJECT POLICIES (INITPLAN)
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "agency_files_select_own_agency" ON storage.objects;
CREATE POLICY "agency_files_select_own_agency"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'agency-files'
    AND (
      (storage.foldername(name))[1] = (SELECT public.current_user_agency_id())::text
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
    )
  );

DROP POLICY IF EXISTS "agency_files_insert_own_agency" ON storage.objects;
CREATE POLICY "agency_files_insert_own_agency"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'agency-files'
    AND (storage.foldername(name))[1] = (SELECT public.current_user_agency_id())::text
  );

DROP POLICY IF EXISTS "agency_files_update_own_agency" ON storage.objects;
CREATE POLICY "agency_files_update_own_agency"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'agency-files'
    AND (storage.foldername(name))[1] = (SELECT public.current_user_agency_id())::text
  )
  WITH CHECK (
    bucket_id = 'agency-files'
    AND (storage.foldername(name))[1] = (SELECT public.current_user_agency_id())::text
  );

DROP POLICY IF EXISTS "agency_files_delete_own_agency" ON storage.objects;
CREATE POLICY "agency_files_delete_own_agency"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'agency-files'
    AND (
      (storage.foldername(name))[1] = (SELECT public.current_user_agency_id())::text
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
    )
  );

DROP POLICY IF EXISTS "temp_email_select_own_agency" ON storage.objects;
CREATE POLICY "temp_email_select_own_agency"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'tams-temp-email'
    AND (
      (storage.foldername(name))[1] = (SELECT public.current_user_agency_id())::text
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
    )
  );

DROP POLICY IF EXISTS "temp_email_insert_own_agency" ON storage.objects;
CREATE POLICY "temp_email_insert_own_agency"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tams-temp-email'
    AND (storage.foldername(name))[1] = (SELECT public.current_user_agency_id())::text
  );

DROP POLICY IF EXISTS "temp_email_delete_own_agency" ON storage.objects;
CREATE POLICY "temp_email_delete_own_agency"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'tams-temp-email'
    AND (
      (storage.foldername(name))[1] = (SELECT public.current_user_agency_id())::text
      OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))
    )
  );

COMMIT;

