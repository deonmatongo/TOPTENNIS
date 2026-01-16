-- Add missing notification types to the notifications_type_check constraint
-- This fixes the error: new row for relation "notifications" violates check constraint "notifications_type_check"

DO $$ 
BEGIN
  -- Drop the old constraint if it exists
  ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
  
  -- Add the new constraint with all required notification types
  ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
    CHECK (type IN (
      'friend_request',
      'message_received', 
      'match_invite',
      'match_confirmed',
      'match_cancelled',
      'match_accepted',
      'match_declined',
      'match_rescheduled',
      'booking_confirmed',
      'booking_cancelled',
      'league_update',
      'system_notification'
    ));
END $$;
