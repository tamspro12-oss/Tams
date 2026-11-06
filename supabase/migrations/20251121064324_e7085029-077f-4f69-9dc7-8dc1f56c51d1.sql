-- Add subscription and storage fields to agencies
ALTER TABLE public.agencies 
ADD COLUMN IF NOT EXISTS subscription_plan text DEFAULT 'free' CHECK (subscription_plan IN ('free', 'monthly', 'yearly')),
ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS max_storage_bytes bigint DEFAULT 1073741824, -- 1GB default
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id);

-- Create files tracking table
CREATE TABLE IF NOT EXISTS public.files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  path text NOT NULL,
  filename text NOT NULL,
  size_bytes bigint NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  is_temporary boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone
);

-- Enable RLS on files table
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for files
CREATE POLICY "Users can view files in their agency"
ON public.files
FOR SELECT
USING (agency_id IN (
  SELECT agency_id FROM profiles WHERE id = auth.uid()
));

CREATE POLICY "Users can insert files in their agency"
ON public.files
FOR INSERT
WITH CHECK (
  agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND uploaded_by = auth.uid()
);

CREATE POLICY "Admins can delete files"
ON public.files
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Function to get agency storage usage
CREATE OR REPLACE FUNCTION public.get_agency_storage_usage(p_agency_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(size_bytes), 0)
  FROM public.files
  WHERE agency_id = p_agency_id
    AND (is_temporary = false OR expires_at > now());
$$;

-- Function to check if agency can upload file
CREATE OR REPLACE FUNCTION public.can_upload_file(
  p_agency_id uuid,
  p_file_size bigint
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    SELECT max_storage_bytes FROM public.agencies WHERE id = p_agency_id
  ) >= (
    public.get_agency_storage_usage(p_agency_id) + p_file_size
  );
$$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_files_agency_id ON public.files(agency_id);
CREATE INDEX IF NOT EXISTS idx_files_expires_at ON public.files(expires_at) WHERE is_temporary = true;
CREATE INDEX IF NOT EXISTS idx_agencies_approval_status ON public.agencies(approval_status);