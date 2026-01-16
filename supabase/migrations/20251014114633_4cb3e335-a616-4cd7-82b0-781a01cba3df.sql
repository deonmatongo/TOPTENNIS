-- Fix search_path for notify_booking_created function
-- Drop and recreate with proper CASCADE
DROP TRIGGER IF EXISTS notify_booking_changes ON public.match_bookings;
DROP FUNCTION IF EXISTS public.notify_booking_created() CASCADE;

CREATE OR REPLACE FUNCTION public.notify_booking_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Recreate the trigger
CREATE TRIGGER notify_booking_changes
AFTER INSERT OR UPDATE ON public.match_bookings
FOR EACH ROW
EXECUTE FUNCTION public.notify_booking_created();