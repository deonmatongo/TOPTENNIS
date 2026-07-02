-- ─────────────────────────────────────────────────────────────────────────────
-- Mobile backend alignment
--
-- Brings the deployed backend up to everything the mobile app (and web app)
-- needs. Every statement is idempotent — safe to run on prod via the SQL
-- editor or `supabase db push`.
--
--  1. notifications type CHECK — union of every type either client writes
--     (fixes rejected `score_reminder` inserts from both apps)
--  2. user_league_matches view — adds league_name (mobile match history)
--  3. calls table — codifies the voice/video call signalling table the mobile
--     app uses (created ad hoc previously), with RLS + realtime
--  4. Realtime publication — tables the mobile app subscribes to
--  5. chat-media storage bucket — mobile image/voice messages
--  6. league_registrations.is_demo — referenced by the mobile app
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. notifications type constraint ─────────────────────────────────────────
-- Normalize any legacy values that the new constraint would reject
UPDATE public.notifications SET type = 'general'
WHERE type NOT IN (
  'message_received', 'friend_request', 'friend_accepted', 'friend_declined',
  'match_invite', 'match_accepted', 'match_declined', 'match_cancelled',
  'match_rescheduled', 'match_confirmed', 'match_scheduled', 'match_result',
  'match_suggestion', 'score_reminder', 'league_update', 'achievement',
  'group_invite', 'booking_confirmed', 'booking_cancelled',
  'general', 'system', 'system_notification'
);

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'message_received', 'friend_request', 'friend_accepted', 'friend_declined',
  'match_invite', 'match_accepted', 'match_declined', 'match_cancelled',
  'match_rescheduled', 'match_confirmed', 'match_scheduled', 'match_result',
  'match_suggestion', 'score_reminder', 'league_update', 'achievement',
  'group_invite', 'booking_confirmed', 'booking_cancelled',
  'general', 'system', 'system_notification'
));

-- ── 2. user_league_matches view + league_name ────────────────────────────────
DROP VIEW IF EXISTS public.user_league_matches;
CREATE VIEW public.user_league_matches AS
SELECT
  lm.*,
  lm.match_duration_minutes AS duration_minutes,
  d.division_name,
  d.league_id,
  (SELECT lr.league_name FROM public.league_registrations lr
    WHERE lr.league_id = d.league_id LIMIT 1) AS league_name,
  p1.first_name  AS player1_first_name,
  p1.last_name   AS player1_last_name,
  p2.first_name  AS player2_first_name,
  p2.last_name   AS player2_last_name,
  CASE WHEN lm.player1_id = auth.uid()
    THEN p2.first_name || ' ' || p2.last_name
    ELSE p1.first_name || ' ' || p1.last_name
  END AS opponent_name,
  CASE WHEN lm.player1_id = auth.uid()
    THEN lm.player2_id
    ELSE lm.player1_id
  END AS opponent_id
FROM public.league_matches lm
JOIN public.divisions       d  ON d.id  = lm.division_id
JOIN public.profiles        p1 ON p1.id = lm.player1_id
JOIN public.profiles        p2 ON p2.id = lm.player2_id
WHERE lm.player1_id = auth.uid()
   OR lm.player2_id = auth.uid();

GRANT SELECT ON public.user_league_matches TO authenticated;

-- ── 3. calls table (voice/video signalling for the mobile app) ────────────────
CREATE TABLE IF NOT EXISTS public.calls (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         TEXT NOT NULL,
  caller_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  callee_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID,
  call_type       TEXT NOT NULL DEFAULT 'audio' CHECK (call_type IN ('audio', 'video')),
  is_group        BOOLEAN NOT NULL DEFAULT FALSE,
  status          TEXT NOT NULL DEFAULT 'ringing'
                    CHECK (status IN ('ringing', 'active', 'declined', 'ended', 'missed')),
  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calls_callee ON public.calls(callee_id, status);
CREATE INDEX IF NOT EXISTS idx_calls_caller ON public.calls(caller_id, status);

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls REPLICA IDENTITY FULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'calls' AND policyname = 'calls_select_participants') THEN
    CREATE POLICY calls_select_participants ON public.calls
      FOR SELECT USING (auth.uid() = caller_id OR auth.uid() = callee_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'calls' AND policyname = 'calls_insert_caller') THEN
    CREATE POLICY calls_insert_caller ON public.calls
      FOR INSERT WITH CHECK (auth.uid() = caller_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'calls' AND policyname = 'calls_update_participants') THEN
    CREATE POLICY calls_update_participants ON public.calls
      FOR UPDATE USING (auth.uid() = caller_id OR auth.uid() = callee_id);
  END IF;
END $$;

-- ── 4. Realtime publication for tables the mobile app subscribes to ──────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['calls', 'league_matches', 'division_assignments', 'players', 'matches']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- ── 5. chat-media storage bucket (mobile image + voice messages) ─────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'chat_media_public_read') THEN
    CREATE POLICY chat_media_public_read ON storage.objects
      FOR SELECT USING (bucket_id = 'chat-media');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'chat_media_auth_upload') THEN
    CREATE POLICY chat_media_auth_upload ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'chat-media'
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[2] = auth.uid()::text
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'chat_media_owner_delete') THEN
    CREATE POLICY chat_media_owner_delete ON storage.objects
      FOR DELETE USING (
        bucket_id = 'chat-media'
        AND (storage.foldername(name))[2] = auth.uid()::text
      );
  END IF;
END $$;

-- ── 6. league_registrations.is_demo ──────────────────────────────────────────
ALTER TABLE public.league_registrations
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
