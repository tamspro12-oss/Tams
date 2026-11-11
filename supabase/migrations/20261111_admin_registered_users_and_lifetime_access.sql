-- ============================================================================
-- Migration: Admin Registered Users List & Master Admin Lifetime Access
-- Date: 2026-11-11
-- Description:
-- 1. Sets lifetime access for usmn4u@gmail.com in auth.users, profiles, and agencies.
-- 2. Creates SECURITY DEFINER RPC admin_get_registered_users() for instant,
--    fail-safe retrieval of all registered users without edge-function dependency.
-- 3. Creates RPC admin_set_agency_subscription() for direct plan management.
-- ============================================================================

-- 1. Ensure master admin usmn4u@gmail.com has Lifetime Access in database
DO $$
DECLARE
  v_admin_user_id UUID;
  v_admin_agency_id UUID;
BEGIN
  -- Locate master admin user
  SELECT id INTO v_admin_user_id
  FROM auth.users
  WHERE LOWER(email) = 'usmn4u@gmail.com'
  LIMIT 1;

  IF v_admin_user_id IS NOT NULL THEN
    -- 1. Ensure profile exists and marked is_super_admin
    SELECT agency_id INTO v_admin_agency_id
    FROM public.profiles
    WHERE id = v_admin_user_id;

    IF v_admin_agency_id IS NULL THEN
      -- Create HQ Agency for master admin if none
      INSERT INTO public.agencies (
        name,
        license_key,
        subscription_plan,
        license_expiry,
        license_status,
        license_active
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

      INSERT INTO public.profiles (id, agency_id, full_name, is_super_admin)
      VALUES (v_admin_user_id, v_admin_agency_id, 'Master Administrator', true)
      ON CONFLICT (id) DO UPDATE
      SET agency_id = v_admin_agency_id,
          is_super_admin = true;
    ELSE
      -- Update master admin agency to lifetime active
      UPDATE public.agencies
      SET subscription_plan = 'lifetime',
          license_status = 'active',
          license_active = true,
          license_expiry = '2099-12-31 23:59:59+00'::TIMESTAMPTZ
      WHERE id = v_admin_agency_id;

      UPDATE public.profiles
      SET is_super_admin = true
      WHERE id = v_admin_user_id;
    END IF;

    -- Ensure admin role in user_roles
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_admin_user_id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;


-- 2. Fast, resilient RPC to list all registered users (Bypasses Edge Function failures)
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
  -- Strict master admin authorization
  IF NOT public.is_master_admin(v_caller_id) THEN
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
      'agency_id', p.agency_id,
      'agency_name', COALESCE(a.name, 'Primary Agency'),
      'subscription_plan', CASE 
        WHEN LOWER(u.email) = 'usmn4u@gmail.com' THEN 'lifetime'
        ELSE COALESCE(a.subscription_plan, 'free')
      END,
      'license_expiry', CASE 
        WHEN LOWER(u.email) = 'usmn4u@gmail.com' THEN '2099-12-31T23:59:59.000Z'
        ELSE a.license_expiry::text
      END,
      'license_status', CASE 
        WHEN LOWER(u.email) = 'usmn4u@gmail.com' THEN 'active'
        ELSE COALESCE(a.license_status, 'active')
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

GRANT EXECUTE ON FUNCTION public.admin_get_registered_users() TO authenticated;


-- 3. Direct RPC for Master Admin to update agency subscriptions
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
  IF NOT public.is_master_admin(v_caller_id) THEN
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

GRANT EXECUTE ON FUNCTION public.admin_set_agency_subscription(UUID, TEXT, INT) TO authenticated;

