-- ============================================================
-- Add user_presence table for reliable online status tracking.
-- Replaces Supabase Realtime Presence (which requires a separate
-- dashboard toggle) with postgres_changes, which is already
-- used and confirmed working for notifications.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_presence (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view all presence records
CREATE POLICY "view_presence" ON user_presence
  FOR SELECT TO authenticated USING (true);

-- Users can only insert their own presence
CREATE POLICY "insert_own_presence" ON user_presence
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Users can only update their own presence
CREATE POLICY "update_own_presence" ON user_presence
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Enable full row data in realtime payloads
ALTER TABLE user_presence REPLICA IDENTITY FULL;

-- Add to realtime publication
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_presence'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE user_presence;
  END IF;
END $$;
