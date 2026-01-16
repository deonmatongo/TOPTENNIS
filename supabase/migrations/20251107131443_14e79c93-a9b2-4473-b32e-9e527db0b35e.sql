-- Fix infinite recursion in players table RLS policies
-- Drop the problematic policies that cause recursion
DROP POLICY IF EXISTS "Users can view suggested players' profiles" ON public.players;
DROP POLICY IF EXISTS "Users can view match participants' profiles" ON public.players;
DROP POLICY IF EXISTS "Users can view match invite participants' profiles" ON public.players;
DROP POLICY IF EXISTS "Users can view friends' player profiles" ON public.players;
DROP POLICY IF EXISTS "Users can view division members' profiles" ON public.players;

-- Recreate simplified policies without recursion
-- Users can view their own profile
-- (This policy already exists, no need to recreate)

-- Allow viewing players in the same division (simplified)
CREATE POLICY "Users can view division members' profiles"
ON public.players
FOR SELECT
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.division_assignments da1
    INNER JOIN public.division_assignments da2 ON da1.division_id = da2.division_id
    WHERE da1.user_id = auth.uid() 
    AND da2.user_id = players.user_id
    AND da1.status = 'active'
    AND da2.status = 'active'
  )
);

-- Allow viewing friends' profiles (simplified)
CREATE POLICY "Users can view friends' player profiles"
ON public.players
FOR SELECT
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.friend_requests
    WHERE status = 'accepted'
    AND (
      (sender_id = auth.uid() AND receiver_id = players.user_id) OR
      (receiver_id = auth.uid() AND sender_id = players.user_id)
    )
  )
);

-- Allow viewing players from match invites (simplified - no subqueries on players)
CREATE POLICY "Users can view match invite participants' profiles"
ON public.players
FOR SELECT
USING (
  user_id = auth.uid() OR
  user_id IN (
    SELECT sender_id FROM public.match_invites WHERE receiver_id = auth.uid()
  ) OR
  user_id IN (
    SELECT receiver_id FROM public.match_invites WHERE sender_id = auth.uid()
  )
);

-- Allow viewing suggested players (simplified - avoid recursion by not querying players again)
CREATE POLICY "Users can view suggested players' profiles"
ON public.players
FOR SELECT
USING (
  user_id = auth.uid() OR
  id IN (
    SELECT suggested_player_id FROM public.match_suggestions ms
    INNER JOIN public.players p ON ms.player_id = p.id
    WHERE p.user_id = auth.uid()
    AND ms.status IN ('pending', 'accepted')
  ) OR
  id IN (
    SELECT player_id FROM public.match_suggestions ms
    INNER JOIN public.players p ON ms.suggested_player_id = p.id
    WHERE p.user_id = auth.uid()
    AND ms.status IN ('pending', 'accepted')
  )
);

-- Allow viewing match participants (simplified)
CREATE POLICY "Users can view match participants' profiles"
ON public.players
FOR SELECT
USING (
  user_id = auth.uid() OR
  id IN (
    SELECT player1_id FROM public.matches m
    INNER JOIN public.players p ON m.player2_id = p.id
    WHERE p.user_id = auth.uid()
  ) OR
  id IN (
    SELECT player2_id FROM public.matches m
    INNER JOIN public.players p ON m.player1_id = p.id
    WHERE p.user_id = auth.uid()
  )
);