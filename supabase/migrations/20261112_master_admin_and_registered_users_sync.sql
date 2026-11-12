-- ============================================================================
-- TAMS PRO: MASTER ADMIN & REGISTERED USERS DIRECTORY SYNC SCRIPT
-- Project: mwpbschzwjxeioyrzskv (https://mwpbschzwjxeioyrzskv.supabase.co)
-- Date: 2026-11-12
--
-- Instructions:
-- Paste this complete SQL script into Supabase Dashboard -> SQL Editor and click "Run".
-- URL: https://supabase.com/dashboard/project/mwpbschzwjxeioyrzskv/sql
-- ============================================================================

-- 0. Relax check constraints on public.agencies to support 'lifetime' plans & statuses
ALTER TABLE public.agencies DROP CONSTRAINT IF EXISTS agencies_subscription_plan_check;
ALTER TABLE public.agencies ADD CONSTRAINT agencies_subscription_plan_check 
  CHECK (subscription_plan IN ('free', 'monthly', 'yearly', 'lifetime'));

ALTER TABLE public.agencies DROP CONSTRAINT IF EXISTS agencies_license_status_check;
ALTER TABLE public.agencies ADD CONSTRAINT agencies_license_status_check 
  CHECK (license_status IN ('active', 'expired', 'trial', 'lifetime'));

-- 1. Helper function: Check if caller is Master Admin (usmn4u@gmail.com)
CREATE OR REPLACE FUNCTION public.is_master_admin(_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_jwt_email TEXT;
  v_db_email TEXT;
  v_is_super BOOLEAN;
BEGIN
  IF current_user = 'postgres' OR COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role' THEN
    RETURN true;
  END IF;

  -- Check JWT claim directly (fastest, available synchronously)
  v_jwt_email := LOWER(COALESCE(auth.jwt()->>'email', ''));
  IF v_jwt_email = 'usmn4u@gmail.com' THEN
    RETURN true;
  END IF;

  IF _user_id IS NULL THEN
    _user_id := auth.uid();
  END IF;

  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check auth.users table
  SELECT LOWER(email) INTO v_db_email
  FROM auth.users
  WHERE id = _user_id;

  IF v_db_email = 'usmn4u@gmail.com' THEN
    RETURN true;
  END IF;

  -- Check profiles is_super_admin flag
  SELECT is_super_admin INTO v_is_super
  FROM public.profiles
  WHERE id = _user_id;

  RETURN COALESCE(v_is_super, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_master_admin(UUID) TO authenticated, anon;


-- 2. Add email and is_super_admin columns to profiles if missing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;


-- 3. Backfill profiles.email from auth.users for all existing users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');


-- 4. Ensure master admin usmn4u@gmail.com is configured with Lifetime Access
DO $$
DECLARE
  v_admin_user_id UUID;
  v_admin_agency_id UUID;
BEGIN
  SELECT id INTO v_admin_user_id
  FROM auth.users
  WHERE LOWER(email) = 'usmn4u@gmail.com'
  LIMIT 1;

  IF v_admin_user_id IS NOT NULL THEN
    SELECT agency_id INTO v_admin_agency_id
    FROM public.profiles
    WHERE id = v_admin_user_id;

    IF v_admin_agency_id IS NULL THEN
      INSERT INTO public.agencies (
        name, license_key, subscription_plan,
        license_expiry, license_status, license_active
      )
      VALUES (
        'Master Admin HQ',
        'LIFETIME-MASTER-KEY',
        'lifetime',
        '2099-12-31 23:59:59+00'::TIMESTAMPTZ,
        'active',
        true
      )
      RETURNING id INTO v_admin_agency_id;

      INSERT INTO public.profiles (id, agency_id, full_name, email, is_super_admin)
      VALUES (v_admin_user_id, v_admin_agency_id, 'Master Administrator', 'usmn4u@gmail.com', true)
      ON CONFLICT (id) DO UPDATE
      SET agency_id = v_admin_agency_id,
          email = 'usmn4u@gmail.com',
          is_super_admin = true;
    ELSE
      UPDATE public.agencies
      SET subscription_plan = 'lifetime',
          license_status = 'active',
          license_active = true,
          license_expiry = '2099-12-31 23:59:59+00'::TIMESTAMPTZ
      WHERE id = v_admin_agency_id;

      UPDATE public.profiles
      SET is_super_admin = true,
          email = 'usmn4u@gmail.com'
      WHERE id = v_admin_user_id;
    END IF;

    -- Ensure admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_admin_user_id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;


-- 5. Update RLS policies on profiles & agencies so Master Admin can view and manage all users
DROP POLICY IF EXISTS "Master admin can view all profiles" ON public.profiles;
CREATE POLICY "Master admin can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_master_admin(auth.uid()));

DROP POLICY IF EXISTS "Master admin can update all profiles" ON public.profiles;
CREATE POLICY "Master admin can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_master_admin(auth.uid()))
WITH CHECK (public.is_master_admin(auth.uid()));

DROP POLICY IF EXISTS "Master admin can view all agencies" ON public.agencies;
CREATE POLICY "Master admin can view all agencies"
ON public.agencies
FOR SELECT
TO authenticated
USING (public.is_master_admin(auth.uid()));

DROP POLICY IF EXISTS "Master admin can update all agencies" ON public.agencies;
CREATE POLICY "Master admin can update all agencies"
ON public.agencies
FOR UPDATE
TO authenticated
USING (public.is_master_admin(auth.uid()))
WITH CHECK (public.is_master_admin(auth.uid()));


-- 6. Direct SECURITY DEFINER function to list ALL registered users (queries auth.users directly)
CREATE OR REPLACE FUNCTION public.admin_get_registered_users()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_jwt_email TEXT := LOWER(COALESCE(auth.jwt()->>'email', ''));
  v_result JSONB;
BEGIN
  IF current_user != 'postgres' 
     AND COALESCE(current_setting('request.jwt.claim.role', true), '') != 'service_role'
     AND v_jwt_email != 'usmn4u@gmail.com' 
     AND NOT public.is_master_admin(v_caller_id) THEN
    RAISE EXCEPTION '403 Forbidden: Master Admin privilege required';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', u.id,
      'email', COALESCE(u.email, 'No Email'),
      'full_name', COALESCE(NULLIF(p.full_name, ''), NULLIF(u.raw_user_meta_data->>'full_name', ''), split_part(u.email, '@', 1)),
      'role', CASE 
        WHEN LOWER(u.email) = 'usmn4u@gmail.com' OR p.is_super_admin = true THEN 'admin'
        WHEN r.role IS NOT NULL THEN r.role::text
        ELSE 'user'
      END,
      'agency_id', COALESCE(p.agency_id::text, a.id::text, ''),
      'agency_name', COALESCE(a.name, u.raw_user_meta_data->>'agency_name', 'Primary Agency'),
      'subscription_plan', CASE 
        WHEN LOWER(u.email) = 'usmn4u@gmail.com' THEN 'lifetime'
        ELSE COALESCE(a.subscription_plan, u.raw_user_meta_data->>'subscription_plan', 'free')
      END,
      'license_expiry', CASE 
        WHEN LOWER(u.email) = 'usmn4u@gmail.com' THEN '2099-12-31T23:59:59.000Z'
        WHEN a.license_expiry IS NOT NULL THEN a.license_expiry::text
        ELSE (u.created_at + INTERVAL '14 days')::text
      END,
      'license_status', CASE 
        WHEN LOWER(u.email) = 'usmn4u@gmail.com' THEN 'active'
        WHEN a.license_status IS NOT NULL THEN a.license_status
        ELSE 'active'
      END,
      'created_at', u.created_at::text,
      'email_confirmed_at', u.email_confirmed_at::text,
      'last_sign_in_at', u.last_sign_in_at::text,
      'active_sessions', 1
    ) ORDER BY u.created_at DESC
  )
  INTO v_result
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.agencies a ON a.id = p.agency_id
  LEFT JOIN (
    SELECT DISTINCT ON (user_id) user_id, role
    FROM public.user_roles
    ORDER BY user_id, role ASC
  ) r ON r.user_id = u.id;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_registered_users() TO authenticated, anon;


-- 7. Direct RPC for Master Admin to update agency subscriptions
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
  IF current_user != 'postgres' 
     AND COALESCE(current_setting('request.jwt.claim.role', true), '') != 'service_role'
     AND LOWER(COALESCE(auth.jwt()->>'email', '')) != 'usmn4u@gmail.com' 
     AND NOT public.is_master_admin(v_caller_id) THEN
    RAISE EXCEPTION '403 Forbidden: Master Admin privilege required';
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

GRANT EXECUTE ON FUNCTION public.admin_set_agency_subscription(UUID, TEXT, INT) TO authenticated, anon;
