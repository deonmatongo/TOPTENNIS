-- Add recurring availability and privacy controls to user_availability table
ALTER TABLE public.user_availability 
ADD COLUMN IF NOT EXISTS recurrence_rule TEXT,
ADD COLUMN IF NOT EXISTS privacy_level TEXT DEFAULT 'public' CHECK (privacy_level IN ('public', 'friends-only', 'private'));

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_user_availability_user_date ON public.user_availability(user_id, date);
CREATE INDEX IF NOT EXISTS idx_user_availability_privacy ON public.user_availability(privacy_level);

-- Add home_away_indicator to match_bookings if not exists
ALTER TABLE public.match_bookings
ADD COLUMN IF NOT EXISTS home_away_indicator TEXT CHECK (home_away_indicator IN ('home', 'away'));

-- Create function to check availability conflicts
CREATE OR REPLACE FUNCTION public.check_availability_conflict(
  p_user_id UUID,
  p_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_exclude_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  has_conflict BOOLEAN;
BEGIN
  -- Check for overlapping availability or bookings
  SELECT EXISTS(
    SELECT 1 FROM public.user_availability
    WHERE user_id = p_user_id
    AND date = p_date
    AND (id != p_exclude_id OR p_exclude_id IS NULL)
    AND (
      (start_time <= p_start_time AND end_time > p_start_time) OR
      (start_time < p_end_time AND end_time >= p_end_time) OR
      (start_time >= p_start_time AND end_time <= p_end_time)
    )
  ) OR EXISTS(
    SELECT 1 FROM public.match_bookings
    WHERE (booker_id = p_user_id OR opponent_id = p_user_id)
    AND date = p_date
    AND status IN ('pending', 'confirmed')
    AND (
      (start_time <= p_start_time AND end_time > p_start_time) OR
      (start_time < p_end_time AND end_time >= p_end_time) OR
      (start_time >= p_start_time AND end_time <= p_end_time)
    )
  ) INTO has_conflict;
  
  RETURN has_conflict;
END;
$$;

-- Create function to get available time slots
CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE(
  date DATE,
  start_time TIME,
  end_time TIME,
  has_conflict BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ua.date,
    ua.start_time,
    ua.end_time,
    public.check_availability_conflict(ua.user_id, ua.date, ua.start_time, ua.end_time, ua.id) as has_conflict
  FROM public.user_availability ua
  WHERE ua.user_id = p_user_id
  AND ua.date BETWEEN p_start_date AND p_end_date
  AND ua.is_available = true
  AND ua.is_blocked = false
  ORDER BY ua.date, ua.start_time;
END;
$$;

-- Update RLS policies for privacy-aware availability viewing
DROP POLICY IF EXISTS "Users can view other players available slots" ON public.user_availability;

CREATE POLICY "Users can view public available slots"
ON public.user_availability
FOR SELECT
USING (
  (is_available = true AND is_blocked = false AND privacy_level = 'public')
  OR auth.uid() = user_id
);

CREATE POLICY "Users can view friends-only available slots"
ON public.user_availability
FOR SELECT
USING (
  (is_available = true AND is_blocked = false AND privacy_level = 'friends-only' 
    AND EXISTS (
      SELECT 1 FROM public.friend_requests
      WHERE status = 'accepted'
      AND ((sender_id = user_id AND receiver_id = auth.uid())
        OR (receiver_id = user_id AND sender_id = auth.uid()))
    )
  )
  OR auth.uid() = user_id
);

-- Add reminder scheduling triggers
CREATE TABLE IF NOT EXISTS public.match_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_booking_id UUID REFERENCES public.match_bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('24h', '1h')),
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_reminders_scheduled ON public.match_reminders(scheduled_for, sent);

-- Enable RLS on match_reminders
ALTER TABLE public.match_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reminders"
ON public.match_reminders
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can manage reminders"
ON public.match_reminders
FOR ALL
USING (true);

-- Create trigger to schedule reminders when match is confirmed
CREATE OR REPLACE FUNCTION public.schedule_match_reminders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  match_datetime TIMESTAMP WITH TIME ZONE;
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    match_datetime := (NEW.date || ' ' || NEW.start_time)::TIMESTAMP WITH TIME ZONE;
    
    -- Schedule 24h reminder for booker
    INSERT INTO public.match_reminders (match_booking_id, user_id, reminder_type, scheduled_for)
    VALUES (NEW.id, NEW.booker_id, '24h', match_datetime - INTERVAL '24 hours');
    
    -- Schedule 24h reminder for opponent
    INSERT INTO public.match_reminders (match_booking_id, user_id, reminder_type, scheduled_for)
    VALUES (NEW.id, NEW.opponent_id, '24h', match_datetime - INTERVAL '24 hours');
    
    -- Schedule 1h reminder for booker
    INSERT INTO public.match_reminders (match_booking_id, user_id, reminder_type, scheduled_for)
    VALUES (NEW.id, NEW.booker_id, '1h', match_datetime - INTERVAL '1 hour');
    
    -- Schedule 1h reminder for opponent
    INSERT INTO public.match_reminders (match_booking_id, user_id, reminder_type, scheduled_for)
    VALUES (NEW.id, NEW.opponent_id, '1h', match_datetime - INTERVAL '1 hour');
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_schedule_match_reminders ON public.match_bookings;
CREATE TRIGGER trigger_schedule_match_reminders
AFTER INSERT OR UPDATE ON public.match_bookings
FOR EACH ROW
EXECUTE FUNCTION public.schedule_match_reminders();