-- ============================================================
-- Definitive fix for friend_requests UPDATE RLS
-- Drop ALL existing policies and recreate clean ones.
-- This resolves "Failed to update friend request" errors.
-- ============================================================

-- 1. Make sure RLS is on
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

-- 2. Drop every possible policy name (old and new) to start fresh
DROP POLICY IF EXISTS "Users can view their own friend requests"     ON friend_requests;
DROP POLICY IF EXISTS "Users can send friend requests"               ON friend_requests;
DROP POLICY IF EXISTS "Users can update received friend requests"    ON friend_requests;
DROP POLICY IF EXISTS "Users can delete their own friend requests"   ON friend_requests;
DROP POLICY IF EXISTS "Enable read for users"                        ON friend_requests;
DROP POLICY IF EXISTS "Enable insert for authenticated users"        ON friend_requests;
DROP POLICY IF EXISTS "Enable update for receiver"                   ON friend_requests;
DROP POLICY IF EXISTS "Enable delete for sender or receiver"         ON friend_requests;
DROP POLICY IF EXISTS "friend_requests_select_policy"                ON friend_requests;
DROP POLICY IF EXISTS "friend_requests_insert_policy"                ON friend_requests;
DROP POLICY IF EXISTS "friend_requests_update_policy"                ON friend_requests;
DROP POLICY IF EXISTS "friend_requests_delete_policy"                ON friend_requests;

-- 3. SELECT — sender or receiver can read
CREATE POLICY "friend_requests_select_policy"
  ON friend_requests FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- 4. INSERT — only the sender can create
CREATE POLICY "friend_requests_insert_policy"
  ON friend_requests FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- 5. UPDATE — sender OR receiver can update (accept/decline/cancel)
--    Using auth.uid() IS NOT NULL as a broad check; the .eq('id', x)
--    in the app query is the real filter. RLS just needs to allow it.
CREATE POLICY "friend_requests_update_policy"
  ON friend_requests FOR UPDATE
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- 6. DELETE — either party can remove
CREATE POLICY "friend_requests_delete_policy"
  ON friend_requests FOR DELETE
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- 7. Realtime
ALTER TABLE friend_requests REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'friend_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE friend_requests;
  END IF;
END $$;
