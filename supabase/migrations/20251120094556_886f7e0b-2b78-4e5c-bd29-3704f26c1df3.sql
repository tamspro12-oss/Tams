-- Create storage bucket for agency lightweight data
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'agency-files',
  'agency-files',
  false,
  5242880, -- 5MB limit per file
  ARRAY['application/json', 'text/plain']::text[]
);

-- RLS policies for agency-files bucket
CREATE POLICY "Users can view their own agency files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'agency-files' AND
  (storage.foldername(name))[1] = (
    SELECT REPLACE(REPLACE(auth.email(), '@', '-'), '.', '-')
    FROM auth.users
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can upload their own agency files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'agency-files' AND
  (storage.foldername(name))[1] = (
    SELECT REPLACE(REPLACE(auth.email(), '@', '-'), '.', '-')
    FROM auth.users
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update their own agency files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'agency-files' AND
  (storage.foldername(name))[1] = (
    SELECT REPLACE(REPLACE(auth.email(), '@', '-'), '.', '-')
    FROM auth.users
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own agency files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'agency-files' AND
  (storage.foldername(name))[1] = (
    SELECT REPLACE(REPLACE(auth.email(), '@', '-'), '.', '-')
    FROM auth.users
    WHERE id = auth.uid()
  )
);