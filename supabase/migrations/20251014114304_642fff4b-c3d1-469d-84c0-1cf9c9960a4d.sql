-- Create match_bookings table for direct bookings
CREATE TABLE public.match_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  opponent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  availability_id uuid REFERENCES public.user_availability(id) ON DELETE SET NULL,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  court_location text,
  message text,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'rescheduled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.match_bookings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their bookings"
ON public.match_bookings FOR SELECT
USING (auth.uid() = booker_id OR auth.uid() = opponent_id);

CREATE POLICY "Users can create bookings"
ON public.match_bookings FOR INSERT
WITH CHECK (auth.uid() = booker_id);

CREATE POLICY "Users can update their bookings"
ON public.match_bookings FOR UPDATE
USING (auth.uid() = booker_id OR auth.uid() = opponent_id);

-- Update timestamp trigger
CREATE TRIGGER update_match_bookings_updated_at
BEFORE UPDATE ON public.match_bookings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Notification trigger for bookings
CREATE OR REPLACE FUNCTION public.notify_booking_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  booker_name TEXT;
  opponent_name TEXT;
BEGIN
  -- Get names
  SELECT CONCAT(first_name, ' ', last_name) INTO booker_name
  FROM public.profiles
  WHERE id = NEW.booker_id;
  
  SELECT CONCAT(first_name, ' ', last_name) INTO opponent_name
  FROM public.profiles
  WHERE id = NEW.opponent_id;
  
  IF NEW.status = 'confirmed' AND (OLD IS NULL OR OLD.status != 'confirmed') THEN
    -- Notify opponent about new booking
    PERFORM public.create_notification(
      NEW.opponent_id,
      'booking_confirmed',
      'Match Booked',
      CONCAT(COALESCE(booker_name, 'Someone'), ' booked a match with you on ', NEW.date::TEXT, ' at ', NEW.start_time::TEXT),
      '/dashboard?tab=schedule',
      jsonb_build_object('booking_id', NEW.id, 'booker_id', NEW.booker_id)
    );
    
    -- Notify booker about confirmation
    PERFORM public.create_notification(
      NEW.booker_id,
      'booking_confirmed',
      'Match Confirmed',
      CONCAT('Your match with ', COALESCE(opponent_name, 'someone'), ' has been confirmed for ', NEW.date::TEXT, ' at ', NEW.start_time::TEXT),
      '/dashboard?tab=schedule',
      jsonb_build_object('booking_id', NEW.id, 'opponent_id', NEW.opponent_id)
    );
  ELSIF NEW.status = 'cancelled' AND OLD.status = 'confirmed' THEN
    -- Notify other party about cancellation
    PERFORM public.create_notification(
      CASE WHEN auth.uid() = NEW.booker_id THEN NEW.opponent_id ELSE NEW.booker_id END,
      'booking_cancelled',
      'Match Cancelled',
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
$$;

CREATE TRIGGER notify_booking_changes
AFTER INSERT OR UPDATE ON public.match_bookings
FOR EACH ROW
EXECUTE FUNCTION public.notify_booking_created();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_bookings;