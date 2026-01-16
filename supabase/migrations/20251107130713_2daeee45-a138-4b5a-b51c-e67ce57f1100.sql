-- Fix remaining Function Search Path Mutable warnings - Final batch

-- Function 13-20: All the notification and other trigger functions
CREATE OR REPLACE FUNCTION public.notify_message_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  sender_name TEXT;
BEGIN
  SELECT CONCAT(first_name, ' ', last_name) INTO sender_name
  FROM public.profiles
  WHERE id = NEW.sender_id;
  
  PERFORM public.create_notification(
    NEW.receiver_id,
    'message_received',
    'New Message',
    CONCAT('You received a message from ', COALESCE(sender_name, 'someone')),
    '/dashboard?tab=messages',
    jsonb_build_object('message_id', NEW.id, 'sender_id', NEW.sender_id)
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_friend_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  sender_name TEXT;
  receiver_name TEXT;
BEGIN
  SELECT CONCAT(first_name, ' ', last_name) INTO sender_name
  FROM public.profiles WHERE id = NEW.sender_id;
  
  SELECT CONCAT(first_name, ' ', last_name) INTO receiver_name
  FROM public.profiles WHERE id = NEW.receiver_id;
  
  IF NEW.status = 'pending' AND (OLD.status IS NULL OR OLD.status != 'pending') THEN
    PERFORM public.create_notification(
      NEW.receiver_id, 'friend_request', 'Friend Request',
      CONCAT(COALESCE(sender_name, 'Someone'), ' sent you a friend request'),
      '/dashboard?tab=friends',
      jsonb_build_object('request_id', NEW.id, 'sender_id', NEW.sender_id)
    );
  ELSIF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    PERFORM public.create_notification(
      NEW.sender_id, 'friend_accepted', 'Friend Request Accepted',
      CONCAT(COALESCE(receiver_name, 'Someone'), ' accepted your friend request'),
      '/dashboard?tab=friends',
      jsonb_build_object('request_id', NEW.id, 'friend_id', NEW.receiver_id)
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.schedule_event_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  DELETE FROM public.event_reminders_queue WHERE event_id = NEW.id;
  
  IF NEW.reminder_offset_minutes IS NOT NULL AND NEW.reminder_offset_minutes > 0 THEN
    INSERT INTO public.event_reminders_queue (event_id, user_id, reminder_time)
    VALUES (NEW.id, NEW.creator_id, NEW.start_time_utc - (NEW.reminder_offset_minutes || ' minutes')::INTERVAL)
    ON CONFLICT (event_id, user_id, reminder_time) DO NOTHING;
    
    INSERT INTO public.event_reminders_queue (event_id, user_id, reminder_time)
    SELECT NEW.id, ep.user_id, NEW.start_time_utc - (NEW.reminder_offset_minutes || ' minutes')::INTERVAL
    FROM public.event_participants ep
    WHERE ep.event_id = NEW.id AND ep.rsvp_status IN ('accepted', 'tentative')
    ON CONFLICT (event_id, user_id, reminder_time) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_event_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_event_name TEXT;
  v_creator_name TEXT;
  v_start_time TIMESTAMPTZ;
BEGIN
  SELECT event_name, start_time_utc INTO v_event_name, v_start_time
  FROM public.calendar_events WHERE id = NEW.event_id;
  
  SELECT CONCAT(first_name, ' ', last_name) INTO v_creator_name
  FROM public.profiles
  WHERE id = (SELECT creator_id FROM public.calendar_events WHERE id = NEW.event_id);
  
  IF NEW.rsvp_status = 'invited' AND (OLD IS NULL OR OLD.rsvp_status != 'invited') THEN
    PERFORM public.create_notification(
      NEW.user_id, 'event_invitation', 'Event Invitation',
      CONCAT(COALESCE(v_creator_name, 'Someone'), ' invited you to "', v_event_name, '" on ', TO_CHAR(v_start_time, 'Mon DD at HH24:MI')),
      '/dashboard?tab=schedule',
      jsonb_build_object('event_id', NEW.event_id, 'creator_id', (SELECT creator_id FROM public.calendar_events WHERE id = NEW.event_id))
    );
  END IF;
  RETURN NEW;
END;
$function$;