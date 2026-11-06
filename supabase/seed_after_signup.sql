-- ============================================================
-- TAMS Pro: Seed First Admin & Verify Agency Link (Run AFTER Signup)
-- ============================================================
-- Instructions:
-- 1. First run supabase/combined_migrations.sql in the Supabase SQL Editor.
-- 2. Sign up for your account in the app (or create a user in Supabase Dashboard -> Authentication -> Users).
-- 3. Copy your user's UUID from Authentication -> Users, paste it into target_user_id below, and click Run.
-- ============================================================

DO $$
DECLARE
  target_user_id UUID := 'PASTE_YOUR_USER_ID_HERE'; -- <-- Replace with your auth.users UUID
  target_agency_id UUID;
  user_email TEXT;
  user_full_name TEXT;
BEGIN
  -- 1. Verify the user exists in auth.users
  SELECT email, COALESCE(raw_user_meta_data->>'full_name', email)
    INTO user_email, user_full_name
  FROM auth.users
  WHERE id = target_user_id;

  IF user_email IS NULL THEN
    RAISE EXCEPTION 'User ID % was not found in auth.users. Sign up first, then paste your UUID.', target_user_id;
  END IF;

  -- 2. Ensure the user has an agency & profile (created automatically by on_auth_user_created trigger on signup,
  --    or created here as a fallback if the user was created before migrations ran)
  SELECT agency_id INTO target_agency_id
  FROM public.profiles
  WHERE id = target_user_id;

  IF target_agency_id IS NULL THEN
    INSERT INTO public.agencies (
      name,
      license_key,
      subscription_plan,
      license_expiry,
      license_status,
      license_active
    )
    VALUES (
      'My Agency',
      'KEY-' || substr(md5(random()::text), 1, 8),
      'yearly',
      NOW() + INTERVAL '365 days',
      'active',
      true
    )
    RETURNING id INTO target_agency_id;

    INSERT INTO public.profiles (id, agency_id, full_name)
    VALUES (target_user_id, target_agency_id, user_full_name);
  ELSE
    -- Ensure the linked agency license is active
    UPDATE public.agencies
    SET license_status = 'active',
        license_active = true
    WHERE id = target_agency_id;
  END IF;

  -- 3. Grant the 'admin' role in public.user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RAISE NOTICE 'Success: User % (%) is now an admin linked to agency %.', target_user_id, user_email, target_agency_id;
END $$;

