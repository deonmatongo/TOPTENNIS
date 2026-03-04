-- ============================================================
-- Group Chat: conversations, conversation_members, conversation_messages
-- Also fixes block_user to cancel pending matches
-- ============================================================

-- ── 1. conversations ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text,                          -- NULL for 1-to-1 DMs
  avatar_url    text,
  is_group      boolean NOT NULL DEFAULT false,
  created_by    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── 2. conversation_members ───────────────────────────────────
CREATE TABLE IF NOT EXISTS conversation_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at       timestamptz NOT NULL DEFAULT now(),
  last_read_at    timestamptz,
  UNIQUE (conversation_id, user_id)
);

-- ── 3. conversation_messages ──────────────────────────────────
CREATE TABLE IF NOT EXISTS conversation_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content         text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── 4. updated_at triggers ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS conversations_updated_at ON conversations;
CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS conversation_messages_updated_at ON conversation_messages;
CREATE TRIGGER conversation_messages_updated_at
  BEFORE UPDATE ON conversation_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Bump conversation.updated_at on new message
CREATE OR REPLACE FUNCTION bump_conversation_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bump_conv_on_message ON conversation_messages;
CREATE TRIGGER bump_conv_on_message
  AFTER INSERT ON conversation_messages
  FOR EACH ROW EXECUTE FUNCTION bump_conversation_updated_at();

-- ── 5. Enable realtime ────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='conversations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='conversation_members') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversation_members;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='conversation_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversation_messages;
  END IF;
END $$;

ALTER TABLE conversations REPLICA IDENTITY FULL;
ALTER TABLE conversation_members REPLICA IDENTITY FULL;
ALTER TABLE conversation_messages REPLICA IDENTITY FULL;

-- ── 6. RLS ───────────────────────────────────────────────────
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

-- conversations: visible only to members
CREATE POLICY "Members can view their conversations"
  ON conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_id = conversations.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create conversations"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can update conversations"
  ON conversations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_id = conversations.id AND user_id = auth.uid() AND role = 'admin'
    )
  );

-- conversation_members: members can see fellow members
CREATE POLICY "Members can view conversation membership"
  ON conversation_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_members cm2
      WHERE cm2.conversation_id = conversation_members.conversation_id
        AND cm2.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can join conversations"
  ON conversation_members FOR INSERT
  WITH CHECK (
    -- allow self-join (creator) or admin adding others
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM conversation_members cm2
      WHERE cm2.conversation_id = conversation_members.conversation_id
        AND cm2.user_id = auth.uid() AND cm2.role = 'admin'
    )
  );

CREATE POLICY "Admins can remove members"
  ON conversation_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM conversation_members cm2
      WHERE cm2.conversation_id = conversation_members.conversation_id
        AND cm2.user_id = auth.uid() AND cm2.role = 'admin'
    )
  );

CREATE POLICY "Members can update their own membership"
  ON conversation_members FOR UPDATE
  USING (user_id = auth.uid());

-- conversation_messages: only members can read/write
CREATE POLICY "Members can read messages"
  ON conversation_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_id = conversation_messages.conversation_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Members can send messages"
  ON conversation_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_id = conversation_messages.conversation_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Sender can edit their own messages"
  ON conversation_messages FOR UPDATE
  USING (auth.uid() = sender_id);

CREATE POLICY "Sender can delete their own messages"
  ON conversation_messages FOR DELETE
  USING (auth.uid() = sender_id);

-- ── 7. Helper RPC: get_or_create_dm(other_user_id) ───────────
-- Returns an existing 1-to-1 conversation between caller & other_user_id,
-- or creates one if it doesn't exist yet.
CREATE OR REPLACE FUNCTION get_or_create_dm(p_other_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_conv_id uuid;
BEGIN
  -- Look for existing 1-to-1 conversation between the two users
  SELECT cm1.conversation_id INTO v_conv_id
  FROM conversation_members cm1
  JOIN conversation_members cm2
    ON cm2.conversation_id = cm1.conversation_id
   AND cm2.user_id = p_other_user_id
  JOIN conversations c ON c.id = cm1.conversation_id
  WHERE cm1.user_id = auth.uid()
    AND c.is_group = false
  LIMIT 1;

  IF v_conv_id IS NOT NULL THEN
    RETURN v_conv_id;
  END IF;

  -- Create new DM conversation
  INSERT INTO conversations (created_by, is_group)
  VALUES (auth.uid(), false)
  RETURNING id INTO v_conv_id;

  -- Add both members
  INSERT INTO conversation_members (conversation_id, user_id, role)
  VALUES (v_conv_id, auth.uid(), 'admin'),
         (v_conv_id, p_other_user_id, 'member');

  RETURN v_conv_id;
END;
$$;

-- ── 8. Update block_user to also cancel pending match invites ──
CREATE OR REPLACE FUNCTION block_user(
  p_blocked_user_id uuid,
  p_reason          text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF auth.uid() = p_blocked_user_id THEN
    RAISE EXCEPTION 'You cannot block yourself';
  END IF;

  INSERT INTO blocked_users (blocker_id, blocked_user_id, reason)
  VALUES (auth.uid(), p_blocked_user_id, p_reason)
  ON CONFLICT (blocker_id, blocked_user_id)
  DO UPDATE SET reason = EXCLUDED.reason, updated_at = now();

  -- Remove any existing friend request between the two users
  DELETE FROM friend_requests
  WHERE (sender_id = auth.uid() AND receiver_id = p_blocked_user_id)
     OR (sender_id = p_blocked_user_id AND receiver_id = auth.uid());

  -- Cancel any pending match invites between the two users
  UPDATE match_invites
  SET status = 'cancelled'
  WHERE status = 'pending'
    AND (
      (sender_id = auth.uid() AND receiver_id = p_blocked_user_id)
      OR (sender_id = p_blocked_user_id AND receiver_id = auth.uid())
    );
END;
$$;
