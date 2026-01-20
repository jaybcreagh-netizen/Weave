-- ============================================================================
-- REALTIME SIGNALS TABLE
--
-- Purpose: Replace expensive unfiltered Realtime subscriptions with targeted
-- signal delivery. Instead of clients asking "Is this update for me?" via RLS,
-- the database says "Here is an update for User X" via triggers.
--
-- This eliminates the O(n) RLS check storm that occurs when unfiltered
-- subscriptions exist on tables with complex RLS policies.
-- ============================================================================

-- 1. Create the signals table
CREATE TABLE IF NOT EXISTS public.realtime_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    signal_type TEXT NOT NULL,  -- 'weave_update', 'participant_response', etc.
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast filtering by user_id (the subscription filter)
CREATE INDEX IF NOT EXISTS idx_realtime_signals_user_id
    ON public.realtime_signals(user_id);

-- Index for cleanup queries (delete old signals)
CREATE INDEX IF NOT EXISTS idx_realtime_signals_created_at
    ON public.realtime_signals(created_at);

-- 2. Enable RLS with simple user_id check (O(1) - no joins!)
ALTER TABLE public.realtime_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own signals"
    ON public.realtime_signals
    FOR SELECT
    USING (user_id = auth.uid());

-- Users should not insert directly - only triggers do
CREATE POLICY "No direct inserts"
    ON public.realtime_signals
    FOR INSERT
    WITH CHECK (false);

-- Users can delete their own signals (for cleanup)
CREATE POLICY "Users can delete own signals"
    ON public.realtime_signals
    FOR DELETE
    USING (user_id = auth.uid());

-- 3. Enable Realtime on this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.realtime_signals;

-- ============================================================================
-- TRIGGER: shared_weaves UPDATE -> signal to all participants
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_weave_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert a signal for each participant of this weave
    INSERT INTO public.realtime_signals (user_id, signal_type, payload)
    SELECT
        swp.user_id,
        'weave_update',
        jsonb_build_object(
            'id', NEW.id,
            'title', NEW.title,
            'weave_date', NEW.weave_date,
            'location', NEW.location,
            'category', NEW.category,
            'duration', NEW.duration,
            'note', NEW.note,
            'last_edited_by', NEW.last_edited_by,
            'updated_at', NEW.server_updated_at
        )
    FROM public.shared_weave_participants swp
    WHERE swp.shared_weave_id = NEW.id
      AND swp.user_id != NEW.last_edited_by;  -- Don't notify the editor

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS on_shared_weave_update ON public.shared_weaves;

-- Create the trigger
CREATE TRIGGER on_shared_weave_update
    AFTER UPDATE ON public.shared_weaves
    FOR EACH ROW
    EXECUTE FUNCTION notify_weave_update();

-- ============================================================================
-- TRIGGER: shared_weave_participants UPDATE -> signal to weave creator
-- (When someone responds to a weave)
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_participant_response()
RETURNS TRIGGER AS $$
DECLARE
    creator_id UUID;
BEGIN
    -- Only trigger when response changes (not on other updates)
    IF OLD.response IS DISTINCT FROM NEW.response THEN
        -- Get the creator of the weave
        SELECT sw.creator_id INTO creator_id
        FROM public.shared_weaves sw
        WHERE sw.id = NEW.shared_weave_id;

        -- Don't notify if user is responding to their own weave
        IF creator_id IS NOT NULL AND creator_id != NEW.user_id THEN
            INSERT INTO public.realtime_signals (user_id, signal_type, payload)
            VALUES (
                creator_id,
                'participant_response',
                jsonb_build_object(
                    'id', NEW.id,
                    'shared_weave_id', NEW.shared_weave_id,
                    'user_id', NEW.user_id,
                    'response', NEW.response,
                    'responded_at', NEW.server_updated_at
                )
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS on_participant_response ON public.shared_weave_participants;

-- Create the trigger
CREATE TRIGGER on_participant_response
    AFTER UPDATE ON public.shared_weave_participants
    FOR EACH ROW
    EXECUTE FUNCTION notify_participant_response();

-- ============================================================================
-- CLEANUP FUNCTION: Delete signals older than 1 hour
-- (Signals are ephemeral - once delivered, they're not needed)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_signals()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.realtime_signals
    WHERE created_at < NOW() - INTERVAL '1 hour';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- NOTES FOR IMPLEMENTATION
-- ============================================================================
--
-- Client-side changes needed:
--
-- 1. Subscribe to realtime_signals with filter:
--    filter: `user_id=eq.${user.id}`
--
-- 2. Handle signal types:
--    - 'weave_update' -> call weaveUpdateHandlerSet
--    - 'participant_response' -> call participantResponseHandlerSet
--
-- 3. Delete signal after processing (optional, cleanup handles it)
--
-- 4. Schedule cleanup_old_signals() via pg_cron or edge function:
--    SELECT cron.schedule('cleanup-signals', '*/15 * * * *', 'SELECT cleanup_old_signals()');
--
