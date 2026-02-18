-- ============================================
-- BLOCKED USERS SYSTEM
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Create blocked_users table
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT blocker_not_blocked CHECK (blocker_id != blocked_user_id),
  CONSTRAINT unique_block UNIQUE (blocker_id, blocked_user_id)
);

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON public.blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON public.blocked_users(blocked_user_id);

-- 3. Enable RLS
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies
DROP POLICY IF EXISTS "Users can view their own blocks" ON public.blocked_users;
CREATE POLICY "Users can view their own blocks"
ON public.blocked_users FOR SELECT
USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users can insert their own blocks" ON public.blocked_users;
CREATE POLICY "Users can insert their own blocks"
ON public.blocked_users FOR INSERT
WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users can delete their own blocks" ON public.blocked_users;
CREATE POLICY "Users can delete their own blocks"
ON public.blocked_users FOR DELETE
USING (auth.uid() = blocker_id);

-- 5. RPC Functions for blocking and unblocking
CREATE OR REPLACE FUNCTION public.block_user(
  p_blocked_user_id UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_block_id UUID;
BEGIN
  -- Check if user is trying to block themselves
  IF p_blocked_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot block yourself';
  END IF;

  -- Insert the block
  INSERT INTO public.blocked_users (blocker_id, blocked_user_id, reason)
  VALUES (auth.uid(), p_blocked_user_id, p_reason)
  ON CONFLICT (blocker_id, blocked_user_id) DO NOTHING
  RETURNING id INTO v_block_id;

  -- Remove any existing friend relationship
  UPDATE public.friend_requests 
  SET status = 'declined'
  WHERE (sender_id = auth.uid() AND receiver_id = p_blocked_user_id)
     OR (sender_id = p_blocked_user_id AND receiver_id = auth.uid());

  RETURN v_block_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.unblock_user(
  p_blocked_user_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  DELETE FROM public.blocked_users 
  WHERE blocker_id = auth.uid() AND blocked_user_id = p_blocked_user_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_user_blocked(
  p_blocker_id UUID,
  p_blocked_user_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.blocked_users 
    WHERE blocker_id = p_blocker_id 
    AND blocked_user_id = p_blocked_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_blocked_users(
  p_user_id UUID
) RETURNS TABLE (
  id UUID,
  blocker_id UUID,
  blocked_user_id UUID,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  blocked_user_name TEXT,
  blocked_user_email TEXT,
  blocked_user_profile_picture TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bu.id,
    bu.blocker_id,
    bu.blocked_user_id,
    bu.reason,
    bu.created_at,
    bu.updated_at,
    p.first_name || ' ' || p.last_name as blocked_user_name,
    p.email as blocked_user_email,
    p.profile_picture_url as blocked_user_profile_picture
  FROM public.blocked_users bu
  LEFT JOIN public.profiles p ON bu.blocked_user_id = p.id
  WHERE bu.blocker_id = p_user_id
  ORDER BY bu.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Update trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_blocked_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_blocked_users_updated_at ON public.blocked_users;
CREATE TRIGGER update_blocked_users_updated_at
  BEFORE UPDATE ON public.blocked_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_blocked_users_updated_at();
