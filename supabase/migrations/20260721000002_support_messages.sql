-- ─── In-app support chat ──────────────────────────────────────────────────────
-- Persists the in-app Support chat so conversations survive across sessions and
-- can surface in the agent console. One row per message; a "conversation" is all
-- of a user's messages ordered by time. Agents reply with sender = 'agent'
-- (written server-side / via the console using the service role).

create table if not exists public.support_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  sender      text not null check (sender in ('user', 'assistant', 'agent')),
  body        text not null,
  escalated   boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists support_messages_user_time_idx
  on public.support_messages (user_id, created_at);

alter table public.support_messages enable row level security;

-- Players can read and write their own messages. Agents use the service role,
-- which bypasses RLS, to read all threads and post replies.
create policy "Users manage their own support messages"
  on public.support_messages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
