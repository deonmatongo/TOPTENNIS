-- ============================================================
-- Enable REPLICA IDENTITY FULL on conversation tables so that
-- filtered Supabase realtime subscriptions (user_id=eq.<id>)
-- receive events even when rows are inserted by SECURITY
-- DEFINER RPCs (which run as the table owner, not auth.uid()).
-- Without REPLICA IDENTITY FULL the old row values are missing
-- and Supabase drops filtered change events silently.
-- ============================================================

ALTER TABLE conversations          REPLICA IDENTITY FULL;
ALTER TABLE conversation_members   REPLICA IDENTITY FULL;
ALTER TABLE conversation_messages  REPLICA IDENTITY FULL;

-- Ensure all three tables are in the realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversation_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversation_members;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversation_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversation_messages;
  END IF;
END $$;
