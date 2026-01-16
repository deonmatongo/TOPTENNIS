-- Fix final remaining Function Search Path Mutable warnings

CREATE OR REPLACE FUNCTION public.notify_match_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  sender_name TEXT;
  receiver_name TEXT;
BEGIN
  SELECT CONCAT(first_name, ' ', last_name) INTO sender_name FROM public.profiles WHERE id = NEW.sender_id;
  SELECT CONCAT(first_name, ' ', last_name) INTO receiver_name FROM public.profiles WHERE id = NEW.receiver_id;
  
  IF NEW.status = 'pending' AND (OLD.status IS NULL OR OLD.status != 'pending') THEN
    PERFORM public.create_notification(
      NEW.receiver_id, 'match_invite', 'Match Invite',
      CONCAT(COALESCE(sender_name, 'Someone'), ' sent you a match invite for ', NEW.date::TEXT, ' at ', NEW.start_time::TEXT),
      '/dashboard?tab=schedule',
      jsonb_build_object('invite_id', NEW.id, 'sender_id', NEW.sender_id)
    );
  ELSIF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    PERFORM public.create_notification(
      NEW.sender_id, 'match_accepted', 'Match Invite Accepted',
      CONCAT(COALESCE(receiver_name, 'Someone'), ' accepted your match invite'),
      '/dashboard?tab=messages',
      jsonb_build_object('invite_id', NEW.id, 'receiver_id', NEW.receiver_id)
    );
  ELSIF NEW.status = 'cancelled' AND OLD.status = 'pending' THEN
    PERFORM public.create_notification(
      CASE WHEN auth.uid() = NEW.sender_id THEN NEW.receiver_id ELSE NEW.sender_id END,
      'match_cancelled', 'Match Invite Cancelled',
      CONCAT(
        CASE WHEN auth.uid() = NEW.sender_id THEN COALESCE(sender_name, 'Someone') ELSE COALESCE(receiver_name, 'Someone') END,
        ' cancelled the match invite for ', NEW.date::TEXT, ' at ', NEW.start_time::TEXT
      ),
      '/dashboard?tab=schedule',
      jsonb_build_object('invite_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_booking_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  booker_name TEXT;
  opponent_name TEXT;
BEGIN
  SELECT CONCAT(first_name, ' ', last_name) INTO booker_name FROM public.profiles WHERE id = NEW.booker_id;
  SELECT CONCAT(first_name, ' ', last_name) INTO opponent_name FROM public.profiles WHERE id = NEW.opponent_id;
  
  IF NEW.status = 'pending' AND (OLD IS NULL OR OLD.status != 'pending') THEN
    PERFORM public.create_notification(
      NEW.opponent_id, 'match_invite', 'Match Booking Request',
      CONCAT(COALESCE(booker_name, 'Someone'), ' wants to book a match with you on ', NEW.date::TEXT, ' at ', NEW.start_time::TEXT),
      '/dashboard?tab=schedule',
      jsonb_build_object('booking_id', NEW.id, 'booker_id', NEW.booker_id, 'status', 'pending')
    );
  ELSIF NEW.status = 'confirmed' AND OLD.status = 'pending' THEN
    PERFORM public.create_notification(
      NEW.booker_id, 'match_confirmed', 'Match Booking Accepted',
      CONCAT(COALESCE(opponent_name, 'Someone'), ' accepted your match booking for ', NEW.date::TEXT, ' at ', NEW.start_time::TEXT),
      '/dashboard?tab=schedule',
      jsonb_build_object('booking_id', NEW.id, 'opponent_id', NEW.opponent_id)
    );
  ELSIF NEW.status = 'declined' AND OLD.status = 'pending' THEN
    PERFORM public.create_notification(
      NEW.booker_id, 'match_cancelled', 'Match Booking Declined',
      CONCAT(COALESCE(opponent_name, 'Someone'), ' declined your match booking for ', NEW.date::TEXT, ' at ', NEW.start_time::TEXT),
      '/dashboard?tab=schedule',
      jsonb_build_object('booking_id', NEW.id)
    );
  ELSIF NEW.status = 'cancelled' AND OLD.status = 'confirmed' THEN
    PERFORM public.create_notification(
      CASE WHEN auth.uid() = NEW.booker_id THEN NEW.opponent_id ELSE NEW.booker_id END,
      'match_cancelled', 'Match Cancelled',
      CONCAT(
        CASE WHEN auth.uid() = NEW.booker_id THEN COALESCE(booker_name, 'Someone') ELSE COALESCE(opponent_name, 'Someone') END,
        ' cancelled the match on ', NEW.date::TEXT, ' at ', NEW.start_time::TEXT
      ),
      '/dashboard?tab=schedule',
      jsonb_build_object('booking_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_match_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  total_accepts INTEGER;
  match_record RECORD;
  player1_user_id UUID;
  player2_user_id UUID;
  other_player_name TEXT;
  responding_player_name TEXT;
BEGIN
  SELECT * INTO match_record FROM public.matches WHERE id = NEW.match_id;
  SELECT user_id INTO player1_user_id FROM public.players WHERE id = match_record.player1_id;
  SELECT user_id INTO player2_user_id FROM public.players WHERE id = match_record.player2_id;
  
  SELECT CONCAT(first_name, ' ', last_name) INTO responding_player_name FROM public.profiles WHERE id = NEW.user_id;
  SELECT CONCAT(first_name, ' ', last_name) INTO other_player_name
  FROM public.profiles WHERE id = CASE WHEN NEW.user_id = player1_user_id THEN player2_user_id ELSE player1_user_id END;
  
  IF NEW.response = 'accepted' THEN
    SELECT COUNT(*) INTO total_accepts FROM public.match_responses WHERE match_id = NEW.match_id AND response = 'accepted';
    IF total_accepts = 2 THEN
      UPDATE public.matches SET invitation_status = 'confirmed', updated_at = now() WHERE id = NEW.match_id;
      PERFORM public.create_notification(player1_user_id, 'match_confirmed', 'Match Confirmed',
        CONCAT('Your match on ', match_record.match_date::DATE, ' at ', EXTRACT(HOUR FROM match_record.match_date)::TEXT, ':', LPAD(EXTRACT(MINUTE FROM match_record.match_date)::TEXT, 2, '0'), ' is confirmed!'),
        '/dashboard?tab=matches', jsonb_build_object('match_id', NEW.match_id));
      PERFORM public.create_notification(player2_user_id, 'match_confirmed', 'Match Confirmed',
        CONCAT('Your match on ', match_record.match_date::DATE, ' at ', EXTRACT(HOUR FROM match_record.match_date)::TEXT, ':', LPAD(EXTRACT(MINUTE FROM match_record.match_date)::TEXT, 2, '0'), ' is confirmed!'),
        '/dashboard?tab=matches', jsonb_build_object('match_id', NEW.match_id));
    ELSE
      UPDATE public.matches SET invitation_status = 'accepted', updated_at = now() WHERE id = NEW.match_id;
      PERFORM public.create_notification(
        CASE WHEN NEW.user_id = player1_user_id THEN player2_user_id ELSE player1_user_id END,
        'match_accepted', 'Match Accepted',
        CONCAT(COALESCE(responding_player_name, 'Someone'), ' accepted your match invitation'),
        '/dashboard?tab=matches', jsonb_build_object('match_id', NEW.match_id));
    END IF;
  ELSIF NEW.response = 'declined' THEN
    UPDATE public.matches SET invitation_status = 'declined', updated_at = now() WHERE id = NEW.match_id;
    PERFORM public.create_notification(
      CASE WHEN NEW.user_id = player1_user_id THEN player2_user_id ELSE player1_user_id END,
      'match_declined', 'Match Declined',
      CONCAT(COALESCE(responding_player_name, 'Someone'), ' declined your match invitation'),
      '/dashboard?tab=matches', jsonb_build_object('match_id', NEW.match_id));
  ELSIF NEW.response = 'proposed' THEN
    IF match_record.reschedule_count >= 3 THEN
      RAISE EXCEPTION 'Maximum reschedule attempts (3) reached for this match';
    END IF;
    UPDATE public.matches SET invitation_status = 'rescheduled', proposed_start = NEW.proposed_start, proposed_end = NEW.proposed_end,
      reschedule_count = reschedule_count + 1, updated_at = now() WHERE id = NEW.match_id;
    UPDATE public.match_responses SET response = 'pending', updated_at = now()
    WHERE match_id = NEW.match_id AND user_id = CASE WHEN NEW.user_id = player1_user_id THEN player2_user_id ELSE player1_user_id END;
    PERFORM public.create_notification(
      CASE WHEN NEW.user_id = player1_user_id THEN player2_user_id ELSE player1_user_id END,
      'match_rescheduled', 'New Time Proposed',
      CONCAT(COALESCE(responding_player_name, 'Someone'), ' proposed a new time: ', TO_CHAR(NEW.proposed_start, 'Mon DD at HH24:MI'),
        CASE WHEN NEW.comment IS NOT NULL THEN CONCAT(' - "', NEW.comment, '"') ELSE '' END),
      '/dashboard?tab=matches',
      jsonb_build_object('match_id', NEW.match_id, 'proposed_start', NEW.proposed_start, 'proposed_end', NEW.proposed_end));
  END IF;
  RETURN NEW;
END;
$function$;