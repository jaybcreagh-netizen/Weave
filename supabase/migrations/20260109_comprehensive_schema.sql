-- ============================================================================
-- COMPREHENSIVE SUPABASE SCHEMA MIGRATION
-- Creates all tables required for WatermelonDB sync to function correctly
-- ============================================================================
-- Run this script in your Supabase SQL Editor
-- Tables are created WITH proper column types (TEXT for IDs, timestamptz for dates)
-- ============================================================================

-- ============================================================================
-- CORE TABLES (User Data)
-- ============================================================================

-- 1. user_profile
CREATE TABLE IF NOT EXISTS public.user_profile (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    current_social_season text,
    season_last_calculated timestamptz,
    season_override_until timestamptz,
    season_override_reason text,
    social_battery_current double precision,
    social_battery_last_checkin timestamptz,
    battery_checkin_enabled boolean,
    battery_checkin_time text,
    reflection_day integer,
    reflection_auto_show boolean,
    reflection_last_snoozed timestamptz,
    tier_flexibility_mode text,
    tier_intelligence_enabled boolean,
    default_messaging_app text,
    ai_features_enabled boolean,
    ai_journal_analysis_enabled boolean,
    ai_oracle_enabled boolean,
    ai_disclosure_acknowledged_at timestamptz,
    phone text,
    email text,
    google_id text,
    proactive_insights_enabled boolean,
    suppressed_insight_rules text,
    milestones_enabled boolean,
    oracle_tone_preference text,
    insight_frequency text,
    social_battery_history text,
    synced_at timestamptz,
    sync_status text,
    server_updated_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. user_progress
CREATE TABLE IF NOT EXISTS public.user_progress (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    current_streak integer DEFAULT 0,
    best_streak integer DEFAULT 0,
    last_practice_date timestamptz,
    consistency_milestones text,
    last_streak_count integer DEFAULT 0,
    streak_released_date timestamptz,
    longest_streak_ever integer DEFAULT 0,
    total_reflections integer DEFAULT 0,
    reflection_milestones text,
    friendship_milestones text,
    catalyst_progress integer DEFAULT 0,
    high_priestess_progress integer DEFAULT 0,
    scribe_progress integer DEFAULT 0,
    curator_progress integer DEFAULT 0,
    total_weaves integer DEFAULT 0,
    global_achievements text,
    hidden_achievements text,
    synced_at timestamptz,
    sync_status text,
    server_updated_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3. friends (alter if exists, create if not)
CREATE TABLE IF NOT EXISTS public.friends (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    name text NOT NULL,
    dunbar_tier text,
    archetype text,
    weave_score double precision DEFAULT 0,
    last_updated timestamptz,
    photo_url text,
    notes text,
    resilience double precision DEFAULT 0,
    rated_weaves_count integer DEFAULT 0,
    momentum_score double precision DEFAULT 0,
    momentum_last_updated timestamptz,
    is_dormant boolean DEFAULT false,
    dormant_since timestamptz,
    last_interaction_date timestamptz,
    birthday text,
    anniversary text,
    relationship_type text,
    typical_interval_days double precision,
    tolerance_window_days double precision,
    category_effectiveness text,
    outcome_count integer DEFAULT 0,
    initiation_ratio double precision DEFAULT 0.5,
    last_initiated_by text,
    consecutive_user_initiations integer DEFAULT 0,
    total_user_initiations integer DEFAULT 0,
    total_friend_initiations integer DEFAULT 0,
    tier_fit_score double precision,
    tier_fit_last_calculated timestamptz,
    suggested_tier text,
    tier_suggestion_dismissed_at timestamptz,
    linked_user_id text,
    link_status text,
    linked_at timestamptz,
    server_link_id text,
    phone_number text,
    email text,
    contact_id text,
    preferred_messaging_app text,
    detected_themes_raw text,
    last_journal_sentiment double precision,
    journal_mention_count integer,
    reflection_activity_score double precision,
    needs_attention boolean,
    avg_weave_duration_minutes double precision,
    preferred_weave_types_raw text,
    best_time_of_day text,
    best_day_of_week integer,
    topic_clusters_raw text,
    topic_trend text,
    reconnection_attempts integer,
    successful_reconnections integer,
    last_reconnection_date timestamptz,
    synced_at timestamptz,
    sync_status text,
    server_updated_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- 4. interactions
CREATE TABLE IF NOT EXISTS public.interactions (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    interaction_date timestamptz NOT NULL,
    interaction_type text,
    duration text,
    vibe text,
    note text,
    activity text,
    status text,
    mode text,
    interaction_category text,
    reflection text,
    title text,
    location text,
    completion_prompted_at timestamptz,
    calendar_event_id text,
    event_importance text,
    initiator text,
    synced_at timestamptz,
    sync_status text,
    server_updated_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 5. interaction_friends (join table)
CREATE TABLE IF NOT EXISTS public.interaction_friends (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    interaction_id text NOT NULL REFERENCES public.interactions(id) ON DELETE CASCADE,
    friend_id text NOT NULL REFERENCES public.friends(id) ON DELETE CASCADE,
    synced_at timestamptz,
    sync_status text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 6. intentions
CREATE TABLE IF NOT EXISTS public.intentions (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    description text,
    interaction_category text,
    status text,
    last_reminded_at timestamptz,
    linked_interaction_id text,
    fulfilled_at timestamptz,
    days_to_fulfillment double precision,
    synced_at timestamptz,
    sync_status text,
    server_updated_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 7. intention_friends (join table)
CREATE TABLE IF NOT EXISTS public.intention_friends (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    intention_id text NOT NULL REFERENCES public.intentions(id) ON DELETE CASCADE,
    friend_id text NOT NULL REFERENCES public.friends(id) ON DELETE CASCADE,
    synced_at timestamptz,
    sync_status text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 8. life_events
CREATE TABLE IF NOT EXISTS public.life_events (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    friend_id text NOT NULL REFERENCES public.friends(id) ON DELETE CASCADE,
    event_type text,
    event_date timestamptz,
    title text,
    notes text,
    importance text,
    source text,
    is_recurring boolean DEFAULT false,
    reminded boolean DEFAULT false,
    synced_at timestamptz,
    sync_status text,
    server_updated_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 9. weekly_reflections
CREATE TABLE IF NOT EXISTS public.weekly_reflections (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    week_start_date timestamptz,
    week_end_date timestamptz,
    total_weaves integer,
    friends_contacted integer,
    top_activity text,
    top_activity_count integer,
    missed_friends_count integer,
    gratitude_text text,
    gratitude_prompt text,
    prompt_context text,
    story_chips text,
    completed_at timestamptz,
    synced_at timestamptz,
    sync_status text,
    server_updated_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- 10. journal_entries
CREATE TABLE IF NOT EXISTS public.journal_entries (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    entry_date timestamptz,
    title text,
    content text,
    story_chips text,
    is_draft boolean DEFAULT false,
    prompt_used text,
    linked_weave_id text,
    smart_actions_json text,
    synced_at timestamptz,
    sync_status text,
    server_updated_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 11. journal_entry_friends (join table)
CREATE TABLE IF NOT EXISTS public.journal_entry_friends (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    journal_entry_id text NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
    friend_id text NOT NULL REFERENCES public.friends(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- INTELLIGENCE & ANALYTICS TABLES
-- ============================================================================

-- 12. suggestion_events
CREATE TABLE IF NOT EXISTS public.suggestion_events (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    suggestion_id text NOT NULL,
    friend_id text NOT NULL,
    suggestion_type text,
    urgency text,
    action_type text,
    event_type text,
    event_timestamp timestamptz,
    friend_score_at_event double precision,
    days_since_last_interaction double precision,
    resulting_interaction_id text,
    time_to_action_minutes double precision,
    created_at timestamptz DEFAULT now()
);

-- 13. proactive_insights
CREATE TABLE IF NOT EXISTS public.proactive_insights (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    rule_id text,
    type text,
    friend_id text,
    headline text,
    body text,
    grounding_data_json text,
    source_signals_json text,
    action_type text,
    action_params_json text,
    action_label text,
    severity double precision,
    generated_at timestamptz,
    expires_at timestamptz,
    status text,
    feedback text,
    status_changed_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 14. conversation_threads
CREATE TABLE IF NOT EXISTS public.conversation_threads (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    friend_id text NOT NULL,
    topic text,
    first_mentioned timestamptz,
    last_mentioned timestamptz,
    mention_count integer,
    status text,
    sentiment text,
    source_entry_ids_raw text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 15. interaction_outcomes
CREATE TABLE IF NOT EXISTS public.interaction_outcomes (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    interaction_id text,
    friend_id text,
    score_before double precision,
    score_after double precision,
    score_change double precision,
    category text,
    duration text,
    vibe text,
    had_reflection boolean,
    expected_impact double precision,
    actual_impact double precision,
    effectiveness_ratio double precision,
    interaction_date timestamptz,
    measured_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- 16. portfolio_snapshots
CREATE TABLE IF NOT EXISTS public.portfolio_snapshots (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    snapshot_date timestamptz,
    overall_health_score double precision,
    total_friends integer,
    active_friends integer,
    drifting_friends integer,
    thriving_friends integer,
    inner_circle_avg double precision,
    close_friends_avg double precision,
    community_avg double precision,
    interactions_per_week double precision,
    diversity_score double precision,
    created_at timestamptz DEFAULT now()
);

-- 17. social_season_logs
CREATE TABLE IF NOT EXISTS public.social_season_logs (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    season text,
    start_date timestamptz,
    end_date timestamptz,
    manual_override boolean,
    battery_start double precision,
    battery_end double precision,
    suggestions_shown integer,
    suggestions_accepted integer,
    avg_interaction_rating double precision,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 18. social_battery_logs
CREATE TABLE IF NOT EXISTS public.social_battery_logs (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    value double precision,
    timestamp timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 19. network_health_logs
CREATE TABLE IF NOT EXISTS public.network_health_logs (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    score double precision,
    timestamp timestamptz,
    created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- ORACLE AI TABLES
-- ============================================================================

-- 20. oracle_insights
CREATE TABLE IF NOT EXISTS public.oracle_insights (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    insight_type text,
    content text,
    metadata text,
    valid_until timestamptz,
    created_at timestamptz DEFAULT now()
);

-- 21. oracle_usage
CREATE TABLE IF NOT EXISTS public.oracle_usage (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    endpoint text,
    tokens_used integer,
    cost_cents double precision,
    created_at timestamptz DEFAULT now()
);

-- 22. oracle_consultations
CREATE TABLE IF NOT EXISTS public.oracle_consultations (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    question text,
    response text,
    grounding_data_json text,
    context_tier_used text,
    tokens_used integer,
    turn_count integer,
    saved_to_journal boolean,
    journal_entry_id text,
    created_at timestamptz DEFAULT now()
);

-- 23. oracle_conversations
CREATE TABLE IF NOT EXISTS public.oracle_conversations (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    title text,
    context text,
    friend_id text,
    turns_json text,
    turn_count integer,
    is_archived boolean DEFAULT false,
    started_at timestamptz,
    last_message_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 24. oracle_context_cache
CREATE TABLE IF NOT EXISTS public.oracle_context_cache (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    context_type text,
    friend_id text,
    payload_json text,
    tokens_estimate integer,
    valid_until timestamptz,
    created_at timestamptz DEFAULT now()
);

-- 25. journal_signals
CREATE TABLE IF NOT EXISTS public.journal_signals (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    journal_entry_id text,
    sentiment double precision,
    sentiment_label text,
    core_themes_json text,
    emergent_themes_json text,
    dynamics_json text,
    confidence double precision,
    extracted_at timestamptz,
    extractor_version text,
    created_at timestamptz DEFAULT now()
);

-- 26. llm_quality_log
CREATE TABLE IF NOT EXISTS public.llm_quality_log (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    prompt_id text,
    prompt_version text,
    input_hash text,
    output_hash text,
    latency_ms integer,
    tokens_used integer,
    error_type text,
    user_feedback text,
    created_at timestamptz DEFAULT now()
);

-- 27. user_facts
CREATE TABLE IF NOT EXISTS public.user_facts (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    fact_content text,
    category text,
    confidence double precision,
    source text,
    relevant_friend_id text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- GROUPS & GAMIFICATION TABLES
-- ============================================================================

-- 28. groups
CREATE TABLE IF NOT EXISTS public.groups (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    name text NOT NULL,
    type text,
    smart_confidence double precision,
    photo_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 29. group_members
CREATE TABLE IF NOT EXISTS public.group_members (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    group_id text NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    friend_id text NOT NULL REFERENCES public.friends(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 30. friend_badges
CREATE TABLE IF NOT EXISTS public.friend_badges (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    friend_id text,
    badge_type text,
    badge_id text,
    tier integer,
    unlocked_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 31. achievement_unlocks
CREATE TABLE IF NOT EXISTS public.achievement_unlocks (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    achievement_id text,
    achievement_type text,
    related_friend_id text,
    unlocked_at timestamptz,
    has_been_celebrated boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 32. practice_log
CREATE TABLE IF NOT EXISTS public.practice_log (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    practice_date timestamptz,
    practice_type text,
    related_id text,
    created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- SYNC & INFRASTRUCTURE TABLES
-- ============================================================================

-- 33. shared_weave_refs
CREATE TABLE IF NOT EXISTS public.shared_weave_refs (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    interaction_id text,
    server_weave_id text,
    created_by_user_id text,
    is_creator boolean DEFAULT false,
    status text,
    role text,
    can_participant_edit boolean DEFAULT false,
    shared_at timestamptz,
    responded_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 34. sync_queue
CREATE TABLE IF NOT EXISTS public.sync_queue (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    operation_type text,
    payload text,
    status text,
    retry_count integer DEFAULT 0,
    last_error text,
    queued_at timestamptz,
    processed_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 35. pending_push_notifications
CREATE TABLE IF NOT EXISTS public.pending_push_notifications (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    recipient_user_id text,
    payload text,
    retry_count integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- 36. evening_digests
CREATE TABLE IF NOT EXISTS public.evening_digests (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    digest_date timestamptz,
    items_json text,
    notification_title text,
    notification_body text,
    item_count integer,
    created_at timestamptz DEFAULT now()
);

-- 37. custom_chips
CREATE TABLE IF NOT EXISTS public.custom_chips (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    chip_id text,
    chip_type text,
    plain_text text,
    template text,
    components text,
    usage_count integer DEFAULT 0,
    last_used_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 38. chip_usage
CREATE TABLE IF NOT EXISTS public.chip_usage (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    chip_id text,
    interaction_id text,
    friend_id text,
    chip_type text,
    is_custom boolean DEFAULT false,
    used_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- 39. event_suggestion_feedback
CREATE TABLE IF NOT EXISTS public.event_suggestion_feedback (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    calendar_event_id text,
    event_title text,
    event_date timestamptz,
    event_location text,
    suggested_friend_ids text,
    suggested_category text,
    action text,
    dismissal_reason text,
    corrected_friend_ids text,
    corrected_category text,
    snoozed_until timestamptz,
    snooze_type text,
    snoozed_friend_ids text,
    emotional_rating double precision,
    reflection_notes text,
    resulting_interaction_id text,
    confidence_score double precision,
    match_quality double precision,
    suggested_at timestamptz,
    responded_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================================

ALTER TABLE public.user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interaction_friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intention_friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.life_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestion_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proactive_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interaction_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_season_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_battery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_health_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oracle_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oracle_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oracle_consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oracle_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oracle_context_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_quality_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievement_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_weave_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_push_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evening_digests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_chips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chip_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_suggestion_feedback ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CREATE RLS POLICIES (Users can only access their own data)
-- ============================================================================

DO $$
DECLARE
    t text;
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
        -- Drop existing policies if any
        EXECUTE format('DROP POLICY IF EXISTS "Users can manage their own data" ON public.%I', t);
        
        -- Create select, insert, update, delete policy
        EXECUTE format('
            CREATE POLICY "Users can manage their own data" ON public.%I
            FOR ALL
            TO authenticated
            USING (user_id = auth.uid())
            WITH CHECK (user_id = auth.uid())
        ', t);
    END LOOP;
END $$;

-- ============================================================================
-- DONE!
-- ============================================================================
