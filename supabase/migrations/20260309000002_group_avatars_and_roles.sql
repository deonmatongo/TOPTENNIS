-- ============================================================
-- Group avatars storage bucket + member role management RPC
-- ============================================================

-- 1. Group avatars bucket (public read, admin-only write)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'group-avatars',
  'group-avatars',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "Group avatars are publicly readable"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'group-avatars');

-- Only group admins can upload (path: group-avatars/<conv_id>/<filename>)
CREATE POLICY "Group admins can upload group avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'group-avatars'
  AND EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = (storage.foldername(name))[1]::uuid
      AND user_id = auth.uid()
      AND role = 'admin'
  )
);

CREATE POLICY "Group admins can update group avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'group-avatars'
  AND EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = (storage.foldername(name))[1]::uuid
      AND user_id = auth.uid()
      AND role = 'admin'
  )
);

CREATE POLICY "Group admins can delete group avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'group-avatars'
  AND EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = (storage.foldername(name))[1]::uuid
      AND user_id = auth.uid()
      AND role = 'admin'
  )
);

-- 2. RPC: set_member_role — promote/demote a member (admin only)
CREATE OR REPLACE FUNCTION set_member_role(
  p_conversation_id uuid,
  p_target_user_id  uuid,
  p_role            text   -- 'admin' | 'member'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only an existing admin can change roles
  IF NOT EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = p_conversation_id
      AND user_id = auth.uid()
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can change member roles';
  END IF;

  -- Target must be in the group
  IF NOT EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = p_conversation_id
      AND user_id = p_target_user_id
  ) THEN
    RAISE EXCEPTION 'User is not a member of this group';
  END IF;

  IF p_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Role must be admin or member';
  END IF;

  UPDATE conversation_members
  SET role = p_role
  WHERE conversation_id = p_conversation_id
    AND user_id = p_target_user_id;

  -- System message
  INSERT INTO conversation_messages (conversation_id, sender_id, content, is_system)
  SELECT
    p_conversation_id,
    auth.uid(),
    (SELECT COALESCE(TRIM(first_name || ' ' || last_name), email) FROM profiles WHERE id = p_target_user_id)
      || CASE WHEN p_role = 'admin' THEN ' was promoted to admin.' ELSE ' was demoted to member.' END,
    true;
END;
$$;
