-- ============================================================================
-- SUPABASE SQL QUERIES TO RUN
-- Run these queries in order in your Supabase Dashboard SQL Editor
-- ============================================================================

-- Query 1: Fix Notification Types Constraint
-- This fixes the "failed to accept invitation" error
-- ============================================================================
DO $$ 
BEGIN
  -- Drop the old constraint if it exists
  ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
  
  -- Add the new constraint with all required notification types
  ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
    CHECK (type IN (
      'friend_request',
      'message_received', 
      'match_invite',
      'match_confirmed',
      'match_cancelled',
      'match_accepted',
      'match_declined',
      'match_rescheduled',
      'booking_confirmed',
      'booking_cancelled',
      'league_update',
      'system_notification'
    ));
END $$;

-- Query 2: Add DELETE Policy for Match Invites
-- This allows users to delete old/expired invites
-- ============================================================================
-- Drop the policy if it exists, then create it
DROP POLICY IF EXISTS "Users can delete invites they sent or received" ON public.match_invites;

CREATE POLICY "Users can delete invites they sent or received"
ON public.match_invites
FOR DELETE
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- ============================================================================
-- VERIFICATION QUERIES (Optional - Run these to verify the changes)
-- ============================================================================

-- Verify notification constraint was updated
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'notifications_type_check';

-- Verify delete policy was created
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'match_invites' 
AND policyname = 'Users can delete invites they sent or received';

-- ============================================================================
-- DONE!
-- After running these queries:
-- 1. Accept/decline invitations should work on first click
-- 2. Users can delete old match invites
-- ============================================================================
