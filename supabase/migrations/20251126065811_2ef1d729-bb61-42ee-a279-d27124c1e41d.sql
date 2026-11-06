-- Create policy acknowledgments table
CREATE TABLE public.policy_acknowledgments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  privacy_policy_version text NOT NULL DEFAULT '2025-11-25',
  terms_version text NOT NULL DEFAULT '2025-11-25',
  acknowledged_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.policy_acknowledgments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can insert their own acknowledgment"
ON public.policy_acknowledgments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own acknowledgment"
ON public.policy_acknowledgments
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own acknowledgment"
ON public.policy_acknowledgments
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);