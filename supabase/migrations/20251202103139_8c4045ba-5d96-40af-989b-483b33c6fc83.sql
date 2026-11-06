-- Create function to get active sessions for a specific user
CREATE OR REPLACE FUNCTION public.get_user_active_sessions(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  user_agent text,
  ip text,
  not_after timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT 
    id,
    created_at,
    user_agent,
    ip::text,
    not_after
  FROM auth.sessions
  WHERE user_id = p_user_id
    AND (not_after IS NULL OR not_after > NOW())
  ORDER BY created_at DESC
$$;

-- Create function to delete all sessions for a user
CREATE OR REPLACE FUNCTION public.delete_all_user_sessions(p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  DELETE FROM auth.sessions
  WHERE user_id = p_user_id
$$;

-- Create function to delete a specific session (only if it belongs to the user)
CREATE OR REPLACE FUNCTION public.delete_user_session(p_user_id uuid, p_session_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  DELETE FROM auth.sessions
  WHERE id = p_session_id
    AND user_id = p_user_id
$$;
