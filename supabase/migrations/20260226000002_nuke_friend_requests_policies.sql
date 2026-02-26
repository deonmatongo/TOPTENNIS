-- ============================================================
-- Dynamically drop ALL policies on friend_requests then recreate.
-- This handles any policy name that may exist from prior migrations.
-- ============================================================

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'friend_requests' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON friend_requests', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

-- SELECT: sender or receiver can read
CREATE POLICY "fr_select"
  ON friend_requests FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- INSERT: only sender can create
CREATE POLICY "fr_insert"
  ON friend_requests FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- UPDATE: sender or receiver can update (accept / decline / cancel)
CREATE POLICY "fr_update"
  ON friend_requests FOR UPDATE
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- DELETE: either party can remove
CREATE POLICY "fr_delete"
  ON friend_requests FOR DELETE
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
