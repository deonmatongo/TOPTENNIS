-- Add comprehensive match scoring and status fields
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS set1_player1 INTEGER,
ADD COLUMN IF NOT EXISTS set1_player2 INTEGER,
ADD COLUMN IF NOT EXISTS set2_player1 INTEGER,
ADD COLUMN IF NOT EXISTS set2_player2 INTEGER,
ADD COLUMN IF NOT EXISTS set3_player1 INTEGER,
ADD COLUMN IF NOT EXISTS set3_player2 INTEGER,
ADD COLUMN IF NOT EXISTS tiebreak_player1 INTEGER,
ADD COLUMN IF NOT EXISTS tiebreak_player2 INTEGER,
ADD COLUMN IF NOT EXISTS reported_by_user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reported_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS home_player_id UUID,
ADD COLUMN IF NOT EXISTS away_player_id UUID;

-- Update match_invites table to support accept/decline
ALTER TABLE public.match_invites
ADD COLUMN IF NOT EXISTS response_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS home_away_indicator TEXT CHECK (home_away_indicator IN ('home', 'away'));

-- Add trigger to notify when match score is reported
CREATE OR REPLACE FUNCTION public.notify_match_score_reported()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  player1_name TEXT;
  player2_name TEXT;
  loser_id UUID;
BEGIN
  -- Get player names
  SELECT name INTO player1_name FROM public.players WHERE id = NEW.player1_id;
  SELECT name INTO player2_name FROM public.players WHERE id = NEW.player2_id;
  
  -- Determine loser
  loser_id := CASE 
    WHEN NEW.winner_id = NEW.player1_id THEN NEW.player2_id 
    ELSE NEW.player1_id 
  END;
  
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Notify the loser about the score
    PERFORM public.create_notification(
      (SELECT user_id FROM public.players WHERE id = loser_id),
      'match_score_reported',
      'Match Score Reported',
      CONCAT(player1_name, ' reported the match result'),
      '/dashboard?tab=my-leagues',
      jsonb_build_object(
        'match_id', NEW.id,
        'winner_id', NEW.winner_id,
        'set1', CONCAT(NEW.set1_player1, '-', NEW.set1_player2),
        'set2', CONCAT(NEW.set2_player1, '-', NEW.set2_player2)
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_match_score_reported
  AFTER UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_match_score_reported();

-- Update leagues table to support tournament status
ALTER TABLE public.divisions
ADD COLUMN IF NOT EXISTS tournament_status TEXT DEFAULT 'inactive' CHECK (tournament_status IN ('inactive', 'active', 'completed'));