-- Phone + username authentication: schema foundation
--
-- Adds the identity primitives for SMS/password auth. Nothing here is
-- destructive and nothing here removes email auth -- the clients keep working
-- unchanged until they are cut over in a later stage.
--
-- Deliberate deviations from the original spec, each forced by the live schema:
--
--   * phone_e164 / verified_at live in user_phone_identities, NOT on profiles.
--     The existing "Authenticated users can view basic profile info" policy
--     grants SELECT on every column of every other row, so a phone number
--     stored on profiles would be readable by any signed-in user.
--
--   * profiles.username is NULLABLE. The on_auth_user_created trigger INSERTs
--     into profiles for every auth.users row; a NOT NULL column with no default
--     would make that trigger throw, and a trigger failure on auth.users aborts
--     signup for the entire project.
--
--   * Uniqueness is enforced by a UNIQUE constraint on the citext column rather
--     than a unique index on lower(username). Under citext the constraint is
--     already case-insensitive, so the lower() index would be pure duplicate
--     work on every write.
--
--   * username allows [A-Za-z0-9_] and is stored as typed. The spec asks for
--     case-insensitive uniqueness AND "display as typed", which is only
--     meaningful if mixed case is accepted; case-folding on input would make
--     "display as typed" a no-op.

begin;

-- ---------------------------------------------------------------------------
-- 1. citext -- case-insensitive comparison, case-preserving storage
-- ---------------------------------------------------------------------------
-- Placed in `extensions` to match pgcrypto and uuid-ossp on this project.
create extension if not exists citext with schema extensions;

-- ---------------------------------------------------------------------------
-- 2. profiles.username
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists username extensions.citext;

alter table public.profiles
  add constraint profiles_username_key unique (username);

-- Server-side charset/length guard. Client-side validation is UX only.
alter table public.profiles
  add constraint profiles_username_format_chk
  check (username is null or username::text ~ '^[A-Za-z0-9_]{3,20}$');

comment on column public.profiles.username is
  'Case-insensitive unique handle. Stored as typed. Set via claim_identity(), '
  'never written directly by clients.';

-- ---------------------------------------------------------------------------
-- 3. user_phone_identities -- the phone number, kept off profiles
-- ---------------------------------------------------------------------------
create table if not exists public.user_phone_identities (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  phone_e164  text        not null unique,
  verified_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint user_phone_identities_e164_chk
    check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);

comment on table public.user_phone_identities is
  'PII. Service-role only: RLS is enabled with no policies, so anon and '
  'authenticated cannot read or write it under any circumstances. The '
  'username -> phone resolution needed at login happens in an Edge Function '
  'using the service role key and never returns the number to the client.';

alter table public.user_phone_identities enable row level security;
revoke all on public.user_phone_identities from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. players.email -- phone-only users have no email address
-- ---------------------------------------------------------------------------
-- usePlayerProfile.ts inserts user.email into this NOT NULL column at
-- onboarding. For a phone-only signup that value is NULL, which made
-- onboarding impossible to complete.
alter table public.players alter column email drop not null;

-- ---------------------------------------------------------------------------
-- 5. Rate-limit ledger for the Edge Functions we own
-- ---------------------------------------------------------------------------
-- Fixed-window counters. `subject_hash` is a salted hash of a phone number, IP
-- or user id -- never the raw value.
create table if not exists public.auth_rate_limits (
  bucket       text        not null,
  subject_hash text        not null,
  window_start timestamptz not null,
  hits         integer     not null default 0,
  primary key (bucket, subject_hash, window_start)
);

create index if not exists auth_rate_limits_window_idx
  on public.auth_rate_limits (window_start);

alter table public.auth_rate_limits enable row level security;
revoke all on public.auth_rate_limits from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Auth event log
-- ---------------------------------------------------------------------------
-- Correlation-ID'd audit trail. Phone numbers are masked to their last 4
-- digits by a CHECK constraint, so a logging bug cannot write a full number.
create table if not exists public.auth_events (
  id             bigint generated always as identity primary key,
  correlation_id uuid        not null,
  event          text        not null,
  outcome        text,
  user_id        uuid        references auth.users(id) on delete set null,
  phone_last4    text,
  subject_hash   text,
  detail         jsonb,
  created_at     timestamptz not null default now(),
  constraint auth_events_phone_last4_chk
    check (phone_last4 is null or phone_last4 ~ '^[0-9]{4}$')
);

create index if not exists auth_events_created_idx
  on public.auth_events (created_at desc);
