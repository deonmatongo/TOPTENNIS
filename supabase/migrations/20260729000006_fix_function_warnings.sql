-- Fix plpgsql warnings reported by supabase db lint:
--
--  1. validate_password_strength    — errors TEXT[] := '{}' should use ARRAY[]::TEXT[]
--  2. accept_invite_and_lock_slot   — v_locked_ids UUID[] := '{}' same fix
--  3. generate_playoff_bracket      — same empty-array init + remove v_i from DECLARE
--                                     (only used as FOR loop variable, which creates its own scope)
--  4. generate_round_robin_schedule — remove v_round/v_i/v_j from DECLARE (same reason)
--  5. generate_match_suggestions    — remove unused v_losses variable

-- ── 1. validate_password_strength ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_password_strength(password TEXT)
RETURNS JSONB LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  result JSONB   := '{"valid": true, "errors": []}'::JSONB;
  errors TEXT[]  := ARRAY[]::TEXT[];
BEGIN
  IF LENGTH(password) < 8 THEN
    errors := array_append(errors, 'Password must be at least 8 characters long');
  END IF;
  IF password !~ '[A-Z]' THEN
    errors := array_append(errors, 'Password must contain at least one uppercase letter');
  END IF;
  IF password !~ '[a-z]' THEN
    errors := array_append(errors, 'Password must contain at least one lowercase letter');
  END IF;
  IF password !~ '[0-9]' THEN
    errors := array_append(errors, 'Password must contain at least one number');
  END IF;
  IF password !~ '[!@#$%^&*(),.?":{}|<>]' THEN
    errors := array_append(errors, 'Password must contain at least one special character');
  END IF;
  IF array_length(errors, 1) > 0 THEN
    result := jsonb_build_object('valid', false, 'errors', errors);
  END IF;
  RETURN result;
END;
$$;

-- ── 2. accept_invite_and_lock_slot ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_invite_and_lock_slot(
  p_invite_id               UUID,
  p_user_id                 UUID,
  p_conflicting_invite_ids  UUID[] DEFAULT '{}'::UUID[]
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
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
$$;

-- ── 3. generate_playoff_bracket ──────────────────────────────────────────────
-- Remove v_i from DECLARE (FOR loop creates its own scope); fix array init.
CREATE OR REPLACE FUNCTION public.generate_playoff_bracket(
  p_division_id    UUID,
  p_num_qualifiers INTEGER DEFAULT 4
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
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
$$;

-- ── 4. generate_round_robin_schedule ─────────────────────────────────────────
-- Remove v_round, v_i, v_j from DECLARE — only used as FOR loop variables.
CREATE OR REPLACE FUNCTION public.generate_round_robin_schedule(
  p_division_id  UUID,
  p_season_start DATE DEFAULT CURRENT_DATE
)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
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
$$;

-- ── 5. generate_match_suggestions ────────────────────────────────────────────
-- Remove unused v_losses variable.
CREATE OR REPLACE FUNCTION public.generate_match_suggestions(
  target_player_id       UUID,
  competitiveness_filter TEXT DEFAULT NULL
)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
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
$$;

NOTIFY pgrst, 'reload schema';
