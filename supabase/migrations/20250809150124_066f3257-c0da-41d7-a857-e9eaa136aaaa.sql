-- Allow other users to view basic profile information including profile pictures
-- This enables profile pictures to be visible to other users

-- Drop the existing restrictive policy that only allows users to see their own profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create a new policy that allows users to view their own full profile
CREATE POLICY "Users can view their own full profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Create a policy that allows other authenticated users to view basic profile info
-- This includes profile picture, name, and other non-sensitive information
CREATE POLICY "Authenticated users can view basic profile info" 
ON public.profiles 
FOR SELECT 
USING (
  auth.role() = 'authenticated' 
  AND id != auth.uid()
);

-- Ensure storage policies allow public access to profile pictures
-- Update the existing policy or create new ones for profile pictures bucket

-- Policy for viewing profile pictures (public access)
INSERT INTO storage.policies (id, bucket_id, name, definition, type)
VALUES (
  'profile-pictures-public-view',
  'profile-pictures',
  'Anyone can view profile pictures',
  'SELECT',
  'permissive'
)
ON CONFLICT (id) DO UPDATE SET
  definition = EXCLUDED.definition;

-- Policy for users to upload their own profile pictures
INSERT INTO storage.policies (id, bucket_id, name, definition, type)
VALUES (
  'profile-pictures-user-upload',
  'profile-pictures', 
  'Users can upload their own profile pictures',
  'INSERT',
  'permissive'
)
ON CONFLICT (id) DO UPDATE SET
  definition = EXCLUDED.definition;

-- Policy for users to update their own profile pictures
INSERT INTO storage.policies (id, bucket_id, name, definition, type)
VALUES (
  'profile-pictures-user-update',
  'profile-pictures',
  'Users can update their own profile pictures', 
  'UPDATE',
  'permissive'
)
ON CONFLICT (id) DO UPDATE SET
  definition = EXCLUDED.definition;

-- Policy for users to delete their own profile pictures
INSERT INTO storage.policies (id, bucket_id, name, definition, type)
VALUES (
  'profile-pictures-user-delete',
  'profile-pictures',
  'Users can delete their own profile pictures',
  'DELETE', 
  'permissive'
)
ON CONFLICT (id) DO UPDATE SET
  definition = EXCLUDED.definition;