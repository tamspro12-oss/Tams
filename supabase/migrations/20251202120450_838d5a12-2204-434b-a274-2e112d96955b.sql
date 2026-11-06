-- Create sub_users table for Sub ID management
CREATE TABLE public.sub_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  main_user_id uuid NOT NULL,
  agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE NOT NULL,
  sub_id_code text NOT NULL UNIQUE,
  permissions jsonb NOT NULL DEFAULT '{
    "dashboard": true,
    "bookings": {"read": true, "write": false, "delete": false},
    "vendors": {"read": true, "write": false, "delete": false},
    "clients": {"read": true, "write": false, "delete": false},
    "queries": {"read": true, "write": false, "delete": false},
    "expenses": {"read": true, "write": false, "delete": false},
    "reports": {"read": true},
    "invoices": {"read": true, "write": false},
    "settings": false
  }'::jsonb,
  is_active boolean DEFAULT true,
  last_login timestamp with time zone,
  last_activity timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sub_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sub_users
CREATE POLICY "Super Admin can view all sub users"
ON public.sub_users
FOR SELECT
USING (
  (SELECT email FROM auth.users WHERE id = auth.uid()) = 'usmn4u@gmail.com'
);

CREATE POLICY "Main users can view their own sub users"
ON public.sub_users
FOR SELECT
USING (main_user_id = auth.uid());

CREATE POLICY "Sub users can view their own record"
ON public.sub_users
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Super Admin can manage all sub users"
ON public.sub_users
FOR ALL
USING (
  (SELECT email FROM auth.users WHERE id = auth.uid()) = 'usmn4u@gmail.com'
);

CREATE POLICY "Main users can manage their own sub users"
ON public.sub_users
FOR ALL
USING (main_user_id = auth.uid());

-- Helper function: Check if user is a Sub ID
CREATE OR REPLACE FUNCTION public.is_sub_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.sub_users WHERE user_id = _user_id AND is_active = true);
$$;

-- Helper function: Get Main ID for a Sub ID
CREATE OR REPLACE FUNCTION public.get_main_user_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT main_user_id FROM public.sub_users WHERE user_id = _user_id;
$$;

-- Helper function: Count Sub IDs for a Main ID
CREATE OR REPLACE FUNCTION public.count_sub_users(_main_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM public.sub_users WHERE main_user_id = _main_user_id AND is_active = true;
$$;

-- Helper function: Check module permission for Sub ID
CREATE OR REPLACE FUNCTION public.has_module_permission(_user_id uuid, _module text, _action text DEFAULT 'read')
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  perms jsonb;
  module_perms jsonb;
BEGIN
  -- If not a Sub ID, return true (Main ID has full access)
  SELECT permissions INTO perms FROM public.sub_users WHERE user_id = _user_id AND is_active = true;
  IF NOT FOUND THEN RETURN true; END IF;
  
  -- Check module permission
  module_perms := perms->_module;
  IF module_perms IS NULL THEN RETURN false; END IF;
  IF module_perms::text = 'true' THEN RETURN true; END IF;
  IF module_perms::text = 'false' THEN RETURN false; END IF;
  
  -- Check action-level permission
  RETURN COALESCE((module_perms->>_action)::boolean, false);
END;
$$;

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_sub_users_updated_at
BEFORE UPDATE ON public.sub_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();