-- Update push trigger: hardcode project URL, use anon key for auth,
-- and forward type + metadata so the client can deep-link on tap.
CREATE OR REPLACE FUNCTION public.notify_push_on_notification_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://qrhladnnblgbobcnxjsz.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyaGxhZG5uYmxnYm9iY254anN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDcxNzEsImV4cCI6MjA2NzAyMzE3MX0.XtnqHLXk6WguDHQLetYYEkhS1hNj52NPnuxOHHdhVKY'
               ),
    body    := jsonb_build_object(
                 'userId',    NEW.user_id,
                 'title',     NEW.title,
                 'body',      NEW.message,
                 'type',      COALESCE(NEW.type, 'general'),
                 'metadata',  COALESCE(NEW.metadata, '{}'::jsonb)
               )
  );
  RETURN NEW;
END;
$$;
