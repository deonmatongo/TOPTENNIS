-- Fix all function errors reported by supabase db lint:
--
--  1. check_availability_conflict      — references non-existent match_bookings table
--  2. create_league_match_with_invite  — references non-existent timezone column on match_invites
--  3. submit_league_match_score        — references non-existent updated_at on division_assignments
--  4. confirm_league_match_score       — uses non-existent "data" column on notifications (correct: metadata)
--  5. dispute_league_match_score       — same data→metadata fix
--  6. calculate_player_compatibility   — text[] || 'literal' fails; use array_append()
--  7. generate_match_suggestions       — same array_append fix

-- ── 1. check_availability_conflict ───────────────────────────────────────────
-- Remove the match_bookings subquery (table does not exist).
CREATE OR REPLACE FUNCTION public.check_availability_conflict(
  p_user_id    UUID,
  p_date       DATE,
  p_start_time TIME WITHOUT TIME ZONE,
  p_end_time   TIME WITHOUT TIME ZONE,
  p_exclude_id UUID DEFAULT NULL
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
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
$$;

-- ── 2. create_league_match_with_invite ───────────────────────────────────────
-- Remove timezone from match_invites INSERT (column does not exist on that table).
CREATE OR REPLACE FUNCTION public.create_league_match_with_invite(
  p_division_id    UUID,
  p_player1_id     UUID,
  p_player2_id     UUID,
  p_scheduled_date DATE,
  p_scheduled_time TIME,
  p_timezone       TEXT,
  p_court_location TEXT,
  p_message        TEXT DEFAULT NULL
)
RETURNS UUID AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 3. submit_league_match_score ─────────────────────────────────────────────
-- Remove updated_at from division_assignments UPDATEs (column does not exist).
-- Fix notifications INSERT: data → metadata.
CREATE OR REPLACE FUNCTION public.submit_league_match_score(
  p_match_id     UUID,
  p_winner_id    UUID,
  p_set1_p1      INTEGER,
  p_set1_p2      INTEGER,
  p_set2_p1      INTEGER,
  p_set2_p2      INTEGER,
  p_set3_p1      INTEGER DEFAULT NULL,
  p_set3_p2      INTEGER DEFAULT NULL,
  p_tiebreak_p1  INTEGER DEFAULT NULL,
  p_tiebreak_p2  INTEGER DEFAULT NULL,
  p_reported_by  UUID    DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.submit_league_match_score TO authenticated;

-- ── 4. confirm_league_match_score ────────────────────────────────────────────
-- Fix notifications INSERT: data → metadata.
CREATE OR REPLACE FUNCTION public.confirm_league_match_score(
  p_match_id           UUID,
  p_confirming_user_id UUID
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.confirm_league_match_score(UUID, UUID) TO authenticated;

-- ── 5. dispute_league_match_score ────────────────────────────────────────────
-- Fix notifications INSERT: data → metadata.
CREATE OR REPLACE FUNCTION public.dispute_league_match_score(
  p_match_id          UUID,
  p_disputing_user_id UUID,
  p_dispute_reason    TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.dispute_league_match_score(UUID, UUID, TEXT) TO authenticated;

-- ── 6. calculate_player_compatibility ────────────────────────────────────────
-- Replace text[] || 'literal' with array_append() throughout.
CREATE OR REPLACE FUNCTION public.calculate_player_compatibility(player1_id UUID, player2_id UUID)
RETURNS TABLE(compatibility_score INTEGER, match_reasons TEXT[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  p1              RECORD;
  p2              RECORD;
  score           INTEGER  := 0;
  reasons         TEXT[]   := ARRAY[]::TEXT[];
  age_ranges      TEXT[]   := ARRAY['18-25','26-40','41-54','55-plus'];
  p1_age_index    INTEGER;
  p2_age_index    INTEGER;
  age_difference  INTEGER;
  skill_levels    TEXT[]   := ARRAY['beginner','intermediate','advanced'];
  p1_skill_index  INTEGER;
  p2_skill_index  INTEGER;
BEGIN
  SELECT * INTO p1 FROM public.players WHERE id = player1_id;
  SELECT * INTO p2 FROM public.players WHERE id = player2_id;

  IF player1_id = player2_id THEN
    RETURN QUERY SELECT 0, ARRAY['Same player']::TEXT[];
    RETURN;
  END IF;

  IF p1.id IS NULL OR p2.id IS NULL THEN
    RETURN QUERY SELECT 0, ARRAY['Player not found']::TEXT[];
    RETURN;
  END IF;

  SELECT array_position(age_ranges, p1.age_range) INTO p1_age_index;
  SELECT array_position(age_ranges, p2.age_range) INTO p2_age_index;

  IF p1_age_index IS NOT NULL AND p2_age_index IS NOT NULL THEN
    age_difference := p1_age_index - p2_age_index;

    IF age_difference = 0 THEN
      score   := score + 25;
      reasons := array_append(reasons, 'Same age bracket');
    ELSIF age_difference > 0 AND age_difference <= 2 THEN
      score   := score + 20;
      reasons := array_append(reasons, 'Compatible age brackets');
    ELSIF age_difference < 0 AND age_difference >= -2 THEN
      score   := score + 20;
      reasons := array_append(reasons, 'Compatible age brackets');
    ELSE
      RETURN QUERY SELECT 0, ARRAY['Age brackets incompatible - maximum 2 bracket difference allowed']::TEXT[];
      RETURN;
    END IF;
  END IF;

  SELECT array_position(skill_levels,
    CASE
      WHEN p1.skill_level <= 3              THEN 'beginner'
      WHEN p1.skill_level BETWEEN 4 AND 7   THEN 'intermediate'
      ELSE 'advanced'
    END
  ) INTO p1_skill_index;

  SELECT array_position(skill_levels,
    CASE
      WHEN p2.skill_level <= 3              THEN 'beginner'
      WHEN p2.skill_level BETWEEN 4 AND 7   THEN 'intermediate'
      ELSE 'advanced'
    END
  ) INTO p2_skill_index;

  IF abs(p1_skill_index - p2_skill_index) = 0 THEN
    score   := score + 40;
    reasons := array_append(reasons, 'Exact skill level match');
  ELSIF abs(p1_skill_index - p2_skill_index) = 1 THEN
    score   := score + 25;
    reasons := array_append(reasons, 'Similar skill level');
  ELSE
    reasons := array_append(reasons, 'Different skill levels');
  END IF;

  IF p1.competitiveness = p2.competitiveness THEN
    score   := score + 30;
    reasons := array_append(reasons, 'Same competitiveness level');
  ELSIF (p1.competitiveness = 'fun'      AND p2.competitiveness = 'casual') OR
        (p1.competitiveness = 'casual'   AND p2.competitiveness = 'fun') THEN
    score   := score + 20;
    reasons := array_append(reasons, 'Compatible competitiveness');
  ELSIF (p1.competitiveness = 'casual'      AND p2.competitiveness = 'competitive') OR
        (p1.competitiveness = 'competitive' AND p2.competitiveness = 'casual') THEN
    score   := score + 10;
    reasons := array_append(reasons, 'Moderately compatible competitiveness');
  ELSE
    reasons := array_append(reasons, 'Different competitiveness levels');
  END IF;

  IF p1.gender_preference = 'no-preference' AND p2.gender_preference = 'no-preference' THEN
    score   := score + 5;
    reasons := array_append(reasons, 'Both have no gender preference');
  ELSIF p1.gender_preference = 'same-gender' AND p2.gender_preference = 'same-gender' AND p1.gender = p2.gender THEN
    score   := score + 5;
    reasons := array_append(reasons, 'Same gender preference matched');
  ELSIF p1.gender_preference = 'mixed' AND p2.gender_preference = 'mixed' THEN
    score   := score + 5;
    reasons := array_append(reasons, 'Both prefer mixed matches');
  ELSIF (p1.gender_preference = 'no-preference' AND p2.gender_preference IN ('same-gender','mixed')) OR
        (p2.gender_preference = 'no-preference' AND p1.gender_preference IN ('same-gender','mixed')) THEN
    score   := score + 3;
    reasons := array_append(reasons, 'Compatible gender preferences');
  ELSE
    reasons := array_append(reasons, 'Incompatible gender preferences');
  END IF;

  RETURN QUERY SELECT score, reasons;
END;
$$;

-- ── 7. generate_match_suggestions ────────────────────────────────────────────
-- Replace text[] || 'literal' with array_append() throughout.
CREATE OR REPLACE FUNCTION public.generate_match_suggestions(
  target_player_id     UUID,
  competitiveness_filter TEXT DEFAULT NULL
)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id          UUID;
  v_skill            INT;
  v_competitiveness  TEXT;
  v_wins             INT;
  v_losses           INT;
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
  SELECT p.user_id, p.skill_level, p.competitiveness, p.wins, p.losses,
         COALESCE(p.wins, 0) + COALESCE(p.losses, 0)
  INTO   v_user_id, v_skill, v_competitiveness, v_wins, v_losses, v_total
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
        WHERE ms.player_id         = target_player_id
          AND ms.suggested_player_id = p.id
          AND ms.created_at        >= now() - INTERVAL '7 days'
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
      WHERE ua.user_id         = rec.puid
        AND ua.is_available    = true
        AND ua.is_blocked      = false
        AND ua.date            >= current_date
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
$$;

NOTIFY pgrst, 'reload schema';
