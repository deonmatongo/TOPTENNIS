-- Gap 1: stale push token cleanup via receipt tracking
-- Gap 2: accurate badge count in push payload (was hardcoded to 1)

-- ── Table to track outgoing push requests ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_tickets (
  id             BIGSERIAL PRIMARY KEY,
  user_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  net_req_id     BIGINT,          -- pg_net request ID → look up Expo response later
  expo_ticket_id TEXT,            -- populated when we process the pg_net response
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed      BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS push_tickets_unprocessed_idx
  ON public.push_tickets(sent_at)
  WHERE NOT processed;

-- ── Updated trigger function ──────────────────────────────────────────────────
-- Changes vs. previous version:
--   1. `badge` now queries the real unread count instead of hardcoding 1
--   2. Stores the pg_net request ID in push_tickets so we can check the
--      Expo send response and clear DeviceNotRegistered tokens later

CREATE OR REPLACE FUNCTION public.notify_push_on_notification_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_push_token   TEXT;
  v_push_enabled BOOLEAN := TRUE;
  v_category_ok  BOOLEAN := TRUE;
  v_category_col TEXT;
  v_badge_count  INT;
  v_payload      JSONB;
  v_net_req_id   BIGINT;
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

  -- 3. Check user preferences
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

  IF NOT v_push_enabled OR NOT v_category_ok THEN
    RETURN NEW;
  END IF;

  -- 4. Real unread count (this trigger is AFTER INSERT, so NEW row is visible)
  SELECT COUNT(*)::int INTO v_badge_count
  FROM notifications
  WHERE user_id = NEW.user_id AND read = false;

  -- 5. Build and fire the push payload
  v_payload := jsonb_build_object(
    'to',        v_push_token,
    'sound',     'default',
    'title',     NEW.title,
    'body',      NEW.message,
    'data',      jsonb_build_object('type', COALESCE(NEW.type, 'general'))
                   || COALESCE(NEW.metadata, '{}'::jsonb),
    'badge',     v_badge_count,
    'channelId', 'default',
    'priority',  'high',
    'ttl',       0
  );

  SELECT net.http_post(
    url     := 'https://api.expo.dev/v2/push/send',
    headers := '{"Content-Type":"application/json","Accept":"application/json"}'::jsonb,
    body    := v_payload
  ) INTO v_net_req_id;

  -- Track the request so we can inspect Expo's response for stale tokens
  INSERT INTO public.push_tickets(user_id, net_req_id)
  VALUES (NEW.user_id, v_net_req_id);

  RETURN NEW;
END;
$$;

-- ── Receipt processor (called every 30 min by pg_cron or GitHub Actions) ─────
-- Reads pg_net's response table, extracts Expo ticket info, and clears any
-- push tokens that Expo reports as DeviceNotRegistered.

CREATE OR REPLACE FUNCTION public.process_push_tickets()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'net'
AS $$
DECLARE
  rec          RECORD;
  v_body       JSONB;
  v_status     TEXT;
  v_error_code TEXT;
  v_ticket_id  TEXT;
BEGIN
  -- Process tickets where pg_net has received the Expo response
  FOR rec IN
    SELECT pt.id, pt.user_id, pt.net_req_id
    FROM   public.push_tickets  pt
    JOIN   net._http_response   r  ON r.id = pt.net_req_id
    WHERE  NOT pt.processed
      AND  pt.sent_at > NOW() - INTERVAL '3 days'
  LOOP
    BEGIN
      SELECT body::jsonb INTO v_body
      FROM   net._http_response
      WHERE  id = rec.net_req_id;

      -- Expo /v2/push/send response shape:
      --   { "data": { "status": "ok", "id": "<ticketId>" } }
      --   { "data": { "status": "error", "message": "...", "details": { "error": "DeviceNotRegistered" } } }
      v_status     := v_body -> 'data' ->> 'status';
      v_error_code := v_body -> 'data' -> 'details' ->> 'error';
      v_ticket_id  := v_body -> 'data' ->> 'id';

      IF v_status = 'error' AND v_error_code = 'DeviceNotRegistered' THEN
        UPDATE public.profiles SET push_token = NULL WHERE id = rec.user_id;
      END IF;

      UPDATE public.push_tickets
      SET    processed      = TRUE,
             expo_ticket_id = v_ticket_id
      WHERE  id = rec.id;

    EXCEPTION WHEN OTHERS THEN
      -- Skip malformed records; don't fail the whole batch
      NULL;
    END;
  END LOOP;

  -- Purge processed records older than 3 days
  DELETE FROM public.push_tickets
  WHERE  processed AND sent_at < NOW() - INTERVAL '3 days';
END;
$$;

-- ── pg_cron schedule (only if the extension is enabled on this project) ───────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'process-push-tickets',
      '*/30 * * * *',
      'SELECT public.process_push_tickets()'
    );
  END IF;
END;
$$;
