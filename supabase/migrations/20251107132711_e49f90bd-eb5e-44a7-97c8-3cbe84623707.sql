-- Ensure users can view their own availability
DROP POLICY IF EXISTS "Users can view their own availability" ON public.user_availability;

CREATE POLICY "Users can view their own availability"
ON public.user_availability
FOR SELECT
USING (auth.uid() = user_id);