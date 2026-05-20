-- Update push trigger to forward notification type and metadata to the
-- Edge Function so the mobile client can deep-link on notification tap.
CREATE OR REPLACE FUNCTION public.notify_push_on_notification_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_project_ref TEXT := current_setting('app.supabase_project_ref', true);
  v_service_key TEXT := current_setting('app.supabase_service_role_key', true);
BEGIN
  IF v_project_ref IS NULL OR v_project_ref = '' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := 'https://' || v_project_ref || '.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_service_key
               ),
    body    := jsonb_build_object(
                 'userId',    NEW.user_id,
                 'title',     NEW.title,
                 'body',      NEW.message,
                 'type',      COALESCE(NEW.type, 'general'),
                 'metadata',  COALESCE(NEW.metadata, '{}'::jsonb),
                 'tag',       NEW.id::text,
                 'actionUrl', COALESCE(NEW.action_url, '/dashboard')
               )
  );

  RETURN NEW;
END;
$$;
