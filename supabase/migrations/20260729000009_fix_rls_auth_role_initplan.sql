-- Fix remaining auth_rls_initplan warnings: wrap auth.role() in (SELECT ...)
-- on the 3 policies missed by the previous migration.

DROP POLICY IF EXISTS "Service role can manage all notifications" ON public.notifications;
CREATE POLICY "Service role can manage all notifications" ON public.notifications
  AS PERMISSIVE
  TO public
  USING ((SELECT auth.role()) = 'service_role'::text)
  WITH CHECK ((SELECT auth.role()) = 'service_role'::text);

DROP POLICY IF EXISTS "Authenticated users can view players for search" ON public.players;
CREATE POLICY "Authenticated users can view players for search" ON public.players
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING ((SELECT auth.role()) = 'authenticated'::text);

DROP POLICY IF EXISTS "Authenticated users can view basic profile info" ON public.profiles;
CREATE POLICY "Authenticated users can view basic profile info" ON public.profiles
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (((SELECT auth.role()) = 'authenticated'::text) AND (id <> (SELECT auth.uid())));
