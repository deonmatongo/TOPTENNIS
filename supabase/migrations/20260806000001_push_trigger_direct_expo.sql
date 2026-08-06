-- Optimise push delivery: call Expo Push API directly from the trigger
-- instead of going trigger → Edge Function → Expo.
--
-- This eliminates the Edge Function cold-start penalty (0–2 s) and the
-- extra HTTP round-trip, cutting the DB-insert→device path from
-- ~3–5 s down to ~1–2 s.
--
-- The Edge Function (send-push) is kept deployed for manual / ad-hoc use
-- but is no longer in the hot path.

CREATE OR REPLACE FUNCTION public.notify_push_on_notification_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_push_token      TEXT;
  v_push_enabled    BOOLEAN := TRUE;
  v_category_ok     BOOLEAN := TRUE;
  v_category_col    TEXT;
  v_payload         JSONB;
BEGIN
  -- 1. Fast exit: no push token = nothing to do
  SELECT push_token INTO v_push_token
  FROM   profiles
  WHERE  id = NEW.user_id;

  IF v_push_token IS NULL THEN
    RETURN NEW;
  END IF;

  -- 2. Map notification type → app_settings column
  v_category_col := CASE NEW.type
    WHEN 'friend_request'    THEN 'friend_requests'
    WHEN 'friend_accepted'   THEN 'friend_requests'
    WHEN 'match_invite'      THEN 'match_invites'
    WHEN 'match_accepted'    THEN 'match_accepted'
    WHEN 'match_confirmed'   THEN 'match_accepted'
    WHEN 'match_declined'    THEN 'match_declined'
    WHEN 'match_cancelled'   THEN 'match_declined'
    WHEN 'match_rescheduled' THEN 'match_reminders'
    WHEN 'match_scheduled'   THEN 'match_reminders'
    WHEN 'match_reminder'    THEN 'match_reminders'
    WHEN 'score_reminder'    THEN 'match_reminders'
    WHEN 'match_result'      THEN 'score_confirmed'
    WHEN 'message_received'  THEN 'messages'
    WHEN 'league_update'     THEN 'league_updates'
    WHEN 'achievement'       THEN 'achievements'
    WHEN 'score_submitted'   THEN 'score_submitted'
    WHEN 'score_confirmed'   THEN 'score_confirmed'
    ELSE NULL
  END;

  -- 3. Check user preferences (opt-out model: missing row = send everything)
  SELECT
    COALESCE(push_enabled, TRUE),
    CASE v_category_col
      WHEN 'friend_requests' THEN COALESCE(friend_requests, TRUE)
      WHEN 'match_invites'   THEN COALESCE(match_invites,   TRUE)
      WHEN 'match_accepted'  THEN COALESCE(match_accepted,  TRUE)
      WHEN 'match_declined'  THEN COALESCE(match_declined,  TRUE)
      WHEN 'match_reminders' THEN COALESCE(match_reminders, TRUE)
      WHEN 'score_confirmed' THEN COALESCE(score_confirmed, TRUE)
      WHEN 'score_submitted' THEN COALESCE(score_submitted, TRUE)
      WHEN 'messages'        THEN COALESCE(messages,        TRUE)
      WHEN 'league_updates'  THEN COALESCE(league_updates,  TRUE)
      WHEN 'achievements'    THEN COALESCE(achievements,    TRUE)
      ELSE TRUE
    END
  INTO v_push_enabled, v_category_ok
  FROM app_settings
  WHERE user_id = NEW.user_id;

  -- FOUND = FALSE means no settings row yet → defaults (TRUE) already set above
  IF NOT v_push_enabled OR NOT v_category_ok THEN
    RETURN NEW;
  END IF;

  -- 4. Build Expo payload and fire directly at the Expo Push API
  --    priority:'high'  → apns-priority:10 (immediate) on iOS
  --                     → FCM high priority on Android
  --    ttl:0            → deliver now-or-never, not queued for hours
  v_payload := jsonb_build_object(
    'to',        v_push_token,
    'sound',     'default',
    'title',     NEW.title,
    'body',      NEW.message,
    'data',      jsonb_build_object('type', COALESCE(NEW.type, 'general'))
                   || COALESCE(NEW.metadata, '{}'::jsonb),
    'badge',     1,
    'channelId', 'default',
    'priority',  'high',
    'ttl',       0
  );

  PERFORM net.http_post(
    url     := 'https://api.expo.dev/v2/push/send',
    headers := '{"Content-Type":"application/json","Accept":"application/json"}'::jsonb,
    body    := v_payload
  );

  RETURN NEW;
END;
$$;
