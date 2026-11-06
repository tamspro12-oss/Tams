
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
BEGIN
  agency_name := COALESCE(NEW.raw_user_meta_data->>'agency_name', 'My Agency');
  plan := LOWER(COALESCE(NEW.raw_user_meta_data->>'subscription_plan', 'free'));
  
  IF plan NOT IN ('free', 'monthly', 'yearly') THEN
    plan := 'free';
  END IF;

  -- All plans get 14-day free trial, active immediately
  INSERT INTO public.agencies (
    name, license_key, subscription_plan,
    license_expiry, license_status, license_active
  )
  VALUES (
    agency_name,
    'KEY-' || substr(md5(random()::text), 1, 8),
    plan,
    NOW() + INTERVAL '14 days',
    'active',
    true
  )
  RETURNING id INTO new_agency_id;
  
  INSERT INTO public.profiles (id, agency_id, full_name)
  VALUES (
    NEW.id,
    new_agency_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  
  RETURN NEW;
END;
$function$;
