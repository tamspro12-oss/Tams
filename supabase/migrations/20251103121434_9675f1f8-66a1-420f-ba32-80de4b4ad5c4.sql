-- Fix infinite recursion in profiles RLS policy
-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Users can view profiles in same agency" ON profiles;

-- Create a simpler policy that doesn't cause recursion
-- This policy allows users to view profiles in their agency by checking agency_id directly
CREATE POLICY "Users can view profiles in same agency" ON profiles
  FOR SELECT
  USING (
    agency_id IN (
      SELECT agency_id 
      FROM profiles 
      WHERE id = auth.uid()
      LIMIT 1
    )
  );