-- C-SEC-03: Block direct username writes via PostgREST
--
-- profiles.username is documented as "set via claim_identity(), never written
-- directly by clients." The UPDATE RLS policy checks auth.uid() = id but has
-- no column restriction, so any authenticated user can write a new username
-- with a direct PostgREST PATCH, bypassing the phone-verification gate in
-- claim_identity().
--
-- This trigger enforces the documented invariant at the DB layer. It raises an
-- exception if NEW.username differs from OLD.username and the caller is not the
-- Postgres service_role. service_role is how Edge Functions and admin tooling
-- write usernames — they always go through claim_identity().

CREATE OR REPLACE FUNCTION public.guard_username_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.username IS DISTINCT FROM OLD.username THEN
    -- current_user is 'authenticator' for PostgREST JWT callers (anon or
    -- authenticated). It is 'postgres' / 'service_role' for direct DB
    -- connections and Edge Functions using the service_role key.
    IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
      RAISE EXCEPTION 'username may only be set via claim_identity()'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_username_change ON public.profiles;
CREATE TRIGGER trg_guard_username_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_username_change();

COMMENT ON FUNCTION public.guard_username_change() IS
  'Blocks direct writes to profiles.username from PostgREST / client JWTs. '
  'Username changes must go through claim_identity() which enforces phone verification.';
