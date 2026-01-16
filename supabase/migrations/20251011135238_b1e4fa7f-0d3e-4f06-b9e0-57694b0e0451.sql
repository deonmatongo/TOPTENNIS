-- Update the calculate_player_compatibility function to enforce age bracket rules
-- Players can only match with players in their age bracket or up to 2 brackets below

CREATE OR REPLACE FUNCTION public.calculate_player_compatibility(player1_id uuid, player2_id uuid)
RETURNS TABLE(compatibility_score integer, match_reasons text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  p1 RECORD;
  p2 RECORD;
  score INTEGER := 0;
  reasons TEXT[] := ARRAY[]::TEXT[];
  age_ranges TEXT[] := ARRAY['18-25', '26-40', '41-54', '55-plus'];
  p1_age_index INTEGER;
  p2_age_index INTEGER;
  age_difference INTEGER;
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
  
  -- Age range validation (CRITICAL: Players can only play in their bracket or up to 2 brackets below)
  SELECT array_position(age_ranges, p1.age_range) INTO p1_age_index;
  SELECT array_position(age_ranges, p2.age_range) INTO p2_age_index;
  
  IF p1_age_index IS NOT NULL AND p2_age_index IS NOT NULL THEN
    age_difference := p1_age_index - p2_age_index;
    
    -- Player 1 can only match with Player 2 if:
    -- - They're in the same bracket (age_difference = 0)
    -- - Player 2 is up to 2 brackets below (age_difference = 1 or 2)
    -- AND vice versa for Player 2
    
    IF age_difference = 0 THEN
      -- Same age bracket
      score := score + 25;
      reasons := reasons || 'Same age bracket';
    ELSIF age_difference > 0 AND age_difference <= 2 THEN
      -- Player 2 is younger (1-2 brackets below Player 1)
      score := score + 20;
      reasons := reasons || 'Compatible age brackets';
    ELSIF age_difference < 0 AND age_difference >= -2 THEN
      -- Player 1 is younger (1-2 brackets below Player 2)
      score := score + 20;
      reasons := reasons || 'Compatible age brackets';
    ELSE
      -- Age difference too large (more than 2 brackets)
      RETURN QUERY SELECT 0, ARRAY['Age brackets incompatible - maximum 2 bracket difference allowed']::TEXT[];
      RETURN;
    END IF;
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
  
  -- Gender preference matching (5 points max) - reduced weight
  IF p1.gender_preference = 'no-preference' AND p2.gender_preference = 'no-preference' THEN
    score := score + 5;
    reasons := reasons || 'Both have no gender preference';
  ELSIF p1.gender_preference = 'same-gender' AND p2.gender_preference = 'same-gender' AND p1.gender = p2.gender THEN
    score := score + 5;
    reasons := reasons || 'Same gender preference matched';
  ELSIF p1.gender_preference = 'mixed' AND p2.gender_preference = 'mixed' THEN
    score := score + 5;
    reasons := reasons || 'Both prefer mixed matches';
  ELSIF (p1.gender_preference = 'no-preference' AND p2.gender_preference IN ('same-gender', 'mixed')) OR
        (p2.gender_preference = 'no-preference' AND p1.gender_preference IN ('same-gender', 'mixed')) THEN
    score := score + 3;
    reasons := reasons || 'Compatible gender preferences';
  ELSE
    reasons := reasons || 'Incompatible gender preferences';
  END IF;
  
  RETURN QUERY SELECT score, reasons;
END;
$function$;