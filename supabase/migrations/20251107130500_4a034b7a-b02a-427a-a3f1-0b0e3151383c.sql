-- Fix remaining Function Search Path Mutable warnings - Part 3

-- Function 10: generate_match_suggestions
CREATE OR REPLACE FUNCTION public.generate_match_suggestions(target_player_id uuid, competitiveness_filter text DEFAULT NULL::text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  match_record RECORD;
  inserted_count INTEGER := 0;
BEGIN
  DELETE FROM public.match_suggestions WHERE player_id = target_player_id;
  FOR match_record IN 
    SELECT * FROM public.find_player_matches(target_player_id, 50, 10, competitiveness_filter)
  LOOP
    INSERT INTO public.match_suggestions (
      player_id,
      suggested_player_id,
      compatibility_score,
      match_reasons
    ) VALUES (
      target_player_id,
      match_record.suggested_player_id,
      match_record.compatibility_score,
      match_record.match_reasons
    )
    ON CONFLICT (player_id, suggested_player_id) DO UPDATE SET
      compatibility_score = EXCLUDED.compatibility_score,
      match_reasons = EXCLUDED.match_reasons,
      created_at = NOW();
    inserted_count := inserted_count + 1;
  END LOOP;
  RETURN inserted_count;
END;
$function$;

-- Function 11: get_available_slots
CREATE OR REPLACE FUNCTION public.get_available_slots(p_user_id uuid, p_start_date date, p_end_date date)
RETURNS TABLE(date date, start_time time without time zone, end_time time without time zone, has_conflict boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

-- Function 12: schedule_match_reminders
CREATE OR REPLACE FUNCTION public.schedule_match_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  match_datetime TIMESTAMP WITH TIME ZONE;
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    match_datetime := (NEW.date || ' ' || NEW.start_time)::TIMESTAMP WITH TIME ZONE;
    
    INSERT INTO public.match_reminders (match_booking_id, user_id, reminder_type, scheduled_for)
    VALUES (NEW.id, NEW.booker_id, '24h', match_datetime - INTERVAL '24 hours');
    
    INSERT INTO public.match_reminders (match_booking_id, user_id, reminder_type, scheduled_for)
    VALUES (NEW.id, NEW.opponent_id, '24h', match_datetime - INTERVAL '24 hours');
    
    INSERT INTO public.match_reminders (match_booking_id, user_id, reminder_type, scheduled_for)
    VALUES (NEW.id, NEW.booker_id, '1h', match_datetime - INTERVAL '1 hour');
    
    INSERT INTO public.match_reminders (match_booking_id, user_id, reminder_type, scheduled_for)
    VALUES (NEW.id, NEW.opponent_id, '1h', match_datetime - INTERVAL '1 hour');
  END IF;
  RETURN NEW;
END;
$function$;