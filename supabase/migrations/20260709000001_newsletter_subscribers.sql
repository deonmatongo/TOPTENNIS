-- Newsletter subscribers table
-- Stores email signups from the landing page newsletter and CTA sections.
-- RLS: anyone can subscribe (INSERT); only service role can read or delete.

create table if not exists public.newsletter_subscribers (
  id            uuid        primary key default gen_random_uuid(),
  email         text        not null,
  source        text        not null default 'homepage',   -- 'homepage' | 'cta'
  subscribed_at timestamptz not null default now(),
  active        boolean     not null default true,

  constraint newsletter_subscribers_email_unique unique (email),
  constraint newsletter_subscribers_email_format
    check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

alter table public.newsletter_subscribers enable row level security;

-- Anon users can subscribe (INSERT only — they cannot read other emails)
create policy "Anyone can subscribe"
  on public.newsletter_subscribers
  for insert
  to anon, authenticated
  with check (true);

-- Only service-role / admins can read subscriber list
create policy "Service role can read subscribers"
  on public.newsletter_subscribers
  for select
  to service_role
  using (true);

comment on table public.newsletter_subscribers is
  'Email addresses collected from the Top Tennis landing page newsletter sections.';
