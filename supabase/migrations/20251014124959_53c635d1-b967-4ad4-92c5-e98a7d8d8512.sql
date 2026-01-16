-- Update match_bookings table to use 'pending' as default status
-- and update the notification trigger

-- First, alter the default status to 'pending'
ALTER TABLE match_bookings 
  ALTER COLUMN status SET DEFAULT 'pending';

-- Drop the trigger and function with CASCADE
DROP FUNCTION IF EXISTS notify_booking_created() CASCADE;

-- Recreate the notification function with updated logic
CREATE OR REPLACE FUNCTION public.notify_booking_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  
  -- Handle new pending booking
  IF NEW.status = 'pending' AND (OLD IS NULL OR OLD.status != 'pending') THEN
    -- Notify opponent about pending booking request
    PERFORM public.create_notification(
      NEW.opponent_id,
      'match_invite',
      'Match Booking Request',
      CONCAT(COALESCE(booker_name, 'Someone'), ' wants to book a match with you on ', NEW.date::TEXT, ' at ', NEW.start_time::TEXT),
      '/dashboard?tab=schedule',
      jsonb_build_object('booking_id', NEW.id, 'booker_id', NEW.booker_id, 'status', 'pending')
    );
  -- Handle accepted booking
  ELSIF NEW.status = 'confirmed' AND OLD.status = 'pending' THEN
    -- Notify booker about acceptance
    PERFORM public.create_notification(
      NEW.booker_id,
      'match_confirmed',
      'Match Booking Accepted',
      CONCAT(COALESCE(opponent_name, 'Someone'), ' accepted your match booking for ', NEW.date::TEXT, ' at ', NEW.start_time::TEXT),
      '/dashboard?tab=schedule',
      jsonb_build_object('booking_id', NEW.id, 'opponent_id', NEW.opponent_id)
    );
  -- Handle declined booking  
  ELSIF NEW.status = 'declined' AND OLD.status = 'pending' THEN
    -- Notify booker about declination
    PERFORM public.create_notification(
      NEW.booker_id,
      'match_cancelled',
      'Match Booking Declined',
      CONCAT(COALESCE(opponent_name, 'Someone'), ' declined your match booking for ', NEW.date::TEXT, ' at ', NEW.start_time::TEXT),
      '/dashboard?tab=schedule',
      jsonb_build_object('booking_id', NEW.id)
    );
  -- Handle cancellation of confirmed booking
  ELSIF NEW.status = 'cancelled' AND OLD.status = 'confirmed' THEN
    -- Notify other party about cancellation
    PERFORM public.create_notification(
      CASE WHEN auth.uid() = NEW.booker_id THEN NEW.opponent_id ELSE NEW.booker_id END,
      'match_cancelled',
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
CREATE TRIGGER notify_booking_created
  AFTER INSERT OR UPDATE ON match_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_booking_created();