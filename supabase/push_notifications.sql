-- ═══════════════════════════════════════════════════════════════════════════
-- PUSH NOTIFICATIONS SCHEMA
-- ═══════════════════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor to set up push notification infrastructure
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. USER PUSH TOKENS TABLE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  push_token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'ios', -- 'ios' | 'android'
  device_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Each user can have multiple tokens (multiple devices)
  -- But same token shouldn't be registered twice
  UNIQUE(user_id, push_token)
);

-- RLS Policies
ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own tokens
CREATE POLICY "Users can manage own tokens"
ON user_push_tokens FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Index for quick lookup by user
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON user_push_tokens(user_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. DATABASE TRIGGER FOR SHARED WEAVE NOTIFICATIONS
-- ═══════════════════════════════════════════════════════════════════════════

-- Function to send push notification when shared weave participant is added
CREATE OR REPLACE FUNCTION notify_shared_weave_participant()
RETURNS TRIGGER AS $$
DECLARE
  weave_record RECORD;
  creator_profile RECORD;
BEGIN
  -- Only trigger on INSERT (new participant)
  IF TG_OP = 'INSERT' THEN
    -- Get the weave details
    SELECT * INTO weave_record 
    FROM shared_weaves 
    WHERE id = NEW.shared_weave_id;
    
    -- Get creator's profile
    SELECT display_name, username INTO creator_profile
    FROM user_profiles
    WHERE user_id = weave_record.created_by;
    
    -- Don't notify the creator themselves
    IF NEW.user_id != weave_record.created_by THEN
      -- Call Edge Function to send push
      PERFORM
        net.http_post(
          url := current_setting('app.settings.supabase_url') || '/functions/v1/send-push',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
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

-- Create trigger
DROP TRIGGER IF EXISTS on_shared_weave_participant_added ON shared_weave_participants;
CREATE TRIGGER on_shared_weave_participant_added
  AFTER INSERT ON shared_weave_participants
  FOR EACH ROW
  EXECUTE FUNCTION notify_shared_weave_participant();


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. DATABASE TRIGGER FOR LINK REQUEST NOTIFICATIONS
-- ═══════════════════════════════════════════════════════════════════════════

-- Function to send push notification for link requests
CREATE OR REPLACE FUNCTION notify_link_request()
RETURNS TRIGGER AS $$
DECLARE
  requester_profile RECORD;
  acceptor_profile RECORD;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- New link request sent
    SELECT display_name, username INTO requester_profile
    FROM user_profiles
    WHERE user_id = NEW.requester_id;
    
    PERFORM
      net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/send-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := jsonb_build_object(
          'type', 'link_request',
          'recipient_user_id', NEW.addressee_id,
          'title', COALESCE(requester_profile.display_name, requester_profile.username, 'Someone') || ' wants to connect 🔗',
          'body', 'Accept their link request to share weaves together.',
          'data', jsonb_build_object(
            'requester_id', NEW.requester_id,
            'requester_name', COALESCE(requester_profile.display_name, requester_profile.username)
          )
        )
      );
      
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    -- Link request was accepted, notify the original requester
    SELECT display_name, username INTO acceptor_profile
    FROM user_profiles
    WHERE user_id = NEW.addressee_id;
    
    PERFORM
      net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/send-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := jsonb_build_object(
          'type', 'link_accepted',
          'recipient_user_id', NEW.requester_id,
          'title', COALESCE(acceptor_profile.display_name, acceptor_profile.username, 'Someone') || ' accepted your link! 🎉',
          'body', 'You can now share weaves together.',
          'data', jsonb_build_object(
            'acceptor_id', NEW.addressee_id,
            'acceptor_name', COALESCE(acceptor_profile.display_name, acceptor_profile.username)
          )
        )
      );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_link_request_change ON friend_links;
CREATE TRIGGER on_link_request_change
  AFTER INSERT OR UPDATE ON friend_links
  FOR EACH ROW
  EXECUTE FUNCTION notify_link_request();


-- ═══════════════════════════════════════════════════════════════════════════
-- DONE! Push notification infrastructure is ready.
-- 
-- To use:
-- 1. Deploy the send-push Edge Function: supabase functions deploy send-push
-- 2. Set the app settings in Supabase config or use env vars for the triggers
-- ═══════════════════════════════════════════════════════════════════════════
