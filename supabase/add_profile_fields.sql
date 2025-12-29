-- ═══════════════════════════════════════════════════════════════════════════
-- USER PROFILES: Add Birthday, Archetype, Timezone
-- ═══════════════════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor to add new profile fields
-- ═══════════════════════════════════════════════════════════════════════════

-- Add birthday field (date only, no time)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS birthday DATE;

-- Add archetype field (one of the 8 archetypes)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS archetype VARCHAR(30);

-- Add timezone field
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';

-- Add visibility settings (JSON for flexible per-field visibility)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS visibility_settings JSONB DEFAULT '{
  "displayName": "friends",
  "archetype": "friends",
  "birthday": "friends"
}'::jsonb;

-- Add discoverability toggle (might already exist from initial schema)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS discoverable_by_username BOOLEAN DEFAULT true;

-- ═══════════════════════════════════════════════════════════════════════════
-- DONE! User profiles now include birthday, archetype, timezone, and visibility.
-- ═══════════════════════════════════════════════════════════════════════════
