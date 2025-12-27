-- ═══════════════════════════════════════════════════════════════════════════
-- WEAVE: Accounts & Sharing Extensions
-- ═══════════════════════════════════════════════════════════════════════════
-- Run this AFTER the main schema.sql to add sharing features
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. USER PROFILES (for sharing/linking)
-- Public-facing profile info for friend discovery
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(30) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  photo_url TEXT,
  push_token TEXT,
  discoverable_by_username BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can search by username" ON user_profiles FOR SELECT USING (discoverable_by_username = true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. FRIEND LINKS
-- Bi-directional connections between Weave users
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS friend_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  user_a_friend_id VARCHAR(36),
  user_b_friend_id VARCHAR(36),
  status VARCHAR(20) DEFAULT 'pending',
  initiated_by UUID NOT NULL REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  linked_at TIMESTAMPTZ,
  UNIQUE(user_a_id, user_b_id),
  CHECK (user_a_id != user_b_id)
);

ALTER TABLE friend_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own links" ON friend_links FOR SELECT USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);
CREATE POLICY "Users can create link requests" ON friend_links FOR INSERT WITH CHECK (auth.uid() = initiated_by AND auth.uid() = user_a_id);
CREATE POLICY "Users can update own links" ON friend_links FOR UPDATE USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

CREATE INDEX IF NOT EXISTS idx_friend_links_user_a ON friend_links(user_a_id);
CREATE INDEX IF NOT EXISTS idx_friend_links_user_b ON friend_links(user_b_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. SHARED WEAVES
-- Server record for weaves shared between users
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shared_weaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  weave_date TIMESTAMPTZ NOT NULL,
  title VARCHAR(200),
  location VARCHAR(200),
  category VARCHAR(50) NOT NULL,
  duration VARCHAR(20),
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE shared_weaves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own weaves" ON shared_weaves FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "Users can create weaves" ON shared_weaves FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creator can update weave" ON shared_weaves FOR UPDATE USING (auth.uid() = created_by);

CREATE INDEX IF NOT EXISTS idx_shared_weaves_created_by ON shared_weaves(created_by);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. SHARED WEAVE PARTICIPANTS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shared_weave_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_weave_id UUID NOT NULL REFERENCES shared_weaves(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  local_interaction_id VARCHAR(36),
  response VARCHAR(20) DEFAULT 'pending',
  responded_at TIMESTAMPTZ,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shared_weave_id, user_id)
);

ALTER TABLE shared_weave_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own participations" ON shared_weave_participants FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Creator can add participants" ON shared_weave_participants FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM shared_weaves WHERE id = shared_weave_id AND created_by = auth.uid())
);
CREATE POLICY "Users can update own participation" ON shared_weave_participants FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_participants_user ON shared_weave_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_response ON shared_weave_participants(response);

-- Add the participant view policy to shared_weaves AFTER the participants table exists
CREATE POLICY "Participants can view shared weaves" ON shared_weaves FOR SELECT USING (
  id IN (SELECT shared_weave_id FROM shared_weave_participants WHERE user_id = auth.uid())
);

-- ═══════════════════════════════════════════════════════════════════════════
-- DONE! Now enable realtime separately in Supabase Dashboard:
-- 1. Go to Database > Replication
-- 2. Enable for tables: friend_links, shared_weave_participants
-- ═══════════════════════════════════════════════════════════════════════════
