-- ─── Profile visibility flags ────────────────────────────────────────────────
-- The privacy toggles (Show Win/Loss, Show USTA Rating, Show Location) live in
-- the RLS-private app_settings table, so other players' clients can't read them.
-- Mirror them onto the public profiles table (readable by other users) so player
-- search, match suggestions and the profile sheet can enforce them.
--
-- networking_enabled already exists on profiles and is used for discoverability.

alter table public.profiles
  add column if not exists show_win_loss    boolean not null default true,
  add column if not exists show_usta_rating boolean not null default true,
  add column if not exists show_location    boolean not null default true;
