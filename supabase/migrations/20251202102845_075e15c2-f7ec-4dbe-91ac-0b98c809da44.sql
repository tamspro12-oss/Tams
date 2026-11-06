-- Create a function to get active session counts for all users
-- This function has SECURITY DEFINER to allow querying auth schema
CREATE OR REPLACE FUNCTION public.get_active_session_counts()
RETURNS TABLE (user_id uuid, session_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT 
    user_id,
    COUNT(*)::bigint as session_count
  FROM auth.sessions
  WHERE (not_after IS NULL OR not_after > NOW())
  GROUP BY user_id
$$;