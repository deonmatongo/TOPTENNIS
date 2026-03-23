-- ============================================================
-- Notification deduplication: unique partial indexes for all
-- match-related notification types, and a safe insert RPC.
--
-- Existing indexes already cover friend_request + friend_accepted
-- (migration 20260322000002). This migration extends coverage to:
--   match_invite, match_accepted, match_declined, match_cancelled
--
-- insert_notification_safe(): idempotent client-callable RPC that
-- silently ignores duplicate inserts instead of raising an error.
-- ============================================================

-- One match_invite notification per (recipient, match, sender)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_notifications_match_invite
  ON notifications (user_id, (metadata->>'match_id'), (metadata->>'sender_id'))
  WHERE type = 'match_invite'
    AND metadata->>'match_id' IS NOT NULL
    AND metadata->>'sender_id' IS NOT NULL;

-- One match_accepted notification per (recipient, match)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_notifications_match_accepted
  ON notifications (user_id, (metadata->>'match_id'))
  WHERE type = 'match_accepted'
    AND metadata->>'match_id' IS NOT NULL;

-- One match_declined notification per (recipient, match)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_notifications_match_declined
  ON notifications (user_id, (metadata->>'match_id'))
  WHERE type = 'match_declined'
    AND metadata->>'match_id' IS NOT NULL;

-- One match_cancelled notification per (recipient, match)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_notifications_match_cancelled
  ON notifications (user_id, (metadata->>'match_id'))
  WHERE type = 'match_cancelled'
    AND metadata->>'match_id' IS NOT NULL;

-- ── Safe insert RPC ────────────────────────────────────────────────────────
-- Inserts a notification and silently discards the insert if a unique
-- constraint would be violated.  Client callers never need to check for
-- duplicate-notification errors; they can fire-and-forget.
--
-- Usage (TypeScript):
--   await supabase.rpc('insert_notification_safe', {
--     p_user_id:    '...',
--     p_type:       'match_invite',
--     p_title:      'New Match Invitation',
--     p_message:    '...',
--     p_action_url: '/dashboard?tab=schedule',
--     p_metadata:   { match_id: '...', sender_id: '...' },
--   });
CREATE OR REPLACE FUNCTION insert_notification_safe(
  p_user_id     uuid,
  p_type        text,
  p_title       text,
  p_message     text,
  p_action_url  text  DEFAULT NULL,
  p_metadata    jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, message, read, action_url, metadata)
  VALUES (p_user_id, p_type::text, p_title, p_message, false, p_action_url, p_metadata)
  ON CONFLICT DO NOTHING;
EXCEPTION
  WHEN unique_violation THEN
    -- Unique index hit: this is an expected duplicate — discard silently.
    NULL;
END;
$$;
