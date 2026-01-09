-- ============================================================================
-- CONSOLIDATE PUSH NOTIFICATIONS
-- Enables pg_net and sets up server-side triggers for shared weaves
-- ============================================================================

-- 1. Enable pg_net extension for HTTP requests (Edge Function calls)
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA extensions;

-- 2. Function to send push notification when shared weave participant is added
CREATE OR REPLACE FUNCTION public.notify_shared_weave_participant()
RETURNS TRIGGER AS $$
DECLARE
  weave_record RECORD;
  creator_profile RECORD;
BEGIN
  -- Only trigger on INSERT (new participant)
  IF TG_OP = 'INSERT' THEN
    -- Get the weave details
    SELECT * INTO weave_record 
    FROM public.shared_weaves 
    WHERE id = NEW.shared_weave_id;
    
    -- Get creator's profile
    SELECT display_name, username INTO creator_profile
    FROM public.user_profiles
    WHERE id = weave_record.created_by;
    
    -- Don't notify the creator themselves (if they add themselves for some reason)
    IF NEW.user_id != weave_record.created_by THEN
      -- Call Edge Function to send push using pg_net
      -- Note: app.settings.supabase_url and app.settings.service_role_key must be set in postgresql.conf or via ALTER SYSTEM
      -- Alternatively, we defaults for now assuming standard Edge Function path
      
      PERFORM
        net.http_post(
          url := coalesce(current_setting('app.settings.supabase_url', true), 'https://YOUR_PROJECT_REF.supabase.co') || '/functions/v1/send-push',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.service_role_key', true), 'SERVICE_ROLE_KEY_PLACEHOLDER')
          ),
          body := jsonb_build_object(
            'type', 'shared_weave',
            'recipient_user_id', NEW.user_id,
            'title', COALESCE(creator_profile.display_name, creator_profile.username, 'Someone') || ' shared a weave',
            'body', COALESCE(weave_record.title, 'Tap to view and accept'),
            'data', jsonb_build_object(
              'shared_weave_id', NEW.shared_weave_id
            )
          )
        );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create trigger for Shared Weaves
DROP TRIGGER IF EXISTS on_shared_weave_participant_added ON public.shared_weave_participants;
CREATE TRIGGER on_shared_weave_participant_added
  AFTER INSERT ON public.shared_weave_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_shared_weave_participant();

-- 4. Function to send push notification when participant ACCEPTS
CREATE OR REPLACE FUNCTION public.notify_shared_weave_acceptance()
RETURNS TRIGGER AS $$
DECLARE
  weave_record RECORD;
  accepter_profile RECORD;
BEGIN
  -- Only trigger on UPDATE when response changes to 'accepted'
  IF TG_OP = 'UPDATE' AND OLD.response != 'accepted' AND NEW.response = 'accepted' THEN
    -- Get the weave details
    SELECT * INTO weave_record 
    FROM public.shared_weaves 
    WHERE id = NEW.shared_weave_id;
    
    -- Get accepter's profile
    SELECT display_name, username INTO accepter_profile
    FROM public.user_profiles
    WHERE id = NEW.user_id;

    -- Notify the creator
    PERFORM
      net.http_post(
        url := coalesce(current_setting('app.settings.supabase_url', true), 'https://YOUR_PROJECT_REF.supabase.co') || '/functions/v1/send-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || coalesce(current_setting('app.settings.service_role_key', true), 'SERVICE_ROLE_KEY_PLACEHOLDER')
        ),
        body := jsonb_build_object(
          'type', 'shared_weave',
          'recipient_user_id', weave_record.created_by,
          'title', COALESCE(accepter_profile.display_name, accepter_profile.username, 'A friend') || ' joined your weave',
          'body', 'They accepted your invitation to "' || COALESCE(weave_record.title, 'your plan') || '"',
          'data', jsonb_build_object(
            'shared_weave_id', NEW.shared_weave_id,
            'action', 'view_shared_weave'
          )
        )
      );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create trigger for Acceptance
DROP TRIGGER IF EXISTS on_shared_weave_participant_accepted ON public.shared_weave_participants;
CREATE TRIGGER on_shared_weave_participant_accepted
  AFTER UPDATE ON public.shared_weave_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_shared_weave_acceptance();
