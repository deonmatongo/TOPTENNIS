-- Enable realtime for user_availability table
ALTER TABLE user_availability REPLICA IDENTITY FULL;

-- Add the table to the realtime publication (if not already there)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'user_availability'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE user_availability;
  END IF;
END $$;