-- ============================================================
-- Fix notifications_type_check constraint
-- The old constraint only allowed 'friend_request' and
-- 'message_received', causing the notify_friend_request()
-- trigger to fail when inserting 'friend_accepted' type.
-- ============================================================

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

UPDATE notifications 
SET type = 'system' 
WHERE type NOT IN (
  'message_received',
  'friend_request',
  'friend_accepted',
  'friend_declined',
  'match_invite',
  'match_accepted',
  'match_declined',
  'match_cancelled',
  'league_update',
  'system'
);

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
CHECK (type = ANY (ARRAY[
  'message_received',
  'friend_request',
  'friend_accepted',
  'friend_declined',
  'match_invite',
  'match_accepted',
  'match_declined',
  'match_cancelled',
  'league_update',
  'system'
]::text[]));
