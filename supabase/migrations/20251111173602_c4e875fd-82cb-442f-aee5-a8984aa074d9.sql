-- Enhanced match invite trigger with more notification scenarios
CREATE OR REPLACE FUNCTION public.notify_match_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  sender_name TEXT;
  receiver_name TEXT;
  proposer_name TEXT;
BEGIN
  -- Get names
  SELECT CONCAT(first_name, ' ', last_name) INTO sender_name 
  FROM public.profiles WHERE id = NEW.sender_id;
  
  SELECT CONCAT(first_name, ' ', last_name) INTO receiver_name 
  FROM public.profiles WHERE id = NEW.receiver_id;
  
  -- New invite
  IF NEW.status = 'pending' AND (OLD.status IS NULL OR OLD.status != 'pending') THEN
    PERFORM public.create_notification(
      NEW.receiver_id, 
      'match_invite', 
      'Match Invite',
      CONCAT(COALESCE(sender_name, 'Someone'), ' sent you a match invite for ', 
             TO_CHAR(NEW.date, 'Mon DD'), ' at ', TO_CHAR(NEW.start_time, 'HH12:MI AM')),
      '/dashboard?tab=schedule',
      jsonb_build_object(
        'invite_id', NEW.id, 
        'sender_id', NEW.sender_id,
        'date', NEW.date,
        'start_time', NEW.start_time,
        'end_time', NEW.end_time,
        'court_location', NEW.court_location,
        'message', NEW.message
      )
    );
    
  -- Invite accepted
  ELSIF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    PERFORM public.create_notification(
      NEW.sender_id, 
      'match_accepted', 
      'Match Invite Accepted',
      CONCAT(COALESCE(receiver_name, 'Someone'), ' accepted your match invite for ',
             TO_CHAR(NEW.date, 'Mon DD'), ' at ', TO_CHAR(NEW.start_time, 'HH12:MI AM')),
      '/dashboard?tab=messages',
      jsonb_build_object(
        'invite_id', NEW.id, 
        'receiver_id', NEW.receiver_id,
        'date', NEW.date,
        'start_time', NEW.start_time
      )
    );
    
  -- Invite declined (NEW)
  ELSIF NEW.status = 'declined' AND OLD.status = 'pending' THEN
    PERFORM public.create_notification(
      NEW.sender_id, 
      'match_declined', 
      'Match Invite Declined',
      CONCAT(COALESCE(receiver_name, 'Someone'), ' declined your match invite for ',
             TO_CHAR(NEW.date, 'Mon DD'), ' at ', TO_CHAR(NEW.start_time, 'HH12:MI AM')),
      '/dashboard?tab=schedule',
      jsonb_build_object(
        'invite_id', NEW.id,
        'date', NEW.date,
        'start_time', NEW.start_time
      )
    );
    
  -- Proposed time updated (NEW)
  ELSIF NEW.proposed_date IS NOT NULL 
    AND (OLD.proposed_date IS NULL 
         OR NEW.proposed_date != OLD.proposed_date 
         OR NEW.proposed_start_time != OLD.proposed_start_time) THEN
    
    -- Get proposer name
    SELECT CONCAT(first_name, ' ', last_name) INTO proposer_name 
    FROM public.profiles WHERE id = NEW.proposed_by_user_id;
    
    -- Notify the other party
    PERFORM public.create_notification(
      CASE WHEN NEW.proposed_by_user_id = NEW.sender_id 
           THEN NEW.receiver_id 
           ELSE NEW.sender_id END,
      'match_rescheduled',
      'New Time Proposed',
      CONCAT(COALESCE(proposer_name, 'Someone'), ' proposed a new time: ',
             TO_CHAR(NEW.proposed_date, 'Mon DD'), ' at ', 
             TO_CHAR(NEW.proposed_start_time, 'HH12:MI AM')),
      '/dashboard?tab=schedule',
      jsonb_build_object(
        'invite_id', NEW.id,
        'proposed_date', NEW.proposed_date,
        'proposed_start_time', NEW.proposed_start_time,
        'proposed_end_time', NEW.proposed_end_time,
        'proposer_id', NEW.proposed_by_user_id
      )
    );
    
  -- Invite cancelled
  ELSIF NEW.status = 'cancelled' AND OLD.status = 'pending' THEN
    PERFORM public.create_notification(
      CASE WHEN auth.uid() = NEW.sender_id THEN NEW.receiver_id ELSE NEW.sender_id END,
      'match_cancelled', 
      'Match Invite Cancelled',
      CONCAT(
        CASE WHEN auth.uid() = NEW.sender_id 
             THEN COALESCE(sender_name, 'Someone') 
             ELSE COALESCE(receiver_name, 'Someone') END,
        ' cancelled the match invite for ', TO_CHAR(NEW.date, 'Mon DD'), 
        ' at ', TO_CHAR(NEW.start_time, 'HH12:MI AM')
      ),
      '/dashboard?tab=schedule',
      jsonb_build_object('invite_id', NEW.id)
    );
  END IF;
  
  RETURN NEW;
END;
$function$;