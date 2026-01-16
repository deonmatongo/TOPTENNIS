
-- Add columns to players table for matching criteria
ALTER TABLE public.players 
ADD COLUMN IF NOT EXISTS age_range VARCHAR(20),
ADD COLUMN IF NOT EXISTS gender_preference VARCHAR(20),
ADD COLUMN IF NOT EXISTS competitiveness VARCHAR(20),
ADD COLUMN IF NOT EXISTS usta_rating VARCHAR(10),
ADD COLUMN IF NOT EXISTS gender VARCHAR(10);

-- Create a matches_suggestions table to store potential matches
CREATE TABLE IF NOT EXISTS public.match_suggestions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  suggested_player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  compatibility_score INTEGER NOT NULL DEFAULT 0,
  match_reasons TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'pending',
  UNIQUE(player_id, suggested_player_id)
);

-- Enable RLS on match_suggestions
ALTER TABLE public.match_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS policies for match_suggestions
CREATE POLICY "Users can view their own match suggestions" 
  ON public.match_suggestions 
  FOR SELECT 
  USING (
    EXISTS (SELECT 1 FROM public.players WHERE id = match_suggestions.player_id AND user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.players WHERE id = match_suggestions.suggested_player_id AND user_id = auth.uid())
  );

CREATE POLICY "System can insert match suggestions" 
  ON public.match_suggestions 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Users can update their match suggestions status" 
  ON public.match_suggestions 
  FOR UPDATE 
  USING (
    EXISTS (SELECT 1 FROM public.players WHERE id = match_suggestions.player_id AND user_id = auth.uid())
  );

-- Create a function to calculate player compatibility
CREATE OR REPLACE FUNCTION public.calculate_player_compatibility(
  player1_id UUID,
  player2_id UUID
)
RETURNS TABLE (
  compatibility_score INTEGER,
  match_reasons TEXT[]
) AS $$
DECLARE
  p1 RECORD;
  p2 RECORD;
  score INTEGER := 0;
  reasons TEXT[] := ARRAY[]::TEXT[];
  age_ranges TEXT[] := ARRAY['under-18', '18-29', '30-39', '40-49', '50-59', '60-plus'];
  p1_age_index INTEGER;
  p2_age_index INTEGER;
  skill_levels TEXT[] := ARRAY['beginner', 'intermediate', 'advanced'];
  p1_skill_index INTEGER;
  p2_skill_index INTEGER;
