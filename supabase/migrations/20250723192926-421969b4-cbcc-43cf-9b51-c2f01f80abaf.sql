-- Add profileCompleted boolean flag to profiles table
ALTER TABLE public.profiles 
ADD COLUMN profile_completed BOOLEAN NOT NULL DEFAULT false;

-- Update existing profiles that have corresponding player records to mark as completed
UPDATE public.profiles 
SET profile_completed = true 
WHERE id IN (
  SELECT DISTINCT user_id 
  FROM public.players 
  WHERE user_id IS NOT NULL
);

-- Add unique constraint on email for profiles table (if not already exists)
-- This ensures email uniqueness at the database level
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_email_unique UNIQUE (email) 
DEFERRABLE INITIALLY DEFERRED;

-- Add email column to profiles if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'profiles' 
                 AND column_name = 'email' 
                 AND table_schema = 'public') THEN
    ALTER TABLE public.profiles ADD COLUMN email TEXT;
  END IF;
END $$;

-- Update handle_new_user function to include email from auth.users
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
    email,
    is_active,
    profile_completed
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.email,
    true,
    false
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