-- ============================================================================
-- PERFORMANCE & LINT FIXES
-- Addresses issues from Supabase Performance Security Lints log
-- 1. Drops duplicate indexes
-- 2. Consolidates redundant policies
-- 3. Optimizes auth.uid() calls to avoid per-row re-evaluation
-- ============================================================================

BEGIN;

-- 1. DROP DUPLICATE INDEXES
-- ============================================================================
-- public.shared_weave_participants has identical indexes idx_participants_user and idx_shared_weave_participants_user
DROP INDEX IF EXISTS public.idx_participants_user;


-- 2. CONSOLIDATE DELETED_RECORDS POLICIES
-- ============================================================================
-- Combine multiple permissive policies into clearer, optimized ones
DROP POLICY IF EXISTS "Users can view own deleted records" ON public.deleted_records;
DROP POLICY IF EXISTS "Service role can insert deleted records" ON public.deleted_records;
DROP POLICY IF EXISTS "Users can insert own deleted records" ON public.deleted_records;

-- Optimized view policy
CREATE POLICY "Users can view own deleted records"
    ON public.deleted_records
    FOR SELECT
    USING ((select auth.uid()) = user_id);

-- Consolidated insert policy (Service Role + User specific)
CREATE POLICY "Users and service role can manage deleted records"
    ON public.deleted_records
    FOR INSERT
    WITH CHECK (
        (select auth.uid()) = user_id OR 
        (select auth.role()) = 'service_role'
    );


-- 3. REMOVE REDUNDANT SPECIFIC POLICIES
-- ============================================================================
-- These tables have both specific policies (e.g. "Users can view own friends") AND
-- a catch-all "Users can manage their own data" policy. We keep the catch-all.

DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'friends', 'interactions', 'interaction_friends', 
        'intentions', 'intention_friends', 'life_events', 
        'weekly_reflections', 'journal_entries', 'user_progress',
        'reserved_usernames' -- Also flagged in logs
    ];
    policies text[] := ARRAY[
        'Users can insert own %I',
        'Users can update own %I',
        'Users can delete own %I',
        'Users can view own %I',
        'Users can manage %I' -- for reserved_usernames generic case
    ];
    p text;
BEGIN
    FOREACH t IN ARRAY tables
    LOOP
        FOREACH p IN ARRAY policies
        LOOP
            BEGIN
                EXECUTE format('DROP POLICY IF EXISTS "' || p || '" ON public.%I', t, t);
            EXCEPTION WHEN OTHERS THEN
                -- Ignore errors if policy name format doesn't match exactly
                NULL;
            END;
        END LOOP;
    END LOOP;
END $$;

-- Specifically drop potentially unpredictable names from logs if the above loop missed them
DROP POLICY IF EXISTS "Users can manage own reservations" ON public.reserved_usernames;
DROP POLICY IF EXISTS "Anyone can check reserved usernames" ON public.reserved_usernames; 
-- Re-create "Anyone can check reserved usernames" properly optimized if needed, 
-- but if it's public read, it should be simple. 
-- Assuming "Anyone can check..." is needed for availability checks.
CREATE POLICY "Anyone can check reserved usernames" 
    ON public.reserved_usernames FOR SELECT 
    USING (true);


-- 4. OPTIMIZE BLANKET POLICIES (Users can manage their own data)
-- ============================================================================
-- Re-create the catch-all policies with (select auth.uid()) optimization

DO $$
DECLARE
    t text;
    -- Same list as comprehensive_schema.sql
    tables text[] := ARRAY[
        'user_profile', 'user_progress', 'friends', 'interactions', 'interaction_friends',
        'intentions', 'intention_friends', 'life_events', 'weekly_reflections', 'journal_entries',
        'journal_entry_friends', 'suggestion_events', 'proactive_insights', 'conversation_threads',
        'interaction_outcomes', 'portfolio_snapshots', 'social_season_logs', 'social_battery_logs',
        'network_health_logs', 'oracle_insights', 'oracle_usage', 'oracle_consultations',
        'oracle_conversations', 'oracle_context_cache', 'journal_signals', 'llm_quality_log',
        'user_facts', 'groups', 'group_members', 'friend_badges', 'achievement_unlocks',
        'practice_log', 'shared_weave_refs', 'sync_queue', 'pending_push_notifications',
        'evening_digests', 'custom_chips', 'chip_usage', 'event_suggestion_feedback'
    ];
BEGIN
    FOREACH t IN ARRAY tables
    LOOP
        -- Drop existing to ensure we update the definition
        EXECUTE format('DROP POLICY IF EXISTS "Users can manage their own data" ON public.%I', t);
        
        -- Create optimized policy
        EXECUTE format('
            CREATE POLICY "Users can manage their own data" ON public.%I
            FOR ALL
            TO authenticated
            USING (user_id = (select auth.uid()))
            WITH CHECK (user_id = (select auth.uid()))
        ', t);
    END LOOP;
END $$;


-- 5. OPTIMIZE SHARED WEAVES ECOSYSTEM
-- ============================================================================

-- Shared Weaves
DROP POLICY IF EXISTS "Creator can manage shared weaves" ON public.shared_weaves;
CREATE POLICY "Creator can manage shared weaves"
    ON public.shared_weaves
    FOR ALL
    TO authenticated
    USING (created_by = (select auth.uid()))
    WITH CHECK (created_by = (select auth.uid()));

-- Shared Weave Participants
DROP POLICY IF EXISTS "Users can view own participation" ON public.shared_weave_participants;
CREATE POLICY "Users can view own participation"
    ON public.shared_weave_participants
    FOR SELECT
    TO authenticated
    USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own response" ON public.shared_weave_participants;
CREATE POLICY "Users can update own response"
    ON public.shared_weave_participants
    FOR UPDATE
    TO authenticated
    USING (user_id = (select auth.uid()))
    WITH CHECK (user_id = (select auth.uid()));

-- Friend Links
DROP POLICY IF EXISTS "Users can view own links" ON public.friend_links;
CREATE POLICY "Users can view own links"
    ON public.friend_links
    FOR SELECT
    TO authenticated
    USING ((select auth.uid()) IN (user_a_id, user_b_id));

DROP POLICY IF EXISTS "Users can create links" ON public.friend_links;
CREATE POLICY "Users can create links"
    ON public.friend_links
    FOR INSERT
    TO authenticated
    WITH CHECK (initiated_by = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update links" ON public.friend_links;
CREATE POLICY "Users can update links"
    ON public.friend_links
    FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) IN (user_a_id, user_b_id));


-- 6. USER SUBSCRIPTIONS (Flagged in logs)
-- ============================================================================
-- Ensure user_subscriptions policies are optimized

DROP POLICY IF EXISTS "Users can view own subscription" ON public.user_subscriptions;
CREATE POLICY "Users can view own subscription"
    ON public.user_subscriptions
    FOR SELECT
    USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role can manage subscriptions" ON public.user_subscriptions;
CREATE POLICY "Service role can manage subscriptions"
    ON public.user_subscriptions
    FOR ALL
    USING ((select auth.role()) = 'service_role');


COMMIT;
