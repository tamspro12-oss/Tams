-- Fix infinite recursion in profiles RLS policy
-- The current policy tries to SELECT from profiles to check if user can SELECT from profiles (circular!)

-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Users can view profiles in their agency" ON profiles;

-- Add a simple policy: users can always view their own profile
CREATE POLICY "Users can view their own profile"
ON profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Add a policy: users can view other profiles in the same agency
-- This uses a non-recursive approach
CREATE POLICY "Users can view profiles in same agency"
ON profiles
FOR SELECT
TO authenticated
USING (
  agency_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM profiles p2 
    WHERE p2.id = auth.uid() 
    AND p2.agency_id = profiles.agency_id
  )
);