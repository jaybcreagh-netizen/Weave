-- ═══════════════════════════════════════════════════════════════════════════
-- USER PROFILES: Add Birthday and Archetype
-- ═══════════════════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor to add new profile fields
-- ═══════════════════════════════════════════════════════════════════════════

-- Add birthday field (date only, no time)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS birthday DATE;

-- Add archetype field (one of the 8 archetypes)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS archetype VARCHAR(30);

-- Add discoverability toggle (might already exist from initial schema)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS discoverable_by_username BOOLEAN DEFAULT true;

-- ═══════════════════════════════════════════════════════════════════════════
-- DONE! User profiles now include birthday and archetype.
-- ═══════════════════════════════════════════════════════════════════════════
