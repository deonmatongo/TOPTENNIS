-- Update find_player_matches function to support filtering by competitiveness
DROP FUNCTION IF EXISTS public.find_player_matches(uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.find_player_matches(
  target_player_id uuid, 
  min_compatibility_score integer DEFAULT 50, 
  limit_results integer DEFAULT 10,
  competitiveness_filter text DEFAULT NULL
)
RETURNS TABLE(
  suggested_player_id uuid, 
  player_name text, 
  compatibility_score integer, 
  match_reasons text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    AND (competitiveness_filter IS NULL OR p.competitiveness = competitiveness_filter)
  ORDER BY comp.compatibility_score DESC
  LIMIT limit_results;
END;
$$;

-- Update generate_match_suggestions to support competitiveness filtering
DROP FUNCTION IF EXISTS public.generate_match_suggestions(uuid);

CREATE OR REPLACE FUNCTION public.generate_match_suggestions(
  target_player_id uuid,
  competitiveness_filter text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  match_record RECORD;
  inserted_count INTEGER := 0;
BEGIN
  -- Clear existing suggestions for this player
  DELETE FROM public.match_suggestions WHERE player_id = target_player_id;
  
  -- Generate new suggestions with optional competitiveness filter
  FOR match_record IN 
    SELECT * FROM public.find_player_matches(target_player_id, 50, 10, competitiveness_filter)
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
$$;