-- ============================================
-- TIMEZONE FEATURE - SQL SETUP QUERIES
-- Run these queries in Supabase SQL Editor
-- ============================================

-- 1. Add preferred_timezone column to profiles table
-- This stores each user's timezone preference
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS preferred_timezone TEXT DEFAULT 'America/New_York';

-- 2. Add comment to document the column
COMMENT ON COLUMN profiles.preferred_timezone IS 
'User''s preferred timezone for displaying times in the calendar (IANA timezone identifier)';

-- 3. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_preferred_timezone 
ON profiles(preferred_timezone);

-- 4. Verify the column was added (optional - for testing)
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'profiles' AND column_name = 'preferred_timezone';

-- 5. Update RLS (Row Level Security) policies if needed
-- The existing policies should already allow users to update their own profiles
-- But if you get permission errors, you may need to update the policy:

-- Check existing policies:
-- SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- If needed, update the policy to allow timezone updates:
-- DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
-- CREATE POLICY "Users can update own profile" ON profiles
--   FOR UPDATE
--   USING (auth.uid() = id)
--   WITH CHECK (auth.uid() = id);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check if column exists
SELECT EXISTS (
  SELECT 1 
  FROM information_schema.columns 
  WHERE table_name = 'profiles' 
  AND column_name = 'preferred_timezone'
) AS column_exists;

-- View all timezones currently set by users
-- SELECT id, email, preferred_timezone 
-- FROM profiles 
-- WHERE preferred_timezone IS NOT NULL;

-- ============================================
-- NOTES
-- ============================================

-- Default timezone: America/New_York (Eastern Time)
-- Supported timezones include:
--   - America/New_York (Eastern)
--   - America/Chicago (Central)
--   - America/Denver (Mountain)
--   - America/Los_Angeles (Pacific)
--   - America/Anchorage (Alaska)
--   - Pacific/Honolulu (Hawaii)
--   - And more US timezone variants

-- After running these queries:
-- 1. Timezone preferences will be saved to database
-- 2. Users can change timezone and it persists across devices
-- 3. No more TypeScript errors about preferred_timezone
-- 4. Feature works exactly as designed

-- ============================================
-- ROLLBACK (if needed)
-- ============================================

-- To remove the timezone feature:
-- DROP INDEX IF EXISTS idx_profiles_preferred_timezone;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS preferred_timezone;