create index if not exists auth_events_correlation_idx
  on public.auth_events (correlation_id);

alter table public.auth_events enable row level security;
revoke all on public.auth_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. handle_new_user -- make it survive phone signups
-- ---------------------------------------------------------------------------
-- Changes from the live version:
--   * ON CONFLICT (id) DO NOTHING, so a pre-existing profiles row can no
--     longer abort signup.
--   * phone is read from NEW.phone (where GoTrue puts it for a phone signup)
--     as well as from metadata (where the email clients put it). The leading
--     '+' is normalised in either direction.
--   * email is no longer copied into user_activity_log.metadata. It is PII and
--     the log has no need of it; the identity *kind* is recorded instead.
--   * username is deliberately NOT read from metadata. A duplicate handle would
--     raise unique_violation inside this trigger and abort the whole signup;
--     usernames are claimed afterwards via claim_identity(), which reports the
--     collision cleanly without destroying the session.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  new_membership_id text;
begin
  select public.generate_membership_id() into new_membership_id;

  insert into public.profiles (
    id,
    first_name,
    last_name,
    email,
    phone,
    is_active,
    profile_completed,
    membership_id
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'phone', ''),
      case
        when coalesce(new.phone, '') = '' then null
        else '+' || regexp_replace(new.phone, '^\+', '')
      end
    ),
    true,
    false,
    new_membership_id
  )
  on conflict (id) do nothing;

  insert into public.user_activity_log (user_id, activity_type, metadata)
  values (
    new.id,
    'user_registered',
    jsonb_build_object(
      'created_at',    new.created_at,
      'membership_id', new_membership_id,
      'identity',      case
                         when coalesce(new.phone, '') <> '' then 'phone'
                         else 'email'
                       end
    )
  );

  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 8. claim_identity -- the transactional half of signup step 5
-- ---------------------------------------------------------------------------
-- Called by the client with its own JWT immediately after verifyOtp succeeds.
-- Replaces the Edge Function the spec asked for: two PostgREST calls from a
-- function cannot share a transaction, whereas this genuinely can.
--
-- The phone number is read server-side from auth.users, so the client never
-- sends it and cannot claim a number it has not proven control of --
-- phone_confirmed_at must already be set by GoTrue.
create or replace function public.claim_identity(p_username extensions.citext)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid       uuid := auth.uid();
  v_phone     text;
  v_confirmed timestamptz;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  if p_username is null or p_username::text !~ '^[A-Za-z0-9_]{3,20}$' then
    raise exception 'INVALID_USERNAME' using errcode = '22023';
  end if;

  select u.phone, u.phone_confirmed_at
    into v_phone, v_confirmed
  from auth.users u
  where u.id = v_uid;

  if coalesce(v_phone, '') = '' or v_confirmed is null then
    raise exception 'PHONE_NOT_VERIFIED' using errcode = '28000';
  end if;

  begin
    insert into public.user_phone_identities (user_id, phone_e164, verified_at)
    values (v_uid, '+' || regexp_replace(v_phone, '^\+', ''), v_confirmed)
    on conflict (user_id) do update
      set phone_e164  = excluded.phone_e164,
          verified_at = excluded.verified_at,
          updated_at  = now();
  exception
    when unique_violation then
      -- phone_e164 is already bound to a different account
      raise exception 'PHONE_TAKEN' using errcode = 'P0001';
  end;

  begin
    update public.profiles
       set username   = p_username,
           updated_at = now()
     where id = v_uid;
  exception
    when unique_violation then
      raise exception 'USERNAME_TAKEN' using errcode = 'P0001';
  end;
end;
$function$;

revoke all on function public.claim_identity(extensions.citext) from public;
grant execute on function public.claim_identity(extensions.citext) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. display_name -- stop phone-only users collapsing messages to NULL
-- ---------------------------------------------------------------------------
-- Four functions below built their display name as
--   COALESCE(TRIM(first_name || ' ' || last_name), email)
-- which is NULL whenever either name part is NULL *and* email is NULL. NULL
-- then propagates through `|| ' left the group.'`, so the entire system message
-- became NULL. Phone-only users have no email, so this stopped being a corner
-- case and became the default.
create or replace function public.display_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(
    (
      select coalesce(
        nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
        p.username::text
      )
      from public.profiles p
      where p.id = p_user_id
    ),
    'A player'
  );
$function$;

comment on function public.display_name(uuid) is
  'Never returns NULL. Name, else username, else a neutral placeholder.';

-- Redefinitions below are byte-for-byte the live bodies with only the
-- display-name expression replaced.

