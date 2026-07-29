-- Fix: user_league_matches view should use SECURITY INVOKER so that RLS policies
-- on the underlying league_matches table are enforced for the querying user.
-- Without this, the view runs as the view owner, bypassing RLS entirely.

DROP VIEW IF EXISTS public.user_league_matches;

CREATE VIEW public.user_league_matches WITH (security_invoker = true) AS
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
