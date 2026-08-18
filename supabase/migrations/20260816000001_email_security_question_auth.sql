-- Replace phone+SMS auth with plain email+password auth and a security-question
-- password reset. Phone/Twilio Verify costs money per SMS; this app is
-- pre-revenue, so the goal is the lowest-cost auth that still works.
--
-- This migration does NOT drop user_phone_identities, auth_rate_limits,
-- auth_events, claim_identity() or resolve_phone_for_identifier() — they are
-- left in place (unused) rather than dropped, since dropping them touches
-- already-live data and existing accounts created via the phone flow. It only
-- ADDS the new email/security-question primitives and the functions the new
-- Edge Functions call.

begin;

-- ---------------------------------------------------------------------------
-- 1. user_security_answers -- the answer, kept off profiles
-- ---------------------------------------------------------------------------
-- Same shape as user_phone_identities: service-role only, RLS enabled with
-- zero policies. The answer is never stored in the clear -- only a bcrypt hash
-- via pgcrypto, the same primitive Postgres/GoTrue already use for passwords.
create table if not exists public.user_security_answers (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  question    text not null,
  answer_hash text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint user_security_answers_question_len_chk check (length(trim(question)) between 1 and 200)
);

comment on table public.user_security_answers is
  'PII-adjacent. Service-role only: RLS is enabled with no policies, so anon '
  'and authenticated cannot read or write it directly. Set via '
  'set_security_answer() (the user''s own JWT); verified via '
  'verify_security_answer() (service_role only, from the reset Edge Function).';

alter table public.user_security_answers enable row level security;
revoke all on public.user_security_answers from anon, authenticated;
grant select, insert, update, delete on public.user_security_answers to service_role;

-- ---------------------------------------------------------------------------
-- 2. set_security_answer -- called by the client right after signup
-- ---------------------------------------------------------------------------
-- Runs on the user's own session (auth.uid()), so it can only ever set the
-- caller's own answer. The answer is lowercased and trimmed before hashing so
-- a reset attempt is not defeated by stray whitespace or case.
create or replace function public.set_security_answer(p_question text, p_answer text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  if p_question is null or length(trim(p_question)) = 0 then
    raise exception 'INVALID_QUESTION' using errcode = '22023';
  end if;

  if p_answer is null or length(trim(p_answer)) < 2 then
    raise exception 'INVALID_ANSWER' using errcode = '22023';
  end if;

  insert into public.user_security_answers (user_id, question, answer_hash)
  values (
    v_uid,
    trim(p_question),
    extensions.crypt(lower(trim(p_answer)), extensions.gen_salt('bf'))
  )
  on conflict (user_id) do update
    set question    = excluded.question,
        answer_hash = excluded.answer_hash,
        updated_at  = now();
end;
$function$;

revoke all on function public.set_security_answer(text, text) from public;
grant execute on function public.set_security_answer(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. claim_username -- set the display handle for an email signup
-- ---------------------------------------------------------------------------
-- Mirrors claim_identity() from the phone flow minus the phone-verification
-- gate: an email signup has no OTP step to prove control of anything beyond
-- the password the user just chose, so there is nothing left to check first.
create or replace function public.claim_username(p_username extensions.citext)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  if p_username is null or p_username::text !~ '^[A-Za-z0-9_]{3,20}$' then
    raise exception 'INVALID_USERNAME' using errcode = '22023';
  end if;

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

revoke all on function public.claim_username(extensions.citext) from public;
grant execute on function public.claim_username(extensions.citext) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Password-reset primitives -- service_role only
-- ---------------------------------------------------------------------------
-- Same reasoning as resolve_phone_for_identifier(): turning an email into a
-- user id, or checking a security answer, must never be reachable by anon or
-- authenticated -- both are enumeration oracles if exposed directly.

-- Email -> user id. Reads auth.users directly (SECURITY DEFINER), which is
-- why this cannot be a client-side query: profiles has no email-unique lookup
-- guarantee and auth.users is not exposed over PostgREST at all.
create or replace function public.resolve_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path to ''
as $function$
  select u.id
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;
$function$;

revoke all on function public.resolve_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.resolve_user_id_by_email(text) to service_role;

-- The stored question, for display before the user answers it.
create or replace function public.get_security_question(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select usa.question
  from public.user_security_answers usa
  where usa.user_id = p_user_id;
$function$;

revoke all on function public.get_security_question(uuid) from public, anon, authenticated;
grant execute on function public.get_security_question(uuid) to service_role;

-- Constant-time-ish compare via crypt(): crypt() re-derives the hash using the
-- salt embedded in answer_hash, so this is the same bcrypt verify Postgres
-- uses everywhere else, not a custom comparison.
create or replace function public.verify_security_answer(p_user_id uuid, p_answer text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(
    (
      select extensions.crypt(lower(trim(p_answer)), usa.answer_hash) = usa.answer_hash
      from public.user_security_answers usa
      where usa.user_id = p_user_id
    ),
    false
  );
$function$;

revoke all on function public.verify_security_answer(uuid, text) from public, anon, authenticated;
grant execute on function public.verify_security_answer(uuid, text) to service_role;

commit;
