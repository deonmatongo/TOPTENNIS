-- Create calendar_events table
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('match', 'lesson', 'tournament', 'practice')),
  event_name TEXT NOT NULL CHECK (LENGTH(event_name) <= 150),
  description TEXT,
  location_name TEXT,
  location_type TEXT CHECK (location_type IN ('physical', 'virtual')),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  virtual_location TEXT,
  
  -- Date and time (stored in UTC)
  start_time_utc TIMESTAMPTZ NOT NULL,
  end_time_utc TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER GENERATED ALWAYS AS (EXTRACT(EPOCH FROM (end_time_utc - start_time_utc))/60) STORED,
  
  -- Settings
  privacy_level TEXT NOT NULL DEFAULT 'public' CHECK (privacy_level IN ('public', 'friends-only', 'private')),
  reminder_offset_minutes INTEGER DEFAULT 30,
  
  -- Recurrence
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_rule JSONB,
  recurrence_parent_id UUID REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'pending_conflict', 'cancelled', 'completed')),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Default configuration based on event type
  color_code TEXT,
  default_duration INTEGER,
  
  -- Constraints
  CONSTRAINT valid_time_range CHECK (end_time_utc > start_time_utc)
);

-- Create event_participants table
CREATE TABLE IF NOT EXISTS public.event_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('participant', 'organizer', 'coach')),
  rsvp_status TEXT NOT NULL DEFAULT 'invited' CHECK (rsvp_status IN ('invited', 'accepted', 'declined', 'tentative')),
  availability_status TEXT DEFAULT 'unknown' CHECK (availability_status IN ('available', 'busy', 'unknown')),
  responded_at TIMESTAMPTZ,
  proposed_time_start TIMESTAMPTZ,
  proposed_time_end TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(event_id, user_id)
);

-- Create event_reminders_queue table
CREATE TABLE IF NOT EXISTS public.event_reminders_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_time TIMESTAMPTZ NOT NULL,
  sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  notification_type TEXT DEFAULT 'push' CHECK (notification_type IN ('push', 'email', 'sms')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(event_id, user_id, reminder_time)
);

-- Create availability_conflicts table
CREATE TABLE IF NOT EXISTS public.availability_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conflict_type TEXT NOT NULL CHECK (conflict_type IN ('existing_event', 'user_availability', 'proposed_time')),
  conflict_details JSONB,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_calendar_events_creator ON public.calendar_events(creator_id);
CREATE INDEX idx_calendar_events_start_time ON public.calendar_events(start_time_utc);
CREATE INDEX idx_calendar_events_type ON public.calendar_events(event_type);
CREATE INDEX idx_calendar_events_status ON public.calendar_events(status);
CREATE INDEX idx_calendar_events_name_search ON public.calendar_events USING gin(to_tsvector('english', event_name));
CREATE INDEX idx_calendar_events_description_search ON public.calendar_events USING gin(to_tsvector('english', COALESCE(description, '')));

CREATE INDEX idx_event_participants_event ON public.event_participants(event_id);
CREATE INDEX idx_event_participants_user ON public.event_participants(user_id);
CREATE INDEX idx_event_participants_rsvp ON public.event_participants(rsvp_status);

CREATE INDEX idx_event_reminders_queue_time ON public.event_reminders_queue(reminder_time) WHERE NOT sent;
CREATE INDEX idx_event_reminders_queue_event ON public.event_reminders_queue(event_id);

CREATE INDEX idx_availability_conflicts_event ON public.availability_conflicts(event_id);
CREATE INDEX idx_availability_conflicts_user ON public.availability_conflicts(user_id) WHERE NOT resolved;

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_calendar_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_events_updated_at();

CREATE TRIGGER trigger_update_event_participants_updated_at
  BEFORE UPDATE ON public.event_participants
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_events_updated_at();

