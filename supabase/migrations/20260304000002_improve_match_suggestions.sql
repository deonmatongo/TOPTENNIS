-- ============================================================
-- Improved generate_match_suggestions
--
-- Scoring breakdown (max 100):
--   Skill proximity   : up to 40 pts  (exact = 40, ±1 = 30, ±2 = 18, ±3 = 8)
--   Competitiveness   : up to 20 pts  (exact match = 20, adjacent = 10)
--   Activity level    : up to 20 pts  (≥ 20 matches = 20, scaled linearly)
--   Win-rate balance  : up to 10 pts  (similar win-rate = 10)
--   Availability      : up to 10 pts  (has future availability slots = 10)
--
-- Exclusions:
--   - The target player themselves
--   - Any user who has blocked the target player (either direction)
--   - Any user the target player has already been suggested in the last 7 days
--   - Players with networking_enabled = false
-- ============================================================

CREATE OR REPLACE FUNCTION generate_match_suggestions(
  target_player_id   uuid,
  competitiveness_filter text DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id          uuid;
  v_skill            int;
  v_competitiveness  text;
  v_wins             int;
  v_losses           int;
  v_total            int;
  v_win_rate         numeric;
  v_inserted         int := 0;

  rec RECORD;
  v_skill_score      int;
  v_comp_score       int;
  v_activity_score   int;
  v_winrate_score    int;
  v_avail_score      int;
  v_total_score      int;
  v_reasons          text[];
BEGIN
  -- Fetch the target player's stats
  SELECT p.user_id, p.skill_level, p.competitiveness, p.wins, p.losses,
         COALESCE(p.wins, 0) + COALESCE(p.losses, 0)
  INTO   v_user_id, v_skill, v_competitiveness, v_wins, v_losses, v_total
  FROM   players p
  WHERE  p.id = target_player_id;

  IF v_user_id IS NULL THEN
    RETURN 0;
  END IF;

  v_win_rate := CASE WHEN v_total > 0 THEN (v_wins::numeric / v_total) ELSE 0.5 END;

  -- Clear stale suggestions older than 7 days for this player
  DELETE FROM match_suggestions
  WHERE  player_id = target_player_id
    AND  created_at < now() - interval '7 days';

  -- Build candidate list
  FOR rec IN
    SELECT
      p.id            AS pid,
      p.user_id       AS puid,
      p.skill_level   AS skill,
      p.competitiveness AS comp,
      COALESCE(p.wins, 0)   AS wins,
      COALESCE(p.losses, 0) AS losses,
      COALESCE(p.wins, 0) + COALESCE(p.losses, 0) AS total_matches
    FROM players p
    JOIN profiles pr ON pr.id = p.user_id
    WHERE
      -- Not the target player
      p.id <> target_player_id
      -- Networking enabled (NULL treated as enabled)
      AND COALESCE(pr.networking_enabled, true) = true
      -- Exclude blocked relationships (either direction)
      AND NOT EXISTS (
        SELECT 1 FROM blocked_users b
        WHERE (b.blocker_id = v_user_id AND b.blocked_user_id = p.user_id)
           OR (b.blocker_id = p.user_id AND b.blocked_user_id = v_user_id)
      )
      -- Not already suggested in last 7 days
      AND NOT EXISTS (
        SELECT 1 FROM match_suggestions ms
        WHERE ms.player_id = target_player_id
          AND ms.suggested_player_id = p.id
          AND ms.created_at >= now() - interval '7 days'
      )
      -- Competitiveness filter (optional)
      AND (competitiveness_filter IS NULL OR p.competitiveness = competitiveness_filter)
      -- Skill range: within 3 levels
      AND ABS(COALESCE(p.skill_level, 5) - COALESCE(v_skill, 5)) <= 3
  LOOP
    -- ── Skill proximity score (40 pts max) ──────────────
    CASE ABS(COALESCE(rec.skill, 5) - COALESCE(v_skill, 5))
      WHEN 0 THEN v_skill_score := 40;
      WHEN 1 THEN v_skill_score := 30;
      WHEN 2 THEN v_skill_score := 18;
      ELSE        v_skill_score := 8;
    END CASE;

    -- ── Competitiveness score (20 pts max) ──────────────
    IF rec.comp = v_competitiveness THEN
      v_comp_score := 20;
    ELSIF (rec.comp IN ('casual','intermediate') AND v_competitiveness IN ('casual','intermediate'))
       OR (rec.comp IN ('intermediate','competitive') AND v_competitiveness IN ('intermediate','competitive'))
    THEN
      v_comp_score := 10;
    ELSE
      v_comp_score := 0;
    END IF;

    -- ── Activity score (20 pts max) ──────────────────────
    v_activity_score := LEAST(20, (rec.total_matches * 20 / GREATEST(20, rec.total_matches)));
    -- Simpler: cap at 20, linear up to 20 matches
    v_activity_score := LEAST(20, rec.total_matches);

    -- ── Win-rate balance score (10 pts max) ─────────────
    DECLARE
      v_opp_win_rate numeric;
      v_rate_diff    numeric;
    BEGIN
      v_opp_win_rate := CASE WHEN rec.total_matches > 0
                             THEN (rec.wins::numeric / rec.total_matches)
                             ELSE 0.5 END;
      v_rate_diff := ABS(v_win_rate - v_opp_win_rate);
      v_winrate_score := GREATEST(0, ROUND(10 - (v_rate_diff * 20))::int);
    END;

    -- ── Availability score (10 pts max) ─────────────────
    SELECT CASE WHEN EXISTS (
      SELECT 1 FROM user_availability ua
      WHERE ua.user_id = rec.puid
        AND ua.is_available = true
        AND ua.is_blocked = false
        AND ua.date >= current_date
        AND COALESCE(ua.privacy_level, 'public') <> 'private'
    ) THEN 10 ELSE 0 END
    INTO v_avail_score;

    -- ── Total ────────────────────────────────────────────
    v_total_score := v_skill_score + v_comp_score + v_activity_score + v_winrate_score + v_avail_score;

    -- Build human-readable reasons
    v_reasons := ARRAY[]::text[];

    IF v_skill_score >= 30 THEN
      v_reasons := v_reasons || 'Similar skill level';
    ELSIF v_skill_score >= 18 THEN
      v_reasons := v_reasons || 'Close skill level';
    END IF;

    IF v_comp_score = 20 THEN
      v_reasons := v_reasons || 'Matching play style';
    ELSIF v_comp_score = 10 THEN
      v_reasons := v_reasons || 'Compatible play style';
    END IF;

    IF v_activity_score >= 15 THEN
      v_reasons := v_reasons || 'Very active player';
    ELSIF v_activity_score >= 8 THEN
      v_reasons := v_reasons || 'Active player';
    END IF;

    IF v_winrate_score >= 8 THEN
      v_reasons := v_reasons || 'Balanced match-up';
    END IF;

    IF v_avail_score = 10 THEN
      v_reasons := v_reasons || 'Has available time slots';
    END IF;

    -- Only insert if score is meaningful
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
