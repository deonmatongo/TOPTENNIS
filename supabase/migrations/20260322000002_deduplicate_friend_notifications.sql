-- ============================================================
-- Enforce notification deduplication at the database level
-- for friend_request and friend_accepted notifications.
--
-- friend_request: one row per (recipient, sender)
--   keyed on: user_id + metadata->>'sender_id'
--
-- friend_accepted: one row per (sender, request)
--   keyed on: user_id + metadata->>'request_id'
--
-- These partial unique indexes guarantee that even if the
-- client-side idempotency check races (e.g. two rapid
-- button presses), the DB will reject the duplicate INSERT
-- and the transaction will fail gracefully.
-- ============================================================

-- Deduplicate incoming friend request notifications
CREATE UNIQUE INDEX IF NOT EXISTS uniq_notifications_friend_request
  ON notifications (user_id, (metadata->>'sender_id'))
  WHERE type = 'friend_request'
    AND metadata->>'sender_id' IS NOT NULL;

-- Deduplicate friend-accepted notifications
CREATE UNIQUE INDEX IF NOT EXISTS uniq_notifications_friend_accepted
  ON notifications (user_id, (metadata->>'request_id'))
  WHERE type = 'friend_accepted'
    AND metadata->>'request_id' IS NOT NULL;
