-- Fix infinite recursion in division_assignments table
DROP POLICY IF EXISTS "Division members can view each other's assignments" ON public.division_assignments;

-- Create a simpler policy without recursion
CREATE POLICY "Division members can view each other's assignments"
ON public.division_assignments
FOR SELECT
USING (
  auth.uid() = user_id OR
  division_id IN (
    SELECT division_id 
    FROM public.division_assignments 
    WHERE user_id = auth.uid() 
    AND status = 'active'
  )
);

-- Fix user_availability policies to remove complex checks that might cause issues
DROP POLICY IF EXISTS "Users can view division members' availability" ON public.user_availability;
DROP POLICY IF EXISTS "Users can view friends' availability" ON public.user_availability;
DROP POLICY IF EXISTS "Users can view match invite participants' availability" ON public.user_availability;
DROP POLICY IF EXISTS "Users can view match participants' availability" ON public.user_availability;

-- Recreate simpler availability viewing policies
CREATE POLICY "Users can view division members' availability"
ON public.user_availability
FOR SELECT
USING (
  is_available = true 
  AND is_blocked = false 
  AND user_id IN (
    SELECT da2.user_id
    FROM public.division_assignments da1
    INNER JOIN public.division_assignments da2 ON da1.division_id = da2.division_id
    WHERE da1.user_id = auth.uid()
    AND da1.status = 'active'
    AND da2.status = 'active'
  )
);

CREATE POLICY "Users can view friends' availability"
ON public.user_availability
FOR SELECT
USING (
  is_available = true 
  AND is_blocked = false 
  AND user_id IN (
    SELECT CASE 
      WHEN sender_id = auth.uid() THEN receiver_id 
      ELSE sender_id 
    END
    FROM public.friend_requests
    WHERE status = 'accepted'
    AND (sender_id = auth.uid() OR receiver_id = auth.uid())
  )
);

CREATE POLICY "Users can view match invite participants' availability"
ON public.user_availability
FOR SELECT
USING (
  is_available = true 
  AND is_blocked = false 
  AND (
    user_id IN (SELECT sender_id FROM public.match_invites WHERE receiver_id = auth.uid() AND status IN ('pending', 'accepted'))
    OR
    user_id IN (SELECT receiver_id FROM public.match_invites WHERE sender_id = auth.uid() AND status IN ('pending', 'accepted'))
  )
);

CREATE POLICY "Users can view match participants' availability"
ON public.user_availability
FOR SELECT
USING (
  is_available = true 
  AND is_blocked = false 
  AND user_id IN (
    SELECT p1.user_id FROM public.matches m
    INNER JOIN public.players p1 ON m.player1_id = p1.id
    INNER JOIN public.players p2 ON m.player2_id = p2.id
    WHERE p2.user_id = auth.uid()
    UNION
    SELECT p2.user_id FROM public.matches m
    INNER JOIN public.players p1 ON m.player1_id = p1.id
    INNER JOIN public.players p2 ON m.player2_id = p2.id
    WHERE p1.user_id = auth.uid()
  )
);