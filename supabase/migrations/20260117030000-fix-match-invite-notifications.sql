-- Fix match invite notifications to include declined invites
-- This ensures both sender and receiver get proper notifications for all invite responses

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS notify_match_invite_trigger ON public.match_invites;
DROP FUNCTION IF EXISTS public.notify_match_invite();

-- Recreate function with support for declined invites
CREATE OR REPLACE FUNCTION public.notify_match_invite()
RETURNS TRIGGER
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
  
  -- New match invite sent (INSERT or status changed to pending)
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
  
  -- Match invite accepted
  ELSIF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Create notification for sender about accepted invite
    PERFORM public.create_notification(
      NEW.sender_id,
      'match_accepted',
      'Match Invite Accepted',
      CONCAT(COALESCE(receiver_name, 'Someone'), ' accepted your match invite for ', NEW.date::TEXT, ' at ', NEW.start_time::TEXT),
      '/dashboard?tab=schedule',
      jsonb_build_object('invite_id', NEW.id, 'receiver_id', NEW.receiver_id)
    );
  
  -- Match invite declined
  ELSIF NEW.status = 'declined' AND OLD.status = 'pending' THEN
    -- Create notification for sender about declined invite
    PERFORM public.create_notification(
      NEW.sender_id,
      'match_declined',
      'Match Invite Declined',
      CONCAT(COALESCE(receiver_name, 'Someone'), ' declined your match invite for ', NEW.date::TEXT, ' at ', NEW.start_time::TEXT),
      '/dashboard?tab=schedule',
      jsonb_build_object('invite_id', NEW.id, 'receiver_id', NEW.receiver_id)
    );
  
  -- Match invite cancelled
  ELSIF NEW.status = 'cancelled' AND OLD.status IN ('pending', 'accepted') THEN
    -- Determine who to notify (the other party)
    IF NEW.cancelled_by_user_id = NEW.sender_id THEN
      -- Sender cancelled, notify receiver
      PERFORM public.create_notification(
        NEW.receiver_id,
        'match_cancelled',
        'Match Cancelled',
        CONCAT(COALESCE(sender_name, 'Someone'), ' cancelled the match for ', NEW.date::TEXT, ' at ', NEW.start_time::TEXT),
        '/dashboard?tab=schedule',
        jsonb_build_object('invite_id', NEW.id, 'cancelled_by', 'sender', 'reason', NEW.cancellation_reason)
      );
    ELSIF NEW.cancelled_by_user_id = NEW.receiver_id THEN
      -- Receiver cancelled, notify sender
      PERFORM public.create_notification(
        NEW.sender_id,
        'match_cancelled',
        'Match Cancelled',
        CONCAT(COALESCE(receiver_name, 'Someone'), ' cancelled the match for ', NEW.date::TEXT, ' at ', NEW.start_time::TEXT),
        '/dashboard?tab=schedule',
        jsonb_build_object('invite_id', NEW.id, 'cancelled_by', 'receiver', 'reason', NEW.cancellation_reason)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Recreate trigger for match invite notifications
CREATE TRIGGER notify_match_invite_trigger
AFTER INSERT OR UPDATE ON public.match_invites
FOR EACH ROW
EXECUTE FUNCTION public.notify_match_invite();

-- Add comment explaining the trigger
COMMENT ON TRIGGER notify_match_invite_trigger ON public.match_invites IS 
'Sends notifications to users when match invites are created, accepted, declined, or cancelled';
