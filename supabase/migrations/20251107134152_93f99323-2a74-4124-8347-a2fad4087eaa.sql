-- Add policy to allow authenticated users to view public availability
-- This enables users to see other players' availability when sending match requests
CREATE POLICY "Authenticated users can view public availability"
ON public.user_availability
FOR SELECT
TO authenticated
USING (
  is_available = true 
  AND is_blocked = false 
  AND privacy_level = 'public'
);