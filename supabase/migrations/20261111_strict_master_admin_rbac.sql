-- ============================================================================
-- Migration: Strict Role-Based Access Control (RBAC) for Master Admin (usmn4u@gmail.com)
-- Date: 2026-11-11
-- Description:
-- 1. Adds is_super_admin flag to public.profiles.
-- 2. Defines public.is_master_admin(user_id) SECURITY DEFINER helper.
-- 3. Updates public.has_role() to restrict admin role exclusively to master admin.
-- 4. Ensures usmn4u@gmail.com has is_super_admin = true and 'admin' role in user_roles.
-- 5. Tightens RLS on user_roles and administrative tables.
-- ============================================================================

-- 1. Add is_super_admin column to profiles if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'profiles' 
      AND column_name = 'is_super_admin'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN is_super_admin BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 2. Create is_master_admin helper function
CREATE OR REPLACE FUNCTION public.is_master_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email TEXT;
  v_is_super BOOLEAN;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check auth.users email
  SELECT LOWER(email) INTO v_email
  FROM auth.users
  WHERE id = _user_id;

  IF v_email = 'usmn4u@gmail.com' THEN
    RETURN true;
  END IF;

  -- Check profiles is_super_admin flag
  SELECT is_super_admin INTO v_is_super
  FROM public.profiles
  WHERE id = _user_id;

  RETURN COALESCE(v_is_super, false);
END;
$$;

-- Grant execution to authenticated & anon
GRANT EXECUTE ON FUNCTION public.is_master_admin(UUID) TO authenticated, anon;


-- 3. Strengthen has_role helper function to enforce master admin exclusivity for 'admin' role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Admin privileges require master admin authentication
  IF _role = 'admin'::public.app_role THEN
    IF NOT public.is_master_admin(_user_id) THEN
      RETURN false;
    END IF;
  END IF;

  -- Check user_roles table
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  ) OR (_role = 'admin'::public.app_role AND public.is_master_admin(_user_id));
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role) TO authenticated;


-- 4. Seed / Flag master admin usmn4u@gmail.com if already exists
DO $$
DECLARE
  v_admin_id UUID;
BEGIN
  SELECT id INTO v_admin_id
  FROM auth.users
  WHERE LOWER(email) = 'usmn4u@gmail.com'
  LIMIT 1;

  IF v_admin_id IS NOT NULL THEN
    -- Mark profile as super admin
    UPDATE public.profiles
    SET is_super_admin = true
    WHERE id = v_admin_id;

    -- Grant admin role in user_roles
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_admin_id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;


-- 5. Trigger on auth.users to automatically grant is_super_admin and admin role if usmn4u@gmail.com signs up
CREATE OR REPLACE FUNCTION public.handle_master_admin_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF LOWER(NEW.email) = 'usmn4u@gmail.com' THEN
    -- Update profile if already created
    UPDATE public.profiles
    SET is_super_admin = true
    WHERE id = NEW.id;

    -- Ensure admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_master_admin_registration ON auth.users;
CREATE TRIGGER trg_handle_master_admin_registration
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_master_admin_registration();


-- 6. Tighten user_roles table RLS: only master admin can read all roles or modify them
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Master admin can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read own role or master admin reads all" ON public.user_roles;

CREATE POLICY "Users can read own role or master admin reads all"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR public.is_master_admin(auth.uid())
);

CREATE POLICY "Master admin can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  public.is_master_admin(auth.uid())
)
WITH CHECK (
  public.is_master_admin(auth.uid())
);