-- Function to check if user has access to view event based on privacy
CREATE OR REPLACE FUNCTION can_view_event(p_event_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_privacy_level TEXT;
  v_creator_id UUID;
  v_is_participant BOOLEAN;
  v_is_friend BOOLEAN;
BEGIN
  -- Get event details
  SELECT privacy_level, creator_id INTO v_privacy_level, v_creator_id
  FROM public.calendar_events
  WHERE id = p_event_id;
  
  -- Creator can always view
  IF v_creator_id = p_user_id THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user is participant
  SELECT EXISTS(
    SELECT 1 FROM public.event_participants
    WHERE event_id = p_event_id AND user_id = p_user_id
  ) INTO v_is_participant;
  
  IF v_is_participant THEN
    RETURN TRUE;
  END IF;
  
  -- Public events are viewable by all
  IF v_privacy_level = 'public' THEN
    RETURN TRUE;
  END IF;
  
  -- Friends-only events
  IF v_privacy_level = 'friends-only' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.friend_requests
      WHERE status = 'accepted'
      AND ((sender_id = v_creator_id AND receiver_id = p_user_id)
        OR (receiver_id = v_creator_id AND sender_id = p_user_id))
    ) INTO v_is_friend;
    
    RETURN v_is_friend;
  END IF;
  
  -- Private events only viewable by creator and participants
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check availability conflicts
CREATE OR REPLACE FUNCTION check_event_conflicts(
  p_user_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_exclude_event_id UUID DEFAULT NULL
)
RETURNS TABLE(
  conflict_type TEXT,
  conflict_event_id UUID,
  conflict_start TIMESTAMPTZ,
  conflict_end TIMESTAMPTZ,
  conflict_title TEXT
) AS $$
BEGIN
  RETURN QUERY
  -- Check calendar events
  SELECT 
    'existing_event'::TEXT,
    ce.id,
    ce.start_time_utc,
    ce.end_time_utc,
    ce.event_name
  FROM public.calendar_events ce
  JOIN public.event_participants ep ON ce.id = ep.event_id
  WHERE ep.user_id = p_user_id
    AND ce.status IN ('scheduled', 'confirmed')
    AND (p_exclude_event_id IS NULL OR ce.id != p_exclude_event_id)
    AND (
      (ce.start_time_utc <= p_start_time AND ce.end_time_utc > p_start_time)
      OR (ce.start_time_utc < p_end_time AND ce.end_time_utc >= p_end_time)
      OR (ce.start_time_utc >= p_start_time AND ce.end_time_utc <= p_end_time)
    )
  
  UNION ALL
  
  -- Check user availability blocks
  SELECT 
    'user_availability'::TEXT,
    ua.id,
    (ua.date + ua.start_time)::TIMESTAMPTZ,
    (ua.date + ua.end_time)::TIMESTAMPTZ,
    'Blocked time'::TEXT
  FROM public.user_availability ua
  WHERE ua.user_id = p_user_id
    AND ua.is_blocked = TRUE
    AND ua.date = p_start_time::DATE
    AND (
      (ua.start_time <= p_start_time::TIME AND ua.end_time > p_start_time::TIME)
      OR (ua.start_time < p_end_time::TIME AND ua.end_time >= p_end_time::TIME)
      OR (ua.start_time >= p_start_time::TIME AND ua.end_time <= p_end_time::TIME)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate reminder jobs when event is created/updated
CREATE OR REPLACE FUNCTION schedule_event_reminders()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete existing reminders for this event if updating
  DELETE FROM public.event_reminders_queue WHERE event_id = NEW.id;
  
  -- Only schedule if reminder is enabled
  IF NEW.reminder_offset_minutes IS NOT NULL AND NEW.reminder_offset_minutes > 0 THEN
    -- Schedule reminder for creator
    INSERT INTO public.event_reminders_queue (event_id, user_id, reminder_time)
    VALUES (
      NEW.id,
      NEW.creator_id,
      NEW.start_time_utc - (NEW.reminder_offset_minutes || ' minutes')::INTERVAL
    )
    ON CONFLICT (event_id, user_id, reminder_time) DO NOTHING;
    
    -- Schedule reminders for all participants
    INSERT INTO public.event_reminders_queue (event_id, user_id, reminder_time)
    SELECT 
      NEW.id,
      ep.user_id,
      NEW.start_time_utc - (NEW.reminder_offset_minutes || ' minutes')::INTERVAL
    FROM public.event_participants ep
    WHERE ep.event_id = NEW.id
      AND ep.rsvp_status IN ('accepted', 'tentative')
    ON CONFLICT (event_id, user_id, reminder_time) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_schedule_event_reminders
  AFTER INSERT OR UPDATE ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION schedule_event_reminders();

-- Function to notify participants when added to event
CREATE OR REPLACE FUNCTION notify_event_participant()
RETURNS TRIGGER AS $$
DECLARE
  v_event_name TEXT;
  v_creator_name TEXT;
  v_start_time TIMESTAMPTZ;
BEGIN
  -- Get event details
  SELECT event_name, start_time_utc INTO v_event_name, v_start_time
  FROM public.calendar_events
  WHERE id = NEW.event_id;
  
  -- Get creator name
  SELECT CONCAT(first_name, ' ', last_name) INTO v_creator_name
  FROM public.profiles
  WHERE id = (SELECT creator_id FROM public.calendar_events WHERE id = NEW.event_id);
  
  -- Notify participant of new invitation
  IF NEW.rsvp_status = 'invited' AND (OLD IS NULL OR OLD.rsvp_status != 'invited') THEN
    PERFORM public.create_notification(
      NEW.user_id,
      'event_invitation',
      'Event Invitation',
      CONCAT(COALESCE(v_creator_name, 'Someone'), ' invited you to "', v_event_name, '" on ', TO_CHAR(v_start_time, 'Mon DD at HH24:MI')),
      '/dashboard?tab=schedule',
      jsonb_build_object('event_id', NEW.event_id, 'creator_id', (SELECT creator_id FROM public.calendar_events WHERE id = NEW.event_id))
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_event_participant
  AFTER INSERT OR UPDATE ON public.event_participants
  FOR EACH ROW
  EXECUTE FUNCTION notify_event_participant();

-- Enable Row Level Security
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_reminders_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_conflicts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for calendar_events
CREATE POLICY "Users can create their own events"
  ON public.calendar_events FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Users can view events they have access to"
  ON public.calendar_events FOR SELECT
  USING (can_view_event(id, auth.uid()));

CREATE POLICY "Creators can update their own events"
  ON public.calendar_events FOR UPDATE
  USING (auth.uid() = creator_id);

CREATE POLICY "Creators can delete their own events"
  ON public.calendar_events FOR DELETE
  USING (auth.uid() = creator_id);

-- RLS Policies for event_participants
CREATE POLICY "Event creators can manage participants"
  ON public.event_participants FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.calendar_events
      WHERE id = event_participants.event_id
      AND creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can view participants of events they can see"
  ON public.event_participants FOR SELECT
  USING (
    can_view_event(event_id, auth.uid())
  );

CREATE POLICY "Users can update their own participant record"
  ON public.event_participants FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for event_reminders_queue
CREATE POLICY "Users can view their own reminders"
  ON public.event_reminders_queue FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage reminders"
  ON public.event_reminders_queue FOR ALL
  USING (true);

-- RLS Policies for availability_conflicts
CREATE POLICY "Users can view their own conflicts"
  ON public.availability_conflicts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Event creators can view event conflicts"
  ON public.availability_conflicts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.calendar_events
      WHERE id = availability_conflicts.event_id
      AND creator_id = auth.uid()
    )
  );

CREATE POLICY "System can manage conflicts"
  ON public.availability_conflicts FOR ALL
  USING (true);