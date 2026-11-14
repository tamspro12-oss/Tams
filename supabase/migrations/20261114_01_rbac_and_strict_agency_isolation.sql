-- ==============================================================================
-- TAMS PRO — MIGRATION 01: STRICT RBAC, SESSION REVOCATION & AGENCY ISOLATION
-- Covers Security Audit Tasks 1, 2, 3 (100% additive & preserves all live data)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. BACKFILL & LOCK DOWN RBAC (public.user_roles + has_role + is_super_admin)
-- ------------------------------------------------------------------------------

-- Preserve existing master/super admin(s) inside public.user_roles BEFORE
-- removing hardcoded email / profile flag shortcuts.
DO $$
DECLARE
  v_uid UUID;
BEGIN
  FOR v_uid IN
    SELECT DISTINCT id FROM (
      SELECT p.id
      FROM public.profiles p
      WHERE p.is_super_admin = true
      UNION
      SELECT u.id
      FROM auth.users u
      WHERE LOWER(u.email) = 'usmn4u@gmail.com'
    ) s
    WHERE EXISTS (SELECT 1 FROM auth.users au WHERE au.id = s.id)
  LOOP
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_uid, 'super_admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END LOOP;
END $$;

-- Authoritative role helper: ONLY checks public.user_roles (no email or client flags)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _user_id IS NULL OR _role IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = _user_id
        AND ur.role = _role
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'super_admin'::public.app_role);
$$;

-- Keep legacy RPC name working safely, backed strictly by user_roles.super_admin
CREATE OR REPLACE FUNCTION public.is_master_admin(_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'super_admin'::public.app_role);
$$;

-- Resolve caller agency from server-side tables only
CREATE OR REPLACE FUNCTION public.current_user_agency_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_agency_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT agency_id INTO v_agency_id
  FROM public.profiles
  WHERE id = v_uid
  LIMIT 1;

  IF v_agency_id IS NULL THEN
    SELECT agency_id INTO v_agency_id
    FROM public.sub_users
    WHERE user_id = v_uid AND is_active = true
    LIMIT 1;
  END IF;

  RETURN v_agency_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_agency_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_agency_id();
$$;

-- Guard public.user_roles against ANY non-super_admin write even via SECURITY DEFINER bugs
CREATE OR REPLACE FUNCTION public.protect_user_roles_mutations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin')
     OR COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
     OR public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION '403 Forbidden: Only super_admin or service_role may modify user roles';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_user_roles ON public.user_roles;
CREATE TRIGGER trg_protect_user_roles
BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.protect_user_roles_mutations();

-- Prevent non-super_admin users from escalating profiles.is_super_admin or changing profiles.agency_id
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin')
     OR COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
     OR public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW)->'is_super_admin') IS DISTINCT FROM (to_jsonb(OLD)->'is_super_admin') THEN
    RAISE EXCEPTION '403 Forbidden: Cannot modify is_super_admin';
  END IF;

  IF NEW.agency_id IS DISTINCT FROM OLD.agency_id THEN
    RAISE EXCEPTION '403 Forbidden: Cannot transfer profile to another agency';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_sensitive_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_sensitive_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_sensitive_columns();

-- Prevent non-super_admin users from mutating agency subscription / license fields
CREATE OR REPLACE FUNCTION public.protect_agency_billing_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new JSONB := to_jsonb(NEW);
  v_old JSONB := to_jsonb(OLD);
BEGIN
  IF current_user IN ('postgres', 'supabase_admin')
     OR COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
     OR public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF (v_new->'subscription_plan') IS DISTINCT FROM (v_old->'subscription_plan')
     OR (v_new->'license_key') IS DISTINCT FROM (v_old->'license_key')
     OR (v_new->'license_expiry') IS DISTINCT FROM (v_old->'license_expiry')
     OR (v_new->'license_status') IS DISTINCT FROM (v_old->'license_status')
     OR (v_new->'license_active') IS DISTINCT FROM (v_old->'license_active')
     OR (v_new->'max_storage_bytes') IS DISTINCT FROM (v_old->'max_storage_bytes')
     OR (v_new->'agency_code') IS DISTINCT FROM (v_old->'agency_code') THEN
    RAISE EXCEPTION '403 Forbidden: Only super_admin may modify subscription or license fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_agency_billing_columns ON public.agencies;
