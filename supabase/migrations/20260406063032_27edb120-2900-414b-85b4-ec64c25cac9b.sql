CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_agency_id UUID;
  agency_name TEXT;
  plan TEXT;
  duration_days INT;
  is_free BOOLEAN;
BEGIN
  -- Get values from user metadata
  agency_name := COALESCE(NEW.raw_user_meta_data->>'agency_name', 'My Agency');
  plan := LOWER(COALESCE(NEW.raw_user_meta_data->>'subscription_plan', 'free'));
  
  -- Determine duration
  IF plan = 'yearly' THEN
    duration_days := 370;
    is_free := false;
  ELSIF plan = 'monthly' THEN
    duration_days := 32;
    is_free := false;
  ELSE
    plan := 'free';
    duration_days := 14;
    is_free := true;
  END IF;

  -- Create a new agency for the user
  INSERT INTO public.agencies (
    name, license_key, subscription_plan,
    license_expiry, license_status, license_active
  )
  VALUES (
    agency_name,
    'KEY-' || substr(md5(random()::text), 1, 8),
    plan,
    NOW() + (duration_days || ' days')::interval,
    CASE WHEN is_free THEN 'active' ELSE 'pending_payment' END,
    is_free
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