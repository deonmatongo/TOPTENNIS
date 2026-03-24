-- ============================================================
-- Drop the notify_friend_request() DB trigger and function.
--
-- This trigger was created manually in the Supabase dashboard
-- (not tracked in migrations).  It has two known defects:
--
--   1. It inserts a second "friend_request" notification for
--      the receiver on every friend_requests INSERT, duplicating
--      the notification the client already inserts via
--      insert_notification_safe → receiver sees two alerts.
--
--   2. It inserts a spurious "message_received" (or legacy
--      messages row) addressed to the *sender*, so the sender
--      receives a "New Message" notification immediately after
--      sending a request.
--
-- The client (useFriendRequests.ts → sendFriendRequest) now
-- owns the entire notification dispatch via insert_notification_safe,
-- which is idempotent thanks to the unique partial index
-- uniq_notifications_friend_request.  The trigger is no longer
-- needed and must be removed to stop the duplicates.
-- ============================================================

-- Drop any trigger on friend_requests that uses notify_friend_request()
-- (trigger name varies depending on how it was created in the dashboard).
DO $$
DECLARE
  trig_name text;
BEGIN
  FOR trig_name IN
    SELECT t.trigger_name
    FROM information_schema.triggers t
    WHERE t.event_object_schema = 'public'
      AND t.event_object_table  = 'friend_requests'
      AND t.action_statement    ILIKE '%notify_friend_request%'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.friend_requests', trig_name);
    RAISE NOTICE 'Dropped trigger % on friend_requests', trig_name;
  END LOOP;
END;
$$;

-- Drop the function itself (CASCADE covers any remaining trigger references)
DROP FUNCTION IF EXISTS public.notify_friend_request() CASCADE;
