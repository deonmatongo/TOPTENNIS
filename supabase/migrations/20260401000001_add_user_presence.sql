-- ============================================================
-- Add user_presence table for reliable online status tracking.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_presence (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

-- Create policies only if they don't already exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_presence' AND policyname = 'view_presence'
  ) THEN
    CREATE POLICY "view_presence" ON user_presence
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_presence' AND policyname = 'insert_own_presence'
  ) THEN
    CREATE POLICY "insert_own_presence" ON user_presence
      FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_presence' AND policyname = 'update_own_presence'
  ) THEN
    CREATE POLICY "update_own_presence" ON user_presence
      FOR UPDATE TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;

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