create or replace function public.create_group_chat(p_name text, p_member_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_conv_id uuid;
  v_member  uuid;
  v_creator_name text;
BEGIN
  INSERT INTO conversations (name, is_group, created_by)
  VALUES (p_name, true, auth.uid())
  RETURNING id INTO v_conv_id;

  INSERT INTO conversation_members (conversation_id, user_id, role)
  VALUES (v_conv_id, auth.uid(), 'admin');

  FOREACH v_member IN ARRAY p_member_ids LOOP
    INSERT INTO conversation_members (conversation_id, user_id, role)
    VALUES (v_conv_id, v_member, 'member')
    ON CONFLICT DO NOTHING;

    INSERT INTO notifications (user_id, type, title, message, read, action_url, metadata)
    VALUES (
      v_member,
      'group_invite',
      'Added to a group chat',
      'You were added to the group "' || p_name || '"',
      false,
      '/dashboard?tab=messages',
      jsonb_build_object('conversation_id', v_conv_id, 'created_by', auth.uid())
    );
  END LOOP;

  -- System welcome message
  v_creator_name := public.display_name(auth.uid());

  INSERT INTO conversation_messages (conversation_id, sender_id, content, is_system)
  VALUES (v_conv_id, auth.uid(), v_creator_name || ' created the group. Welcome everyone! 🎾', true);

  RETURN v_conv_id;
END;
$function$;

create or replace function public.create_group_chat(p_name text, p_member_ids uuid[], p_description text DEFAULT NULL::text, p_group_type text DEFAULT 'private'::text, p_avatar_emoji text DEFAULT NULL::text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_conv_id      uuid;
  v_member       uuid;
  v_creator_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Group name cannot be empty';
  END IF;

  -- Create conversation
  INSERT INTO conversations (name, is_group, created_by, description, group_type, avatar_emoji)
  VALUES (trim(p_name), true, auth.uid(), p_description, p_group_type, p_avatar_emoji)
  RETURNING id INTO v_conv_id;

  -- Add creator as admin
  INSERT INTO conversation_members (conversation_id, user_id, role)
  VALUES (v_conv_id, auth.uid(), 'admin');

  -- Add each selected member
  IF p_member_ids IS NOT NULL THEN
    FOREACH v_member IN ARRAY p_member_ids LOOP
      IF v_member <> auth.uid() THEN
        INSERT INTO conversation_members (conversation_id, user_id, role)
        VALUES (v_conv_id, v_member, 'member')
        ON CONFLICT DO NOTHING;

        -- Notification for each added member
        INSERT INTO notifications (user_id, type, title, message, read, action_url, metadata)
        VALUES (
          v_member,
          'group_invite',
          'New Group Invitation',
          'You have been added to the group: ' || trim(p_name),
          false,
          '/dashboard?tab=social',
          jsonb_build_object(
            'conversation_id', v_conv_id,
            'group_name', trim(p_name),
            'invited_by', auth.uid()
          )
        );
      END IF;
    END LOOP;
  END IF;

  -- Creator name for system message
  v_creator_name := public.display_name(auth.uid());

  -- System welcome message
  INSERT INTO conversation_messages (conversation_id, sender_id, content, is_system)
  VALUES (v_conv_id, auth.uid(),
    v_creator_name || ' created the group. Welcome everyone! 🎾',
    true);

  RETURN v_conv_id;
END;
$function$;

create or replace function public.leave_group(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
BEGIN
  DELETE FROM conversation_members
  WHERE conversation_id = p_conversation_id AND user_id = auth.uid();

  -- Insert system message
  INSERT INTO conversation_messages (conversation_id, sender_id, content, is_system)
  SELECT p_conversation_id, auth.uid(),
    public.display_name(auth.uid()) || ' left the group.',
    true;
END;
$function$;

create or replace function public.set_member_role(p_conversation_id uuid, p_target_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
BEGIN
  -- Only an existing admin can change roles
  IF NOT EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = p_conversation_id
      AND user_id = auth.uid()
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can change member roles';
  END IF;

  -- Target must be in the group
  IF NOT EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = p_conversation_id
      AND user_id = p_target_user_id
  ) THEN
    RAISE EXCEPTION 'User is not a member of this group';
  END IF;

  IF p_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Role must be admin or member';
  END IF;

  UPDATE conversation_members
  SET role = p_role
  WHERE conversation_id = p_conversation_id
    AND user_id = p_target_user_id;

  -- System message
  INSERT INTO conversation_messages (conversation_id, sender_id, content, is_system)
  SELECT
    p_conversation_id,
    auth.uid(),
    public.display_name(p_target_user_id)
      || CASE WHEN p_role = 'admin' THEN ' was promoted to admin.' ELSE ' was demoted to member.' END,
    true;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 10. consume_rate_limit -- atomic fixed-window counter
-- ---------------------------------------------------------------------------
-- One statement, so concurrent requests cannot both read a stale count and
-- both decide they are under the limit.
--
-- Called only by Edge Functions holding the service role key. Execute is
-- revoked from anon/authenticated: a client that could increment or inspect
-- these counters could also map out which phone numbers exist.
create or replace function public.consume_rate_limit(
  p_bucket         text,
  p_subject_hash   text,
  p_limit          integer,
  p_window_seconds integer
)
returns table (allowed boolean, hits integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_window_start timestamptz;
  v_hits         integer;
begin
  -- Floor the clock to the start of the current fixed window.
  v_window_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into public.auth_rate_limits as rl (bucket, subject_hash, window_start, hits)
  values (p_bucket, p_subject_hash, v_window_start, 1)
  on conflict (bucket, subject_hash, window_start)
    do update set hits = rl.hits + 1
  returning rl.hits into v_hits;

  return query select
    v_hits <= p_limit,
    v_hits,
    greatest(
      0,
      ceil(extract(epoch from (
        v_window_start + make_interval(secs => p_window_seconds) - clock_timestamp()
      )))::integer
    );
end;
$function$;

revoke all on function public.consume_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;

-- Read the current window's count WITHOUT incrementing it.
--
-- Needed because a login has to know how many failures precede it before it
-- decides whether to answer. Using consume() for that would count every
-- successful login as an attempt and eventually throttle a legitimate user out
-- of their own account.
--
-- Not marked STABLE: it reads clock_timestamp() to pick the window, which must
-- match consume_rate_limit() exactly.
create or replace function public.peek_rate_limit(
  p_bucket         text,
  p_subject_hash   text,
  p_window_seconds integer
)
returns integer
language sql
security definer
set search_path to ''
as $function$
  select coalesce((
    select rl.hits
    from public.auth_rate_limits rl
    where rl.bucket = p_bucket
      and rl.subject_hash = p_subject_hash
      and rl.window_start = to_timestamp(
        floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
      )
  ), 0);
$function$;

revoke all on function public.peek_rate_limit(text, text, integer) from public, anon, authenticated;
grant execute on function public.peek_rate_limit(text, text, integer) to service_role;

-- Clear a counter. Called after a successful login so one correct password
-- wipes the failure streak rather than leaving the user part-throttled.
create or replace function public.reset_rate_limit(p_bucket text, p_subject_hash text)
returns void
language sql
security definer
set search_path to ''
as $function$
  delete from public.auth_rate_limits
  where bucket = p_bucket and subject_hash = p_subject_hash;
$function$;

revoke all on function public.reset_rate_limit(text, text) from public, anon, authenticated;
grant execute on function public.reset_rate_limit(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 11. resolve_phone_for_identifier -- the username -> phone hop, server-side
-- ---------------------------------------------------------------------------
-- This is the single most sensitive function in the schema: it turns a public
-- handle into PII. Execute is granted to service_role ONLY. If anon or
-- authenticated could reach it, it would be both a PII leak and an account
-- enumeration oracle -- exactly what routing login through an Edge Function
-- exists to prevent.
--
-- Accepts either a username or an already-normalised E.164 number so the login
-- and reset paths share one code path and therefore one timing profile.
create or replace function public.resolve_phone_for_identifier(p_identifier text)
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select upi.phone_e164
  from public.user_phone_identities upi
  where upi.verified_at is not null
    and (
      upi.phone_e164 = p_identifier
      or upi.user_id = (
        select p.id
        from public.profiles p
        where p.username = p_identifier::extensions.citext
      )
    )
  limit 1;
$function$;

revoke all on function public.resolve_phone_for_identifier(text) from public, anon, authenticated;
grant execute on function public.resolve_phone_for_identifier(text) to service_role;

-- ---------------------------------------------------------------------------
-- 12. Explicit service_role grants
-- ---------------------------------------------------------------------------
-- The Edge Functions reach these three tables with the service role key. They
-- would inherit access from Supabase's default privileges anyway, but being
-- explicit means a future change to those defaults cannot silently break auth.
grant select, insert, update, delete
  on public.user_phone_identities,
     public.auth_rate_limits,
     public.auth_events
  to service_role;

commit;
