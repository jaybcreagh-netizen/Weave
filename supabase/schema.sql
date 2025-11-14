-- =====================================================
-- Weave Backend Schema for Supabase PostgreSQL
-- =====================================================
-- This schema mirrors the WatermelonDB local database
-- and adds subscription/freemium model support
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USER SUBSCRIPTIONS & TIERS
-- =====================================================

CREATE TYPE subscription_tier AS ENUM ('free', 'plus', 'premium');
CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'past_due', 'trialing');

CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Subscription details
  tier subscription_tier NOT NULL DEFAULT 'free',
  status subscription_status NOT NULL DEFAULT 'active',

  -- Billing integration (Stripe/RevenueCat)
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,

  -- Dates
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one subscription per user
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only view their own subscription
CREATE POLICY "Users can view own subscription"
  ON user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can modify subscriptions (webhook from Stripe)
CREATE POLICY "Service role can manage subscriptions"
  ON user_subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================
-- USAGE TRACKING (for freemium limits)
-- =====================================================

CREATE TABLE usage_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Current period usage
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  -- Counters
  friends_count INT DEFAULT 0,
  weaves_this_month INT DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, period_start)
);

ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
  ON usage_tracking FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own usage"
  ON usage_tracking FOR UPDATE
  USING (auth.uid() = user_id);

-- =====================================================
-- CORE TABLES (mirroring WatermelonDB)
-- =====================================================

-- Friends table
CREATE TABLE friends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Core friend data
  name TEXT NOT NULL,
  dunbar_tier TEXT NOT NULL,
  archetype TEXT NOT NULL,
  weave_score NUMERIC DEFAULT 50,
  last_updated BIGINT NOT NULL,
  created_at BIGINT NOT NULL,
  photo_url TEXT,
  notes TEXT,

  -- Scoring mechanics
  resilience NUMERIC DEFAULT 1.0,
  rated_weaves_count INT DEFAULT 0,
  momentum_score NUMERIC DEFAULT 0,
  momentum_last_updated BIGINT,
  is_dormant BOOLEAN DEFAULT FALSE,
  dormant_since BIGINT,

  -- Life context
  birthday TEXT, -- MM-DD format
  anniversary TEXT, -- MM-DD format
  relationship_type TEXT,

  -- Adaptive learning
  typical_interval_days INT,
  tolerance_window_days INT,
  category_effectiveness JSONB,
  outcome_count INT DEFAULT 0,

  -- Reciprocity
  initiation_ratio NUMERIC DEFAULT 0.5,
  last_initiated_by TEXT,
  consecutive_user_initiations INT DEFAULT 0,
  total_user_initiations INT DEFAULT 0,
  total_friend_initiations INT DEFAULT 0,

  -- Sync metadata
  server_updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  created_at_ts TIMESTAMPTZ DEFAULT NOW(),
  updated_at_ts TIMESTAMPTZ DEFAULT NOW()
);

-- Interactions table
CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Core interaction data
  interaction_date BIGINT NOT NULL,
  interaction_type TEXT NOT NULL,
  duration TEXT,
  vibe TEXT,
  note TEXT,
  activity TEXT NOT NULL,
  status TEXT NOT NULL,
  mode TEXT NOT NULL,

  -- Enhanced data
  interaction_category TEXT,
  reflection JSONB,
  title TEXT,
  location TEXT,
  completion_prompted_at BIGINT,
  calendar_event_id TEXT,
  event_importance TEXT,
  initiator TEXT,

  -- Sync metadata
  server_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  created_at_ts TIMESTAMPTZ DEFAULT NOW(),
  updated_at_ts TIMESTAMPTZ DEFAULT NOW()
);

-- Join table for interactions <-> friends
CREATE TABLE interaction_friends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  interaction_id UUID REFERENCES interactions(id) ON DELETE CASCADE NOT NULL,
  friend_id UUID REFERENCES friends(id) ON DELETE CASCADE NOT NULL,

  server_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at_ts TIMESTAMPTZ DEFAULT NOW()
);

-- Intentions table
CREATE TABLE intentions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  description TEXT,
  interaction_category TEXT,
  status TEXT NOT NULL,
  last_reminded_at BIGINT,
  linked_interaction_id UUID,
  fulfilled_at BIGINT,
  days_to_fulfillment INT,

  server_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  created_at_ts TIMESTAMPTZ DEFAULT NOW(),
  updated_at_ts TIMESTAMPTZ DEFAULT NOW()
);

-- Join table for intentions <-> friends
CREATE TABLE intention_friends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  intention_id UUID REFERENCES intentions(id) ON DELETE CASCADE NOT NULL,
  friend_id UUID REFERENCES friends(id) ON DELETE CASCADE NOT NULL,

  server_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at_ts TIMESTAMPTZ DEFAULT NOW()
);

-- User profile table
CREATE TABLE user_profile (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Social season
  current_social_season TEXT,
  season_last_calculated BIGINT,
  season_history JSONB,

  -- Social battery
  social_battery_current INT,
  social_battery_last_checkin BIGINT,
  social_battery_history JSONB,

  -- Preferences
  battery_checkin_enabled BOOLEAN DEFAULT TRUE,
  battery_checkin_time TEXT DEFAULT '09:00',

  server_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,

  UNIQUE(user_id)
);