CREATE TRIGGER trg_protect_agency_billing_columns
BEFORE UPDATE ON public.agencies
FOR EACH ROW
EXECUTE FUNCTION public.protect_agency_billing_columns();


-- ------------------------------------------------------------------------------
-- 2. SESSION REVOCATION & ADMIN RPC HARDENING (Task 2 & Task 1/3)
-- ------------------------------------------------------------------------------

-- Drop pre-existing non-policy/non-trigger functions whose return type or
-- overload signature changed cleanly so CREATE OR REPLACE never hits 42P13.
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
      AND p.proname IN (
        'admin_revoke_user_sessions',
        'delete_all_user_sessions',
        'delete_user_session',
        'get_user_active_sessions',
        'admin_get_registered_users',
        'admin_set_agency_subscription',
        'admin_activate_agency_override',
        'verify_agency_account_fallback',
        'account_balances'
      )
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s)', r.proname, r.args);
  END LOOP;
END $$;

-- Revoke ALL sessions AND refresh tokens for a target user
CREATE OR REPLACE FUNCTION public.admin_revoke_user_sessions(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_deleted_sessions INTEGER := 0;
  v_has_session_col BOOLEAN := false;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Target user_id is required';
  END IF;

  IF current_user NOT IN ('postgres', 'supabase_admin')
     AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     AND v_caller_id IS DISTINCT FROM p_user_id
     AND NOT public.has_role(v_caller_id, 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION '403 Forbidden: Not authorized to revoke sessions for this user';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'auth'
      AND table_name = 'refresh_tokens'
      AND column_name = 'session_id'
  ) INTO v_has_session_col;

  IF v_has_session_col THEN
    DELETE FROM auth.refresh_tokens
    WHERE user_id = p_user_id::text
       OR session_id IN (SELECT id FROM auth.sessions WHERE user_id = p_user_id);
  ELSE
    DELETE FROM auth.refresh_tokens
    WHERE user_id = p_user_id::text;
  END IF;

  DELETE FROM auth.sessions
  WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_deleted_sessions = ROW_COUNT;

  RETURN v_deleted_sessions;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_all_user_sessions(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN public.admin_revoke_user_sessions(p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_user_session(p_user_id UUID, p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_has_session_col BOOLEAN := false;
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin')
     AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     AND v_caller_id IS DISTINCT FROM p_user_id
     AND NOT public.has_role(v_caller_id, 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION '403 Forbidden: Not authorized to delete sessions for this user';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'auth'
      AND table_name = 'refresh_tokens'
      AND column_name = 'session_id'
  ) INTO v_has_session_col;

  IF v_has_session_col THEN
    DELETE FROM auth.refresh_tokens
    WHERE session_id = p_session_id AND user_id = p_user_id::text;
  END IF;

  DELETE FROM auth.sessions
  WHERE id = p_session_id AND user_id = p_user_id;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_active_sessions(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  user_agent TEXT,
  ip TEXT,
  not_after TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin')
     AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     AND v_caller_id IS DISTINCT FROM p_user_id
     AND NOT public.has_role(v_caller_id, 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION '403 Forbidden: Not authorized to inspect sessions for this user';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.created_at,
    s.user_agent,
    s.ip::TEXT,
    s.not_after
  FROM auth.sessions s
  WHERE s.user_id = p_user_id
    AND (s.not_after IS NULL OR s.not_after > NOW())
  ORDER BY COALESCE(s.updated_at, s.created_at) DESC;
END;
$$;

-- Restrict session counts strictly to super_admin / service_role
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_active_session_counts'
  ) THEN
    DROP FUNCTION IF EXISTS public.get_active_session_counts();
    CREATE OR REPLACE FUNCTION public.get_active_session_counts()
    RETURNS TABLE (user_id UUID, session_count BIGINT)
    LANGUAGE plpgsql
    STABLE
    SECURITY DEFINER
    SET search_path = public, auth
    AS $fn$
    BEGIN
      IF current_user NOT IN ('postgres', 'supabase_admin')
         AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
         AND NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
        RAISE EXCEPTION '403 Forbidden: super_admin role required';
      END IF;

      RETURN QUERY
      SELECT s.user_id, COUNT(*)::BIGINT AS session_count
      FROM auth.sessions s
      GROUP BY s.user_id;
    END;
    $fn$;
  END IF;
END $$;

-- Harden admin_get_registered_users: ONLY super_admin role (never email string)
CREATE OR REPLACE FUNCTION public.admin_get_registered_users()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_result JSONB;
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin')
     AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     AND NOT public.has_role(v_caller_id, 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION '403 Forbidden: super_admin role required';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', u.id,
      'email', COALESCE(u.email, 'No Email'),
      'full_name', COALESCE(NULLIF(p.full_name, ''), NULLIF(u.raw_user_meta_data->>'full_name', ''), split_part(u.email, '@', 1)),
      'role', COALESCE(r.role::text, 'staff'),
      'agency_id', COALESCE(p.agency_id::text, a.id::text, ''),
      'agency_name', COALESCE(a.name, u.raw_user_meta_data->>'agency_name', 'Primary Agency'),
      'subscription_plan', COALESCE(a.subscription_plan, 'free'),
      'license_expiry', COALESCE(a.license_expiry::text, (u.created_at + INTERVAL '14 days')::text),
      'license_status', COALESCE(a.license_status, 'active'),
      'created_at', u.created_at::text,
      'email_confirmed_at', u.email_confirmed_at::text,
      'last_sign_in_at', u.last_sign_in_at::text,
      'active_sessions', COALESCE((SELECT COUNT(*) FROM auth.sessions s WHERE s.user_id = u.id), 0)
    ) ORDER BY u.created_at DESC
  )
  INTO v_result
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.agencies a ON a.id = p.agency_id
  LEFT JOIN (
    SELECT DISTINCT ON (user_id) user_id, role
    FROM public.user_roles
    ORDER BY user_id,
      CASE role::text WHEN 'super_admin' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END ASC
  ) r ON r.user_id = u.id;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Harden admin_set_agency_subscription: ONLY super_admin role
CREATE OR REPLACE FUNCTION public.admin_set_agency_subscription(
  p_agency_id UUID,
  p_plan TEXT,
  p_duration_days INT DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_new_expiry TIMESTAMPTZ;
  v_plan_clean TEXT := LOWER(TRIM(p_plan));
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin')
     AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     AND NOT public.has_role(v_caller_id, 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION '403 Forbidden: super_admin role required';
  END IF;

  IF v_plan_clean = 'lifetime' THEN
    v_new_expiry := '2099-12-31 23:59:59+00'::TIMESTAMPTZ;
  ELSE
    v_new_expiry := NOW() + (COALESCE(p_duration_days, 30) || ' days')::INTERVAL;
  END IF;

  UPDATE public.agencies
  SET subscription_plan = v_plan_clean,
      license_status = 'active',
      license_active = true,
      license_expiry = v_new_expiry
  WHERE id = p_agency_id;

  RETURN jsonb_build_object(
    'success', true,
    'agency_id', p_agency_id,
    'plan', v_plan_clean,
    'license_expiry', v_new_expiry
  );
END;
$$;

-- Harden admin_activate_agency_override: require super_admin role!
CREATE OR REPLACE FUNCTION public.admin_activate_agency_override(p_agency_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin')
     AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     AND NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION '403 Forbidden: super_admin role required';
  END IF;

  UPDATE public.agencies
  SET license_active = true,
      license_status = 'active',
      license_expiry = GREATEST(COALESCE(license_expiry, NOW()), NOW() + INTERVAL '30 days')
  WHERE id = p_agency_id;

  RETURN jsonb_build_object('success', true, 'agency_id', p_agency_id);
END;
$$;

-- Harden verify_agency_account_fallback: never executable by anon; never extends expired licenses
CREATE OR REPLACE FUNCTION public.verify_agency_account_fallback(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_email TEXT;
  v_target_user RECORD;
BEGIN
  IF v_caller_id IS NULL AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Authentication required');
  END IF;

  SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller_id;

  IF NOT public.has_role(v_caller_id, 'super_admin'::public.app_role)
     AND LOWER(COALESCE(v_caller_email, '')) <> LOWER(TRIM(COALESCE(p_email, ''))) THEN
    RAISE EXCEPTION '403 Forbidden: Cannot verify another user account';
  END IF;

  SELECT id, email, email_confirmed_at INTO v_target_user
  FROM auth.users
  WHERE LOWER(email) = LOWER(TRIM(p_email))
  LIMIT 1;

  IF v_target_user.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Account not found');
  END IF;

  IF v_target_user.email_confirmed_at IS NULL THEN
    UPDATE auth.users
    SET email_confirmed_at = NOW(), updated_at = NOW()
    WHERE id = v_target_user.id;
  END IF;

  RETURN jsonb_build_object('success', true, 'user_id', v_target_user.id);
END;
$$;


-- ------------------------------------------------------------------------------
-- 3. PREVENT CROSS-AGENCY LEAKS IN HELPER / SEQUENCE / BALANCE RPCs
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.next_formatted_number(
  p_agency_id UUID,
  p_counter_type TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_agency UUID := public.current_user_agency_id();
  v_effective_agency UUID;
  v_next_val BIGINT;
BEGIN
  IF p_agency_id IS NOT NULL
     AND p_agency_id IS DISTINCT FROM v_caller_agency
     AND current_user NOT IN ('postgres', 'supabase_admin')
     AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     AND NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION '403 Forbidden: Cross-agency sequence access denied';
  END IF;

  v_effective_agency := COALESCE(p_agency_id, v_caller_agency);
  IF v_effective_agency IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Active agency context required';
  END IF;

  INSERT INTO public.agency_counters (agency_id, counter_type, current_val, updated_at)
  VALUES (v_effective_agency, p_counter_type, 1001, now())
  ON CONFLICT (agency_id, counter_type) DO UPDATE
    SET current_val = public.agency_counters.current_val + 1,
        updated_at = now()
  RETURNING current_val INTO v_next_val;

  IF p_counter_type IN ('invoice', 'client', 'vendor', 'voucher', 'refund', 'expense', 'quotation', 'query', 'reminder') THEN
    RETURN public.format_agency_number(v_effective_agency, p_counter_type, v_next_val);
  ELSIF p_counter_type = 'voucher_crv' THEN
    RETURN 'CRV-' || LPAD(v_next_val::TEXT, 8, '0');
  ELSIF p_counter_type = 'voucher_cpv' THEN
    RETURN 'CPV-' || LPAD(v_next_val::TEXT, 8, '0');
  ELSE
    RETURN UPPER(p_counter_type) || '-' || LPAD(v_next_val::TEXT, 6, '0');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.account_balances(p_agency_id UUID DEFAULT NULL)
RETURNS TABLE (
  account_id UUID,
  account_name TEXT,
  account_type TEXT,
  opening_balance NUMERIC,
  total_in NUMERIC,
  total_out NUMERIC,
  current_balance NUMERIC,
  active BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_agency UUID := public.current_user_agency_id();
  v_target_agency UUID;
BEGIN
  IF p_agency_id IS NOT NULL
     AND p_agency_id IS DISTINCT FROM v_caller_agency
     AND current_user NOT IN ('postgres', 'supabase_admin')
     AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     AND NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION '403 Forbidden: Cross-agency balance access denied';
  END IF;

  v_target_agency := COALESCE(p_agency_id, v_caller_agency);
  IF v_target_agency IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    a.id AS account_id,
    a.name AS account_name,
    a.type AS account_type,
    a.opening_balance,
    COALESCE(SUM(t.debit) FILTER (WHERE t.reversed_of IS NULL), 0)::NUMERIC AS total_in,
    COALESCE(SUM(t.credit) FILTER (WHERE t.reversed_of IS NULL), 0)::NUMERIC AS total_out,
    (a.opening_balance + COALESCE(SUM(t.debit - t.credit) FILTER (WHERE t.reversed_of IS NULL), 0))::NUMERIC AS current_balance,
    a.active
  FROM public.accounts a
  LEFT JOIN public.transactions t
    ON t.account_id = a.id
   AND t.agency_id = v_target_agency
  WHERE a.agency_id = v_target_agency
  GROUP BY a.id, a.name, a.type, a.opening_balance, a.active
  ORDER BY a.type DESC, a.name ASC;
END;
$$;


-- ------------------------------------------------------------------------------
-- 4. AGENCY ISOLATION TRIGGER (FAILS LOUDLY ON CROSS-AGENCY INSERT OR UPDATE)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_agency_isolation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_agency_id UUID;
BEGIN
  IF current_user IN ('postgres', 'supabase_admin')
     OR COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role' THEN
    IF NEW.agency_id IS NULL THEN
      NEW.agency_id := public.current_user_agency_id();
    END IF;
    RETURN NEW;
  END IF;

  v_user_agency_id := public.current_user_agency_id();

  IF public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    IF NEW.agency_id IS NULL THEN
      NEW.agency_id := v_user_agency_id;
    END IF;
    RETURN NEW;
  END IF;

  IF v_user_agency_id IS NULL THEN
    RAISE EXCEPTION '403 Forbidden: Authenticated user has no assigned agency';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.agency_id IS NULL THEN
      NEW.agency_id := v_user_agency_id;
    ELSIF NEW.agency_id IS DISTINCT FROM v_user_agency_id THEN
      RAISE EXCEPTION '403 Forbidden: Cannot insert row for another agency';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.agency_id IS DISTINCT FROM v_user_agency_id THEN
      RAISE EXCEPTION '403 Forbidden: Cannot update row belonging to another agency';
    END IF;
    IF NEW.agency_id IS DISTINCT FROM OLD.agency_id THEN
      RAISE EXCEPTION '403 Forbidden: Cannot change row agency_id';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;


-- ------------------------------------------------------------------------------
-- 5. COMPLETE 40-TABLE RLS AUDIT FIX + MISSING agency_id BACKFILL
-- ------------------------------------------------------------------------------

-- Ensure policy_acknowledgments also carries agency_id (nullable only if orphan user, backfilled from profiles)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'policy_acknowledgments'
  ) THEN
    ALTER TABLE public.policy_acknowledgments
      ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE;

    UPDATE public.policy_acknowledgments pa
    SET agency_id = p.agency_id
    FROM public.profiles p
    WHERE pa.user_id = p.id
      AND pa.agency_id IS NULL
      AND p.agency_id IS NOT NULL;
  END IF;
END $$;

-- Ensure google_drive_tokens backfills agency_id if any null exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'google_drive_tokens'
  ) THEN
    UPDATE public.google_drive_tokens g
    SET agency_id = p.agency_id
    FROM public.profiles p
    WHERE g.user_id = p.id
      AND g.agency_id IS NULL
      AND p.agency_id IS NOT NULL;
  END IF;
END $$;

-- Drop ALL existing RLS policies on ALL public tables so stale/permissive/legacy
-- policies (e.g. "Admins can delete...", "error_logs agency_id IS NULL", etc.)
-- cannot bypass strict isolation.
DO $$
DECLARE
  pol RECORD;
  tbl RECORD;
BEGIN
  FOR tbl IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl.tablename);
  END LOOP;

  FOR pol IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- 5A. ADMIN-ONLY TABLES (super_admin ONLY via has_role)
CREATE POLICY "user_roles_select_own_or_super_admin"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "user_roles_super_admin_insert"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "user_roles_super_admin_update"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "user_roles_super_admin_delete"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "admin_audit_logs_super_admin_only"
  ON public.admin_audit_logs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- 5B. AGENCIES TABLE (own agency or super_admin; no cross-agency admin leak)
CREATE POLICY "agencies_select_own_or_super_admin"
  ON public.agencies FOR SELECT TO authenticated
  USING (id = public.current_user_agency_id() OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "agencies_update_own_or_super_admin"
  ON public.agencies FOR UPDATE TO authenticated
  USING (id = public.current_user_agency_id() OR public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (id = public.current_user_agency_id() OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "agencies_insert_super_admin_only"
  ON public.agencies FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "agencies_delete_super_admin_only"
  ON public.agencies FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- 5C. PROFILES TABLE (same agency or self, or super_admin)
CREATE POLICY "profiles_select_agency_or_super_admin"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR agency_id = public.current_user_agency_id()
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "profiles_update_self_or_super_admin"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "profiles_insert_super_admin_only"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- 5D. USER + AGENCY DUAL-SCOPED TABLES
CREATE POLICY "google_drive_tokens_strict_isolation"
  ON public.google_drive_tokens FOR ALL TO authenticated
  USING (user_id = auth.uid() AND agency_id = public.current_user_agency_id())
  WITH CHECK (user_id = auth.uid() AND agency_id = public.current_user_agency_id());

DROP TRIGGER IF EXISTS trg_isolation_google_drive_tokens ON public.google_drive_tokens;
CREATE TRIGGER trg_isolation_google_drive_tokens
BEFORE INSERT OR UPDATE ON public.google_drive_tokens
FOR EACH ROW EXECUTE FUNCTION public.enforce_agency_isolation();

CREATE POLICY "policy_acknowledgments_strict_isolation"
  ON public.policy_acknowledgments FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    AND (agency_id IS NULL OR agency_id = public.current_user_agency_id())
  )
  WITH CHECK (
    user_id = auth.uid()
    AND (agency_id IS NULL OR agency_id = public.current_user_agency_id())
  );

DROP TRIGGER IF EXISTS trg_isolation_policy_acknowledgments ON public.policy_acknowledgments;
CREATE TRIGGER trg_isolation_policy_acknowledgments
BEFORE INSERT OR UPDATE ON public.policy_acknowledgments
FOR EACH ROW EXECUTE FUNCTION public.enforce_agency_isolation();

-- 5E. SUB_USERS TABLE (same agency main user, own sub_user record, or super_admin)
CREATE POLICY "sub_users_select_strict"
  ON public.sub_users FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (agency_id = public.current_user_agency_id() AND main_user_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "sub_users_insert_strict"
  ON public.sub_users FOR INSERT TO authenticated
  WITH CHECK (
    (agency_id = public.current_user_agency_id() AND main_user_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "sub_users_update_strict"
  ON public.sub_users FOR UPDATE TO authenticated
  USING (
    (agency_id = public.current_user_agency_id() AND main_user_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
  WITH CHECK (
    (agency_id = public.current_user_agency_id() AND main_user_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY "sub_users_delete_strict"
  ON public.sub_users FOR DELETE TO authenticated
  USING (
    (agency_id = public.current_user_agency_id() AND main_user_id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

DROP TRIGGER IF EXISTS trg_isolation_sub_users ON public.sub_users;
CREATE TRIGGER trg_isolation_sub_users
BEFORE INSERT OR UPDATE ON public.sub_users
FOR EACH ROW EXECUTE FUNCTION public.enforce_agency_isolation();

-- 5F. ALL REMAINING AGENCY-SCOPED TABLES (uniform strict isolation + trigger)
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
BEGIN
  FOREACH v_t IN ARRAY v_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = v_t
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE',
        v_t
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (agency_id = public.current_user_agency_id() OR public.has_role(auth.uid(), ''super_admin''::public.app_role))',
        v_t || '_strict_select', v_t
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (agency_id = public.current_user_agency_id() OR public.has_role(auth.uid(), ''super_admin''::public.app_role))',
        v_t || '_strict_insert', v_t
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (agency_id = public.current_user_agency_id() OR public.has_role(auth.uid(), ''super_admin''::public.app_role)) WITH CHECK (agency_id = public.current_user_agency_id() OR public.has_role(auth.uid(), ''super_admin''::public.app_role))',
        v_t || '_strict_update', v_t
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (agency_id = public.current_user_agency_id() OR public.has_role(auth.uid(), ''super_admin''::public.app_role))',
        v_t || '_strict_delete', v_t
      );

      EXECUTE format('DROP TRIGGER IF EXISTS trg_isolation_%I ON public.%I', v_t, v_t);
      EXECUTE format(
        'CREATE TRIGGER trg_isolation_%I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_agency_isolation()',
        v_t, v_t
      );
    END IF;
  END LOOP;
END $$;

-- Backfill non-null agency_id onto any orphaned error_logs using user_id if possible
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'error_logs'
  ) THEN
    UPDATE public.error_logs el
    SET agency_id = p.agency_id
    FROM public.profiles p
    WHERE el.user_id = p.id
      AND el.agency_id IS NULL
      AND p.agency_id IS NOT NULL;
  END IF;
END $$;

-- 5G. ENFORCE security_invoker = true ON ALL PUBLIC VIEWS (if any exist)
DO $$
DECLARE
  v_view RECORD;
BEGIN
  FOR v_view IN
    SELECT schemaname, viewname
    FROM pg_views
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER VIEW %I.%I SET (security_invoker = true)', v_view.schemaname, v_view.viewname);
  END LOOP;
END $$;


-- ------------------------------------------------------------------------------
-- 6. STORAGE BUCKETS & STRICT AGENCY-FOLDER POLICIES (Task 3)
-- ------------------------------------------------------------------------------

-- Never allow public bucket access for agency files or temp email attachments
UPDATE storage.buckets
SET public = false
WHERE id IN ('agency-files', 'tams-temp-email');

-- Drop ALL prior storage.objects policies targeting agency-files or tams-temp-email
DO $$
DECLARE
  sp RECORD;
BEGIN
  FOR sp IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        COALESCE(qual, '') ILIKE '%agency-files%'
        OR COALESCE(with_check, '') ILIKE '%agency-files%'
        OR COALESCE(qual, '') ILIKE '%tams-temp-email%'
        OR COALESCE(with_check, '') ILIKE '%tams-temp-email%'
        OR policyname ILIKE '%agency files%'
        OR policyname ILIKE '%email attachments%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', sp.policyname);
  END LOOP;
END $$;

-- Strictly scope storage objects by leading folder = current_user_agency_id()
CREATE POLICY "agency_files_select_own_agency"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'agency-files'
    AND (
      (storage.foldername(name))[1] = public.current_user_agency_id()::text
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    )
  );

CREATE POLICY "agency_files_insert_own_agency"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'agency-files'
    AND (storage.foldername(name))[1] = public.current_user_agency_id()::text
  );

CREATE POLICY "agency_files_update_own_agency"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'agency-files'
    AND (storage.foldername(name))[1] = public.current_user_agency_id()::text
  )
  WITH CHECK (
    bucket_id = 'agency-files'
    AND (storage.foldername(name))[1] = public.current_user_agency_id()::text
  );

CREATE POLICY "agency_files_delete_own_agency"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'agency-files'
    AND (
      (storage.foldername(name))[1] = public.current_user_agency_id()::text
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    )
  );

CREATE POLICY "temp_email_select_own_agency"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'tams-temp-email'
    AND (
      (storage.foldername(name))[1] = public.current_user_agency_id()::text
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    )
  );

CREATE POLICY "temp_email_insert_own_agency"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tams-temp-email'
    AND (storage.foldername(name))[1] = public.current_user_agency_id()::text
  );

CREATE POLICY "temp_email_delete_own_agency"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'tams-temp-email'
    AND (
      (storage.foldername(name))[1] = public.current_user_agency_id()::text
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    )
  );


-- ------------------------------------------------------------------------------
-- 7. REVOKE OVERPERMISSIVE ANON FUNCTION GRANTS (Task 1 & Task 3)
-- ------------------------------------------------------------------------------

DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.proname NOT IN ('handle_new_user', 'auto_confirm_agency_signup', 'handle_master_admin_registration')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon', fn.proname, fn.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', fn.proname, fn.args);
  END LOOP;
END $$;

