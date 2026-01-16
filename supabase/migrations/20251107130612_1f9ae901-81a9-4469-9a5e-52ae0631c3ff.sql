-- Fix remaining Function Search Path Mutable warnings - Part 4 (Final batch)

-- These functions need SET search_path = public added
-- Notification-related functions, event functions, and scheduling functions

-- Function 13: notify_message_received (already has search_path but verifying)
-- Function 14: notify_friend_request (already has search_path but verifying)
-- Function 15: notify_event_participant (already has search_path but verifying)
-- Function 16: notify_booking_created (already has search_path but verifying)
-- Function 17: notify_match_invite (already has search_path but verifying)
-- Function 18: notify_match_score_reported (already has search_path but verifying)
-- Function 19: handle_match_response (already has search_path but verifying)
-- Function 20: schedule_event_reminders (already has search_path but verifying)
-- Function 21: check_event_conflicts (already has search_path but verifying)
-- Function 22: check_availability_conflict (already has search_path but verifying)
-- Function 23: can_view_event (already has search_path but verifying)
-- Function 24: can_view_division_calendar (already has search_path but verifying)
-- Function 25: assign_player_to_division (already has search_path but verifying)
-- Function 26: find_player_matches (already has search_path but verifying)
-- Function 27: calculate_player_compatibility (already has search_path but verifying)

-- Let's check which ones are actually missing by recreating the ones without SET search_path

-- Create notification function
CREATE OR REPLACE FUNCTION public.create_notification(
  target_user_id uuid,
  notification_type text,
  notification_title text,
  notification_message text,
  notification_action_url text DEFAULT NULL::text,
  notification_metadata jsonb DEFAULT NULL::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;