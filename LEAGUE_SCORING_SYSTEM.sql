-- ============================================
-- LEAGUE MATCH SCORING & LEADERBOARD SYSTEM
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Update league_matches table to support detailed scoring
ALTER TABLE public.league_matches 
DROP COLUMN IF EXISTS score CASCADE;

ALTER TABLE public.league_matches
ADD COLUMN set1_player1 INTEGER,
ADD COLUMN set1_player2 INTEGER,
ADD COLUMN set2_player1 INTEGER,
ADD COLUMN set2_player2 INTEGER,
ADD COLUMN set3_player1 INTEGER,
ADD COLUMN set3_player2 INTEGER,
ADD COLUMN tiebreak_player1 INTEGER,
ADD COLUMN tiebreak_player2 INTEGER,
ADD COLUMN reported_by_user_id UUID REFERENCES auth.users(id),
ADD COLUMN reported_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN confirmed_by_opponent BOOLEAN DEFAULT false,
ADD COLUMN confirmation_requested_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN disputed BOOLEAN DEFAULT false,
ADD COLUMN dispute_reason TEXT,
ADD COLUMN disputed_at TIMESTAMP WITH TIME ZONE;

-- 2. Add constraints for valid tennis scores
ALTER TABLE public.league_matches
ADD CONSTRAINT valid_set1_scores CHECK (
  (set1_player1 IS NULL AND set1_player2 IS NULL) OR
  (set1_player1 >= 0 AND set1_player1 <= 7 AND set1_player2 >= 0 AND set1_player2 <= 7)
),
ADD CONSTRAINT valid_set2_scores CHECK (
  (set2_player1 IS NULL AND set2_player2 IS NULL) OR
  (set2_player1 >= 0 AND set2_player1 <= 7 AND set2_player2 >= 0 AND set2_player2 <= 7)
),
ADD CONSTRAINT valid_set3_scores CHECK (
  (set3_player1 IS NULL AND set3_player2 IS NULL) OR
  (set3_player1 >= 0 AND set3_player1 <= 7 AND set3_player2 >= 0 AND set3_player2 <= 7)
),
ADD CONSTRAINT valid_tiebreak_scores CHECK (
  (tiebreak_player1 IS NULL AND tiebreak_player2 IS NULL) OR
  (tiebreak_player1 >= 0 AND tiebreak_player2 >= 0)
);

