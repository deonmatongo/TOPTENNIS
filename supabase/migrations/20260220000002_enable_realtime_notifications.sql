-- Enable Realtime on the notifications table so postgres_changes subscriptions fire
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Ensure the type check constraint covers all notification types used in the app
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

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
    'match_scheduled',
    'match_result',
    'match_suggestion',
    'league_update',
    'achievement',
    'booking_confirmed',
    'booking_cancelled',
    'system_notification',
    'general'
  ));
