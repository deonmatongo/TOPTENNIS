-- Remove problematic SELECT policies on public.players to stop recursion during profile checks
DROP POLICY IF EXISTS "Users can view division members' profiles" ON public.players;
DROP POLICY IF EXISTS "Users can view friends' player profiles" ON public.players;
DROP POLICY IF EXISTS "Users can view match invite participants' profiles" ON public.players;
DROP POLICY IF EXISTS "Users can view suggested players' profiles" ON public.players;
DROP POLICY IF EXISTS "Users can view match participants' profiles" ON public.players;

-- Ensure the minimal safe policy remains: users can view their own row
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'players'
      AND policyname = 'Users can view their own player profile'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view their own player profile" ON public.players FOR SELECT USING (auth.uid() = user_id)';
  END IF;
END$$;