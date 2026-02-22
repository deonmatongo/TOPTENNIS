-- ─── app_settings ────────────────────────────────────────────────────────────
create table if not exists public.app_settings (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,

  -- Privacy
  profile_visibility        text not null default 'public' check (profile_visibility in ('public', 'friends_only', 'private')),
  show_win_loss             boolean not null default true,
  show_usta_rating          boolean not null default true,
  show_location             boolean not null default true,
  networking_enabled        boolean not null default true,

  -- Notifications (mirrors notification_settings for unified storage)
  push_enabled              boolean not null default true,
  email_enabled             boolean not null default false,
  match_invites             boolean not null default true,
  match_reminders           boolean not null default true,
  match_accepted            boolean not null default true,
  match_declined            boolean not null default true,
  league_updates            boolean not null default true,
  score_submitted           boolean not null default true,
  score_confirmed           boolean not null default true,
  friend_requests           boolean not null default true,
  messages                  boolean not null default true,
  achievements              boolean not null default true,

  -- Match preferences
  preferred_match_duration  integer not null default 60 check (preferred_match_duration in (30, 60, 90, 120)),
  preferred_surface         text not null default 'any' check (preferred_surface in ('any', 'hard', 'clay', 'grass', 'indoor')),
  preferred_time_of_day     text not null default 'any' check (preferred_time_of_day in ('any', 'morning', 'afternoon', 'evening')),
  max_travel_distance       integer not null default 25 check (max_travel_distance in (5, 10, 25, 50)),

  -- App preferences
  dark_mode                 boolean not null default false,
  haptics_enabled           boolean not null default true,
  sound_effects             boolean not null default true,
  auto_confirm_scores       boolean not null default false,
  show_match_tips           boolean not null default true,
  compact_leaderboard       boolean not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (user_id)
);

-- ─── notification_settings ───────────────────────────────────────────────────
create table if not exists public.notification_settings (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,

  push_enabled    boolean not null default true,
  email_enabled   boolean not null default false,
  match_invites   boolean not null default true,
  match_accepted  boolean not null default true,
  match_declined  boolean not null default true,
  match_reminders boolean not null default true,
  league_updates  boolean not null default true,
  score_submitted boolean not null default true,
  score_confirmed boolean not null default true,
  friend_requests boolean not null default true,
  messages        boolean not null default true,
  achievements    boolean not null default true,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (user_id)
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.app_settings enable row level security;
alter table public.notification_settings enable row level security;

create policy "Users can manage their own app_settings"
  on public.app_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage their own notification_settings"
  on public.notification_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── updated_at triggers ─────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

create trigger notification_settings_updated_at
  before update on public.notification_settings
  for each row execute function public.set_updated_at();
