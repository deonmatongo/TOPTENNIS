-- Fix critical security issues by removing unsafe admin view and updating functions

-- Drop the potentially unsafe admin_users_view that exposes auth.users
DROP VIEW IF EXISTS public.admin_users_view;

-- Create a safer admin view that doesn't expose sensitive auth.users data directly
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

-- Fix search_path for critical functions to improve security
-- Update the find_player_matches function
CREATE OR REPLACE FUNCTION public.find_player_matches(target_player_id uuid, min_compatibility_score integer DEFAULT 50, limit_results integer DEFAULT 10)
 RETURNS TABLE(suggested_player_id uuid, player_name text, compatibility_score integer, match_reasons text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
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
$function$;

-- Update the generate_match_suggestions function
CREATE OR REPLACE FUNCTION public.generate_match_suggestions(target_player_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
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
$function$;