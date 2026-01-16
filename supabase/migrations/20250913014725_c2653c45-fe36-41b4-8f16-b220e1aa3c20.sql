-- Fix the handle_new_user function to properly generate membership ID
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  new_membership_id TEXT;
BEGIN
  -- Generate membership ID once
  SELECT public.generate_membership_id() INTO new_membership_id;
  
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
    new_membership_id
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
    jsonb_build_object(
      'email', NEW.email, 
      'created_at', NEW.created_at, 
      'membership_id', new_membership_id
    )
  );
  
  RETURN NEW;
END;
$$;

-- Create the trigger to automatically generate membership ID for new users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Generate membership IDs for existing users who don't have one
UPDATE public.profiles 
SET membership_id = public.generate_membership_id()
WHERE membership_id IS NULL OR membership_id = '';

-- Create a function to regenerate membership ID if needed (for admin use)
CREATE OR REPLACE FUNCTION public.regenerate_membership_id(user_uuid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id TEXT;
BEGIN
  -- Generate new membership ID
  SELECT public.generate_membership_id() INTO new_id;
  
  -- Update the user's profile
  UPDATE public.profiles 
  SET membership_id = new_id, updated_at = NOW()
  WHERE id = user_uuid;
  
  RETURN new_id;
END;
$$;