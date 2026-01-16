-- Create notification settings table
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  
  -- Notification type preferences
  enable_match_invites BOOLEAN DEFAULT true,
  enable_match_accepted BOOLEAN DEFAULT true,
  enable_match_declined BOOLEAN DEFAULT true,
  enable_match_cancelled BOOLEAN DEFAULT true,
  enable_match_rescheduled BOOLEAN DEFAULT true,
  enable_friend_requests BOOLEAN DEFAULT true,
  enable_league_updates BOOLEAN DEFAULT true,
  
  -- Channel preferences
  browser_notifications BOOLEAN DEFAULT true,
  email_notifications BOOLEAN DEFAULT false,
  
  -- Focus-aware setting
  respect_tab_focus BOOLEAN DEFAULT false,
  
  -- Quiet hours
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME DEFAULT '22:00:00',
  quiet_hours_end TIME DEFAULT '08:00:00',
  
  -- Notification sound
  notification_sound TEXT DEFAULT 'default',
  
  -- Grouping preferences
  group_similar_notifications BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own notification settings"
  ON public.notification_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notification settings"
  ON public.notification_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification settings"
  ON public.notification_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();