-- 3. Create function to validate tennis match scores
CREATE OR REPLACE FUNCTION public.validate_tennis_score(
  p_set1_p1 INTEGER, p_set1_p2 INTEGER,
  p_set2_p1 INTEGER, p_set2_p2 INTEGER,
  p_set3_p1 INTEGER, p_set3_p2 INTEGER,
  p_winner_id UUID, p_player1_id UUID, p_player2_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_player1_sets INTEGER := 0;
  v_player2_sets INTEGER := 0;
BEGIN
  -- Must have at least 2 sets
  IF p_set1_p1 IS NULL OR p_set1_p2 IS NULL OR p_set2_p1 IS NULL OR p_set2_p2 IS NULL THEN
    RAISE EXCEPTION 'First two sets are required';
  END IF;

  -- Count sets won by each player
  IF p_set1_p1 > p_set1_p2 THEN v_player1_sets := v_player1_sets + 1;
  ELSIF p_set1_p2 > p_set1_p1 THEN v_player2_sets := v_player2_sets + 1;
  END IF;

  IF p_set2_p1 > p_set2_p2 THEN v_player1_sets := v_player1_sets + 1;
  ELSIF p_set2_p2 > p_set2_p1 THEN v_player2_sets := v_player2_sets + 1;
  END IF;

  IF p_set3_p1 IS NOT NULL AND p_set3_p2 IS NOT NULL THEN
    IF p_set3_p1 > p_set3_p2 THEN v_player1_sets := v_player1_sets + 1;
    ELSIF p_set3_p2 > p_set3_p1 THEN v_player2_sets := v_player2_sets + 1;
    END IF;
  END IF;

  -- Winner must have won at least 2 sets
  IF p_winner_id = p_player1_id AND v_player1_sets < 2 THEN
    RAISE EXCEPTION 'Winner must have won at least 2 sets';
  END IF;

  IF p_winner_id = p_player2_id AND v_player2_sets < 2 THEN
    RAISE EXCEPTION 'Winner must have won at least 2 sets';
  END IF;

  -- Validate set scores (must win by 2 or win 7-6)
  IF NOT (
    (p_set1_p1 >= 6 AND p_set1_p1 - p_set1_p2 >= 2) OR 
    (p_set1_p2 >= 6 AND p_set1_p2 - p_set1_p1 >= 2) OR
    (p_set1_p1 = 7 AND p_set1_p2 = 6) OR 
    (p_set1_p2 = 7 AND p_set1_p1 = 6)
  ) THEN
    RAISE EXCEPTION 'Invalid Set 1 score: must win by 2 games or win 7-6';
  END IF;

  IF NOT (
    (p_set2_p1 >= 6 AND p_set2_p1 - p_set2_p2 >= 2) OR 
    (p_set2_p2 >= 6 AND p_set2_p2 - p_set2_p1 >= 2) OR
    (p_set2_p1 = 7 AND p_set2_p2 = 6) OR 
    (p_set2_p2 = 7 AND p_set2_p1 = 6)
  ) THEN
    RAISE EXCEPTION 'Invalid Set 2 score: must win by 2 games or win 7-6';
  END IF;

  IF p_set3_p1 IS NOT NULL AND p_set3_p2 IS NOT NULL THEN
    IF NOT (
      (p_set3_p1 >= 6 AND p_set3_p1 - p_set3_p2 >= 2) OR 
      (p_set3_p2 >= 6 AND p_set3_p2 - p_set3_p1 >= 2) OR
      (p_set3_p1 = 7 AND p_set3_p2 = 6) OR 
      (p_set3_p2 = 7 AND p_set3_p1 = 6)
    ) THEN
      RAISE EXCEPTION 'Invalid Set 3 score: must win by 2 games or win 7-6';
    END IF;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 4. Create function to submit match score (with validation)
CREATE OR REPLACE FUNCTION public.submit_league_match_score(
  p_match_id UUID,
  p_winner_id UUID,
  p_set1_p1 INTEGER, p_set1_p2 INTEGER,
  p_set2_p1 INTEGER, p_set2_p2 INTEGER,
  p_set3_p1 INTEGER DEFAULT NULL, p_set3_p2 INTEGER DEFAULT NULL,
  p_tiebreak_p1 INTEGER DEFAULT NULL, p_tiebreak_p2 INTEGER DEFAULT NULL,
  p_reported_by UUID
) RETURNS UUID AS $$
DECLARE
  v_match RECORD;
  v_is_player BOOLEAN;
BEGIN
  -- Get match details
  SELECT * INTO v_match FROM public.league_matches WHERE id = p_match_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  -- Verify reporter is a player in the match
  IF p_reported_by NOT IN (v_match.player1_id, v_match.player2_id) THEN
    RAISE EXCEPTION 'Only match players can report scores';
  END IF;

  -- Verify match is in correct status
  IF v_match.status NOT IN ('scheduled', 'in_progress') THEN
    RAISE EXCEPTION 'Match must be scheduled or in progress to report score';
  END IF;

  -- Validate tennis score
  PERFORM public.validate_tennis_score(
    p_set1_p1, p_set1_p2, p_set2_p1, p_set2_p2, p_set3_p1, p_set3_p2,
    p_winner_id, v_match.player1_id, v_match.player2_id
  );

  -- Update match with score
  UPDATE public.league_matches
  SET 
    winner_id = p_winner_id,
    set1_player1 = p_set1_p1,
    set1_player2 = p_set1_p2,
    set2_player1 = p_set2_p1,
    set2_player2 = p_set2_p2,
    set3_player1 = p_set3_p1,
    set3_player2 = p_set3_p2,
    tiebreak_player1 = p_tiebreak_p1,
    tiebreak_player2 = p_tiebreak_p2,
    reported_by_user_id = p_reported_by,
    reported_at = NOW(),
    confirmation_requested_at = NOW(),
    status = 'completed',
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_match_id;

  -- Update division assignments (increment matches_completed)
  UPDATE public.division_assignments
  SET matches_completed = matches_completed + 1,
      updated_at = NOW()
  WHERE division_id = v_match.division_id 
    AND user_id IN (v_match.player1_id, v_match.player2_id);

  -- Create notification for opponent to confirm score
  INSERT INTO public.notifications (user_id, type, title, message, action_url, metadata)
  SELECT 
    CASE WHEN p_reported_by = v_match.player1_id THEN v_match.player2_id ELSE v_match.player1_id END,
    'match_result',
    'Match Score Reported',
    'Your opponent has reported the match score. Please review and confirm.',
    '/dashboard?tab=leagues',
    jsonb_build_object('match_id', p_match_id, 'requires_confirmation', true)
  WHERE v_match.player1_id IS NOT NULL;

  RETURN p_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create function to confirm match score
CREATE OR REPLACE FUNCTION public.confirm_league_match_score(
  p_match_id UUID,
  p_confirming_user_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_match RECORD;
BEGIN
  SELECT * INTO v_match FROM public.league_matches WHERE id = p_match_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  -- Verify confirming user is the opponent
  IF p_confirming_user_id NOT IN (v_match.player1_id, v_match.player2_id) THEN
    RAISE EXCEPTION 'Only match players can confirm scores';
  END IF;

  IF p_confirming_user_id = v_match.reported_by_user_id THEN
    RAISE EXCEPTION 'Cannot confirm your own reported score';
  END IF;

  -- Mark as confirmed
  UPDATE public.league_matches
  SET confirmed_by_opponent = true,
      updated_at = NOW()
  WHERE id = p_match_id;

  -- Notify reporter
  INSERT INTO public.notifications (user_id, type, title, message, action_url)
  VALUES (
    v_match.reported_by_user_id,
    'match_confirmed',
    'Match Score Confirmed',
    'Your opponent has confirmed the match score.',
    '/dashboard?tab=leagues'
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create function to dispute match score
CREATE OR REPLACE FUNCTION public.dispute_league_match_score(
  p_match_id UUID,
  p_disputing_user_id UUID,
  p_dispute_reason TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_match RECORD;
BEGIN
  SELECT * INTO v_match FROM public.league_matches WHERE id = p_match_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  -- Verify disputing user is the opponent
  IF p_disputing_user_id NOT IN (v_match.player1_id, v_match.player2_id) THEN
    RAISE EXCEPTION 'Only match players can dispute scores';
  END IF;

  IF p_disputing_user_id = v_match.reported_by_user_id THEN
    RAISE EXCEPTION 'Cannot dispute your own reported score';
  END IF;

  -- Mark as disputed
  UPDATE public.league_matches
  SET disputed = true,
      dispute_reason = p_dispute_reason,
      disputed_at = NOW(),
      status = 'in_progress', -- Revert to in_progress until resolved
      updated_at = NOW()
  WHERE id = p_match_id;

  -- Notify reporter and league admin
  INSERT INTO public.notifications (user_id, type, title, message, action_url, metadata)
  VALUES (
    v_match.reported_by_user_id,
    'match_disputed',
    'Match Score Disputed',
    'Your opponent has disputed the match score. Please review.',
    '/dashboard?tab=leagues',
    jsonb_build_object('match_id', p_match_id, 'dispute_reason', p_dispute_reason)
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create comprehensive leaderboard calculation function
CREATE OR REPLACE FUNCTION public.calculate_division_leaderboard(p_division_id UUID)
RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  matches_played INTEGER,
  matches_won INTEGER,
  matches_lost INTEGER,
  sets_won INTEGER,
  sets_lost INTEGER,
  games_won INTEGER,
  games_lost INTEGER,
  win_percentage NUMERIC,
  points INTEGER,
  rank INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH player_stats AS (
    SELECT 
      da.user_id,
      p.first_name,
      p.last_name,
      -- Matches played (completed and confirmed)
      COUNT(DISTINCT lm.id) FILTER (WHERE lm.status = 'completed' AND lm.confirmed_by_opponent = true) as matches_played,
      -- Matches won
      COUNT(DISTINCT lm.id) FILTER (WHERE lm.winner_id = da.user_id AND lm.status = 'completed' AND lm.confirmed_by_opponent = true) as matches_won,
      -- Matches lost
      COUNT(DISTINCT lm.id) FILTER (WHERE lm.winner_id != da.user_id AND lm.winner_id IS NOT NULL AND lm.status = 'completed' AND lm.confirmed_by_opponent = true) as matches_lost,
      -- Sets won
      COALESCE(SUM(
        CASE 
          WHEN da.user_id = lm.player1_id THEN
            (CASE WHEN lm.set1_player1 > lm.set1_player2 THEN 1 ELSE 0 END) +
            (CASE WHEN lm.set2_player1 > lm.set2_player2 THEN 1 ELSE 0 END) +
            (CASE WHEN lm.set3_player1 > lm.set3_player2 THEN 1 ELSE 0 END)
          WHEN da.user_id = lm.player2_id THEN
            (CASE WHEN lm.set1_player2 > lm.set1_player1 THEN 1 ELSE 0 END) +
            (CASE WHEN lm.set2_player2 > lm.set2_player1 THEN 1 ELSE 0 END) +
            (CASE WHEN lm.set3_player2 > lm.set3_player1 THEN 1 ELSE 0 END)
        END
      ) FILTER (WHERE lm.status = 'completed' AND lm.confirmed_by_opponent = true), 0)::INTEGER as sets_won,
      -- Sets lost
      COALESCE(SUM(
        CASE 
          WHEN da.user_id = lm.player1_id THEN
            (CASE WHEN lm.set1_player1 < lm.set1_player2 THEN 1 ELSE 0 END) +
            (CASE WHEN lm.set2_player1 < lm.set2_player2 THEN 1 ELSE 0 END) +
            (CASE WHEN lm.set3_player1 < lm.set3_player2 THEN 1 ELSE 0 END)
          WHEN da.user_id = lm.player2_id THEN
            (CASE WHEN lm.set1_player2 < lm.set1_player1 THEN 1 ELSE 0 END) +
            (CASE WHEN lm.set2_player2 < lm.set2_player1 THEN 1 ELSE 0 END) +
            (CASE WHEN lm.set3_player2 < lm.set3_player1 THEN 1 ELSE 0 END)
        END
      ) FILTER (WHERE lm.status = 'completed' AND lm.confirmed_by_opponent = true), 0)::INTEGER as sets_lost,
      -- Games won
      COALESCE(SUM(
        CASE 
          WHEN da.user_id = lm.player1_id THEN
            COALESCE(lm.set1_player1, 0) + COALESCE(lm.set2_player1, 0) + COALESCE(lm.set3_player1, 0)
          WHEN da.user_id = lm.player2_id THEN
            COALESCE(lm.set1_player2, 0) + COALESCE(lm.set2_player2, 0) + COALESCE(lm.set3_player2, 0)
        END
      ) FILTER (WHERE lm.status = 'completed' AND lm.confirmed_by_opponent = true), 0)::INTEGER as games_won,
      -- Games lost
      COALESCE(SUM(
        CASE 
          WHEN da.user_id = lm.player1_id THEN
            COALESCE(lm.set1_player2, 0) + COALESCE(lm.set2_player2, 0) + COALESCE(lm.set3_player2, 0)
          WHEN da.user_id = lm.player2_id THEN
            COALESCE(lm.set1_player1, 0) + COALESCE(lm.set2_player1, 0) + COALESCE(lm.set3_player1, 0)
        END
      ) FILTER (WHERE lm.status = 'completed' AND lm.confirmed_by_opponent = true), 0)::INTEGER as games_lost
    FROM public.division_assignments da
    JOIN public.profiles p ON p.id = da.user_id
    LEFT JOIN public.league_matches lm ON 
      lm.division_id = da.division_id AND 
      (lm.player1_id = da.user_id OR lm.player2_id = da.user_id)
    WHERE da.division_id = p_division_id AND da.status = 'active'
    GROUP BY da.user_id, p.first_name, p.last_name
  )
  SELECT 
    ps.user_id,
    ps.first_name,
    ps.last_name,
    ps.matches_played,
    ps.matches_won,
    ps.matches_lost,
    ps.sets_won,
    ps.sets_lost,
    ps.games_won,
    ps.games_lost,
    CASE 
      WHEN ps.matches_played > 0 THEN 
        ROUND((ps.matches_won::NUMERIC / ps.matches_played::NUMERIC) * 100, 2)
      ELSE 0
    END as win_percentage,
    -- Points system: 3 points for win, 0 for loss
    (ps.matches_won * 3) as points,
    RANK() OVER (ORDER BY 
      (ps.matches_won * 3) DESC, -- Points first
      ps.matches_won DESC,        -- Then wins
      ps.sets_won DESC,           -- Then sets won
      ps.games_won DESC           -- Then games won
    )::INTEGER as rank
  FROM player_stats ps
  ORDER BY rank;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create view for easy leaderboard access
CREATE OR REPLACE VIEW public.division_leaderboards AS
SELECT 
  d.id as division_id,
  d.division_name,
  d.league_id,
  lb.*
FROM public.divisions d
CROSS JOIN LATERAL public.calculate_division_leaderboard(d.id) lb;

-- 9. Update RLS policies for new columns
DROP POLICY IF EXISTS "Users can update match scores" ON public.league_matches;
CREATE POLICY "Users can update match scores"
ON public.league_matches FOR UPDATE
USING (auth.uid() IN (player1_id, player2_id) AND status IN ('scheduled', 'in_progress', 'completed'))
WITH CHECK (auth.uid() IN (player1_id, player2_id));

-- 10. Create function to determine playoff qualifiers
CREATE OR REPLACE FUNCTION public.get_playoff_qualifiers(
  p_division_id UUID,
  p_num_qualifiers INTEGER DEFAULT 4
) RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  rank INTEGER,
  points INTEGER,
  matches_won INTEGER,
  qualifies BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    lb.user_id,
    lb.first_name,
    lb.last_name,
    lb.rank,
    lb.points,
    lb.matches_won,
    (lb.rank <= p_num_qualifiers) as qualifies
  FROM public.calculate_division_leaderboard(p_division_id) lb
  ORDER BY lb.rank;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.submit_league_match_score TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_league_match_score TO authenticated;
GRANT EXECUTE ON FUNCTION public.dispute_league_match_score TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_division_leaderboard TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_playoff_qualifiers TO authenticated;
GRANT SELECT ON public.division_leaderboards TO authenticated;

-- ============================================
-- COMPLETED! 
-- This system provides:
-- 1. Proper tennis scoring validation
-- 2. Score submission with opponent confirmation
-- 3. Dispute resolution mechanism
-- 4. Comprehensive leaderboard calculations
-- 5. Playoff qualification tracking
-- 6. Fair play enforcement
-- ============================================
