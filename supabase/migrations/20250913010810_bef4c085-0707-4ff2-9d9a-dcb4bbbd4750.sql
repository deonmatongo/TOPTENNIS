-- Add networking preferences to profiles table
ALTER TABLE public.profiles 
ADD COLUMN networking_enabled BOOLEAN NOT NULL DEFAULT true;

-- Add comment explaining the column
COMMENT ON COLUMN public.profiles.networking_enabled IS 'Controls whether other players can send connection requests to this user';