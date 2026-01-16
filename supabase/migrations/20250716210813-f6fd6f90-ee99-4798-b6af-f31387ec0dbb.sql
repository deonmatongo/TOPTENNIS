
-- Remove email verification functionality from database

-- Drop the email_verification_codes table
DROP TABLE IF EXISTS public.email_verification_codes CASCADE;

-- Remove email verification related columns and functions
DROP FUNCTION IF EXISTS public.create_verification_code(text, uuid);
DROP FUNCTION IF EXISTS public.generate_verification_code();

-- Update profiles table to remove email_verified column since we're not using email verification
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email_verified;

-- Update the handle_new_user function to remove email verification logic
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    first_name, 
    last_name,
    is_active
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    true
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
    jsonb_build_object('email', NEW.email, 'created_at', NEW.created_at)
  );
  
  RETURN NEW;
END;
$$;
