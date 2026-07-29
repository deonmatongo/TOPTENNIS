-- Fix search_path for all functions flagged by Supabase advisor

CREATE OR REPLACE FUNCTION public._set_playoff_brackets_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_invite_and_lock_slot(p_invite_id uuid, p_user_id uuid, p_conflicting_invite_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invite           RECORD;
  v_availability_id  UUID;
  v_slot_date        DATE;
  v_slot_start_time  TIME;
  v_slot_end_time    TIME;
  v_conflict_count   INTEGER;
  v_locked_ids       UUID[] := ARRAY[]::UUID[];
  v_result           JSON;
BEGIN
  SELECT * INTO v_invite
  FROM match_invites
  WHERE id          = p_invite_id
    AND receiver_id = p_user_id
    AND status      = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found or not pending';
  END IF;

  v_availability_id := v_invite.availability_id;
  v_slot_date       := v_invite.date;
  v_slot_start_time := v_invite.start_time;
  v_slot_end_time   := v_invite.end_time;

  IF v_availability_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_conflict_count
    FROM user_availability
    WHERE id             = v_availability_id
      AND booking_status = 'booked';

    IF v_conflict_count > 0 THEN
      RAISE EXCEPTION 'Slot already booked';
    END IF;
  END IF;

  UPDATE match_invites
  SET status      = 'accepted',
      response_at = NOW(),
      updated_at  = NOW()
  WHERE id = p_invite_id;

  IF v_availability_id IS NOT NULL THEN
    UPDATE user_availability
    SET booking_status = 'booked',
        updated_at     = NOW()
    WHERE id             = v_availability_id
      AND booking_status IS DISTINCT FROM 'booked'
    RETURNING id INTO v_availability_id;

    IF v_availability_id IS NOT NULL THEN
      v_locked_ids := array_append(v_locked_ids, v_availability_id);
    END IF;
  ELSE
    WITH locked AS (
      UPDATE user_availability
      SET booking_status = 'booked',
          updated_at     = NOW()
      WHERE user_id      = p_user_id
        AND date         = v_slot_date
        AND start_time  <= v_slot_start_time
        AND end_time    >= v_slot_end_time
        AND is_available = TRUE
        AND (booking_status IS NULL OR booking_status != 'booked')
      RETURNING id
    )
    SELECT array_agg(id) INTO v_locked_ids FROM locked;
    v_locked_ids := COALESCE(v_locked_ids, ARRAY[]::UUID[]);
  END IF;

  WITH locked AS (
    UPDATE user_availability
    SET booking_status = 'booked',
        updated_at     = NOW()
    WHERE user_id      = v_invite.sender_id
      AND date         = v_slot_date
      AND start_time  <= v_slot_start_time
      AND end_time    >= v_slot_end_time
      AND is_available = TRUE
      AND (booking_status IS NULL OR booking_status != 'booked')
    RETURNING id
  )
  SELECT v_locked_ids || array_agg(id) INTO v_locked_ids FROM locked;
  v_locked_ids := COALESCE(v_locked_ids, ARRAY[]::UUID[]);

  IF p_conflicting_invite_ids IS NOT NULL
     AND array_length(p_conflicting_invite_ids, 1) > 0
  THEN
    UPDATE match_invites
    SET status      = 'declined',
        response_at = NOW(),
        updated_at  = NOW()
    WHERE id = ANY(p_conflicting_invite_ids)
      AND status = 'pending';
  END IF;

  IF v_availability_id IS NOT NULL THEN
    UPDATE match_invites
    SET status      = 'declined',
        response_at = NOW(),
        updated_at  = NOW()
    WHERE availability_id = v_availability_id
      AND status          = 'pending'
      AND id             != p_invite_id;
  END IF;

  v_result := json_build_object(
    'success',            TRUE,
    'invite_id',          p_invite_id,
    'availability_id',    v_invite.availability_id,
    'locked_slot_ids',    v_locked_ids,
    'slot_date',          v_slot_date,
    'slot_start_time',    v_slot_start_time,
    'slot_end_time',      v_slot_end_time,
    'conflicts_declined', COALESCE(array_length(p_conflicting_invite_ids, 1), 0)
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', FALSE,
      'error',   SQLERRM,
      'detail',  SQLSTATE
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.advance_playoff_winner(p_match_id uuid, p_winner_id uuid, p_score jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_match        playoff_brackets%ROWTYPE;
  v_next_match   INTEGER;
  v_next_slot    TEXT;   -- 'player1_id' or 'player2_id'
  v_next_id      UUID;
BEGIN
  SELECT * INTO v_match FROM playoff_brackets WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Playoff match % not found', p_match_id;
  END IF;

  -- Validate winner is a participant
  IF p_winner_id <> v_match.player1_id AND p_winner_id <> v_match.player2_id THEN
    RAISE EXCEPTION 'Winner % is not a participant in match %', p_winner_id, p_match_id;
  END IF;

  -- Record result
  UPDATE playoff_brackets
  SET winner_id = p_winner_id,
      score     = p_score,
      status    = 'completed'
  WHERE id = p_match_id;

  -- Determine which slot in the next round to fill
  -- Even match_number → fills player2, odd → fills player1
  v_next_match := CEIL(v_match.match_number::numeric / 2)::int;
  IF v_match.match_number % 2 = 1 THEN
    v_next_slot := 'player1_id';
  ELSE
    v_next_slot := 'player2_id';
  END IF;

  -- Find the next-round TBD match
  SELECT id INTO v_next_id
  FROM   playoff_brackets
  WHERE  division_id  = v_match.division_id
    AND  round_number = v_match.round_number + 1
    AND  match_number = v_next_match
    AND  is_tbd       = true
  LIMIT 1;

  IF FOUND THEN
    IF v_next_slot = 'player1_id' THEN
      UPDATE playoff_brackets
      SET player1_id = p_winner_id, is_tbd = false
      WHERE id = v_next_id;
    ELSE
      UPDATE playoff_brackets
      SET player2_id = p_winner_id, is_tbd = false
      WHERE id = v_next_id;
    END IF;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.assign_player_to_division(p_user_id uuid, p_league_registration_id uuid, p_league_id text, p_skill_level text, p_competitiveness text, p_age_range text, p_gender_preference text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_division_id UUID;
  v_division_name TEXT;
  v_season TEXT := EXTRACT(YEAR FROM NOW())::TEXT;
BEGIN
  -- First try to find an existing compatible division with space
  SELECT id INTO v_division_id
  FROM public.divisions
  WHERE league_id = p_league_id
    AND season = v_season
    AND skill_level_range = p_skill_level
    AND competitiveness = p_competitiveness
    AND age_range = p_age_range
    AND gender_preference = p_gender_preference
    AND current_players < max_players
    AND status = 'active'
  ORDER BY current_players DESC
  LIMIT 1;

  -- If no compatible division found, create a new one
  IF v_division_id IS NULL THEN
    v_division_name := 'Division ' || (
      SELECT COALESCE(COUNT(*) + 1, 1)
      FROM public.divisions
      WHERE league_id = p_league_id AND season = v_season
    );

    INSERT INTO public.divisions (
      league_id,
      division_name,
      season,
      skill_level_range,
      competitiveness,
      age_range,
      gender_preference
    ) VALUES (
      p_league_id,
      v_division_name,
      v_season,
      p_skill_level,
      p_competitiveness,
      p_age_range,
      p_gender_preference
    ) RETURNING id INTO v_division_id;
  END IF;

  -- Assign player to division
  INSERT INTO public.division_assignments (
    user_id,
    division_id,
    league_registration_id
  ) VALUES (
    p_user_id,
    v_division_id,
    p_league_registration_id
  );

  -- Update division player count
  UPDATE public.divisions
  SET 
    current_players = current_players + 1,
    updated_at = NOW()
  WHERE id = v_division_id;

  RETURN v_division_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_generate_round_robin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Fire when a division transitions to 'active' status
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status <> 'active') THEN
    -- generate_round_robin_schedule returns -1 if schedule already exists (idempotent)
    PERFORM public.generate_round_robin_schedule(NEW.id, CURRENT_DATE);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.block_user(p_blocked_user_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() = p_blocked_user_id THEN
    RAISE EXCEPTION 'You cannot block yourself';
  END IF;

  INSERT INTO blocked_users (blocker_id, blocked_user_id, reason)
  VALUES (auth.uid(), p_blocked_user_id, p_reason)
  ON CONFLICT (blocker_id, blocked_user_id)
  DO UPDATE SET reason = EXCLUDED.reason, updated_at = now();

  -- Remove any existing friend request between the two users
  DELETE FROM friend_requests
  WHERE (sender_id = auth.uid() AND receiver_id = p_blocked_user_id)
     OR (sender_id = p_blocked_user_id AND receiver_id = auth.uid());

  -- Cancel any pending match invites between the two users
  UPDATE match_invites
  SET status = 'cancelled'
  WHERE status = 'pending'
    AND (
      (sender_id = auth.uid() AND receiver_id = p_blocked_user_id)
      OR (sender_id = p_blocked_user_id AND receiver_id = auth.uid())
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.bump_conversation_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_view_division_calendar(p_target_user_id uuid, p_requesting_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if both users are in the same division
  RETURN EXISTS (
    SELECT 1 
    FROM public.division_assignments da1
    JOIN public.division_assignments da2 ON da1.division_id = da2.division_id
    WHERE da1.user_id = p_target_user_id
      AND da2.user_id = p_requesting_user_id
      AND da1.status = 'active'
      AND da2.status = 'active'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_view_event(p_event_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_privacy_level TEXT;
  v_creator_id UUID;
  v_is_participant BOOLEAN;
  v_is_friend BOOLEAN;
BEGIN
  -- Get event details
  SELECT privacy_level, creator_id INTO v_privacy_level, v_creator_id
  FROM public.calendar_events
  WHERE id = p_event_id;
  
  -- Creator can always view
  IF v_creator_id = p_user_id THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user is participant
  SELECT EXISTS(
    SELECT 1 FROM public.event_participants
    WHERE event_id = p_event_id AND user_id = p_user_id
  ) INTO v_is_participant;
  
  IF v_is_participant THEN
    RETURN TRUE;
  END IF;
  
  -- Public events are viewable by all
  IF v_privacy_level = 'public' THEN
    RETURN TRUE;
  END IF;
  
  -- Friends-only events
  IF v_privacy_level = 'friends-only' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.friend_requests
      WHERE status = 'accepted'
      AND ((sender_id = v_creator_id AND receiver_id = p_user_id)
        OR (receiver_id = v_creator_id AND sender_id = p_user_id))
    ) INTO v_is_friend;
    
    RETURN v_is_friend;
  END IF;
  
  -- Private events only viewable by creator and participants
  RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_availability_conflict(p_user_id uuid, p_date date, p_start_time time without time zone, p_end_time time without time zone, p_exclude_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  has_conflict BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.user_availability
    WHERE user_id = p_user_id
      AND date    = p_date
      AND (id != p_exclude_id OR p_exclude_id IS NULL)
      AND (
        (start_time <= p_start_time AND end_time > p_start_time) OR
        (start_time <  p_end_time  AND end_time >= p_end_time)   OR
        (start_time >= p_start_time AND end_time <= p_end_time)
      )
  ) INTO has_conflict;

  RETURN has_conflict;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_event_conflicts(p_user_id uuid, p_start_time timestamp with time zone, p_end_time timestamp with time zone, p_exclude_event_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(conflict_type text, conflict_event_id uuid, conflict_start timestamp with time zone, conflict_end timestamp with time zone, conflict_title text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  -- Check calendar events
  SELECT 
    'existing_event'::TEXT,
    ce.id,
    ce.start_time_utc,
    ce.end_time_utc,
    ce.event_name
  FROM public.calendar_events ce
  JOIN public.event_participants ep ON ce.id = ep.event_id
  WHERE ep.user_id = p_user_id
    AND ce.status IN ('scheduled', 'confirmed')
    AND (p_exclude_event_id IS NULL OR ce.id != p_exclude_event_id)
    AND (
      (ce.start_time_utc <= p_start_time AND ce.end_time_utc > p_start_time)
      OR (ce.start_time_utc < p_end_time AND ce.end_time_utc >= p_end_time)
      OR (ce.start_time_utc >= p_start_time AND ce.end_time_utc <= p_end_time)
    )
  
  UNION ALL
  
  -- Check user availability blocks
  SELECT 
    'user_availability'::TEXT,
    ua.id,
    (ua.date + ua.start_time)::TIMESTAMPTZ,
    (ua.date + ua.end_time)::TIMESTAMPTZ,
    'Blocked time'::TEXT
  FROM public.user_availability ua
  WHERE ua.user_id = p_user_id
    AND ua.is_blocked = TRUE
    AND ua.date = p_start_time::DATE
    AND (
      (ua.start_time <= p_start_time::TIME AND ua.end_time > p_start_time::TIME)
      OR (ua.start_time < p_end_time::TIME AND ua.end_time >= p_end_time::TIME)
      OR (ua.start_time >= p_start_time::TIME AND ua.end_time <= p_end_time::TIME)
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_league_match_score(p_match_id uuid, p_confirming_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_match public.league_matches%ROWTYPE;
BEGIN
  IF auth.uid() <> p_confirming_user_id THEN
    RAISE EXCEPTION 'Not authorized.';
  END IF;

  SELECT * INTO v_match FROM public.league_matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found.'; END IF;

  IF auth.uid() NOT IN (v_match.player1_id, v_match.player2_id) THEN
    RAISE EXCEPTION 'You are not a participant in this match.';
  END IF;
  IF (v_match.score->>'reported_by')::UUID = auth.uid() THEN
    RAISE EXCEPTION 'You cannot confirm your own score report.';
  END IF;

  UPDATE public.league_matches
  SET score      = score || jsonb_build_object('confirmed_by', auth.uid()),
      updated_at = NOW()
  WHERE id = p_match_id;

  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (
    v_match.winner_id,
    'score_confirmed',
    'Score Confirmed',
    'Your opponent confirmed the match result.',
    jsonb_build_object('match_id', p_match_id)
  )
  ON CONFLICT DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_group_chat(p_name text, p_member_ids uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_conv_id uuid;
  v_member  uuid;
  v_creator_name text;
BEGIN
  INSERT INTO conversations (name, is_group, created_by)
  VALUES (p_name, true, auth.uid())
  RETURNING id INTO v_conv_id;

  INSERT INTO conversation_members (conversation_id, user_id, role)
  VALUES (v_conv_id, auth.uid(), 'admin');

  FOREACH v_member IN ARRAY p_member_ids LOOP
    INSERT INTO conversation_members (conversation_id, user_id, role)
    VALUES (v_conv_id, v_member, 'member')
    ON CONFLICT DO NOTHING;

    INSERT INTO notifications (user_id, type, title, message, read, action_url, metadata)
    VALUES (
      v_member,
      'group_invite',
      'Added to a group chat',
      'You were added to the group "' || p_name || '"',
      false,
      '/dashboard?tab=messages',
      jsonb_build_object('conversation_id', v_conv_id, 'created_by', auth.uid())
    );
  END LOOP;

  -- System welcome message
  SELECT COALESCE(TRIM(first_name || ' ' || last_name), email)
  INTO v_creator_name FROM profiles WHERE id = auth.uid();

  INSERT INTO conversation_messages (conversation_id, sender_id, content, is_system)
  VALUES (v_conv_id, auth.uid(), v_creator_name || ' created the group. Welcome everyone! 🎾', true);

  RETURN v_conv_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_group_chat(p_name text, p_member_ids uuid[], p_description text DEFAULT NULL::text, p_group_type text DEFAULT 'private'::text, p_avatar_emoji text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_conv_id      uuid;
  v_member       uuid;
  v_creator_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Group name cannot be empty';
  END IF;

  -- Create conversation
  INSERT INTO conversations (name, is_group, created_by, description, group_type, avatar_emoji)
  VALUES (trim(p_name), true, auth.uid(), p_description, p_group_type, p_avatar_emoji)
  RETURNING id INTO v_conv_id;

  -- Add creator as admin
  INSERT INTO conversation_members (conversation_id, user_id, role)
  VALUES (v_conv_id, auth.uid(), 'admin');

  -- Add each selected member
  IF p_member_ids IS NOT NULL THEN
    FOREACH v_member IN ARRAY p_member_ids LOOP
      IF v_member <> auth.uid() THEN
        INSERT INTO conversation_members (conversation_id, user_id, role)
        VALUES (v_conv_id, v_member, 'member')
        ON CONFLICT DO NOTHING;

        -- Notification for each added member
        INSERT INTO notifications (user_id, type, title, message, read, action_url, metadata)
        VALUES (
          v_member,
          'group_invite',
          'New Group Invitation',
          'You have been added to the group: ' || trim(p_name),
          false,
          '/dashboard?tab=social',
          jsonb_build_object(
            'conversation_id', v_conv_id,
            'group_name', trim(p_name),
            'invited_by', auth.uid()
          )
        );
      END IF;
    END LOOP;
  END IF;

  -- Creator name for system message
  SELECT COALESCE(TRIM(first_name || ' ' || last_name), email)
  INTO v_creator_name FROM profiles WHERE id = auth.uid();

  -- System welcome message
  INSERT INTO conversation_messages (conversation_id, sender_id, content, is_system)
  VALUES (v_conv_id, auth.uid(),
    v_creator_name || ' created the group. Welcome everyone! 🎾',
    true);

  RETURN v_conv_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_league_match_with_invite(p_division_id uuid, p_player1_id uuid, p_player2_id uuid, p_scheduled_date date, p_scheduled_time time without time zone, p_timezone text, p_court_location text, p_message text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_league_match_id UUID;
  v_match_invite_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.division_assignments da1
    JOIN  public.division_assignments da2 ON da1.division_id = da2.division_id
    WHERE da1.division_id = p_division_id
      AND da1.user_id     = p_player1_id
      AND da2.user_id     = p_player2_id
      AND da1.status      = 'active'
      AND da2.status      = 'active'
  ) THEN
    RAISE EXCEPTION 'Both players must be in the same division';
  END IF;

  INSERT INTO public.league_matches
    (division_id, player1_id, player2_id, scheduled_date, scheduled_time, timezone, court_location, status)
  VALUES
    (p_division_id, p_player1_id, p_player2_id, p_scheduled_date, p_scheduled_time, p_timezone, p_court_location, 'pending')
  RETURNING id INTO v_league_match_id;

  INSERT INTO public.match_invites
    (sender_id, receiver_id, date, start_time, end_time, court_location, message, status, league_match_id, division_id, is_league_match)
  VALUES
    (p_player1_id, p_player2_id, p_scheduled_date,
     p_scheduled_time,
     (p_scheduled_time + INTERVAL '2 hours')::TIME,
     p_court_location,
     COALESCE(p_message, 'League match invitation'),
     'pending', v_league_match_id, p_division_id, true)
  RETURNING id INTO v_match_invite_id;

  UPDATE public.league_matches SET match_invite_id = v_match_invite_id WHERE id = v_league_match_id;
  RETURN v_league_match_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_group(p_conversation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = p_conversation_id AND user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can delete a group';
  END IF;

  DELETE FROM conversations WHERE id = p_conversation_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.dispute_league_match_score(p_match_id uuid, p_disputing_user_id uuid, p_dispute_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_match public.league_matches%ROWTYPE;
BEGIN
  IF auth.uid() <> p_disputing_user_id THEN
    RAISE EXCEPTION 'Not authorized.';
  END IF;

  SELECT * INTO v_match FROM public.league_matches WHERE id = p_match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found.'; END IF;

  IF auth.uid() NOT IN (v_match.player1_id, v_match.player2_id) THEN
    RAISE EXCEPTION 'You are not a participant in this match.';
  END IF;

  UPDATE public.league_matches
  SET score      = score || jsonb_build_object(
                     'disputed_by',    auth.uid(),
                     'dispute_reason', p_dispute_reason
                   ),
      updated_at = NOW()
  WHERE id = p_match_id;

  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (
    v_match.winner_id,
    'score_disputed',
    'Score Disputed',
    'Your opponent has disputed the match score. An admin will review.',
    jsonb_build_object('match_id', p_match_id, 'reason', p_dispute_reason)
  )
  ON CONFLICT DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_match_suggestions(target_player_id uuid, competitiveness_filter text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id          UUID;
  v_skill            INT;
  v_competitiveness  TEXT;
  v_wins             INT;
  v_total            INT;
  v_win_rate         NUMERIC;
  v_inserted         INT := 0;

  rec                RECORD;
  v_skill_score      INT;
  v_comp_score       INT;
  v_activity_score   INT;
  v_winrate_score    INT;
  v_avail_score      INT;
  v_total_score      INT;
  v_reasons          TEXT[];
BEGIN
  SELECT p.user_id, p.skill_level, p.competitiveness, p.wins,
         COALESCE(p.wins, 0) + COALESCE(p.losses, 0)
  INTO   v_user_id, v_skill, v_competitiveness, v_wins, v_total
  FROM   players p
  WHERE  p.id = target_player_id;

  IF v_user_id IS NULL THEN
    RETURN 0;
  END IF;

  v_win_rate := CASE WHEN v_total > 0 THEN (v_wins::NUMERIC / v_total) ELSE 0.5 END;

  DELETE FROM match_suggestions
  WHERE  player_id  = target_player_id
    AND  created_at < now() - INTERVAL '7 days';

  FOR rec IN
    SELECT
      p.id              AS pid,
      p.user_id         AS puid,
      p.skill_level     AS skill,
      p.competitiveness AS comp,
      COALESCE(p.wins,   0) AS wins,
      COALESCE(p.losses, 0) AS losses,
      COALESCE(p.wins,   0) + COALESCE(p.losses, 0) AS total_matches
    FROM players p
    JOIN profiles pr ON pr.id = p.user_id
    WHERE
      p.id <> target_player_id
      AND COALESCE(pr.networking_enabled, true) = true
      AND NOT EXISTS (
        SELECT 1 FROM blocked_users b
        WHERE (b.blocker_id = v_user_id AND b.blocked_user_id = p.user_id)
           OR (b.blocker_id = p.user_id AND b.blocked_user_id = v_user_id)
      )
      AND NOT EXISTS (
        SELECT 1 FROM match_suggestions ms
        WHERE ms.player_id           = target_player_id
          AND ms.suggested_player_id = p.id
          AND ms.created_at         >= now() - INTERVAL '7 days'
      )
      AND (competitiveness_filter IS NULL OR p.competitiveness = competitiveness_filter)
      AND ABS(COALESCE(p.skill_level, 5) - COALESCE(v_skill, 5)) <= 3
  LOOP
    CASE ABS(COALESCE(rec.skill, 5) - COALESCE(v_skill, 5))
      WHEN 0 THEN v_skill_score := 40;
      WHEN 1 THEN v_skill_score := 30;
      WHEN 2 THEN v_skill_score := 18;
      ELSE        v_skill_score := 8;
    END CASE;

    IF rec.comp = v_competitiveness THEN
      v_comp_score := 20;
    ELSIF (rec.comp IN ('casual','intermediate') AND v_competitiveness IN ('casual','intermediate'))
       OR (rec.comp IN ('intermediate','competitive') AND v_competitiveness IN ('intermediate','competitive'))
    THEN
      v_comp_score := 10;
    ELSE
      v_comp_score := 0;
    END IF;

    v_activity_score := LEAST(20, rec.total_matches);

    DECLARE
      v_opp_win_rate NUMERIC;
      v_rate_diff    NUMERIC;
    BEGIN
      v_opp_win_rate := CASE WHEN rec.total_matches > 0
                             THEN (rec.wins::NUMERIC / rec.total_matches)
                             ELSE 0.5 END;
      v_rate_diff    := ABS(v_win_rate - v_opp_win_rate);
      v_winrate_score := GREATEST(0, ROUND(10 - (v_rate_diff * 20))::INT);
    END;

    SELECT CASE WHEN EXISTS (
      SELECT 1 FROM user_availability ua
      WHERE ua.user_id                         = rec.puid
        AND ua.is_available                    = true
        AND ua.is_blocked                      = false
        AND ua.date                           >= current_date
        AND COALESCE(ua.privacy_level, 'public') <> 'private'
    ) THEN 10 ELSE 0 END
    INTO v_avail_score;

    v_total_score := v_skill_score + v_comp_score + v_activity_score + v_winrate_score + v_avail_score;

    v_reasons := ARRAY[]::TEXT[];

    IF v_skill_score >= 30 THEN
      v_reasons := array_append(v_reasons, 'Similar skill level');
    ELSIF v_skill_score >= 18 THEN
      v_reasons := array_append(v_reasons, 'Close skill level');
    END IF;

    IF v_comp_score = 20 THEN
      v_reasons := array_append(v_reasons, 'Matching play style');
    ELSIF v_comp_score = 10 THEN
      v_reasons := array_append(v_reasons, 'Compatible play style');
    END IF;

    IF v_activity_score >= 15 THEN
      v_reasons := array_append(v_reasons, 'Very active player');
    ELSIF v_activity_score >= 8 THEN
      v_reasons := array_append(v_reasons, 'Active player');
    END IF;

    IF v_winrate_score >= 8 THEN
      v_reasons := array_append(v_reasons, 'Balanced match-up');
    END IF;

    IF v_avail_score = 10 THEN
      v_reasons := array_append(v_reasons, 'Has available time slots');
    END IF;

    IF v_total_score >= 20 THEN
      INSERT INTO match_suggestions (player_id, suggested_player_id, compatibility_score, match_reasons, status)
      VALUES (target_player_id, rec.pid, v_total_score, v_reasons, 'pending')
      ON CONFLICT DO NOTHING;

      v_inserted := v_inserted + 1;
    END IF;

  END LOOP;

  RETURN v_inserted;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_playoff_bracket(p_division_id uuid, p_num_qualifiers integer DEFAULT 4)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_qualifiers UUID[]  := ARRAY[]::UUID[];
  v_count      INTEGER := 0;
  v_qualifier  RECORD;
  v_round      INTEGER;
  v_prev       INTEGER;
  v_curr       INTEGER;
BEGIN
  FOR v_qualifier IN
    SELECT da.user_id
    FROM   division_assignments da
    LEFT JOIN players p ON p.user_id = da.user_id
    WHERE  da.division_id      = p_division_id
      AND  da.playoff_eligible = true
      AND  da.status           = 'active'
    ORDER BY (COALESCE(p.wins, 0) * 3)
               + FLOOR(da.matches_completed::NUMERIC / 2) DESC
    LIMIT p_num_qualifiers
  LOOP
    v_count := v_count + 1;
    v_qualifiers[v_count] := v_qualifier.user_id;
  END LOOP;

  IF v_count < 2 THEN
    RAISE EXCEPTION 'Need at least 2 playoff-eligible players (found %).', v_count;
  END IF;

  DELETE FROM playoff_brackets WHERE division_id = p_division_id;

  FOR match_num IN 1 .. FLOOR(v_count::NUMERIC / 2)::INT LOOP
    INSERT INTO playoff_brackets
      (division_id, round_number, match_number,
       player1_id,                    player2_id,
       seed_player1,                  seed_player2, status)
    VALUES
      (p_division_id, 1, match_num,
       v_qualifiers[match_num],       v_qualifiers[v_count - match_num + 1],
       match_num,                     v_count - match_num + 1, 'pending');
  END LOOP;

  v_prev  := FLOOR(v_count::NUMERIC / 2)::INT;
  v_round := 2;
  WHILE v_prev > 1 LOOP
    v_curr := CEIL(v_prev::NUMERIC / 2)::INT;
    FOR match_num IN 1..v_curr LOOP
      INSERT INTO playoff_brackets
        (division_id, round_number, match_number, is_tbd, status)
      VALUES
        (p_division_id, v_round, match_num, true, 'pending');
    END LOOP;
    v_prev  := v_curr;
    v_round := v_round + 1;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_round_robin_schedule(p_division_id uuid, p_season_start date DEFAULT CURRENT_DATE)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_players UUID[];
  v_n       INTEGER;
  v_rounds  INTEGER;
  v_tmp     UUID;
  v_p1      UUID;
  v_p2      UUID;
  v_count   INTEGER := 0;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.league_matches
    WHERE division_id = p_division_id AND week_number IS NOT NULL
    LIMIT 1
  ) THEN
    RETURN -1;
  END IF;

  SELECT ARRAY_AGG(user_id ORDER BY user_id)
  INTO v_players
  FROM public.division_assignments
  WHERE division_id = p_division_id AND status = 'active';

  IF v_players IS NULL OR array_length(v_players, 1) < 2 THEN
    RETURN 0;
  END IF;

  v_n := array_length(v_players, 1);

  IF v_n % 2 = 1 THEN
    v_players := v_players || ARRAY[NULL::UUID];
    v_n       := v_n + 1;
  END IF;

  v_rounds := v_n - 1;

  FOR v_round IN 1..v_rounds LOOP
    v_p1 := v_players[1];
    v_p2 := v_players[v_n];

    IF v_p1 IS NOT NULL AND v_p2 IS NOT NULL THEN
      INSERT INTO public.league_matches
        (division_id, player1_id, player2_id, week_number, status, scheduled_date)
      VALUES
        (p_division_id, v_p1, v_p2, v_round, 'pending',
         p_season_start + ((v_round - 1) * 7));
      v_count := v_count + 1;
    END IF;

    FOR v_i IN 2..(v_n / 2) LOOP
      v_p1 := v_players[v_i];
      v_p2 := v_players[v_n + 1 - v_i];

      IF v_p1 IS NOT NULL AND v_p2 IS NOT NULL THEN
        INSERT INTO public.league_matches
          (division_id, player1_id, player2_id, week_number, status, scheduled_date)
        VALUES
          (p_division_id, v_p1, v_p2, v_round, 'pending',
           p_season_start + ((v_round - 1) * 7));
        v_count := v_count + 1;
      END IF;
    END LOOP;

    v_tmp := v_players[v_n];
    FOR v_j IN REVERSE v_n..3 LOOP
      v_players[v_j] := v_players[v_j - 1];
    END LOOP;
    v_players[2] := v_tmp;
  END LOOP;

  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_blocked_users(p_user_id uuid)
 RETURNS TABLE(id uuid, blocker_id uuid, blocked_user_id uuid, reason text, created_at timestamp with time zone, updated_at timestamp with time zone, blocked_user_name text, blocked_user_email text, blocked_user_profile_picture text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    bu.id,
    bu.blocker_id,
    bu.blocked_user_id,
    bu.reason,
    bu.created_at,
    bu.updated_at,
    COALESCE(p.first_name || ' ' || p.last_name, p.first_name, p.last_name, 'Unknown Player') AS blocked_user_name,
    p.email                    AS blocked_user_email,
    p.profile_picture_url      AS blocked_user_profile_picture
  FROM blocked_users bu
  LEFT JOIN profiles p ON p.id = bu.blocked_user_id
  WHERE bu.blocker_id = p_user_id
  ORDER BY bu.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_division_opponents(p_user_id uuid, p_division_id uuid)
 RETURNS TABLE(user_id uuid, first_name text, last_name text, email text, skill_level integer, wins integer, losses integer, matches_completed integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT p.id, p.first_name, p.last_name, p.email, pl.skill_level,
    COALESCE((SELECT COUNT(*) FROM public.league_matches lm WHERE lm.winner_id = p.id AND lm.division_id = p_division_id AND lm.status = 'completed'), 0)::INTEGER as wins,
    COALESCE((SELECT COUNT(*) FROM public.league_matches lm WHERE (lm.player1_id = p.id OR lm.player2_id = p.id) AND lm.winner_id IS NOT NULL AND lm.winner_id != p.id AND lm.division_id = p_division_id AND lm.status = 'completed'), 0)::INTEGER as losses,
    da.matches_completed
  FROM public.division_assignments da
  JOIN public.profiles p ON p.id = da.user_id
  LEFT JOIN public.players pl ON pl.user_id = p.id
  WHERE da.division_id = p_division_id AND da.user_id != p_user_id AND da.status = 'active'
  ORDER BY da.matches_completed DESC, p.first_name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_or_create_dm(p_other_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_conv_id uuid;
BEGIN
  -- Try to find existing DM between the two users
  SELECT c.id INTO v_conv_id
  FROM conversations c
  JOIN conversation_members m1 ON m1.conversation_id = c.id AND m1.user_id = auth.uid()
  JOIN conversation_members m2 ON m2.conversation_id = c.id AND m2.user_id = p_other_user_id
  WHERE c.is_group = false
  LIMIT 1;

  IF v_conv_id IS NOT NULL THEN
    RETURN v_conv_id;
  END IF;

  -- Create new DM
  INSERT INTO conversations (is_group, created_by)
  VALUES (false, auth.uid())
  RETURNING id INTO v_conv_id;

  INSERT INTO conversation_members (conversation_id, user_id, role)
  VALUES
    (v_conv_id, auth.uid(),        'admin'),
    (v_conv_id, p_other_user_id,   'member');

  RETURN v_conv_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_conversation_admin(p_conversation_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = p_conversation_id
      AND user_id = auth.uid()
      AND role = 'admin'
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_conversation_member(p_conversation_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = p_conversation_id
      AND user_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_user_blocked(p_blocker_id uuid, p_blocked_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM blocked_users
    WHERE blocker_id = p_blocker_id
      AND blocked_user_id = p_blocked_user_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.leave_group(p_conversation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM conversation_members
  WHERE conversation_id = p_conversation_id AND user_id = auth.uid();

  -- Insert system message
  INSERT INTO conversation_messages (conversation_id, sender_id, content, is_system)
  SELECT p_conversation_id, auth.uid(),
    (SELECT COALESCE(first_name || ' ' || last_name, email) FROM profiles WHERE id = auth.uid()) || ' left the group.',
    true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_push_on_notification_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM net.http_post(
    url     := 'https://qrhladnnblgbobcnxjsz.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyaGxhZG5uYmxnYm9iY254anN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDcxNzEsImV4cCI6MjA2NzAyMzE3MX0.XtnqHLXk6WguDHQLetYYEkhS1hNj52NPnuxOHHdhVKY'
               ),
    body    := jsonb_build_object(
                 'userId',    NEW.user_id,
                 'title',     NEW.title,
                 'body',      NEW.message,
                 'type',      COALESCE(NEW.type, 'general'),
                 'metadata',  COALESCE(NEW.metadata, '{}'::jsonb)
               )
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_member_role(p_conversation_id uuid, p_target_user_id uuid, p_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only an existing admin can change roles
  IF NOT EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = p_conversation_id
      AND user_id = auth.uid()
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can change member roles';
  END IF;

  -- Target must be in the group
  IF NOT EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = p_conversation_id
      AND user_id = p_target_user_id
  ) THEN
    RAISE EXCEPTION 'User is not a member of this group';
  END IF;

  IF p_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Role must be admin or member';
  END IF;

  UPDATE conversation_members
  SET role = p_role
  WHERE conversation_id = p_conversation_id
    AND user_id = p_target_user_id;

  -- System message
  INSERT INTO conversation_messages (conversation_id, sender_id, content, is_system)
  SELECT
    p_conversation_id,
    auth.uid(),
    (SELECT COALESCE(TRIM(first_name || ' ' || last_name), email) FROM profiles WHERE id = p_target_user_id)
      || CASE WHEN p_role = 'admin' THEN ' was promoted to admin.' ELSE ' was demoted to member.' END,
    true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_push_subscription_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_league_match_score(p_match_id uuid, p_winner_id uuid, p_set1_p1 integer, p_set1_p2 integer, p_set2_p1 integer, p_set2_p2 integer, p_set3_p1 integer DEFAULT NULL::integer, p_set3_p2 integer DEFAULT NULL::integer, p_tiebreak_p1 integer DEFAULT NULL::integer, p_tiebreak_p2 integer DEFAULT NULL::integer, p_reported_by uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_match          public.league_matches%ROWTYPE;
  v_loser_user_id  UUID;
  v_winner_player  public.players%ROWTYPE;
  v_loser_player   public.players%ROWTYPE;
  v_score          JSONB;
  v_sets           JSONB;
BEGIN
  IF auth.uid() <> p_winner_id THEN
    RAISE EXCEPTION 'Only the winning player can report the match score.';
  END IF;

  SELECT * INTO v_match FROM public.league_matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match % not found.', p_match_id;
  END IF;

  IF v_match.winner_id IS NOT NULL THEN
    RAISE EXCEPTION 'A score has already been submitted for this match.';
  END IF;

  IF p_winner_id NOT IN (v_match.player1_id, v_match.player2_id) THEN
    RAISE EXCEPTION 'Winner is not a participant in match %.', p_match_id;
  END IF;

  v_loser_user_id := CASE
    WHEN p_winner_id = v_match.player1_id THEN v_match.player2_id
    ELSE v_match.player1_id
  END;

  SELECT * INTO v_winner_player FROM public.players WHERE user_id = p_winner_id      LIMIT 1;
  SELECT * INTO v_loser_player  FROM public.players WHERE user_id = v_loser_user_id  LIMIT 1;

  v_sets := jsonb_build_array(
    jsonb_build_object('p1', p_set1_p1, 'p2', p_set1_p2),
    jsonb_build_object('p1', p_set2_p1, 'p2', p_set2_p2)
  );
  IF p_set3_p1 IS NOT NULL THEN
    v_sets := v_sets || jsonb_build_array(jsonb_build_object('p1', p_set3_p1, 'p2', p_set3_p2));
  END IF;

  v_score := jsonb_build_object(
    'sets',        v_sets,
    'tiebreak',    CASE WHEN p_tiebreak_p1 IS NOT NULL
                   THEN jsonb_build_object('p1', p_tiebreak_p1, 'p2', p_tiebreak_p2)
                   ELSE NULL END,
    'reported_by', auth.uid()
  );

  UPDATE public.league_matches SET
    winner_id    = p_winner_id,
    score        = v_score,
    status       = 'completed',
    completed_at = NOW(),
    updated_at   = NOW()
  WHERE id = p_match_id;

  IF v_winner_player.id IS NOT NULL THEN
    UPDATE public.players SET
      wins          = COALESCE(wins,  0) + 1,
      total_matches = COALESCE(total_matches, 0) + 1,
      updated_at    = NOW()
    WHERE id = v_winner_player.id;
  END IF;

  IF v_loser_player.id IS NOT NULL THEN
    UPDATE public.players SET
      losses        = COALESCE(losses, 0) + 1,
      total_matches = COALESCE(total_matches, 0) + 1,
      updated_at    = NOW()
    WHERE id = v_loser_player.id;
  END IF;

  UPDATE public.division_assignments SET
    matches_completed = COALESCE(matches_completed, 0) + 1,
    playoff_eligible  = CASE
      WHEN COALESCE(matches_completed, 0) + 1 >= matches_required THEN true
      ELSE playoff_eligible
    END
  WHERE division_id = v_match.division_id
    AND user_id     = p_winner_id
    AND status      = 'active';

  UPDATE public.division_assignments SET
    matches_completed = COALESCE(matches_completed, 0) + 1,
    playoff_eligible  = CASE
      WHEN COALESCE(matches_completed, 0) + 1 >= matches_required THEN true
      ELSE playoff_eligible
    END
  WHERE division_id = v_match.division_id
    AND user_id     = v_loser_user_id
    AND status      = 'active';

  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (
    v_loser_user_id,
    'match_result',
    'Match Score Reported',
    COALESCE(v_winner_player.name, 'Your opponent')
      || ' reported the score for your recent league match. Please confirm or dispute.',
    jsonb_build_object('match_id', p_match_id, 'winner_id', p_winner_id, 'score', v_score)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_league_match_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_league_match = true AND NEW.league_match_id IS NOT NULL THEN
    IF NEW.status = 'accepted' THEN
      UPDATE public.league_matches
      SET status = 'scheduled', updated_at = NOW()
      WHERE id = NEW.league_match_id;
    ELSIF NEW.status IN ('declined', 'cancelled') THEN
      UPDATE public.league_matches
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = NEW.league_match_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.toggle_reaction(p_message_id uuid, p_emoji text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM message_reactions
    WHERE message_id = p_message_id AND user_id = auth.uid() AND emoji = p_emoji
  ) THEN
    DELETE FROM message_reactions
    WHERE message_id = p_message_id AND user_id = auth.uid() AND emoji = p_emoji;
  ELSE
    INSERT INTO message_reactions (message_id, user_id, emoji)
    VALUES (p_message_id, auth.uid(), p_emoji);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.unblock_user(p_blocked_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM blocked_users
  WHERE blocker_id = auth.uid()
    AND blocked_user_id = p_blocked_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.unlock_slots_for_invite(p_invite_id uuid, p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_invite          RECORD;
    v_unlocked_count  INTEGER := 0;
BEGIN
    -- Fetch the invite (caller must be sender or receiver)
    SELECT * INTO v_invite
    FROM match_invites
    WHERE id = p_invite_id
      AND (sender_id = p_user_id OR receiver_id = p_user_id);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invite not found or access denied';
    END IF;

    -- Unlock receiver's overlapping slots
    WITH unlocked AS (
        UPDATE user_availability
        SET booking_status = NULL,
            updated_at     = NOW()
        WHERE user_id      = v_invite.receiver_id
          AND date         = v_invite.date
          AND start_time  <= v_invite.start_time
          AND end_time    >= v_invite.end_time
          AND booking_status = 'booked'
        RETURNING id
    )
    SELECT COUNT(*) INTO v_unlocked_count FROM unlocked;

    -- Unlock sender's overlapping slots
    WITH unlocked AS (
        UPDATE user_availability
        SET booking_status = NULL,
            updated_at     = NOW()
        WHERE user_id      = v_invite.sender_id
          AND date         = v_invite.date
          AND start_time  <= v_invite.start_time
          AND end_time    >= v_invite.end_time
          AND booking_status = 'booked'
        RETURNING id
    )
    SELECT v_unlocked_count + COUNT(*) INTO v_unlocked_count FROM unlocked;

    RETURN json_build_object(
        'success',         TRUE,
        'invite_id',       p_invite_id,
        'unlocked_count',  v_unlocked_count
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', FALSE,
            'error',   SQLERRM,
            'detail',  SQLSTATE
        );
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_blocked_users_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;

CREATE OR REPLACE FUNCTION public.update_user_schedule_settings_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

