-- ============================================================
-- Fix user_availability RLS so public slots are visible to all
-- authenticated users, not just the owner.
-- ============================================================

ALTER TABLE user_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_availability REPLICA IDENTITY FULL;

-- Drop any existing policies so we start clean
DROP POLICY IF EXISTS "Users can view their own availability" ON user_availability;
DROP POLICY IF EXISTS "Users can view public availability" ON user_availability;
DROP POLICY IF EXISTS "Users can insert their own availability" ON user_availability;
DROP POLICY IF EXISTS "Users can update their own availability" ON user_availability;
DROP POLICY IF EXISTS "Users can delete their own availability" ON user_availability;
DROP POLICY IF EXISTS "Authenticated users can view public availability" ON user_availability;

-- 1. Owner can see ALL their own slots (public + private)
CREATE POLICY "Users can view their own availability"
  ON user_availability FOR SELECT
  USING (auth.uid() = user_id);

-- 2. Any authenticated user can see PUBLIC slots from other users
CREATE POLICY "Authenticated users can view public availability"
  ON user_availability FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (privacy_level = 'public' OR privacy_level IS NULL)
  );

-- 3. Owner can insert their own slots
CREATE POLICY "Users can insert their own availability"
  ON user_availability FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 4. Owner can update their own slots
CREATE POLICY "Users can update their own availability"
  ON user_availability FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Owner can delete their own slots
CREATE POLICY "Users can delete their own availability"
  ON user_availability FOR DELETE
  USING (auth.uid() = user_id);

-- Also ensure the realtime publication includes this table
ALTER PUBLICATION supabase_realtime ADD TABLE user_availability;
