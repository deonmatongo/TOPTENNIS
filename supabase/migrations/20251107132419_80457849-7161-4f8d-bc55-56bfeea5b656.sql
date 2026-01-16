-- Add policy to allow authenticated users to view players for search
CREATE POLICY "Authenticated users can view players for search"
ON public.players
FOR SELECT
USING (auth.role() = 'authenticated');
