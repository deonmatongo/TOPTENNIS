-- Fix: division_league_matches view should use SECURITY INVOKER so RLS on the
-- underlying league_matches table is enforced for the querying user.
-- The existing "Users can view their division matches" RLS policy allows this.

DROP VIEW IF EXISTS public.division_league_matches;

CREATE VIEW public.division_league_matches WITH (security_invoker = true) AS
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