BEGIN
  -- Get player data
  SELECT * INTO p1 FROM public.players WHERE id = player1_id;
  SELECT * INTO p2 FROM public.players WHERE id = player2_id;
  
  -- Don't match a player with themselves
  IF player1_id = player2_id THEN
    RETURN QUERY SELECT 0, ARRAY['Same player']::TEXT[];
    RETURN;
  END IF;
  
  -- Check if players exist
  IF p1.id IS NULL OR p2.id IS NULL THEN
    RETURN QUERY SELECT 0, ARRAY['Player not found']::TEXT[];
    RETURN;
  END IF;
  
  -- Skill level matching (40 points max)
  SELECT array_position(skill_levels, 
    CASE 
      WHEN p1.skill_level <= 3 THEN 'beginner'
      WHEN p1.skill_level BETWEEN 4 AND 7 THEN 'intermediate'
      ELSE 'advanced'
    END
  ) INTO p1_skill_index;
  
  SELECT array_position(skill_levels, 
    CASE 
      WHEN p2.skill_level <= 3 THEN 'beginner'
      WHEN p2.skill_level BETWEEN 4 AND 7 THEN 'intermediate'
      ELSE 'advanced'
    END
  ) INTO p2_skill_index;
  
  IF abs(p1_skill_index - p2_skill_index) = 0 THEN
    score := score + 40;
    reasons := reasons || 'Exact skill level match';
  ELSIF abs(p1_skill_index - p2_skill_index) = 1 THEN
    score := score + 25;
    reasons := reasons || 'Similar skill level';
  ELSE
    reasons := reasons || 'Different skill levels';
  END IF;
  
  -- Competitiveness matching (30 points max)
  IF p1.competitiveness = p2.competitiveness THEN
    score := score + 30;
    reasons := reasons || 'Same competitiveness level';
  ELSIF (p1.competitiveness = 'fun' AND p2.competitiveness = 'casual') OR
        (p1.competitiveness = 'casual' AND p2.competitiveness = 'fun') THEN
    score := score + 20;
    reasons := reasons || 'Compatible competitiveness';
  ELSIF (p1.competitiveness = 'casual' AND p2.competitiveness = 'competitive') OR
        (p1.competitiveness = 'competitive' AND p2.competitiveness = 'casual') THEN
    score := score + 10;
    reasons := reasons || 'Moderately compatible competitiveness';
  ELSE
    reasons := reasons || 'Different competitiveness levels';
  END IF;
  
  -- Age range matching (20 points max)
  SELECT array_position(age_ranges, p1.age_range) INTO p1_age_index;
  SELECT array_position(age_ranges, p2.age_range) INTO p2_age_index;
  
  IF p1_age_index IS NOT NULL AND p2_age_index IS NOT NULL THEN
    IF abs(p1_age_index - p2_age_index) = 0 THEN
      score := score + 20;
      reasons := reasons || 'Same age range';
    ELSIF abs(p1_age_index - p2_age_index) = 1 THEN
      score := score + 15;
      reasons := reasons || 'Adjacent age range';
    ELSE
      reasons := reasons || 'Different age ranges';
    END IF;
  END IF;
  
  -- Gender preference matching (10 points max)
  IF p1.gender_preference = 'no-preference' AND p2.gender_preference = 'no-preference' THEN
    score := score + 10;
    reasons := reasons || 'Both have no gender preference';
  ELSIF p1.gender_preference = 'same-gender' AND p2.gender_preference = 'same-gender' AND p1.gender = p2.gender THEN
    score := score + 10;
    reasons := reasons || 'Same gender preference matched';
  ELSIF p1.gender_preference = 'mixed' AND p2.gender_preference = 'mixed' THEN
    score := score + 10;
    reasons := reasons || 'Both prefer mixed matches';
  ELSIF (p1.gender_preference = 'no-preference' AND p2.gender_preference IN ('same-gender', 'mixed')) OR
        (p2.gender_preference = 'no-preference' AND p1.gender_preference IN ('same-gender', 'mixed')) THEN
    score := score + 5;
    reasons := reasons || 'Compatible gender preferences';
  ELSE
    reasons := reasons || 'Incompatible gender preferences';
  END IF;
  
  RETURN QUERY SELECT score, reasons;
END;
$$ LANGUAGE plpgsql;

-- Create a function to find matches for a player
CREATE OR REPLACE FUNCTION public.find_player_matches(
  target_player_id UUID,
  min_compatibility_score INTEGER DEFAULT 50,
  limit_results INTEGER DEFAULT 10
)
RETURNS TABLE (
  suggested_player_id UUID,
  player_name TEXT,
  compatibility_score INTEGER,
  match_reasons TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    comp.compatibility_score,
    comp.match_reasons
  FROM public.players p
  CROSS JOIN LATERAL public.calculate_player_compatibility(target_player_id, p.id) comp
  WHERE p.id != target_player_id
    AND comp.compatibility_score >= min_compatibility_score
  ORDER BY comp.compatibility_score DESC
  LIMIT limit_results;
END;
$$ LANGUAGE plpgsql;

-- Create a function to generate match suggestions for a player
CREATE OR REPLACE FUNCTION public.generate_match_suggestions(target_player_id UUID)
RETURNS INTEGER AS $$
DECLARE
  match_record RECORD;
  inserted_count INTEGER := 0;
BEGIN
  -- Clear existing suggestions for this player
  DELETE FROM public.match_suggestions WHERE player_id = target_player_id;
  
  -- Generate new suggestions
  FOR match_record IN 
    SELECT * FROM public.find_player_matches(target_player_id, 50, 10)
  LOOP
    INSERT INTO public.match_suggestions (
      player_id,
      suggested_player_id,
      compatibility_score,
      match_reasons
    ) VALUES (
      target_player_id,
      match_record.suggested_player_id,
      match_record.compatibility_score,
      match_record.match_reasons
    )
    ON CONFLICT (player_id, suggested_player_id) DO UPDATE SET
      compatibility_score = EXCLUDED.compatibility_score,
      match_reasons = EXCLUDED.match_reasons,
      created_at = NOW();
    
    inserted_count := inserted_count + 1;
  END LOOP;
  
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;
