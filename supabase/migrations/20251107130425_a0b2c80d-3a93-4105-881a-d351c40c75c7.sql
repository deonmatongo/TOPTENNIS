-- Fix remaining Function Search Path Mutable warnings - Part 2

-- Function 7: update_player_stats
CREATE OR REPLACE FUNCTION public.update_player_stats()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.status = 'completed' AND NEW.winner_id IS NOT NULL AND (OLD.status != 'completed' OR OLD.winner_id IS NULL) THEN
    UPDATE public.players 
    SET 
      wins = wins + 1,
      total_matches = total_matches + 1,
      current_streak = current_streak + 1,
      best_streak = GREATEST(best_streak, current_streak + 1),
      hours_played = hours_played + COALESCE(NEW.duration_minutes, 120) / 60.0,
      updated_at = NOW()
    WHERE id = NEW.winner_id;
    
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
$function$;

-- Function 8: expire_pending_match_invites
CREATE OR REPLACE FUNCTION public.expire_pending_match_invites()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  expired_count INTEGER;
BEGIN
  WITH expired_matches AS (
    UPDATE public.matches
    SET invitation_status = 'declined', updated_at = now()
    WHERE invitation_status = 'pending'
    AND created_at < (now() - INTERVAL '72 hours')
    RETURNING id
  )
  SELECT COUNT(*) INTO expired_count FROM expired_matches;
  RETURN expired_count;
END;
$function$;

-- Function 9: mark_all_notifications_read
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.notifications
  SET read = true
  WHERE user_id = p_user_id AND read = false;
END;
$function$;