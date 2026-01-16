-- Fix all security errors and warnings
-- Part 1: Fix matches table security (PUBLIC_MATCH_DATA error)

-- Drop the insecure public access policy
DROP POLICY IF EXISTS "Anyone can view matches" ON public.matches;

-- Users can view their own matches (as participants)
CREATE POLICY "Users can view matches they participate in"
ON public.matches
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.players p
    WHERE (p.id = matches.player1_id OR p.id = matches.player2_id)
      AND p.user_id = auth.uid()
  )
);

-- Users can view matches of players in their divisions
CREATE POLICY "Users can view division members' matches"
ON public.matches
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.players p1
    JOIN public.division_assignments da1 ON da1.user_id = p1.user_id
    JOIN public.division_assignments da2 ON da2.division_id = da1.division_id
    WHERE (p1.id = matches.player1_id OR p1.id = matches.player2_id)
      AND da2.user_id = auth.uid()
      AND da1.status = 'active'
      AND da2.status = 'active'
  )
);

-- Part 2: Fix match_reminders table security (PUBLIC_REMINDER_DATA error)
-- The existing policies are already correct, but let's verify they're restrictive enough
-- Drop any public policies that might exist
DROP POLICY IF EXISTS "Anyone can view match reminders" ON public.match_reminders;

-- The existing "Users can view their own reminders" policy is correct
-- The existing "System can manage reminders" policy is correct

-- Part 3: Fix divisions table security (PUBLIC_DIVISION_DATA warning)
-- Drop the public access policy
DROP POLICY IF EXISTS "Anyone can view divisions" ON public.divisions;

-- Only authenticated users can view divisions
CREATE POLICY "Authenticated users can view divisions"
ON public.divisions
FOR SELECT
TO authenticated
USING (true);

-- Keep the "System can manage divisions" policy as is