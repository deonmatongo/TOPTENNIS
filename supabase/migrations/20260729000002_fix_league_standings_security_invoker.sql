-- Fix: league_standings view should use SECURITY INVOKER so it runs with the
-- querying user's permissions rather than the view owner's, satisfying Supabase
-- security advisor. The underlying tables have no RLS so behavior is unchanged.

DROP VIEW IF EXISTS public.league_standings;

CREATE VIEW public.league_standings WITH (security_invoker = true) AS
SELECT
  da.user_id,
  da.division_id,
  d.league_id,
  d.division_name,
  d.gender_preference,
  d.skill_level_range,
  d.season,
  COALESCE(p.name,
    TRIM(CONCAT(prof.first_name, ' ', prof.last_name))) AS player_name,
  prof.profile_picture_url                              AS avatar_url,
  COALESCE(p.wins,           0)  AS wins,
  COALESCE(p.losses,         0)  AS losses,
  COALESCE(p.total_matches,  0)  AS total_matches,
  COALESCE(p.skill_level,    3)  AS skill_level,
  p.usta_rating,
  (COALESCE(p.wins, 0) * 3)
    + FLOOR(da.matches_completed::numeric / 2)         AS points,
  da.matches_completed,
  da.matches_required,
  da.playoff_eligible
FROM division_assignments da
JOIN  divisions d    ON d.id      = da.division_id
LEFT JOIN players p  ON p.user_id = da.user_id
LEFT JOIN profiles prof ON prof.id = da.user_id
WHERE da.status = 'active';

GRANT SELECT ON public.league_standings TO authenticated;
