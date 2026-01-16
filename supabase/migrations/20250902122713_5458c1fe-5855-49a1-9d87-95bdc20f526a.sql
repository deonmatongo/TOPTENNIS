-- Add RLS policy to allow viewing other players' available slots (not blocked times)
CREATE POLICY "Users can view other players available slots" 
ON public.user_availability 
FOR SELECT 
USING (is_available = true AND is_blocked = false);