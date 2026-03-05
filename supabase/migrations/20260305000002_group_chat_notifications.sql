-- ============================================================
-- Improve create_group_chat:
--   - Send a notification to every added member
-- ============================================================

CREATE OR REPLACE FUNCTION create_group_chat(
  p_name        text,
  p_member_ids  uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conv_id     uuid;
  v_uid         uuid := auth.uid();
  v_member      uuid;
  v_creator_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Group name cannot be empty';
  END IF;

  IF array_length(p_member_ids, 1) IS NULL OR array_length(p_member_ids, 1) = 0 THEN
    RAISE EXCEPTION 'At least one member must be selected';
  END IF;

  -- Resolve creator's display name
  SELECT COALESCE(
    NULLIF(trim(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), ''),
    email,
    'Someone'
  )
  INTO v_creator_name
  FROM profiles
  WHERE id = v_uid;

  -- Create the conversation
  INSERT INTO conversations (name, is_group, created_by)
  VALUES (trim(p_name), true, v_uid)
  RETURNING id INTO v_conv_id;

  -- Add creator as admin
  INSERT INTO conversation_members (conversation_id, user_id, role)
  VALUES (v_conv_id, v_uid, 'admin');

  -- Add each selected member + notify them
  FOREACH v_member IN ARRAY p_member_ids LOOP
    IF v_member <> v_uid THEN
      INSERT INTO conversation_members (conversation_id, user_id, role)
      VALUES (v_conv_id, v_member, 'member')
      ON CONFLICT (conversation_id, user_id) DO NOTHING;

      -- Notify the added member
      INSERT INTO notifications (user_id, type, title, message, metadata, read)
      VALUES (
        v_member,
        'group_invite',
        'Added to a group chat',
        v_creator_name || ' added you to "' || trim(p_name) || '"',
        jsonb_build_object(
          'conversation_id', v_conv_id,
          'group_name',      trim(p_name),
          'created_by',      v_uid,
          'creator_name',    v_creator_name
        ),
        false
      );
    END IF;
  END LOOP;

  RETURN v_conv_id;
END;
$$;
