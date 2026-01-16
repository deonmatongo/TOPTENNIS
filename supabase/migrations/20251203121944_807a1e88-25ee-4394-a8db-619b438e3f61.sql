-- Drop the overly permissive policy that allows public access
DROP POLICY IF EXISTS "System can manage reminders" ON public.match_reminders;

-- Create proper policies for match_reminders
-- Users can only insert reminders for themselves (or via triggers with service role)
CREATE POLICY "Users can insert their own reminders"
ON public.match_reminders
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own reminders (mark as sent, etc.)
CREATE POLICY "Users can update their own reminders"
ON public.match_reminders
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own reminders
CREATE POLICY "Users can delete their own reminders"
ON public.match_reminders
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);