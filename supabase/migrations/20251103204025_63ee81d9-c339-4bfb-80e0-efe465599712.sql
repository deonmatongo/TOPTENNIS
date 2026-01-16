-- Update the notify_match_invite trigger function to handle cancellations
CREATE OR REPLACE FUNCTION public.notify_match_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  sender_name TEXT;
  receiver_name TEXT;
BEGIN
  -- Get sender and receiver names
  SELECT CONCAT(first_name, ' ', last_name) INTO sender_name
  FROM public.profiles
  WHERE id = NEW.sender_id;
  
  SELECT CONCAT(first_name, ' ', last_name) INTO receiver_name
  FROM public.profiles
  WHERE id = NEW.receiver_id;
  
  IF NEW.status = 'pending' AND (OLD.status IS NULL OR OLD.status != 'pending') THEN
    -- Create notification for receiver about new match invite
    PERFORM public.create_notification(
      NEW.receiver_id,
      'match_invite',
      'Match Invite',
      CONCAT(COALESCE(sender_name, 'Someone'), ' sent you a match invite for ', NEW.date::TEXT, ' at ', NEW.start_time::TEXT),
      '/dashboard?tab=schedule',
      jsonb_build_object('invite_id', NEW.id, 'sender_id', NEW.sender_id)
    );
  ELSIF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Create notification for sender about accepted invite
    PERFORM public.create_notification(
      NEW.sender_id,
      'match_accepted',
      'Match Invite Accepted',
      CONCAT(COALESCE(receiver_name, 'Someone'), ' accepted your match invite'),
      '/dashboard?tab=messages',
      jsonb_build_object('invite_id', NEW.id, 'receiver_id', NEW.receiver_id)
    );
  ELSIF NEW.status = 'cancelled' AND OLD.status = 'pending' THEN
    -- Notify the other party about cancellation
    -- If sender cancelled, notify receiver. If receiver cancelled, notify sender.
    PERFORM public.create_notification(
      CASE WHEN auth.uid() = NEW.sender_id THEN NEW.receiver_id ELSE NEW.sender_id END,
      'match_cancelled',
      'Match Invite Cancelled',
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