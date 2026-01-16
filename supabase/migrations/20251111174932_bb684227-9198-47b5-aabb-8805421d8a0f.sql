-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can update invites they received" ON match_invites;

-- Create new policy allowing both sender and receiver to update
CREATE POLICY "Users can update invites they sent or received"
ON match_invites
FOR UPDATE
USING (auth.uid() = sender_id OR auth.uid() = receiver_id)
WITH CHECK (auth.uid() = sender_id OR auth.uid() = receiver_id);