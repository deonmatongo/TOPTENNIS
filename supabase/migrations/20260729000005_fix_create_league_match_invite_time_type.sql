-- Fix: match_invites.start_time and end_time are TIME type, not TEXT.
-- The previous migration cast p_scheduled_time to TEXT which caused a type error.

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
