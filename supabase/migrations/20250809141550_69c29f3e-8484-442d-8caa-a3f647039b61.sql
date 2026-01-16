-- Update the handle_new_user function to generate membership ID
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id, 
    first_name, 
    last_name,
    email,
    phone,
    is_active,
    profile_completed,
    membership_id
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.email,
    NEW.raw_user_meta_data ->> 'phone',
    true,
    false,
    generate_membership_id()
  );
  
  -- Log the registration activity
  INSERT INTO public.user_activity_log (
    user_id,
    activity_type,
    metadata
  )
  VALUES (
    NEW.id,
    'user_registered',
    jsonb_build_object('email', NEW.email, 'created_at', NEW.created_at, 'membership_id', generate_membership_id())
  );
  
  RETURN NEW;
END;
$function$;