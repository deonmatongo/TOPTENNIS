-- ============================================================
-- Network & Messages upgrade migration
-- Adds: message reactions, soft-delete, system messages,
--       online presence column, pinned conversations,
--       improved RPCs for DM lookup and unread counts
-- ============================================================

-- 1. Add soft-delete + is_system + reply_to to conversation_messages
ALTER TABLE conversation_messages
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_system   boolean     DEFAULT false,
  ADD COLUMN IF NOT EXISTS reply_to_id uuid        REFERENCES conversation_messages(id) ON DELETE SET NULL;

-- 2. Add pinned flag to conversation_members
ALTER TABLE conversation_members
  ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;

-- 3. Message reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES conversation_messages(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji      text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can manage reactions" ON message_reactions;
CREATE POLICY "members can manage reactions" ON message_reactions
  USING (
    EXISTS (
      SELECT 1 FROM conversation_members cm
      JOIN conversation_messages msg ON msg.id = message_reactions.message_id
      WHERE cm.conversation_id = msg.conversation_id
        AND cm.user_id = auth.uid()
    )
  )
  WITH CHECK (user_id = auth.uid());

-- Add to realtime publication
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
  END IF;
END $$;

ALTER TABLE message_reactions REPLICA IDENTITY FULL;

-- 4. RPC: get_or_create_dm — find existing DM or create one
CREATE OR REPLACE FUNCTION get_or_create_dm(p_other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conv_id uuid;
BEGIN
  -- Try to find existing DM between the two users
  SELECT c.id INTO v_conv_id
  FROM conversations c
  JOIN conversation_members m1 ON m1.conversation_id = c.id AND m1.user_id = auth.uid()
  JOIN conversation_members m2 ON m2.conversation_id = c.id AND m2.user_id = p_other_user_id
  WHERE c.is_group = false
  LIMIT 1;

  IF v_conv_id IS NOT NULL THEN
    RETURN v_conv_id;
  END IF;

  -- Create new DM
  INSERT INTO conversations (is_group, created_by)
  VALUES (false, auth.uid())
  RETURNING id INTO v_conv_id;

  INSERT INTO conversation_members (conversation_id, user_id, role)
  VALUES
    (v_conv_id, auth.uid(),        'admin'),
    (v_conv_id, p_other_user_id,   'member');

  RETURN v_conv_id;
END;
$$;

-- 5. RPC: toggle_reaction — add or remove a reaction atomically
CREATE OR REPLACE FUNCTION toggle_reaction(p_message_id uuid, p_emoji text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM message_reactions
    WHERE message_id = p_message_id AND user_id = auth.uid() AND emoji = p_emoji
  ) THEN
    DELETE FROM message_reactions
    WHERE message_id = p_message_id AND user_id = auth.uid() AND emoji = p_emoji;
  ELSE
    INSERT INTO message_reactions (message_id, user_id, emoji)
    VALUES (p_message_id, auth.uid(), p_emoji);
  END IF;
END;
$$;

-- 6. RPC: leave_group
CREATE OR REPLACE FUNCTION leave_group(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM conversation_members
  WHERE conversation_id = p_conversation_id AND user_id = auth.uid();

  -- Insert system message
  INSERT INTO conversation_messages (conversation_id, sender_id, content, is_system)
  SELECT p_conversation_id, auth.uid(),
    (SELECT COALESCE(first_name || ' ' || last_name, email) FROM profiles WHERE id = auth.uid()) || ' left the group.',
    true;
END;
$$;

-- 7. RPC: delete_group (admin only)
CREATE OR REPLACE FUNCTION delete_group(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = p_conversation_id AND user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can delete a group';
  END IF;

  DELETE FROM conversations WHERE id = p_conversation_id;
END;
$$;

-- 8. Update create_group_chat RPC to insert a system welcome message
CREATE OR REPLACE FUNCTION create_group_chat(p_name text, p_member_ids uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conv_id uuid;
  v_member  uuid;
  v_creator_name text;
BEGIN
  INSERT INTO conversations (name, is_group, created_by)
  VALUES (p_name, true, auth.uid())
  RETURNING id INTO v_conv_id;

  INSERT INTO conversation_members (conversation_id, user_id, role)
  VALUES (v_conv_id, auth.uid(), 'admin');

  FOREACH v_member IN ARRAY p_member_ids LOOP
    INSERT INTO conversation_members (conversation_id, user_id, role)
    VALUES (v_conv_id, v_member, 'member')
    ON CONFLICT DO NOTHING;

    INSERT INTO notifications (user_id, type, title, message, read, action_url, metadata)
    VALUES (
      v_member,
      'group_invite',
      'Added to a group chat',
      'You were added to the group "' || p_name || '"',
      false,
      '/dashboard?tab=messages',
      jsonb_build_object('conversation_id', v_conv_id, 'created_by', auth.uid())
    );
  END LOOP;

  -- System welcome message
  SELECT COALESCE(TRIM(first_name || ' ' || last_name), email)
  INTO v_creator_name FROM profiles WHERE id = auth.uid();

  INSERT INTO conversation_messages (conversation_id, sender_id, content, is_system)
  VALUES (v_conv_id, auth.uid(), v_creator_name || ' created the group. Welcome everyone! 🎾', true);

  RETURN v_conv_id;
END;
$$;
