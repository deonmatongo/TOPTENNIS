-- ============================================
-- LEAGUE-SCHEDULE INTEGRATION MIGRATION
-- Copy this entire file and run in Supabase SQL Editor
-- ============================================

-- 1. Create league_matches table
CREATE TABLE IF NOT EXISTS public.league_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES public.divisions(id) ON DELETE CASCADE,
  player1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_invite_id UUID REFERENCES public.match_invites(id) ON DELETE SET NULL,
  scheduled_date DATE,
  scheduled_time TIME,
  timezone TEXT DEFAULT 'America/New_York',
  court_location TEXT,
  match_number INTEGER,
  round_number INTEGER DEFAULT 1,
  is_playoff BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'in_progress', 'completed', 'cancelled')),
  winner_id UUID REFERENCES auth.users(id),
  score JSONB,
  match_duration_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT different_players CHECK (player1_id != player2_id),
  CONSTRAINT valid_winner CHECK (winner_id IS NULL OR winner_id IN (player1_id, player2_id))
);

-- 2. Add league context to match_invites
ALTER TABLE public.match_invites 
ADD COLUMN IF NOT EXISTS league_match_id UUID REFERENCES public.league_matches(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS division_id UUID REFERENCES public.divisions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_league_match BOOLEAN DEFAULT false;

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_league_matches_division ON public.league_matches(division_id);
CREATE INDEX IF NOT EXISTS idx_league_matches_player1 ON public.league_matches(player1_id);
CREATE INDEX IF NOT EXISTS idx_league_matches_player2 ON public.league_matches(player2_id);
CREATE INDEX IF NOT EXISTS idx_league_matches_status ON public.league_matches(status);
CREATE INDEX IF NOT EXISTS idx_league_matches_scheduled_date ON public.league_matches(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_match_invites_league_match ON public.match_invites(league_match_id);
CREATE INDEX IF NOT EXISTS idx_match_invites_division ON public.match_invites(division_id);
CREATE INDEX IF NOT EXISTS idx_match_invites_is_league ON public.match_invites(is_league_match);

-- 4. Enable RLS
ALTER TABLE public.league_matches ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies (drop existing first to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their division matches" ON public.league_matches;
CREATE POLICY "Users can view their division matches"
ON public.league_matches FOR SELECT
USING (EXISTS (SELECT 1 FROM public.division_assignments da WHERE da.division_id = league_matches.division_id AND da.user_id = auth.uid() AND da.status = 'active'));

DROP POLICY IF EXISTS "Users can view their own league matches" ON public.league_matches;
CREATE POLICY "Users can view their own league matches"
ON public.league_matches FOR SELECT
USING (auth.uid() IN (player1_id, player2_id));

DROP POLICY IF EXISTS "Users can create matches in their division" ON public.league_matches;
CREATE POLICY "Users can create matches in their division"
ON public.league_matches FOR INSERT
WITH CHECK (auth.uid() IN (player1_id, player2_id) AND EXISTS (SELECT 1 FROM public.division_assignments da WHERE da.division_id = league_matches.division_id AND da.user_id = auth.uid() AND da.status = 'active'));

DROP POLICY IF EXISTS "Users can update their league matches" ON public.league_matches;
CREATE POLICY "Users can update their league matches"
ON public.league_matches FOR UPDATE
USING (auth.uid() IN (player1_id, player2_id))
WITH CHECK (auth.uid() IN (player1_id, player2_id));

-- 6. Create function to create league match with invite
CREATE OR REPLACE FUNCTION public.create_league_match_with_invite(
  p_division_id UUID, p_player1_id UUID, p_player2_id UUID,
  p_scheduled_date DATE, p_scheduled_time TIME, p_timezone TEXT,
  p_court_location TEXT, p_message TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_league_match_id UUID;
  v_match_invite_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.division_assignments da1
    JOIN public.division_assignments da2 ON da1.division_id = da2.division_id
    WHERE da1.division_id = p_division_id AND da1.user_id = p_player1_id
    AND da2.user_id = p_player2_id AND da1.status = 'active' AND da2.status = 'active'
  ) THEN RAISE EXCEPTION 'Both players must be in the same division'; END IF;

  INSERT INTO public.league_matches (division_id, player1_id, player2_id, scheduled_date, scheduled_time, timezone, court_location, status)
  VALUES (p_division_id, p_player1_id, p_player2_id, p_scheduled_date, p_scheduled_time, p_timezone, p_court_location, 'pending')
  RETURNING id INTO v_league_match_id;

  INSERT INTO public.match_invites (sender_id, receiver_id, date, start_time, end_time, timezone, court_location, message, status, league_match_id, division_id, is_league_match)
  VALUES (p_player1_id, p_player2_id, p_scheduled_date, p_scheduled_time::TEXT, (p_scheduled_time + INTERVAL '2 hours')::TIME::TEXT, p_timezone, p_court_location, COALESCE(p_message, 'League match invitation'), 'pending', v_league_match_id, p_division_id, true)
  RETURNING id INTO v_match_invite_id;

  UPDATE public.league_matches SET match_invite_id = v_match_invite_id WHERE id = v_league_match_id;
  RETURN v_league_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create sync function
CREATE OR REPLACE FUNCTION public.sync_league_match_status() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND NEW.is_league_match = true AND NEW.league_match_id IS NOT NULL THEN
    UPDATE public.league_matches SET status = 'scheduled', updated_at = NOW() WHERE id = NEW.league_match_id;
  END IF;
  IF NEW.status = 'rejected' AND NEW.is_league_match = true AND NEW.league_match_id IS NOT NULL THEN
    UPDATE public.league_matches SET status = 'cancelled', updated_at = NOW() WHERE id = NEW.league_match_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Create trigger
DROP TRIGGER IF EXISTS sync_league_match_status_trigger ON public.match_invites;
CREATE TRIGGER sync_league_match_status_trigger
AFTER UPDATE OF status ON public.match_invites
FOR EACH ROW WHEN (NEW.is_league_match = true AND NEW.league_match_id IS NOT NULL)
EXECUTE FUNCTION public.sync_league_match_status();

-- 9. Create function to get division opponents
CREATE OR REPLACE FUNCTION public.get_division_opponents(p_user_id UUID, p_division_id UUID)
RETURNS TABLE (user_id UUID, first_name TEXT, last_name TEXT, email TEXT, skill_level INTEGER, wins INTEGER, losses INTEGER, matches_completed INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.first_name, p.last_name, p.email, pl.skill_level,
    COALESCE((SELECT COUNT(*) FROM public.league_matches lm WHERE lm.winner_id = p.id AND lm.division_id = p_division_id AND lm.status = 'completed'), 0)::INTEGER as wins,
    COALESCE((SELECT COUNT(*) FROM public.league_matches lm WHERE (lm.player1_id = p.id OR lm.player2_id = p.id) AND lm.winner_id IS NOT NULL AND lm.winner_id != p.id AND lm.division_id = p_division_id AND lm.status = 'completed'), 0)::INTEGER as losses,
    da.matches_completed
  FROM public.division_assignments da
  JOIN public.profiles p ON p.id = da.user_id
  LEFT JOIN public.players pl ON pl.user_id = p.id
  WHERE da.division_id = p_division_id AND da.user_id != p_user_id AND da.status = 'active'
  ORDER BY da.matches_completed DESC, p.first_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Create view
CREATE OR REPLACE VIEW public.user_league_matches AS
SELECT lm.*, d.division_name, d.league_id,
  p1.first_name as player1_first_name, p1.last_name as player1_last_name,
  p2.first_name as player2_first_name, p2.last_name as player2_last_name,
  CASE WHEN lm.player1_id = auth.uid() THEN p2.first_name || ' ' || p2.last_name ELSE p1.first_name || ' ' || p1.last_name END as opponent_name,
  CASE WHEN lm.player1_id = auth.uid() THEN lm.player2_id ELSE lm.player1_id END as opponent_id
FROM public.league_matches lm
JOIN public.divisions d ON d.id = lm.division_id
JOIN public.profiles p1 ON p1.id = lm.player1_id
JOIN public.profiles p2 ON p2.id = lm.player2_id
WHERE lm.player1_id = auth.uid() OR lm.player2_id = auth.uid();
