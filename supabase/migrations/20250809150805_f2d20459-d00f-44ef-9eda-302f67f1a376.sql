-- Fix critical security issues related to the admin_users_view and functions

-- Drop the potentially unsafe admin_users_view that exposes auth.users
DROP VIEW IF EXISTS public.admin_users_view;

-- Create a safer admin view that doesn't expose sensitive auth.users data
CREATE VIEW public.admin_profiles_view AS
SELECT 
  p.id,
  p.first_name,
  p.last_name,
  p.email,
  p.is_active,
  p.created_at as profile_created_at,
  p.profile_completed,
  p.membership_id,
  COALESCE(
    ARRAY_AGG(ur.role) FILTER (WHERE ur.role IS NOT NULL),
    ARRAY[]::app_role[]
  ) as roles
FROM public.profiles p
LEFT JOIN public.user_roles ur ON p.id = ur.user_id
GROUP BY p.id, p.first_name, p.last_name, p.email, p.is_active, p.created_at, p.profile_completed, p.membership_id;

-- Add RLS policy for the new admin view
CREATE POLICY "Only admins can view admin profiles" 
ON public.admin_profiles_view 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Fix search_path for critical functions to improve security
-- Update the calculate_player_compatibility function
CREATE OR REPLACE FUNCTION public.calculate_player_compatibility(player1_id uuid, player2_id uuid)
 RETURNS TABLE(compatibility_score integer, match_reasons text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
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
$function$;