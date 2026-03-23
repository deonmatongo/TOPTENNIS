-- ─────────────────────────────────────────────────────────────────────────────
-- submit_league_match_score
--
-- Only the WINNER may call this function (auth.uid() must map to p_winner_id).
-- 1. Updates matches: scores, winner_id, status = 'completed'
-- 2. Updates players: wins / losses / total_matches for both participants
-- 3. Updates division_assignments: matches_completed; auto-sets playoff_eligible
--    when matches_completed >= matches_required
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.submit_league_match_score(
  p_match_id     UUID,
  p_winner_id    UUID,          -- players.id of the winner (must be the caller)
  p_set1_p1      INTEGER,
  p_set1_p2      INTEGER,
  p_set2_p1      INTEGER,
  p_set2_p2      INTEGER,
  p_set3_p1      INTEGER DEFAULT NULL,
  p_set3_p2      INTEGER DEFAULT NULL,
  p_tiebreak_p1  INTEGER DEFAULT NULL,
  p_tiebreak_p2  INTEGER DEFAULT NULL,
  p_reported_by  UUID    DEFAULT NULL    -- kept for API compat; auth.uid() is used
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_player_id UUID;
  v_match            matches%ROWTYPE;
  v_loser_player_id  UUID;
  v_winner_user_id   UUID;
  v_loser_user_id    UUID;
  v_division_id      UUID;
  v_new_completed    INTEGER;
  v_matches_required INTEGER;
BEGIN
  -- ── 1. Resolve caller's players.id ────────────────────────────────────────
  SELECT id INTO v_caller_player_id
  FROM   public.players
  WHERE  user_id = auth.uid()
  LIMIT  1;

  IF v_caller_player_id IS NULL THEN
    RAISE EXCEPTION 'Player profile not found for current user.';
  END IF;

  -- ── 2. Only the winner may submit ─────────────────────────────────────────
  IF v_caller_player_id <> p_winner_id THEN
    RAISE EXCEPTION 'Only the winning player can report the match score.';
  END IF;

  -- ── 3. Load match ─────────────────────────────────────────────────────────
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match % not found.', p_match_id;
  END IF;

  IF v_match.winner_id IS NOT NULL THEN
    RAISE EXCEPTION 'A score has already been submitted for this match.';
  END IF;

  -- ── 4. Validate winner is a participant ───────────────────────────────────
  IF p_winner_id NOT IN (v_match.player1_id, v_match.player2_id) THEN
    RAISE EXCEPTION 'Winner is not a participant in match %.', p_match_id;
  END IF;

  v_loser_player_id := CASE
    WHEN p_winner_id = v_match.player1_id THEN v_match.player2_id
    ELSE v_match.player1_id
  END;

  -- ── 5. Resolve user IDs ───────────────────────────────────────────────────
  SELECT user_id INTO v_winner_user_id FROM public.players WHERE id = p_winner_id;
  SELECT user_id INTO v_loser_user_id  FROM public.players WHERE id = v_loser_player_id;

  -- ── 6. Update match record ────────────────────────────────────────────────
  UPDATE public.matches SET
    winner_id            = p_winner_id,
    set1_player1         = p_set1_p1,
    set1_player2         = p_set1_p2,
    set2_player1         = p_set2_p1,
    set2_player2         = p_set2_p2,
    set3_player1         = p_set3_p1,
    set3_player2         = p_set3_p2,
    tiebreak_player1     = p_tiebreak_p1,
    tiebreak_player2     = p_tiebreak_p2,
    status               = 'completed',
    reported_by_user_id  = auth.uid(),
    reported_at          = NOW(),
    updated_at           = NOW()
  WHERE id = p_match_id;

  -- ── 7. Update players stats ───────────────────────────────────────────────
  UPDATE public.players SET
    wins          = COALESCE(wins,  0) + 1,
    total_matches = COALESCE(total_matches, 0) + 1,
    updated_at    = NOW()
  WHERE id = p_winner_id;

  UPDATE public.players SET
    losses        = COALESCE(losses, 0) + 1,
    total_matches = COALESCE(total_matches, 0) + 1,
    updated_at    = NOW()
  WHERE id = v_loser_player_id;

  -- ── 8. Find the shared division ───────────────────────────────────────────
  SELECT da.division_id INTO v_division_id
  FROM   public.division_assignments da
  WHERE  da.user_id = v_winner_user_id
    AND  da.status  = 'active'
    AND  EXISTS (
      SELECT 1 FROM public.division_assignments da2
      WHERE  da2.user_id     = v_loser_user_id
        AND  da2.status      = 'active'
        AND  da2.division_id = da.division_id
    )
  LIMIT 1;

  -- Only update assignments if a shared division is found
  IF v_division_id IS NOT NULL THEN

    -- Winner's assignment
    UPDATE public.division_assignments SET
      matches_completed = COALESCE(matches_completed, 0) + 1,
      playoff_eligible  = CASE
        WHEN COALESCE(matches_completed, 0) + 1 >= matches_required THEN true
        ELSE playoff_eligible
      END,
      updated_at = NOW()
    WHERE division_id = v_division_id
      AND user_id     = v_winner_user_id
      AND status      = 'active';

    -- Loser's assignment
    UPDATE public.division_assignments SET
      matches_completed = COALESCE(matches_completed, 0) + 1,
      playoff_eligible  = CASE
        WHEN COALESCE(matches_completed, 0) + 1 >= matches_required THEN true
        ELSE playoff_eligible
      END,
      updated_at = NOW()
    WHERE division_id = v_division_id
      AND user_id     = v_loser_user_id
      AND status      = 'active';

  END IF;

  -- ── 9. Notify loser about the result ─────────────────────────────────────
  INSERT INTO public.notifications (user_id, type, title, message, data)
  SELECT
    v_loser_user_id,
    'match_result',
    'Match Result Submitted',
    (SELECT name FROM public.players WHERE id = p_winner_id LIMIT 1)
      || ' reported the score for your recent match.',
    jsonb_build_object(
      'match_id',   p_match_id,
      'winner_id',  p_winner_id,
      'set1',       jsonb_build_array(p_set1_p1, p_set1_p2),
      'set2',       jsonb_build_array(p_set2_p1, p_set2_p2),
      'set3',       CASE WHEN p_set3_p1 IS NOT NULL
                    THEN jsonb_build_array(p_set3_p1, p_set3_p2) END
    )
  WHERE v_loser_user_id IS NOT NULL;

END;
$$;

-- Grant execute to authenticated users (RLS on matches still applies for reads)
GRANT EXECUTE ON FUNCTION public.submit_league_match_score TO authenticated;
