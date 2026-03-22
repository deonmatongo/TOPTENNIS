-- ── Push subscription storage ────────────────────────────────────────────────
-- Each row stores a browser PushSubscription object for one device per user.
-- Multiple devices per user are supported (one row per subscription endpoint).

create table if not exists public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  endpoint      text not null,
  p256dh        text not null,   -- browser-generated DH public key
  auth          text not null,   -- browser-generated auth secret
  user_agent    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- One row per (user, endpoint) pair — re-subscribing overwrites keys
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

-- Users can only read/write their own subscriptions
create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select using (auth.uid() = user_id);

create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

create policy "push_subscriptions_update_own" on public.push_subscriptions
  for update using (auth.uid() = user_id);

create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- ── Auto-updated timestamp ────────────────────────────────────────────────────
create or replace function public.set_push_subscription_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger push_subscriptions_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_push_subscription_updated_at();

-- ── Trigger: deliver push when a notification row is inserted ─────────────────
-- Requires the pg_net extension (enabled by default on Supabase hosted projects).
-- Replace <YOUR_PROJECT_REF> with your actual Supabase project reference.
-- The SUPABASE_SERVICE_ROLE_KEY secret must be set in the Edge Function environment.

create extension if not exists pg_net;

create or replace function public.notify_push_on_notification_insert()
returns trigger language plpgsql security definer as $$
declare
  project_ref  text := current_setting('app.supabase_project_ref', true);
  service_key  text := current_setting('app.supabase_service_role_key', true);
  edge_url     text;
begin
  -- Only proceed if project_ref is configured
  if project_ref is null or project_ref = '' then
    return new;
  end if;

  edge_url := 'https://' || project_ref || '.supabase.co/functions/v1/send-push';

  -- Fire-and-forget HTTP POST to the Edge Function (non-blocking)
  perform net.http_post(
    url     := edge_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body    := jsonb_build_object(
      'userId',     new.user_id,
      'title',      new.title,
      'body',       new.message,
      'tag',        new.id::text,
      'actionUrl',  coalesce(new.action_url, '/dashboard')
    )
  );

  return new;
end;
$$;

create trigger push_on_notification_insert
  after insert on public.notifications
  for each row execute function public.notify_push_on_notification_insert();
