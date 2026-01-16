-- Fix remaining notification and trigger functions - Part 5

-- Regenerate membership ID function
CREATE OR REPLACE FUNCTION public.regenerate_membership_id(user_uuid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_id TEXT;
BEGIN
  SELECT public.generate_membership_id() INTO new_id;
  UPDATE public.profiles 
  SET membership_id = new_id, updated_at = NOW()
  WHERE id = user_uuid;
  RETURN new_id;
END;
$function$;

-- Notify message received function
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

-- Notify friend request function
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
  FROM public.profiles
  WHERE id = NEW.sender_id;
  
  SELECT CONCAT(first_name, ' ', last_name) INTO receiver_name
  FROM public.profiles
  WHERE id = NEW.receiver_id;
  
  IF NEW.status = 'pending' AND (OLD.status IS NULL OR OLD.status != 'pending') THEN
    PERFORM public.create_notification(
      NEW.receiver_id,
      'friend_request',
      'Friend Request',
      CONCAT(COALESCE(sender_name, 'Someone'), ' sent you a friend request'),
      '/dashboard?tab=friends',
      jsonb_build_object('request_id', NEW.id, 'sender_id', NEW.sender_id)
    );
  ELSIF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    PERFORM public.create_notification(
      NEW.sender_id,
      'friend_accepted',
      'Friend Request Accepted',
      CONCAT(COALESCE(receiver_name, 'Someone'), ' accepted your friend request'),
      '/dashboard?tab=friends',
      jsonb_build_object('request_id', NEW.id, 'friend_id', NEW.receiver_id)
    );
  END IF;
  
  RETURN NEW;
END;
$function$;