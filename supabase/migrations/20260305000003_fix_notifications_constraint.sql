-- ============================================================
-- Widen notifications_type_check to include all types used
-- across the codebase. The old constraint caused the
-- create_group_chat RPC to fail entirely because the
-- notification INSERT for 'group_invite' violated the CHECK,
-- rolling back the whole transaction.
-- ============================================================

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

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
  'match_rescheduled',
  'match_confirmed',
  'match_scheduled',
  'match_result',
  'match_suggestion',
  'league_update',
  'achievement',
  'group_invite',
  'general',
  'system'
]::text[]));
