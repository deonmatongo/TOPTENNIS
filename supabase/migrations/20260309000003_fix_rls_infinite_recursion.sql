-- ============================================================
-- Fix infinite RLS recursion on conversation_members
--
-- The policy "Members can view conversation membership" does a
-- self-join on conversation_members which causes infinite
-- recursion when any other table's RLS policy (e.g.
-- conversation_messages INSERT) also checks conversation_members.
--
-- Fix: replace the self-join with a SECURITY DEFINER helper
-- function that bypasses RLS, then use that in all policies
-- that need to check "is the current user a member of conv X".
-- ============================================================

-- 1. Helper: check membership without triggering RLS recursion
CREATE OR REPLACE FUNCTION is_conversation_member(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = p_conversation_id
      AND user_id = auth.uid()
  );
$$;

-- 2. Fix conversation_members SELECT policy (remove self-join)
DROP POLICY IF EXISTS "Members can view conversation membership" ON conversation_members;
CREATE POLICY "Members can view conversation membership"
  ON conversation_members FOR SELECT
  USING ( is_conversation_member(conversation_id) );

-- 3. Fix conversation_messages SELECT policy
DROP POLICY IF EXISTS "Members can read messages" ON conversation_messages;
CREATE POLICY "Members can read messages"
  ON conversation_messages FOR SELECT
  USING ( is_conversation_member(conversation_id) );

-- 4. Fix conversation_messages INSERT policy
DROP POLICY IF EXISTS "Members can send messages" ON conversation_messages;
CREATE POLICY "Members can send messages"
  ON conversation_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND is_conversation_member(conversation_id)
  );

-- 5. Fix conversations SELECT policy
DROP POLICY IF EXISTS "Members can view their conversations" ON conversations;
CREATE POLICY "Members can view their conversations"
  ON conversations FOR SELECT
  USING ( is_conversation_member(id) );

-- 6. Fix conversations UPDATE policy (admin check)
CREATE OR REPLACE FUNCTION is_conversation_admin(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = p_conversation_id
      AND user_id = auth.uid()
      AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "Admins can update conversations" ON conversations;
CREATE POLICY "Admins can update conversations"
  ON conversations FOR UPDATE
  USING ( is_conversation_admin(id) );

-- 7. Fix conversation_members INSERT policy (admin adding others)
DROP POLICY IF EXISTS "Members can join conversations" ON conversation_members;
CREATE POLICY "Members can join conversations"
  ON conversation_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR is_conversation_admin(conversation_id)
  );

-- 8. Fix conversation_members DELETE policy (admin removing others)
DROP POLICY IF EXISTS "Admins can remove members" ON conversation_members;
CREATE POLICY "Admins can remove members"
  ON conversation_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR is_conversation_admin(conversation_id)
  );

-- 9. Fix message_reactions policy (uses self-join on messages -> members)
DROP POLICY IF EXISTS "members can manage reactions" ON message_reactions;
CREATE POLICY "members can manage reactions"
  ON message_reactions
  USING (
    EXISTS (
      SELECT 1 FROM conversation_messages msg
      WHERE msg.id = message_reactions.message_id
        AND is_conversation_member(msg.conversation_id)
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversation_messages msg
      WHERE msg.id = message_reactions.message_id
        AND is_conversation_member(msg.conversation_id)
    )
  );
