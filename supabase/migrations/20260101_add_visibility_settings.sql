-- ═══════════════════════════════════════════════════════════════════════════
-- ADD VISIBILITY SETTINGS COLUMN TO USER_PROFILES
-- ═══════════════════════════════════════════════════════════════════════════
-- This migration adds the visibility_settings JSONB column required by:
--   - archetype-sync.service.ts (lines 40, 103)
--   - VisibilitySettings.tsx component
-- ═══════════════════════════════════════════════════════════════════════════

-- Add visibility settings (JSON for flexible per-field visibility)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS visibility_settings JSONB DEFAULT '{
  "displayName": "friends",
  "archetype": "friends",
  "birthday": "friends"
}'::jsonb;

-- ═══════════════════════════════════════════════════════════════════════════
-- DONE! visibility_settings column added to user_profiles.
-- ═══════════════════════════════════════════════════════════════════════════
