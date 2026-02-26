-- ============================================================
-- Create blocked_users table + RPC functions
-- ============================================================

-- 1. Table
CREATE TABLE IF NOT EXISTS blocked_users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason          text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_user_id),
  CHECK (blocker_id <> blocked_user_id)
);

-- 2. Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'blocked_users'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE blocked_users;
  END IF;
END $$;
ALTER TABLE blocked_users REPLICA IDENTITY FULL;

-- 3. RLS
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own blocks" ON blocked_users;
DROP POLICY IF EXISTS "Users can create blocks" ON blocked_users;
DROP POLICY IF EXISTS "Users can delete their own blocks" ON blocked_users;

CREATE POLICY "Users can view their own blocks"
  ON blocked_users FOR SELECT
  USING (auth.uid() = blocker_id);

CREATE POLICY "Users can create blocks"
  ON blocked_users FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can delete their own blocks"
  ON blocked_users FOR DELETE
  USING (auth.uid() = blocker_id);

-- 4. updated_at trigger
CREATE OR REPLACE FUNCTION update_blocked_users_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS blocked_users_updated_at ON blocked_users;
CREATE TRIGGER blocked_users_updated_at
  BEFORE UPDATE ON blocked_users
  FOR EACH ROW EXECUTE FUNCTION update_blocked_users_updated_at();

-- 5. get_blocked_users(p_user_id) — returns blocked users with profile info
CREATE OR REPLACE FUNCTION get_blocked_users(p_user_id uuid)
RETURNS TABLE (
  id                        uuid,
  blocker_id                uuid,
  blocked_user_id           uuid,
  reason                    text,
  created_at                timestamptz,
  updated_at                timestamptz,
  blocked_user_name         text,
  blocked_user_email        text,
  blocked_user_profile_picture text
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    bu.id,
    bu.blocker_id,
    bu.blocked_user_id,
    bu.reason,
    bu.created_at,
    bu.updated_at,
    COALESCE(p.first_name || ' ' || p.last_name, p.first_name, p.last_name, 'Unknown Player') AS blocked_user_name,
    p.email                    AS blocked_user_email,
    p.profile_picture_url      AS blocked_user_profile_picture
  FROM blocked_users bu
  LEFT JOIN profiles p ON p.id = bu.blocked_user_id
  WHERE bu.blocker_id = p_user_id
  ORDER BY bu.created_at DESC;
END;
$$;

-- 6. block_user(p_blocked_user_id, p_reason)
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

  -- Also remove any existing friend request between the two users
  DELETE FROM friend_requests
  WHERE (sender_id = auth.uid() AND receiver_id = p_blocked_user_id)
     OR (sender_id = p_blocked_user_id AND receiver_id = auth.uid());
END;
$$;

-- 7. unblock_user(p_blocked_user_id)
CREATE OR REPLACE FUNCTION unblock_user(p_blocked_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM blocked_users
  WHERE blocker_id = auth.uid()
    AND blocked_user_id = p_blocked_user_id;
END;
$$;

-- 8. is_user_blocked(p_blocker_id, p_blocked_user_id)
CREATE OR REPLACE FUNCTION is_user_blocked(
  p_blocker_id      uuid,
  p_blocked_user_id uuid
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM blocked_users
    WHERE blocker_id = p_blocker_id
      AND blocked_user_id = p_blocked_user_id
  );
END;
$$;
