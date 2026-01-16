-- Create match_invites table for handling match invitations
CREATE TABLE public.match_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  availability_id UUID REFERENCES public.user_availability(id),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  court_location TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '7 days')
);

-- Enable RLS
ALTER TABLE public.match_invites ENABLE ROW LEVEL SECURITY;

-- Create policies for match invites
CREATE POLICY "Users can send match invites" 
ON public.match_invites 
FOR INSERT 
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can view invites they sent or received" 
ON public.match_invites 
FOR SELECT 
USING ((auth.uid() = sender_id) OR (auth.uid() = receiver_id));

CREATE POLICY "Users can update invites they received" 
ON public.match_invites 
FOR UPDATE 
USING (auth.uid() = receiver_id)
WITH CHECK (auth.uid() = receiver_id);

-- Create function to update updated_at timestamp
CREATE TRIGGER update_match_invites_updated_at
BEFORE UPDATE ON public.match_invites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to notify users about match invites
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
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for match invite notifications
CREATE TRIGGER notify_match_invite_trigger
AFTER INSERT OR UPDATE ON public.match_invites
FOR EACH ROW
EXECUTE FUNCTION public.notify_match_invite();