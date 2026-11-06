-- Remove approval workflow columns from agencies table
ALTER TABLE public.agencies 
DROP COLUMN IF EXISTS approval_status,
DROP COLUMN IF EXISTS approved_at,
DROP COLUMN IF EXISTS approved_by;

-- Update handle_new_user trigger to remove approval logic
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_agency_id UUID;
  agency_name TEXT;
BEGIN
  -- Get agency name from user metadata
  agency_name := COALESCE(NEW.raw_user_meta_data->>'agency_name', 'My Agency');
  
  -- Create a new agency for the user (without approval status)
  INSERT INTO public.agencies (name, license_key, license_status, license_active)
  VALUES (
    agency_name,
    'KEY-' || substr(md5(random()::text), 1, 8),
    'active',
    true
  )
  RETURNING id INTO new_agency_id;
  
  -- Insert profile with the new agency
  INSERT INTO public.profiles (id, agency_id, full_name)
  VALUES (
    NEW.id,
    new_agency_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  
  RETURN NEW;
END;
$function$;