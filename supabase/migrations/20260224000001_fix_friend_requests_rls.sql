-- ============================================================
-- Fix friend_requests RLS policies
-- The table was missing UPDATE/SELECT policies causing
-- "Failed to update friend request" errors
-- ============================================================

ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests REPLICA IDENTITY FULL;

-- Drop any existing policies first
DROP POLICY IF EXISTS "Users can view their own friend requests" ON friend_requests;
DROP POLICY IF EXISTS "Users can send friend requests" ON friend_requests;
DROP POLICY IF EXISTS "Users can update received friend requests" ON friend_requests;
DROP POLICY IF EXISTS "Users can delete their own friend requests" ON friend_requests;

-- 1. Users can see requests they sent OR received
CREATE POLICY "Users can view their own friend requests"
  ON friend_requests FOR SELECT
  USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

-- 2. Users can send friend requests (insert where they are the sender)
CREATE POLICY "Users can send friend requests"
  ON friend_requests FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- 3. Only the RECEIVER can accept or decline (update status)
--    Also allow sender to cancel (update) their own pending request
CREATE POLICY "Users can update received friend requests"
  ON friend_requests FOR UPDATE
  USING (
    auth.uid() = receiver_id OR auth.uid() = sender_id
  )
  WITH CHECK (
    auth.uid() = receiver_id OR auth.uid() = sender_id
  );

-- 4. Either party can delete the request
CREATE POLICY "Users can delete their own friend requests"
  ON friend_requests FOR DELETE
  USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

-- Ensure realtime works for friend_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'friend_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE friend_requests;
  END IF;
END $$;