-- User progress table
CREATE TABLE user_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Streaks
  current_streak INT DEFAULT 0,
  best_streak INT DEFAULT 0,
  last_practice_date BIGINT,
  consistency_milestones JSONB,
  last_streak_count INT DEFAULT 0,
  streak_released_date BIGINT,
  longest_streak_ever INT DEFAULT 0,

  -- Reflections
  total_reflections INT DEFAULT 0,
  reflection_milestones JSONB,

  -- Friendships
  friendship_milestones JSONB,

  -- Progress counters
  catalyst_progress INT DEFAULT 0,
  high_priestess_progress INT DEFAULT 0,
  scribe_progress INT DEFAULT 0,
  curator_progress INT DEFAULT 0,

  -- Global achievements
  total_weaves INT DEFAULT 0,
  global_achievements JSONB,
  hidden_achievements JSONB,

  server_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,

  UNIQUE(user_id)
);

-- Life events table
CREATE TABLE life_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  friend_id UUID REFERENCES friends(id) ON DELETE CASCADE NOT NULL,

  event_type TEXT NOT NULL,
  event_date BIGINT NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  importance TEXT NOT NULL,
  source TEXT NOT NULL,
  is_recurring BOOLEAN DEFAULT FALSE,
  reminded BOOLEAN DEFAULT FALSE,

  server_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- Weekly reflections table
CREATE TABLE weekly_reflections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  week_start_date BIGINT NOT NULL,
  week_end_date BIGINT NOT NULL,
  total_weaves INT NOT NULL,
  friends_contacted INT NOT NULL,
  top_activity TEXT NOT NULL,
  top_activity_count INT NOT NULL,
  missed_friends_count INT NOT NULL,
  gratitude_text TEXT,
  gratitude_prompt TEXT,
  prompt_context TEXT,
  story_chips JSONB,
  completed_at BIGINT NOT NULL,

  server_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at BIGINT NOT NULL
);

-- Journal entries table
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  entry_date BIGINT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  story_chips JSONB,
  friend_ids JSONB,

  server_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Friends policies
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own friends"
  ON friends FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own friends"
  ON friends FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own friends"
  ON friends FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own friends"
  ON friends FOR DELETE
  USING (auth.uid() = user_id);

-- Interactions policies
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own interactions"
  ON interactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own interactions"
  ON interactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own interactions"
  ON interactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own interactions"
  ON interactions FOR DELETE
  USING (auth.uid() = user_id);

-- Interaction_friends policies
ALTER TABLE interaction_friends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own interaction_friends"
  ON interaction_friends FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own interaction_friends"
  ON interaction_friends FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own interaction_friends"
  ON interaction_friends FOR DELETE
  USING (auth.uid() = user_id);

-- Intentions policies
ALTER TABLE intentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own intentions"
  ON intentions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own intentions"
  ON intentions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own intentions"
  ON intentions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own intentions"
  ON intentions FOR DELETE
  USING (auth.uid() = user_id);

-- Intention_friends policies
ALTER TABLE intention_friends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own intention_friends"
  ON intention_friends FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own intention_friends"
  ON intention_friends FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own intention_friends"
  ON intention_friends FOR DELETE
  USING (auth.uid() = user_id);

-- User profile policies
ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON user_profile FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON user_profile FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON user_profile FOR UPDATE
  USING (auth.uid() = user_id);

-- User progress policies
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress"
  ON user_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON user_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON user_progress FOR UPDATE
  USING (auth.uid() = user_id);

-- Life events policies
ALTER TABLE life_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own life_events"
  ON life_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own life_events"
  ON life_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own life_events"
  ON life_events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own life_events"
  ON life_events FOR DELETE
  USING (auth.uid() = user_id);

-- Weekly reflections policies
ALTER TABLE weekly_reflections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own weekly_reflections"
  ON weekly_reflections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weekly_reflections"
  ON weekly_reflections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weekly_reflections"
  ON weekly_reflections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own weekly_reflections"
  ON weekly_reflections FOR DELETE
  USING (auth.uid() = user_id);

-- Journal entries policies
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own journal_entries"
  ON journal_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own journal_entries"
  ON journal_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own journal_entries"
  ON journal_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own journal_entries"
  ON journal_entries FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Friends indexes
CREATE INDEX idx_friends_user_id ON friends(user_id);
CREATE INDEX idx_friends_dunbar_tier ON friends(user_id, dunbar_tier);
CREATE INDEX idx_friends_is_dormant ON friends(user_id, is_dormant);

-- Interactions indexes
CREATE INDEX idx_interactions_user_id ON interactions(user_id);
CREATE INDEX idx_interactions_date ON interactions(user_id, interaction_date);
CREATE INDEX idx_interactions_status ON interactions(user_id, status);

-- Join table indexes
CREATE INDEX idx_interaction_friends_interaction ON interaction_friends(interaction_id);
CREATE INDEX idx_interaction_friends_friend ON interaction_friends(friend_id);
CREATE INDEX idx_intention_friends_intention ON intention_friends(intention_id);
CREATE INDEX idx_intention_friends_friend ON intention_friends(friend_id);

-- Life events indexes
CREATE INDEX idx_life_events_friend ON life_events(friend_id);
CREATE INDEX idx_life_events_date ON life_events(event_date);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at_ts = NOW();
  NEW.server_updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_friends_updated_at BEFORE UPDATE ON friends
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interactions_updated_at BEFORE UPDATE ON interactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_intentions_updated_at BEFORE UPDATE ON intentions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profile_updated_at BEFORE UPDATE ON user_profile
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_progress_updated_at BEFORE UPDATE ON user_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_life_events_updated_at BEFORE UPDATE ON life_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Initialize subscription on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create free tier subscription for new user
  INSERT INTO user_subscriptions (user_id, tier, status)
  VALUES (NEW.id, 'free', 'active');

  -- Initialize usage tracking
  INSERT INTO usage_tracking (user_id, period_start, period_end)
  VALUES (
    NEW.id,
    DATE_TRUNC('month', NOW()),
    DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
