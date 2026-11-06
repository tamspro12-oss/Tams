-- Make agency_id nullable so admins can create users first, then assign agency later
ALTER TABLE public.profiles ALTER COLUMN agency_id DROP NOT NULL;

-- Update the trigger to handle null agency_id gracefully
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, agency_id, full_name)
  VALUES (
    NEW.id,
    (NEW.raw_user_meta_data->>'agency_id')::UUID,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;