# SQL archive

One-off SQL files that were run manually against the production Supabase
project before the migrations directory became the source of truth. They are
kept because some contain the only record of schema that exists in prod
(e.g. the `league_matches` scoring columns in `LEAGUE_SCORING_SYSTEM.sql`).

Do not run these again — the parts that still matter are superseded by
`supabase/migrations/`, most recently `20260702000001_mobile_backend_alignment.sql`.
New schema changes belong in `supabase/migrations/`.
