-- Fix user_availability table security issue
-- Remove public access and restrict to authenticated users with legitimate connections

-- Drop the insecure public access policies
DROP POLICY IF EXISTS "Users can view public available slots" ON public.user_availability;
DROP POLICY IF EXISTS "Users can view friends-only available slots" ON public.user_availability;

-- Keep the existing policy for users viewing their own availability
-- "Users can view their own availability" already exists

-- Policy 1: Users can view availability of their accepted friends
CREATE POLICY "Users can view friends' availability"
ON public.user_availability
FOR SELECT
TO authenticated
USING (
  is_available = true
  AND is_blocked = false
  AND EXISTS (
    SELECT 1
    FROM public.friend_requests fr
    WHERE fr.status = 'accepted'
      AND (
        (fr.sender_id = auth.uid() AND fr.receiver_id = user_availability.user_id)
        OR
        (fr.receiver_id = auth.uid() AND fr.sender_id = user_availability.user_id)
      )
  )
);

-- Policy 2: Users can view availability of players they have matches with
CREATE POLICY "Users can view match participants' availability"
ON public.user_availability
FOR SELECT
TO authenticated
USING (
  is_available = true
  AND is_blocked = false
  AND EXISTS (
    SELECT 1
    FROM public.matches m
    JOIN public.players p1 ON m.player1_id = p1.id
    JOIN public.players p2 ON m.player2_id = p2.id
    WHERE (
      (p1.user_id = auth.uid() AND p2.user_id = user_availability.user_id)
      OR
      (p2.user_id = auth.uid() AND p1.user_id = user_availability.user_id)
    )
  )
);

-- Policy 3: Users can view availability of players in their divisions
CREATE POLICY "Users can view division members' availability"
ON public.user_availability
FOR SELECT
TO authenticated
USING (
  is_available = true
  AND is_blocked = false
  AND EXISTS (
    SELECT 1
    FROM public.division_assignments da1
    JOIN public.division_assignments da2 ON da1.division_id = da2.division_id
    WHERE da1.user_id = auth.uid()
      AND da2.user_id = user_availability.user_id
      AND da1.status = 'active'
      AND da2.status = 'active'
  )
);

-- Policy 4: Users can view availability of players with active match invites
CREATE POLICY "Users can view match invite participants' availability"
ON public.user_availability
FOR SELECT
TO authenticated
USING (
  is_available = true
  AND is_blocked = false
  AND EXISTS (
    SELECT 1
    FROM public.match_invites mi
    WHERE mi.status IN ('pending', 'accepted')
      AND (
        (mi.sender_id = auth.uid() AND mi.receiver_id = user_availability.user_id)
        OR
        (mi.receiver_id = auth.uid() AND mi.sender_id = user_availability.user_id)
      )
  )
);

-- IMPORTANT: Blocked times are NEVER visible to anyone except the owner
-- This prevents stalking and privacy violations