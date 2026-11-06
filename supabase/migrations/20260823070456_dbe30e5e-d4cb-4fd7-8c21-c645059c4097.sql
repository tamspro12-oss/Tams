-- 1. Hide SMTP password and license key from direct client reads
REVOKE SELECT (email_password, license_key) ON public.agencies FROM authenticated;
REVOKE SELECT (email_password, license_key) ON public.agencies FROM anon;

CREATE OR REPLACE FUNCTION public.agency_smtp_configured()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((
    SELECT email_password IS NOT NULL AND email_password <> ''
    FROM public.agencies
    WHERE id = public.current_user_agency_id()
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.get_agency_smtp_password()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.email_password
  FROM public.agencies a
  WHERE a.id = public.current_user_agency_id()
    AND NOT public.is_sub_user(auth.uid());
$$;

REVOKE ALL ON FUNCTION public.agency_smtp_configured() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_agency_smtp_password() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agency_smtp_configured() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_agency_smtp_password() TO authenticated;

-- 2. Storage: verify agency-files ownership against application data
DROP POLICY IF EXISTS "Users can view their own agency files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own agency files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own agency files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own agency files" ON storage.objects;

CREATE POLICY "Agency members can read their agency files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'agency-files'
  AND (
    EXISTS (
      SELECT 1 FROM public.files f
      WHERE f.path = storage.objects.name
        AND f.agency_id = public.current_user_agency_id()
    )
    OR (storage.foldername(name))[1] = public.current_user_agency_id()::text
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

CREATE POLICY "Agency members can upload agency files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'agency-files'
  AND public.current_user_agency_id() IS NOT NULL
  AND (
    (storage.foldername(name))[1] = public.current_user_agency_id()::text
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

CREATE POLICY "Agency members can update their agency files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'agency-files'
  AND (
    EXISTS (
      SELECT 1 FROM public.files f
      WHERE f.path = storage.objects.name
        AND f.agency_id = public.current_user_agency_id()
    )
    OR (storage.foldername(name))[1] = public.current_user_agency_id()::text
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

CREATE POLICY "Agency members can delete their agency files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'agency-files'
  AND (
    EXISTS (
      SELECT 1 FROM public.files f
      WHERE f.path = storage.objects.name
        AND f.agency_id = public.current_user_agency_id()
    )
    OR (storage.foldername(name))[1] = public.current_user_agency_id()::text
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);