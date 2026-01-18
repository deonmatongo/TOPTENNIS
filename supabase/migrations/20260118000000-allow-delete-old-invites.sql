-- Add policy to allow users to delete their own match invites
-- This enables cleanup of old/expired invites from past dates

-- Create policy for deleting match invites
CREATE POLICY "Users can delete invites they sent or received"
ON public.match_invites
FOR DELETE
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Add comment explaining the policy
COMMENT ON POLICY "Users can delete invites they sent or received" ON public.match_invites IS 
'Allows users to delete match invites where they are either the sender or receiver. Useful for cleaning up old/expired invites from past dates.';
