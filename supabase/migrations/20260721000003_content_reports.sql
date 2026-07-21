-- ─── Content reports (Guideline 1.2 UGC moderation) ─────────────────────────────
-- Lets players report offensive messages, profiles or group chats. Reports are
-- reviewed by the support team (service role) via the agent console. Combined with
-- blocking (blocked_users) and the support contact, this satisfies Apple's UGC rules.

create table if not exists public.content_reports (
  id             uuid primary key default gen_random_uuid(),
  reporter_id    uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid references auth.users(id) on delete set null,
  context        text not null check (context in ('message', 'profile', 'group', 'other')),
  ref_id         text,                 -- id of the message/conversation/etc. being reported
  reason         text not null,
  details        text,
  status         text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at     timestamptz not null default now()
);

create index if not exists content_reports_status_idx on public.content_reports (status, created_at);

alter table public.content_reports enable row level security;

-- Players can file reports and see the ones they filed; the support team uses the
-- service role (which bypasses RLS) to review and action all reports.
create policy "Users can file content reports"
  on public.content_reports for insert
  with check (auth.uid() = reporter_id);

create policy "Users can read their own reports"
  on public.content_reports for select
  using (auth.uid() = reporter_id);
