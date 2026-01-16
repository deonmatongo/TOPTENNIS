-- Create friend_requests table
CREATE TABLE public.friend_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sender_id, receiver_id)
);

-- Enable RLS on friend_requests
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for friend_requests
CREATE POLICY "Users can send friend requests"
ON public.friend_requests
FOR INSERT
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can view friend requests they sent or received"
ON public.friend_requests
FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can update friend requests they received"
ON public.friend_requests
FOR UPDATE
USING (auth.uid() = receiver_id)
WITH CHECK (auth.uid() = receiver_id);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('message_received', 'friend_request', 'friend_accepted', 'match_scheduled', 'match_result', 'league_update', 'achievement', 'match_suggestion', 'general')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  action_url TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Function to create a notification
CREATE OR REPLACE FUNCTION public.create_notification(
  target_user_id UUID,
  notification_type TEXT,
  notification_title TEXT,
  notification_message TEXT,
  notification_action_url TEXT DEFAULT NULL,
  notification_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    action_url,
    metadata
  ) VALUES (
    target_user_id,
    notification_type,
    notification_title,
    notification_message,
    notification_action_url,
    notification_metadata
  ) RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- Trigger function for message notifications
CREATE OR REPLACE FUNCTION public.notify_message_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sender_name TEXT;
BEGIN
  -- Get sender name from profiles
  SELECT CONCAT(first_name, ' ', last_name) INTO sender_name
  FROM public.profiles
  WHERE id = NEW.sender_id;
  
  -- Create notification for receiver
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
$$;

-- Trigger function for friend request notifications
CREATE OR REPLACE FUNCTION public.notify_friend_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
    -- Create notification for receiver about new friend request
    PERFORM public.create_notification(
      NEW.receiver_id,
      'friend_request',
      'Friend Request',
      CONCAT(COALESCE(sender_name, 'Someone'), ' sent you a friend request'),
      '/dashboard?tab=friends',
      jsonb_build_object('request_id', NEW.id, 'sender_id', NEW.sender_id)
    );
  ELSIF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Create notification for sender about accepted friend request
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
$$;

-- Create triggers
CREATE TRIGGER message_notification_trigger
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_message_received();

CREATE TRIGGER friend_request_notification_trigger
  AFTER INSERT OR UPDATE ON public.friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_friend_request();

-- Update friend_requests updated_at trigger
CREATE OR REPLACE FUNCTION public.update_friend_requests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_friend_requests_updated_at
  BEFORE UPDATE ON public.friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_friend_requests_updated_at();