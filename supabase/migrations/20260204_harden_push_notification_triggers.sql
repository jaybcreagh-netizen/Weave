-- ============================================================================
-- Harden Push Notification Triggers
-- - Adds a safer trigger->edge-function bridge (shared secret, not service role)
-- - Aligns link request push triggers with migration-based setup
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA extensions;

-- Required database settings:
--   app.settings.supabase_url
--   app.settings.push_webhook_secret
-- The secret must match the PUSH_WEBHOOK_SECRET env var on the send-push Edge Function.

CREATE OR REPLACE FUNCTION public.send_push_notification(
  p_type text,
  p_recipient_user_id uuid,
  p_title text,
  p_body text,
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  supabase_url text;
  push_secret text;
BEGIN
  supabase_url := nullif(current_setting('app.settings.supabase_url', true), '');
  push_secret := nullif(current_setting('app.settings.push_webhook_secret', true), '');

  IF supabase_url IS NULL OR push_secret IS NULL THEN
    RAISE WARNING '[push] Missing app.settings.supabase_url or app.settings.push_webhook_secret; skipping push type=% recipient=%',
      p_type,
      p_recipient_user_id;
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', push_secret
    ),
    body := jsonb_build_object(
      'type', p_type,
      'recipient_user_id', p_recipient_user_id,
      'title', p_title,
      'body', p_body,
      'data', coalesce(p_data, '{}'::jsonb)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_shared_weave_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  weave_record RECORD;
  creator_profile RECORD;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO weave_record
  FROM public.shared_weaves
  WHERE id = NEW.shared_weave_id;

  IF weave_record IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id = weave_record.created_by THEN
    RETURN NEW;
  END IF;

  SELECT display_name, username INTO creator_profile
  FROM public.user_profiles
  WHERE id = weave_record.created_by;

  PERFORM public.send_push_notification(
    'shared_weave',
    NEW.user_id,
    coalesce(creator_profile.display_name, creator_profile.username, 'Someone') || ' shared a weave',
    coalesce(weave_record.title, 'Tap to view and accept'),
    jsonb_build_object('shared_weave_id', NEW.shared_weave_id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_shared_weave_participant_added ON public.shared_weave_participants;
CREATE TRIGGER on_shared_weave_participant_added
  AFTER INSERT ON public.shared_weave_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_shared_weave_participant();

CREATE OR REPLACE FUNCTION public.notify_shared_weave_acceptance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  weave_record RECORD;
  accepter_profile RECORD;
BEGIN
  IF TG_OP <> 'UPDATE' OR OLD.response = 'accepted' OR NEW.response <> 'accepted' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO weave_record
  FROM public.shared_weaves
  WHERE id = NEW.shared_weave_id;

  IF weave_record IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT display_name, username INTO accepter_profile
  FROM public.user_profiles
  WHERE id = NEW.user_id;

  PERFORM public.send_push_notification(
    'shared_weave',
    weave_record.created_by,
    coalesce(accepter_profile.display_name, accepter_profile.username, 'A friend') || ' joined your weave',
    'They accepted your invitation to "' || coalesce(weave_record.title, 'your plan') || '"',
    jsonb_build_object(
      'shared_weave_id', NEW.shared_weave_id,
      'action', 'view_shared_weave'
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_shared_weave_participant_accepted ON public.shared_weave_participants;
CREATE TRIGGER on_shared_weave_participant_accepted
  AFTER UPDATE ON public.shared_weave_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_shared_weave_acceptance();

CREATE OR REPLACE FUNCTION public.notify_link_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  requester_profile RECORD;
  acceptor_profile RECORD;
  requester_id uuid;
  addressee_id uuid;
  acceptor_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    requester_id := NEW.initiated_by;
    addressee_id := CASE
      WHEN NEW.initiated_by = NEW.user_a_id THEN NEW.user_b_id
      ELSE NEW.user_a_id
    END;

    SELECT display_name, username INTO requester_profile
    FROM public.user_profiles
    WHERE id = requester_id;

    PERFORM public.send_push_notification(
      'link_request',
      addressee_id,
      coalesce(requester_profile.display_name, requester_profile.username, 'Someone') || ' wants to connect',
      'Accept their link request to share weaves together.',
      jsonb_build_object(
        'requester_id', requester_id,
        'requester_name', coalesce(requester_profile.display_name, requester_profile.username)
      )
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    requester_id := NEW.initiated_by;
    acceptor_id := CASE
      WHEN NEW.initiated_by = NEW.user_a_id THEN NEW.user_b_id
      ELSE NEW.user_a_id
    END;

    SELECT display_name, username INTO acceptor_profile
    FROM public.user_profiles
    WHERE id = acceptor_id;

    PERFORM public.send_push_notification(
      'link_accepted',
      requester_id,
      coalesce(acceptor_profile.display_name, acceptor_profile.username, 'Someone') || ' accepted your link!',
      'You can now share weaves together.',
      jsonb_build_object(
        'acceptor_id', acceptor_id,
        'acceptor_name', coalesce(acceptor_profile.display_name, acceptor_profile.username)
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_link_request_change ON public.friend_links;
CREATE TRIGGER on_link_request_change
  AFTER INSERT OR UPDATE ON public.friend_links
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_link_request();
