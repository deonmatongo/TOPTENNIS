-- ============================================================
-- Group creation upgrade
-- Adds: description, group_type, avatar_emoji to conversations
-- Ensures notifications table exists with correct shape
-- ============================================================

-- 1. Conversations extra columns
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS description   text,
  ADD COLUMN IF NOT EXISTS group_type    text DEFAULT 'private'
    CHECK (group_type IN ('private', 'open')),
  ADD COLUMN IF NOT EXISTS avatar_emoji  text;

-- 2. Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         text        NOT NULL,
  payload      jsonb       NOT NULL DEFAULT '{}',
  read         boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "Service can insert notifications" ON notifications;
CREATE POLICY "Service can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Add to realtime
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- 3. Update create_group_chat RPC to accept description + group_type + avatar_emoji
CREATE OR REPLACE FUNCTION create_group_chat(
  p_name        text,
  p_member_ids  uuid[],
  p_description text    DEFAULT NULL,
  p_group_type  text    DEFAULT 'private',
  p_avatar_emoji text   DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conv_id      uuid;
  v_member       uuid;
  v_creator_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Group name cannot be empty';
  END IF;

  -- Create conversation
  INSERT INTO conversations (name, is_group, created_by, description, group_type, avatar_emoji)
  VALUES (trim(p_name), true, auth.uid(), p_description, p_group_type, p_avatar_emoji)
  RETURNING id INTO v_conv_id;

  -- Add creator as admin
  INSERT INTO conversation_members (conversation_id, user_id, role)
  VALUES (v_conv_id, auth.uid(), 'admin');

  -- Add each selected member
  IF p_member_ids IS NOT NULL THEN
    FOREACH v_member IN ARRAY p_member_ids LOOP
      IF v_member <> auth.uid() THEN
        INSERT INTO conversation_members (conversation_id, user_id, role)
        VALUES (v_conv_id, v_member, 'member')
        ON CONFLICT DO NOTHING;

        -- Notification for each added member
        INSERT INTO notifications (recipient_id, type, payload)
        VALUES (
          v_member,
          'group_invite',
          jsonb_build_object(
            'conversation_id', v_conv_id,
            'group_name', trim(p_name),
            'invited_by', auth.uid()
          )
        );
      END IF;
    END LOOP;
  END IF;

  -- Creator name for system message
  SELECT COALESCE(TRIM(first_name || ' ' || last_name), email)
  INTO v_creator_name FROM profiles WHERE id = auth.uid();

  -- System welcome message
  INSERT INTO conversation_messages (conversation_id, sender_id, content, is_system)
  VALUES (v_conv_id, auth.uid(),
    v_creator_name || ' created the group. Welcome everyone! 🎾',
    true);

  RETURN v_conv_id;
END;
$$;
