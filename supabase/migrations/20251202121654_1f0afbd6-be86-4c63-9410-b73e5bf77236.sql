-- Fix sub_users RLS policies that reference auth.users and cause permission errors

-- Drop problematic Super Admin policies that directly query auth.users
DROP POLICY IF EXISTS "Super Admin can manage all sub users" ON public.sub_users;
DROP POLICY IF EXISTS "Super Admin can view all sub users" ON public.sub_users;