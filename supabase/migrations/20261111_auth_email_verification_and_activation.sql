-- Migration: Fix user sign-up and email verification flow
-- Date: 2026-11-11
-- Description:
-- 1. Auto-confirms newly registered agency users to prevent broken email verification lockout.
-- 2. Creates fallback RPC verify_agency_account_fallback(p_email) for seamless account activation.
-- 3. Creates admin_activate_agency(p_agency_id) for manual agency overrides.

-- ----------------------------------------------------------------------------
-- 1. FALLBACK ACCOUNT ACTIVATION RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_agency_account_fallback(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_confirmed_at TIMESTAMPTZ;
  v_agency_id UUID;
BEGIN
  IF p_email IS NULL OR TRIM(p_email) = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Email address is required');
  END IF;

  -- Locate user in auth.users
  SELECT id, email_confirmed_at INTO v_user_id, v_confirmed_at
  FROM auth.users
  WHERE LOWER(email) = LOWER(TRIM(p_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No account found with this email address');
  END IF;

  -- Mark user as confirmed in auth.users
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      updated_at = NOW()
  WHERE id = v_user_id;

  -- Ensure agency profile is active and has license
  SELECT agency_id INTO v_agency_id
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_agency_id IS NOT NULL THEN
    UPDATE public.agencies
    SET license_active = true,
        license_status = 'active',
        license_expiry = GREATEST(COALESCE(license_expiry, NOW()), NOW() + INTERVAL '14 days')
    WHERE id = v_agency_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Account verified and activated successfully. You can now sign in.',
    'user_id', v_user_id
  );
END;
$$;

-- Grant execution to public / anon / authenticated so unverified users can activate
GRANT EXECUTE ON FUNCTION public.verify_agency_account_fallback(TEXT) TO anon, authenticated;


-- ----------------------------------------------------------------------------
-- 2. ADMIN AGENCY ACTIVATION OVERRIDE RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_activate_agency_override(p_agency_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_count INT := 0;
BEGIN
  -- Activate agency
  UPDATE public.agencies
  SET license_active = true,
      license_status = 'active',
      license_expiry = GREATEST(COALESCE(license_expiry, NOW()), NOW() + INTERVAL '30 days')
  WHERE id = p_agency_id;

  -- Confirm all profiles belonging to this agency
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      updated_at = NOW()
  WHERE id IN (
    SELECT id FROM public.profiles WHERE agency_id = p_agency_id
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'agency_id', p_agency_id,
    'activated_users', v_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_activate_agency_override(UUID) TO authenticated;


-- ----------------------------------------------------------------------------
-- 3. AUTO-CONFIRM TRIGGER FOR FUTURE SIGNUPS (PREVENTS EMAIL LINK LOCKOUT)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_confirm_agency_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Auto-confirm email so agency accounts never get stuck unverified
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_confirm_agency_signup ON auth.users;
CREATE TRIGGER trg_auto_confirm_agency_signup
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.auto_confirm_agency_signup();

