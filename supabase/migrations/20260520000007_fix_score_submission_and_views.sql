-- ─────────────────────────────────────────────────────────────────────────────
-- Fix 1: invite sync trigger used 'rejected'; respondToInvite sends 'declined'
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_league_match_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
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
$$;

-- Re-create trigger to pick up the updated function body
DROP TRIGGER IF EXISTS sync_league_match_status_trigger ON public.match_invites;
CREATE TRIGGER sync_league_match_status_trigger
  AFTER UPDATE OF status ON public.match_invites
  FOR EACH ROW
  WHEN (NEW.is_league_match = true AND NEW.league_match_id IS NOT NULL)
  EXECUTE FUNCTION public.sync_league_match_status();

-- ─────────────────────────────────────────────────────────────────────────────
-- Fix 2: division_league_matches view (all matches in a division, not just
--         the current user's). Queried by useLeagueMatches for "Other matches"
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.division_league_matches AS
SELECT
  lm.*,
  d.division_name,
  d.league_id,
  p1.first_name  AS player1_first_name,
  p1.last_name   AS player1_last_name,
  p2.first_name  AS player2_first_name,
  p2.last_name   AS player2_last_name,
  NULL::text     AS opponent_name,
  NULL::uuid     AS opponent_id
FROM public.league_matches lm
JOIN public.divisions  d  ON d.id  = lm.division_id
JOIN public.profiles   p1 ON p1.id = lm.player1_id
JOIN public.profiles   p2 ON p2.id = lm.player2_id;

GRANT SELECT ON public.division_league_matches TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Fix 3: submit_league_match_score
--
-- Previous version queried public.matches (wrong table) and expected players.id
-- for p_winner_id (wrong ID type). Both are now corrected:
--   • Reads/writes public.league_matches
--   • p_winner_id is auth.users.id (the value stored in league_matches.player1/2_id)
--   • Score stored as JSONB: { sets:[{p1,p2},...], tiebreak:{p1,p2}, reported_by }
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_league_match_score(
  p_match_id     UUID,
  p_winner_id    UUID,         -- auth.users.id of the winner
  p_set1_p1      INTEGER,
  p_set1_p2      INTEGER,
  p_set2_p1      INTEGER,
  p_set2_p2      INTEGER,
  p_set3_p1      INTEGER DEFAULT NULL,
  p_set3_p2      INTEGER DEFAULT NULL,
  p_tiebreak_p1  INTEGER DEFAULT NULL,
  p_tiebreak_p2  INTEGER DEFAULT NULL,
  p_reported_by  UUID    DEFAULT NULL    -- kept for API compat; not used
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
  -- Only the declared winner may submit
  IF auth.uid() <> p_winner_id THEN
    RAISE EXCEPTION 'Only the winning player can report the match score.';
  END IF;

  -- Load match from league_matches (NOT the legacy matches table)
  SELECT * INTO v_match FROM public.league_matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match % not found.', p_match_id;
  END IF;

  IF v_match.winner_id IS NOT NULL THEN
    RAISE EXCEPTION 'A score has already been submitted for this match.';
  END IF;

  -- Validate winner is a participant (league_matches stores auth.users.id)
  IF p_winner_id NOT IN (v_match.player1_id, v_match.player2_id) THEN
    RAISE EXCEPTION 'Winner is not a participant in match %.', p_match_id;
  END IF;

  v_loser_user_id := CASE
    WHEN p_winner_id = v_match.player1_id THEN v_match.player2_id
    ELSE v_match.player1_id
  END;

  -- Resolve player records (wins/losses live in the players table)
  SELECT * INTO v_winner_player FROM public.players WHERE user_id = p_winner_id   LIMIT 1;
  SELECT * INTO v_loser_player  FROM public.players WHERE user_id = v_loser_user_id LIMIT 1;

  -- Build score JSONB
  v_sets := jsonb_build_array(
    jsonb_build_object('p1', p_set1_p1, 'p2', p_set1_p2),
    jsonb_build_object('p1', p_set2_p1, 'p2', p_set2_p2)
  );
  IF p_set3_p1 IS NOT NULL THEN
    v_sets := v_sets || jsonb_build_array(
      jsonb_build_object('p1', p_set3_p1, 'p2', p_set3_p2)
    );
  END IF;

  v_score := jsonb_build_object(
    'sets',        v_sets,
    'tiebreak',    CASE WHEN p_tiebreak_p1 IS NOT NULL
                   THEN jsonb_build_object('p1', p_tiebreak_p1, 'p2', p_tiebreak_p2)
                   ELSE NULL END,
    'reported_by', auth.uid()
  );

  -- Update league_matches
  UPDATE public.league_matches SET
    winner_id    = p_winner_id,
    score        = v_score,
    status       = 'completed',
    completed_at = NOW(),
    updated_at   = NOW()
  WHERE id = p_match_id;

  -- Update players stats
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

  -- Update division_assignments: matches_completed + playoff_eligible
  UPDATE public.division_assignments SET
    matches_completed = COALESCE(matches_completed, 0) + 1,
    playoff_eligible  = CASE
      WHEN COALESCE(matches_completed, 0) + 1 >= matches_required THEN true
      ELSE playoff_eligible
    END,
    updated_at = NOW()
  WHERE division_id = v_match.division_id
    AND user_id     = p_winner_id
    AND status      = 'active';

  UPDATE public.division_assignments SET
    matches_completed = COALESCE(matches_completed, 0) + 1,
    playoff_eligible  = CASE
      WHEN COALESCE(matches_completed, 0) + 1 >= matches_required THEN true
      ELSE playoff_eligible
    END,
    updated_at = NOW()
  WHERE division_id = v_match.division_id
    AND user_id     = v_loser_user_id
    AND status      = 'active';

  -- Notify loser
  INSERT INTO public.notifications (user_id, type, title, message, data)
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

-- ─────────────────────────────────────────────────────────────────────────────
-- Fix 4: confirm_league_match_score (called by the losing player)
-- ─────────────────────────────────────────────────────────────────────────────
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

  -- Must be a participant but not the reporter
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

  -- Notify winner
  INSERT INTO public.notifications (user_id, type, title, message, data)
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

-- ─────────────────────────────────────────────────────────────────────────────
-- Fix 5: dispute_league_match_score (called by the losing player)
-- ─────────────────────────────────────────────────────────────────────────────
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

  -- Notify winner of the dispute
  INSERT INTO public.notifications (user_id, type, title, message, data)
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

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
