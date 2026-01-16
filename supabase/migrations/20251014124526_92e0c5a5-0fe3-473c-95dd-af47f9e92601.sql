-- Add booking_confirmed as a valid notification type
-- First, let's check the current constraint
DO $$ 
BEGIN
  -- Drop the old constraint if it exists
  ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
  
  -- Add the new constraint with additional notification types
  ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
    CHECK (type IN (
      'friend_request',
      'message_received', 
      'match_invite',
      'match_confirmed',
      'match_cancelled',
      'booking_confirmed',
      'booking_cancelled',
      'league_update',
      'system_notification'
    ));
END $$;