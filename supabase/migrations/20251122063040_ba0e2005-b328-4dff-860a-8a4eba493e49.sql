-- Create temporary email PDF storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tams-temp-email',
  'tams-temp-email',
  false,
  10485760, -- 10MB limit
  ARRAY['application/pdf']
);

-- RLS policy: users can only access their own temp files
CREATE POLICY "Users can manage their own temp email files"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'tams-temp-email' 
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'tams-temp-email'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Auto-cleanup policy: delete files older than 24 hours
CREATE POLICY "Auto delete temp files older than 24 hours"
ON storage.objects
FOR DELETE
TO service_role
USING (
  bucket_id = 'tams-temp-email'
  AND created_at < (now() - interval '24 hours')
);