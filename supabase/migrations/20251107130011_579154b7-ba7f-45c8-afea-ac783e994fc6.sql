-- Fix Function Search Path Mutable warnings
-- Add SET search_path = public to all functions that don't have it

-- Function 1: generate_membership_id
CREATE OR REPLACE FUNCTION public.generate_membership_id()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  new_id TEXT;
  exists_check INTEGER;
BEGIN
  LOOP
    new_id := 'TL-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    SELECT COUNT(*) INTO exists_check 
    FROM public.profiles 
    WHERE membership_id = new_id;
    IF exists_check = 0 THEN
      EXIT;
    END IF;
  END LOOP;
  RETURN new_id;
END;
$function$;

-- Function 2: update_bookings_updated_at
CREATE OR REPLACE FUNCTION public.update_bookings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Function 3: update_friend_requests_updated_at
CREATE OR REPLACE FUNCTION public.update_friend_requests_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Function 4: update_calendar_events_updated_at
CREATE OR REPLACE FUNCTION public.update_calendar_events_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- Function 5: update_match_responses_updated_at
CREATE OR REPLACE FUNCTION public.update_match_responses_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Function 6: validate_password_strength
CREATE OR REPLACE FUNCTION public.validate_password_strength(password text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  result JSONB := '{"valid": true, "errors": []}'::JSONB;
  errors TEXT[] := '{}';
BEGIN
  IF LENGTH(password) < 8 THEN
    errors := array_append(errors, 'Password must be at least 8 characters long');
  END IF;
  IF password !~ '[A-Z]' THEN
    errors := array_append(errors, 'Password must contain at least one uppercase letter');
  END IF;
  IF password !~ '[a-z]' THEN
    errors := array_append(errors, 'Password must contain at least one lowercase letter');
  END IF;
  IF password !~ '[0-9]' THEN
    errors := array_append(errors, 'Password must contain at least one number');
  END IF;
  IF password !~ '[!@#$%^&*(),.?":{}|<>]' THEN
    errors := array_append(errors, 'Password must contain at least one special character');
  END IF;
  IF array_length(errors, 1) > 0 THEN
    result := jsonb_build_object('valid', false, 'errors', errors);
  END IF;
  RETURN result;
END;
$function$;