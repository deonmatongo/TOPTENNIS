-- Fix notification types constraint
-- Run this in your Supabase SQL Editor to fix the "notifications_type_check" constraint violation

-- Drop the old constraint
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

-- Verify the constraint was added
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'notifications_type_check';
