-- ============================================================
-- Fix 1: REPLICA IDENTITY FULL on messages table
-- Without this, filtered postgres_changes subscriptions
-- (receiver_id=eq.<id>) silently drop events.
-- ============================================================
ALTER TABLE messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
END $$;

-- ============================================================
-- Fix 2: Notifications INSERT policy
-- The previous policy only allowed inserting when
-- auth.uid() = user_id, blocking the sender from creating
-- notifications FOR the receiver (a different user_id).
-- Replace it with: any authenticated user can insert for any user.
-- SELECT/UPDATE/DELETE remain restricted to own rows only.
-- ============================================================

DROP POLICY IF EXISTS "Users can insert their own notifications" ON notifications;
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON notifications;

CREATE POLICY "Authenticated users can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
