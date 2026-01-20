-- Add preferred_timezone column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_timezone TEXT DEFAULT 'America/New_York';

-- Add comment
COMMENT ON COLUMN profiles.preferred_timezone IS 'User''s preferred timezone for displaying times in the calendar';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_preferred_timezone ON profiles(preferred_timezone);
