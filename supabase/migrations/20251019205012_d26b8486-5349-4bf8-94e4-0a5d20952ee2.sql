-- Add match_responses table for tracking individual player responses
CREATE TABLE IF NOT EXISTS public.match_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  response TEXT NOT NULL CHECK (response IN ('pending', 'accepted', 'declined', 'proposed')),
  proposed_start TIMESTAMPTZ,
  proposed_end TIMESTAMPTZ,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(match_id, user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_match_responses_match_id ON public.match_responses(match_id);
CREATE INDEX IF NOT EXISTS idx_match_responses_user_id ON public.match_responses(user_id);

-- Enable RLS on match_responses
ALTER TABLE public.match_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for match_responses
CREATE POLICY "Users can view responses for their matches"
  ON public.match_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_responses.match_id
      AND (m.player1_id IN (SELECT id FROM public.players WHERE user_id = auth.uid())
           OR m.player2_id IN (SELECT id FROM public.players WHERE user_id = auth.uid()))
    )
  );

CREATE POLICY "Users can create responses for their matches"
  ON public.match_responses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own responses"
  ON public.match_responses FOR UPDATE
  USING (auth.uid() = user_id);

-- Add proposed time fields to matches table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'matches' AND column_name = 'proposed_start') THEN
    ALTER TABLE public.matches ADD COLUMN proposed_start TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'matches' AND column_name = 'proposed_end') THEN
    ALTER TABLE public.matches ADD COLUMN proposed_end TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'matches' AND column_name = 'invitation_status') THEN
    ALTER TABLE public.matches ADD COLUMN invitation_status TEXT DEFAULT 'pending' 
      CHECK (invitation_status IN ('pending', 'accepted', 'declined', 'confirmed', 'rescheduled'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'matches' AND column_name = 'reschedule_count') THEN
    ALTER TABLE public.matches ADD COLUMN reschedule_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Function to handle match response logic
CREATE OR REPLACE FUNCTION public.handle_match_response()
RETURNS TRIGGER AS $$
DECLARE
  total_accepts INTEGER;
  match_record RECORD;
  player1_user_id UUID;
  player2_user_id UUID;
  other_player_name TEXT;
  responding_player_name TEXT;
BEGIN
  -- Get match details
  SELECT * INTO match_record FROM public.matches WHERE id = NEW.match_id;
  
  -- Get user IDs for both players
  SELECT user_id INTO player1_user_id FROM public.players WHERE id = match_record.player1_id;
  SELECT user_id INTO player2_user_id FROM public.players WHERE id = match_record.player2_id;
  
  -- Get player names for notifications
  SELECT CONCAT(first_name, ' ', last_name) INTO responding_player_name
  FROM public.profiles WHERE id = NEW.user_id;
  
  SELECT CONCAT(first_name, ' ', last_name) INTO other_player_name
  FROM public.profiles 
  WHERE id = CASE WHEN NEW.user_id = player1_user_id THEN player2_user_id ELSE player1_user_id END;
  
  -- Handle ACCEPT response
  IF NEW.response = 'accepted' THEN
    -- Count total accepts for this match
    SELECT COUNT(*) INTO total_accepts 
    FROM public.match_responses
    WHERE match_id = NEW.match_id AND response = 'accepted';
    
    -- If both players accepted, confirm the match
    IF total_accepts = 2 THEN
      UPDATE public.matches 
      SET invitation_status = 'confirmed', updated_at = now()
      WHERE id = NEW.match_id;
      
      -- Notify both players that match is confirmed
      PERFORM public.create_notification(
        player1_user_id,
        'match_confirmed',
        'Match Confirmed',
        CONCAT('Your match on ', match_record.match_date::DATE, ' at ', 
               EXTRACT(HOUR FROM match_record.match_date)::TEXT, ':',
               LPAD(EXTRACT(MINUTE FROM match_record.match_date)::TEXT, 2, '0'), ' is confirmed!'),
        '/dashboard?tab=matches',
        jsonb_build_object('match_id', NEW.match_id)
      );
      
      PERFORM public.create_notification(
        player2_user_id,
        'match_confirmed',
        'Match Confirmed',
        CONCAT('Your match on ', match_record.match_date::DATE, ' at ', 
               EXTRACT(HOUR FROM match_record.match_date)::TEXT, ':',
               LPAD(EXTRACT(MINUTE FROM match_record.match_date)::TEXT, 2, '0'), ' is confirmed!'),
        '/dashboard?tab=matches',
        jsonb_build_object('match_id', NEW.match_id)
      );
    ELSE
      -- Only one player accepted, notify the other
      UPDATE public.matches 
      SET invitation_status = 'accepted', updated_at = now()
      WHERE id = NEW.match_id;
      
      PERFORM public.create_notification(
        CASE WHEN NEW.user_id = player1_user_id THEN player2_user_id ELSE player1_user_id END,
        'match_accepted',
        'Match Accepted',
        CONCAT(COALESCE(responding_player_name, 'Someone'), ' accepted your match invitation'),
        '/dashboard?tab=matches',
        jsonb_build_object('match_id', NEW.match_id)
      );
    END IF;
    
  -- Handle DECLINE response
  ELSIF NEW.response = 'declined' THEN
    UPDATE public.matches 
    SET invitation_status = 'declined', updated_at = now()
    WHERE id = NEW.match_id;
    
    -- Notify the other player
    PERFORM public.create_notification(
      CASE WHEN NEW.user_id = player1_user_id THEN player2_user_id ELSE player1_user_id END,
      'match_declined',
      'Match Declined',
      CONCAT(COALESCE(responding_player_name, 'Someone'), ' declined your match invitation'),
      '/dashboard?tab=matches',
      jsonb_build_object('match_id', NEW.match_id)
    );
    
  -- Handle PROPOSE NEW TIME response
  ELSIF NEW.response = 'proposed' THEN
    -- Check if we've exceeded max reschedule attempts
    IF match_record.reschedule_count >= 3 THEN
      RAISE EXCEPTION 'Maximum reschedule attempts (3) reached for this match';
    END IF;
    
    -- Update match with proposed time and increment reschedule count
    UPDATE public.matches 
    SET 
      invitation_status = 'rescheduled',
      proposed_start = NEW.proposed_start,
      proposed_end = NEW.proposed_end,
      reschedule_count = reschedule_count + 1,
      updated_at = now()
    WHERE id = NEW.match_id;
    
    -- Reset the other player's response to pending
    UPDATE public.match_responses
    SET response = 'pending', updated_at = now()
    WHERE match_id = NEW.match_id 
    AND user_id = CASE WHEN NEW.user_id = player1_user_id THEN player2_user_id ELSE player1_user_id END;
    
    -- Notify the other player about the proposed time
    PERFORM public.create_notification(
      CASE WHEN NEW.user_id = player1_user_id THEN player2_user_id ELSE player1_user_id END,
      'match_rescheduled',
      'New Time Proposed',
      CONCAT(
        COALESCE(responding_player_name, 'Someone'), 
        ' proposed a new time: ',
        TO_CHAR(NEW.proposed_start, 'Mon DD at HH24:MI'),
        CASE WHEN NEW.comment IS NOT NULL THEN CONCAT(' - "', NEW.comment, '"') ELSE '' END
      ),
      '/dashboard?tab=matches',
      jsonb_build_object(
        'match_id', NEW.match_id,
        'proposed_start', NEW.proposed_start,
        'proposed_end', NEW.proposed_end
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for match responses
DROP TRIGGER IF EXISTS trigger_handle_match_response ON public.match_responses;
CREATE TRIGGER trigger_handle_match_response
  AFTER INSERT OR UPDATE ON public.match_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_match_response();

-- Function to auto-expire pending invites after 72 hours
CREATE OR REPLACE FUNCTION public.expire_pending_match_invites()
RETURNS INTEGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update match_responses updated_at
CREATE OR REPLACE FUNCTION public.update_match_responses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_match_responses_updated_at ON public.match_responses;
CREATE TRIGGER trigger_update_match_responses_updated_at
  BEFORE UPDATE ON public.match_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_match_responses_updated_at();