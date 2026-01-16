-- Fix players table security issue
-- Remove public access and implement restricted policies based on connections

-- Drop the insecure "Anyone can view players" policy
DROP POLICY IF EXISTS "Anyone can view players" ON public.players;

-- Policy 1: Users can view their own full player profile
CREATE POLICY "Users can view their own player profile"
ON public.players
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy 2: Users can view profiles of their accepted friends
CREATE POLICY "Users can view friends' player profiles"
ON public.players
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.friend_requests fr
    WHERE fr.status = 'accepted'
      AND (
        (fr.sender_id = auth.uid() AND fr.receiver_id = players.user_id)
        OR
        (fr.receiver_id = auth.uid() AND fr.sender_id = players.user_id)
      )
  )
);

-- Policy 3: Users can view profiles of players they have matches with
CREATE POLICY "Users can view match participants' profiles"
ON public.players
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.matches m
    JOIN public.players p1 ON m.player1_id = p1.id
    JOIN public.players p2 ON m.player2_id = p2.id
    WHERE (p1.user_id = auth.uid() AND p2.id = players.id)
       OR (p2.user_id = auth.uid() AND p1.id = players.id)
  )
);

-- Policy 4: Users can view profiles of players in their divisions
CREATE POLICY "Users can view division members' profiles"
ON public.players
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.division_assignments da1
    JOIN public.division_assignments da2 ON da1.division_id = da2.division_id
    WHERE da1.user_id = auth.uid()
      AND da2.user_id = players.user_id
      AND da1.status = 'active'
      AND da2.status = 'active'
  )
);

-- Policy 5: Users can view profiles of players who sent or received match invites
CREATE POLICY "Users can view match invite participants' profiles"
ON public.players
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.match_invites mi
    WHERE (mi.sender_id = auth.uid() AND mi.receiver_id = players.user_id)
       OR (mi.receiver_id = auth.uid() AND mi.sender_id = players.user_id)
  )
);

-- Policy 6: Users can view profiles from match suggestions
CREATE POLICY "Users can view suggested players' profiles"
ON public.players
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.match_suggestions ms
    WHERE ms.player_id IN (
      SELECT id FROM public.players WHERE user_id = auth.uid()
    )
    AND ms.suggested_player_id = players.id
    AND ms.status IN ('pending', 'accepted')
  )
  OR
  EXISTS (
    SELECT 1
    FROM public.match_suggestions ms
    WHERE ms.suggested_player_id IN (
      SELECT id FROM public.players WHERE user_id = auth.uid()
    )
    AND ms.player_id = players.id
    AND ms.status IN ('pending', 'accepted')
  )
);