
-- Add email verification status to profiles table (if not already exists)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT,
ADD COLUMN IF NOT EXISTS location VARCHAR(100),
ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'en';

-- Create password reset tokens table for enhanced security
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '1 hour'),
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on password reset tokens
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies for password reset tokens
CREATE POLICY "Users can view their own reset tokens" 
  ON public.password_reset_tokens 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can insert reset tokens" 
  ON public.password_reset_tokens 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Users can update their own reset tokens" 
  ON public.password_reset_tokens 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Create user activity log table for security tracking
CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user activity log
ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

-- Create policies for user activity log
CREATE POLICY "Users can view their own activity" 
  ON public.user_activity_log 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert activity logs" 
  ON public.user_activity_log 
  FOR INSERT 
  WITH CHECK (true);

-- Create function for password strength validation
CREATE OR REPLACE FUNCTION validate_password_strength(password TEXT)
RETURNS JSONB AS $$
DECLARE
  result JSONB := '{"valid": true, "errors": []}'::JSONB;
  errors TEXT[] := '{}';
BEGIN
  -- Check minimum length
  IF LENGTH(password) < 8 THEN
    errors := array_append(errors, 'Password must be at least 8 characters long');
  END IF;
  
  -- Check for uppercase letter
  IF password !~ '[A-Z]' THEN
    errors := array_append(errors, 'Password must contain at least one uppercase letter');
  END IF;
  
  -- Check for lowercase letter
  IF password !~ '[a-z]' THEN
    errors := array_append(errors, 'Password must contain at least one lowercase letter');
  END IF;
  
  -- Check for number
  IF password !~ '[0-9]' THEN
    errors := array_append(errors, 'Password must contain at least one number');
  END IF;
  
  -- Check for special character
  IF password !~ '[!@#$%^&*(),.?":{}|<>]' THEN
    errors := array_append(errors, 'Password must contain at least one special character');
  END IF;
  
  -- Update result
  IF array_length(errors, 1) > 0 THEN
    result := jsonb_build_object('valid', false, 'errors', errors);
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Update the handle_new_user function to include additional profile fields
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
    email_verified,
    is_active
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
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
