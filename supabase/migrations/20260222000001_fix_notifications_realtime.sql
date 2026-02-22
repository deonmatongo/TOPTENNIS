-- ============================================================
-- Fix real-time notifications: REPLICA IDENTITY + RLS policies
-- ============================================================

-- 1. Ensure the table is in the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- 2. Set REPLICA IDENTITY FULL so filtered postgres_changes
--    subscriptions (filter: user_id=eq.<id>) actually fire.
--    Without this, Supabase Realtime cannot match the filter
--    and silently drops the event.
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- 3. Enable Row Level Security (required for Realtime to work)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 4. Drop any stale policies before recreating
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
DROP POLICY IF EXISTS "Service role can manage all notifications" ON notifications;

-- 5. SELECT — users can only read their own notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- 6. INSERT — authenticated users can create notifications
--    (needed for the app to insert notifications for other users via service role,
--     but also allows self-inserts for testing)
CREATE POLICY "Users can insert their own notifications"
  ON notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 7. UPDATE — users can mark their own notifications as read
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 8. DELETE — users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- 9. Service role bypass (for server-side notification inserts to other users)
CREATE POLICY "Service role can manage all notifications"
  ON notifications FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
