
-- Create players table
CREATE TABLE public.players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  skill_level INTEGER CHECK (skill_level >= 1 AND skill_level <= 10) DEFAULT 5,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  total_matches INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  hours_played DECIMAL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create matches table
CREATE TABLE public.matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player1_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  player2_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  winner_id UUID REFERENCES public.players(id),
  player1_score INTEGER,
  player2_score INTEGER,
  match_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  court_location TEXT,
  status TEXT CHECK (status IN ('scheduled', 'completed', 'cancelled')) DEFAULT 'scheduled',
  duration_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create match_sets table for detailed scoring
CREATE TABLE public.match_sets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  player1_games INTEGER DEFAULT 0,
  player2_games INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_sets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for players
CREATE POLICY "Anyone can view players" ON public.players FOR SELECT USING (true);
CREATE POLICY "Users can insert their own player profile" ON public.players FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own player profile" ON public.players FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for matches
CREATE POLICY "Anyone can view matches" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Players can create matches" ON public.matches FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.players WHERE id = player1_id AND user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.players WHERE id = player2_id AND user_id = auth.uid())
);
CREATE POLICY "Players can update their matches" ON public.matches FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.players WHERE id = player1_id AND user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.players WHERE id = player2_id AND user_id = auth.uid())
);

-- RLS Policies for match_sets
CREATE POLICY "Anyone can view match sets" ON public.match_sets FOR SELECT USING (true);
CREATE POLICY "Match participants can manage sets" ON public.match_sets FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.matches m 
    JOIN public.players p1 ON m.player1_id = p1.id 
    JOIN public.players p2 ON m.player2_id = p2.id 
    WHERE m.id = match_id AND (p1.user_id = auth.uid() OR p2.user_id = auth.uid())
  )
);

-- Function to update player stats after match completion
CREATE OR REPLACE FUNCTION public.update_player_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if match is being marked as completed and has a winner
  IF NEW.status = 'completed' AND NEW.winner_id IS NOT NULL AND (OLD.status != 'completed' OR OLD.winner_id IS NULL) THEN
    -- Update winner stats
    UPDATE public.players 
    SET 
      wins = wins + 1,
      total_matches = total_matches + 1,
      current_streak = current_streak + 1,
      best_streak = GREATEST(best_streak, current_streak + 1),
      hours_played = hours_played + COALESCE(NEW.duration_minutes, 120) / 60.0,
      updated_at = NOW()
    WHERE id = NEW.winner_id;
    
    -- Update loser stats
    UPDATE public.players 
    SET 
      losses = losses + 1,
      total_matches = total_matches + 1,
      current_streak = 0,
      hours_played = hours_played + COALESCE(NEW.duration_minutes, 120) / 60.0,
      updated_at = NOW()
    WHERE id = (CASE WHEN NEW.winner_id = NEW.player1_id THEN NEW.player2_id ELSE NEW.player1_id END);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update player stats
CREATE TRIGGER update_player_stats_trigger
  AFTER UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_player_stats();

-- Insert some sample data
INSERT INTO public.players (name, email, skill_level, wins, losses, total_matches, hours_played) VALUES
('Maria Garcia', 'maria@example.com', 8, 24, 6, 30, 180),
('John Smith', 'john@example.com', 7, 22, 8, 30, 165),
('Lisa Chen', 'lisa@example.com', 7, 21, 9, 30, 158),
('Mike Thompson', 'mike@example.com', 6, 18, 12, 30, 142),
('Emma Davis', 'emma@example.com', 6, 16, 14, 30, 135),
('Alex Wilson', 'alex@example.com', 5, 15, 15, 30, 128),
('Sarah Johnson', 'sarah@example.com', 6, 14, 16, 30, 125),
('David Brown', 'david@example.com', 5, 12, 18, 30, 118);

-- Insert some sample matches
INSERT INTO public.matches (player1_id, player2_id, winner_id, player1_score, player2_score, match_date, court_location, status, duration_minutes) 
SELECT 
  p1.id, p2.id, p1.id, 2, 0, 
  NOW() - INTERVAL '1 day', 
  'Court 3, Tennis Club', 
  'completed', 
  120
FROM public.players p1, public.players p2 
WHERE p1.name = 'Mike Thompson' AND p2.name = 'Sarah Johnson';

INSERT INTO public.matches (player1_id, player2_id, winner_id, player1_score, player2_score, match_date, court_location, status, duration_minutes) 
SELECT 
  p1.id, p2.id, p2.id, 1, 2, 
  NOW() - INTERVAL '3 days', 
  'Court 1, Tennis Club', 
  'completed', 
  135
FROM public.players p1, public.players p2 
WHERE p1.name = 'John Smith' AND p2.name = 'Emma Davis';

-- Insert upcoming match
INSERT INTO public.matches (player1_id, player2_id, match_date, court_location, status) 
SELECT 
  p1.id, p2.id, 
  NOW() + INTERVAL '4 hours', 
  'Court 3, Tennis Club', 
  'scheduled'
FROM public.players p1, public.players p2 
WHERE p1.name = 'Sarah Johnson' AND p2.name = 'Mike Thompson';
