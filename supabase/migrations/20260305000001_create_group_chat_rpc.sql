-- ============================================================
-- create_group_chat RPC
--
-- Reason: The client-side INSERT approach hits an RLS circular
-- dependency: inserting the creator as admin and other members
-- in the same batch means the admin check sub-query on
-- conversation_members finds no rows yet, causing the member
-- inserts to fail with RLS violation.
--
-- This SECURITY DEFINER function runs as the function owner
-- (bypassing RLS) and still validates the caller is the creator.
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
  v_conv_id uuid;
  v_uid     uuid := auth.uid();
  v_member  uuid;
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

  -- Create the conversation
  INSERT INTO conversations (name, is_group, created_by)
  VALUES (trim(p_name), true, v_uid)
  RETURNING id INTO v_conv_id;

  -- Add creator as admin
  INSERT INTO conversation_members (conversation_id, user_id, role)
  VALUES (v_conv_id, v_uid, 'admin');

  -- Add each selected member (skip duplicates and the creator)
  FOREACH v_member IN ARRAY p_member_ids LOOP
    IF v_member <> v_uid THEN
      INSERT INTO conversation_members (conversation_id, user_id, role)
      VALUES (v_conv_id, v_member, 'member')
      ON CONFLICT (conversation_id, user_id) DO NOTHING;
    END IF;
  END LOOP;

  RETURN v_conv_id;
END;
$$;
