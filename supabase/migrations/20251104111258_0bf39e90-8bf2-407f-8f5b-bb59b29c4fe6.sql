-- Helper function to safely get current user's agency id without RLS recursion
CREATE OR REPLACE FUNCTION public.current_user_agency_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT agency_id
  FROM public.profiles
  WHERE id = auth.uid();
$$;

-- PROFILES: Fix recursive policy by using the helper function
DROP POLICY IF EXISTS "Users can view profiles in same agency" ON public.profiles;
CREATE POLICY "Users can view profiles in same agency"
ON public.profiles
FOR SELECT
USING (agency_id = public.current_user_agency_id());

-- Keep existing own-profile policy as-is (relies only on id = auth.uid())
-- (No change to UPDATE policy)

-- AGENCIES: Replace subselect-based policies to avoid recursion
DROP POLICY IF EXISTS "Users can view their own agency" ON public.agencies;
CREATE POLICY "Users can view their own agency"
ON public.agencies
FOR SELECT
USING (id = public.current_user_agency_id());

DROP POLICY IF EXISTS "Users can update their own agency" ON public.agencies;
CREATE POLICY "Users can update their own agency"
ON public.agencies
FOR UPDATE
USING (id = public.current_user_agency_id());